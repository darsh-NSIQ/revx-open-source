/**
 * Exchange rates: typed into Setup, or fetched from a provider (Frankfurter, the free ECB
 * feed, or any Apex class named in Setup > Plugins implementing Provider). A fetch keeps a
 * dated Exchange_Rate__c row per currency and publishes the markets' rates as a new settings
 * version, so pricing picks them up the same way as rates an admin typed.
 */
public with sharing class RevquilaFx {
  public interface Provider {
    /** Units of each wanted currency per one unit of `base`, today. */
    Map<String, Decimal> rates(String base, Set<String> wanted);
  }

  public class Frankfurter implements Provider {
    public Map<String, Decimal> rates(String base, Set<String> wanted) {
      Map<String, Decimal> found = new Map<String, Decimal>();
      if (wanted.isEmpty()) {
        return found;
      }
      String endpoint =
        'https://api.frankfurter.app/latest?from=' +
        base +
        '&to=' +
        String.join(new List<String>(wanted), ',');
      HttpRequest request = new HttpRequest();
      request.setEndpoint(endpoint);
      request.setMethod('GET');
      request.setTimeout(20000);
      HttpResponse response = new Http().send(request);
      RevquilaCore.log('fx', endpoint, response.getStatusCode() == 200 ? 'ok' : 'failed', null, response.getBody(), null);
      if (response.getStatusCode() != 200) {
        return found;
      }
      Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
      if (body.get('rates') instanceof Map<String, Object>) {
        for (String code : ((Map<String, Object>) body.get('rates')).keySet()) {
          found.put(code, Decimal.valueOf(String.valueOf(((Map<String, Object>) body.get('rates')).get(code))));
        }
      }
      return found;
    }
  }

  public static Provider provider() {
    RevquilaSettings settings = RevquilaSettings.current();
    String name = settings.plugins.get('fx');
    if (String.isBlank(name)) {
      name = settings.fxProvider;
    }
    if (name == 'frankfurter') {
      return new Frankfurter();
    }
    if (String.isBlank(name) || name == 'none') {
      return null;
    }
    try {
      Object instance = Type.forName(name).newInstance();
      if (instance instanceof Provider) {
        return (Provider) instance;
      }
    } catch (Exception e) {
      RevquilaCore.log('fx', name, 'failed', null, e.getMessage(), null);
    }
    return null;
  }

  /** Fetches today's rates for every market and publishes them. Returns what changed, in words. */
  public static String fetch() {
    Provider source = provider();
    RevquilaCore.need(source != null, 'Pick a rate provider in Setup > Tax & currency first.');
    RevquilaSettings settings = RevquilaSettings.current();
    Set<String> wanted = new Set<String>();
    for (RevquilaSettings.Market market : settings.markets) {
      if (market.currencyCode != settings.home.currencyCode) {
        wanted.add(market.currencyCode);
      }
    }
    RevquilaCore.need(!wanted.isEmpty(), 'Add another country in Setup > Tax & currency first.');
    Map<String, Decimal> rates = source.rates(settings.home.currencyCode, wanted);
    RevquilaCore.need(!rates.isEmpty(), 'The provider returned no rates.');
    List<Exchange_Rate__c> rows = new List<Exchange_Rate__c>();
    for (String code : rates.keySet()) {
      rows.add(
        new Exchange_Rate__c(
          Currency_Code__c = code,
          Rate__c = rates.get(code).setScale(6, RoundingMode.HALF_UP),
          Effective_On__c = Date.today(),
          Source__c = source instanceof Frankfurter ? 'Frankfurter (ECB)' : 'Provider'
        )
      );
    }
    Database.insert(rows, false, AccessLevel.SYSTEM_MODE);
    Integer changed = publishRates(rates);
    return changed + ' of ' + wanted.size() + ' rates updated and published';
  }

  // Writes the rates into the markets of the live settings and publishes that as a new version
  private static Integer publishRates(Map<String, Decimal> rates) {
    List<Config_Version__c> latest = [
      SELECT Payload__c, Version__c
      FROM Config_Version__c
      WITH SYSTEM_MODE
      ORDER BY Version__c DESC
      LIMIT 1
    ];
    RevquilaCore.need(!latest.isEmpty(), 'Publish the settings once in Setup before fetching rates.');
    Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(latest[0].Payload__c);
    Integer changed = 0;
    if (root.get('markets') instanceof List<Object>) {
      for (Object row : (List<Object>) root.get('markets')) {
        Map<String, Object> market = (Map<String, Object>) row;
        String code = String.valueOf(market.get('currency'));
        if (rates.containsKey(code)) {
          market.put('exchangeRate', rates.get(code).setScale(6, RoundingMode.HALF_UP));
          changed++;
        }
      }
    }
    if (changed > 0) {
      Database.insert(
        new Config_Version__c(
          Version__c = latest[0].Version__c + 1,
          Payload__c = JSON.serialize(root),
          Note__c = 'Exchange rates fetched ' + RevquilaCore.dayText(Date.today())
        ),
        true,
        AccessLevel.SYSTEM_MODE
      );
    }
    return changed;
  }

  /** The rate on a day for a currency, from the fetched history, or null when none was kept. */
  public static Decimal rateOn(String currencyCode, Date day) {
    List<Exchange_Rate__c> rows = [
      SELECT Rate__c
      FROM Exchange_Rate__c
      WHERE Currency_Code__c = :currencyCode AND Effective_On__c <= :day
      WITH USER_MODE
      ORDER BY Effective_On__c DESC
      LIMIT 1
    ];
    return rows.isEmpty() ? null : rows[0].Rate__c;
  }
}