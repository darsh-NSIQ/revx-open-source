/**
 * Tax for an amount: the built-in engine (Setup > Tax: modes, regions, categories, exemptions),
 * an Avalara AvaTax adapter, or any Apex class named in Setup > Plugins that implements Provider.
 * Also the VAT-number format check and the e-invoice payload (India GST schema).
 */
public with sharing class RevquilaTaxEngine {
  public class Request {
    public Decimal amount;
    public String region;
    public String country;
    public String category;
    public Boolean exempt = false;
    public String exemptionReason;
    public RevquilaSettings.Market market;
    public Id accountId;
    public String postalCode;
  }

  /** What a tax provider has to do: tax one amount for one place. */
  public interface Provider {
    RevquilaPricing.TaxResult tax(Request request);
  }

  /** The provider Setup names: builtin, avalara, or an Apex class implementing Provider. */
  public static Provider provider() {
    RevquilaSettings settings = RevquilaSettings.current();
    String name = settings.plugins.get('tax');
    if (String.isBlank(name)) {
      name = settings.taxProvider;
    }
    if (String.isBlank(name) || name == 'builtin') {
      return new BuiltIn();
    }
    if (name == 'avalara') {
      return new Avalara();
    }
    try {
      Type custom = Type.forName(name);
      Object instance = custom == null ? null : custom.newInstance();
      if (instance instanceof Provider) {
        return (Provider) instance;
      }
    } catch (Exception e) {
      RevquilaCore.log('tax', name, 'failed', null, e.getMessage(), null);
    }
    return new BuiltIn();
  }

  /** The built-in engine. Exempt customers pay no tax; a product category can carry its own rate. */
  public class BuiltIn implements Provider {
    public RevquilaPricing.TaxResult tax(Request request) {
      RevquilaSettings.Market market = request.market == null
        ? RevquilaSettings.current().home
        : request.market;
      if (request.exempt == true && RevquilaSettings.current().taxExemptions) {
        RevquilaPricing.TaxResult none = new RevquilaPricing.TaxResult();
        none.net = RevquilaCore.money(request.amount);
        none.total = none.net;
        none.tax = 0;
        if (market.taxMode != 'none') {
          RevquilaPricing.TaxLine line = new RevquilaPricing.TaxLine();
          line.label = 'Exempt' + (String.isBlank(request.exemptionReason) ? '' : ' · ' + request.exemptionReason);
          line.rate = 0;
          line.amount = 0;
          none.lines.add(line);
        }
        return none;
      }
      Decimal rateOverride;
      if (
        String.isNotBlank(request.category) &&
        market.categoryRates.containsKey(request.category.toLowerCase())
      ) {
        rateOverride = market.categoryRates.get(request.category.toLowerCase());
      }
      return RevquilaPricing.taxOn(request.amount, request.region, market, rateOverride);
    }
  }

  /**
   * Avalara AvaTax: one CreateTransaction call per amount (the sandbox host until a
   * production key is set). The key goes in Setup > Integrations (Revquila Secrets), never
   * in the configuration. Falls back to the built-in engine when the call fails.
   */
  public class Avalara implements Provider {
    public RevquilaPricing.TaxResult tax(Request request) {
      Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
      String key = secrets == null ? null : secrets.Tax_Api_Key__c;
      if (String.isBlank(key)) {
        return new BuiltIn().tax(request);
      }
      try {
        HttpRequest http = new HttpRequest();
        Boolean sandbox = key.startsWith('sandbox:');
        String token = sandbox ? key.substringAfter('sandbox:') : key;
        http.setEndpoint(
          (sandbox ? 'https://sandbox-rest.avatax.com' : 'https://rest.avatax.com') +
          '/api/v2/transactions/create'
        );
        http.setMethod('POST');
        http.setHeader('Content-Type', 'application/json');
        http.setHeader('Authorization', 'Basic ' + token);
        http.setTimeout(20000);
        Map<String, Object> body = new Map<String, Object>{
          'type' => 'SalesOrder',
          'companyCode' => 'DEFAULT',
          'date' => String.valueOf(Date.today()),
          'customerCode' => String.valueOf(request.accountId),
          'currencyCode' => request.market == null ? 'USD' : request.market.currencyCode,
          'addresses' => new Map<String, Object>{
            'shipTo' => new Map<String, Object>{
              'region' => request.region,
              'country' => request.country,
              'postalCode' => request.postalCode
            }
          },
          'lines' => new List<Object>{
            new Map<String, Object>{ 'amount' => request.amount, 'taxCode' => request.category }
          }
        };
        http.setBody(JSON.serialize(body));
        HttpResponse response = new Http().send(http);
        RevquilaCore.log('tax', http.getEndpoint(), response.getStatusCode() == 201 ? 'ok' : 'failed', JSON.serialize(body), response.getBody(), request.accountId);
        if (response.getStatusCode() != 201) {
          return new BuiltIn().tax(request);
        }
        Map<String, Object> answer = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
        RevquilaPricing.TaxResult result = new RevquilaPricing.TaxResult();
        result.net = RevquilaCore.money(request.amount);
        result.tax = RevquilaCore.money((Decimal) answer.get('totalTax'));
        result.total = RevquilaCore.money(result.net + result.tax);
        if (answer.get('summary') instanceof List<Object>) {
          for (Object row : (List<Object>) answer.get('summary')) {
            Map<String, Object> summary = (Map<String, Object>) row;
            RevquilaPricing.TaxLine line = new RevquilaPricing.TaxLine();
            line.label = String.valueOf(summary.get('taxName'));
            line.rate = summary.get('rate') == null ? 0 : (Decimal) summary.get('rate') * 100;
            line.amount = RevquilaCore.money((Decimal) summary.get('tax'));
            result.lines.add(line);
          }
        }
        if (result.lines.isEmpty() && result.tax > 0) {
          RevquilaPricing.TaxLine line = new RevquilaPricing.TaxLine();
          line.label = 'Tax';
          line.rate = 0;
          line.amount = result.tax;
          result.lines.add(line);
        }
        return result;
      } catch (Exception e) {
        RevquilaCore.log('tax', 'avalara', 'failed', null, e.getMessage(), request.accountId);
        return new BuiltIn().tax(request);
      }
    }
  }

  // ---------------------------------------------------------------- VAT numbers

  private static final Map<String, String> VAT_PATTERNS = new Map<String, String>{
    'AT' => 'ATU[0-9]{8}',
    'BE' => 'BE[01][0-9]{9}',
    'BG' => 'BG[0-9]{9,10}',
    'CY' => 'CY[0-9]{8}[A-Z]',
    'CZ' => 'CZ[0-9]{8,10}',
    'DE' => 'DE[0-9]{9}',
    'DK' => 'DK[0-9]{8}',
    'EE' => 'EE[0-9]{9}',
    'ES' => 'ES[A-Z0-9][0-9]{7}[A-Z0-9]',
    'FI' => 'FI[0-9]{8}',
    'FR' => 'FR[A-Z0-9]{2}[0-9]{9}',
    'GB' => 'GB([0-9]{9}|[0-9]{12}|GD[0-9]{3}|HA[0-9]{3})',
    'GR' => 'EL[0-9]{9}',
    'HR' => 'HR[0-9]{11}',
    'HU' => 'HU[0-9]{8}',
    'IE' => 'IE[0-9][A-Z0-9+*][0-9]{5}[A-Z]{1,2}',
    'IN' => '[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]',
    'IT' => 'IT[0-9]{11}',
    'LT' => 'LT([0-9]{9}|[0-9]{12})',
    'LU' => 'LU[0-9]{8}',
    'LV' => 'LV[0-9]{11}',
    'MT' => 'MT[0-9]{8}',
    'NL' => 'NL[0-9]{9}B[0-9]{2}',
    'PL' => 'PL[0-9]{10}',
    'PT' => 'PT[0-9]{9}',
    'RO' => 'RO[0-9]{2,10}',
    'SE' => 'SE[0-9]{12}',
    'SI' => 'SI[0-9]{8}',
    'SK' => 'SK[0-9]{10}',
    'AU' => '[0-9]{11}',
    'NZ' => '[0-9]{8,9}',
    'SG' => '[0-9]{8,9}[A-Z]|[A-Z][0-9]{8}[A-Z]|[0-9]{9}[A-Z]|[0-9]{10}[A-Z]',
    'AE' => '1[0-9]{14}'
  };

  /** Whether a registration number has the shape the country uses. Unknown country: true. */
  public static Boolean looksValid(String countryCode, String registration) {
    if (String.isBlank(registration) || String.isBlank(countryCode)) {
      return true;
    }
    String shape = VAT_PATTERNS.get(countryCode.toUpperCase());
    if (shape == null) {
      return true;
    }
    return Pattern.matches(shape, registration.replaceAll('[\\s-]', '').toUpperCase());
  }

  // ---------------------------------------------------------------- e-invoice (India GST IRP schema, subset)

  /** The invoice in the GST e-invoice JSON format (schema 1.1, the fields the IRP needs). */
  public static String eInvoicePayload(Invoice__c invoice, List<Invoice_Line__c> lines) {
    RevquilaSettings settings = RevquilaSettings.current();
    Map<String, Object> seller = new Map<String, Object>{
      'Gstin' => '',
      'LglNm' => settings.companyName,
      'Loc' => settings.homeRegion,
      'Pin' => 0,
      'Stcd' => ''
    };
    Map<String, Object> buyer = new Map<String, Object>{
      'Gstin' => invoice.Account__r == null ? '' : invoice.Account__r.Tax_Registration_Number__c,
      'LglNm' => invoice.Account__r == null ? '' : invoice.Account__r.Name,
      'Pos' => invoice.Region__c,
      'Loc' => invoice.Account__r == null ? '' : invoice.Account__r.BillingCity,
      'Pin' => 0,
      'Stcd' => ''
    };
    List<Object> items = new List<Object>();
    Integer position = 0;
    Decimal taxRate = settings.home.taxRate;
    Boolean split = false;
    for (RevquilaPricing.TaxLine line : RevquilaPricing.taxLines(invoice.Tax_Breakup__c)) {
      if (line.label != null && line.label.startsWith(settings.home.splitLabels[0])) {
        split = true;
      }
    }
    for (Invoice_Line__c line : lines) {
      position++;
      Decimal net = RevquilaCore.orZero(line.Net_Amount__c);
      Decimal tax = RevquilaCore.money(net * taxRate / 100);
      items.add(
        new Map<String, Object>{
          'SlNo' => String.valueOf(position),
          'PrdDesc' => line.Description__c,
          'IsServc' => 'Y',
          'HsnCd' => '998314',
          'Qty' => line.Quantity__c,
          'Unit' => 'OTH',
          'UnitPrice' => line.Unit_Price__c,
          'TotAmt' => line.List_Amount__c,
          'Discount' => RevquilaCore.money(RevquilaCore.orZero(line.List_Amount__c) - net),
          'AssAmt' => net,
          'GstRt' => taxRate,
          'IgstAmt' => split ? 0 : tax,
          'CgstAmt' => split ? RevquilaCore.money(tax / 2) : 0,
          'SgstAmt' => split ? RevquilaCore.money(tax / 2) : 0,
          'TotItemVal' => RevquilaCore.money(net + tax)
        }
      );
    }
    Map<String, Object> payload = new Map<String, Object>{
      'Version' => '1.1',
      'TranDtls' => new Map<String, Object>{ 'TaxSch' => 'GST', 'SupTyp' => 'B2B' },
      'DocDtls' => new Map<String, Object>{
        'Typ' => 'INV',
        'No' => invoice.Number__c,
        'Dt' => invoice.Issued_On__c == null ? '' : invoice.Issued_On__c.format()
      },
      'SellerDtls' => seller,
      'BuyerDtls' => buyer,
      'ItemList' => items,
      'ValDtls' => new Map<String, Object>{
        'AssVal' => invoice.Net_Amount__c,
        'IgstVal' => split ? 0 : invoice.Tax_Amount__c,
        'CgstVal' => split ? RevquilaCore.money(RevquilaCore.orZero(invoice.Tax_Amount__c) / 2) : 0,
        'SgstVal' => split ? RevquilaCore.money(RevquilaCore.orZero(invoice.Tax_Amount__c) / 2) : 0,
        'TotInvVal' => invoice.Total__c
      }
    };
    return JSON.serializePretty(payload);
  }
}