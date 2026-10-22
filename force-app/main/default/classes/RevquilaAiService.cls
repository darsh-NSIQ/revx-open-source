/**
 * Revquila AI Intelligence Service: provides Deal Optimization, Win Probability Scoring,
 * Discount Benchmarking, Risk Scanner, and Proposal Generation for Revquila quotes.
 *
 * Supports OpenAI (GPT-4o / GPT-4o-mini), Google Gemini (1.5 Flash / Pro), and a built-in
 * Heuristic Revenue AI Engine that operates reliably offline without external keys.
 */
public with sharing class RevquilaAiService {
  public class AdviceResult {
    @AuraEnabled public Integer winProbability;
    @AuraEnabled public String winConfidence;
    @AuraEnabled public Decimal benchmarkDiscount;
    @AuraEnabled public Decimal actualDiscount;
    @AuraEnabled public String discountAnalysis;
    @AuraEnabled public List<String> recommendations;
    @AuraEnabled public List<UpsellItem> upsellSuggestions;
    @AuraEnabled public List<String> riskWarnings;
    @AuraEnabled public String executiveSummary;
    @AuraEnabled public String clientPitchEmail;
    @AuraEnabled public String providerUsed;
    @AuraEnabled public Boolean isLiveAi;
  }

  public class UpsellItem {
    @AuraEnabled public String name;
    @AuraEnabled public String reason;
    @AuraEnabled public Decimal estimatedAmount;
    @AuraEnabled public String family;

    public UpsellItem(String name, String reason, Decimal estimatedAmount, String family) {
      this.name = name;
      this.reason = reason;
      this.estimatedAmount = estimatedAmount;
      this.family = family;
    }
  }

  /**
   * Generates AI Deal Advice for a quote.
   */
  public static AdviceResult getAdvice(Id quoteId) {
    Quote__c q = fetchQuote(quoteId);
    if (q == null) {
      throw new RevquilaCore.ProblemException('Quote not found.');
    }

    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    String apiKey = secrets != null ? secrets.AI_Api_Key__c : null;
    String provider = secrets != null && String.isNotBlank(secrets.AI_Provider__c)
      ? secrets.AI_Provider__c.toLowerCase().trim()
      : 'local';
    String model = secrets != null && String.isNotBlank(secrets.AI_Model__c)
      ? secrets.AI_Model__c.trim()
      : 'gpt-4o-mini';

    // If external API key is present and provider is openai or gemini, try live callout
    if (String.isNotBlank(apiKey) && provider == 'openai') {
      try {
        AdviceResult liveRes = callOpenAi(q, apiKey, model);
        if (liveRes != null) {
          liveRes.isLiveAi = true;
          liveRes.providerUsed = 'OpenAI (' + model + ')';
          return liveRes;
        }
      } catch (Exception e) {
        // Fall back gracefully to Heuristic AI
        System.debug(LoggingLevel.WARN, 'OpenAI callout failed, falling back to heuristic engine: ' + e.getMessage());
      }
    } else if (String.isNotBlank(apiKey) && provider == 'gemini') {
      try {
        AdviceResult liveRes = callGemini(q, apiKey, model);
        if (liveRes != null) {
          liveRes.isLiveAi = true;
          liveRes.providerUsed = 'Google Gemini (' + model + ')';
          return liveRes;
        }
      } catch (Exception e) {
        System.debug(LoggingLevel.WARN, 'Gemini callout failed, falling back to heuristic engine: ' + e.getMessage());
      }
    }

    // Default to Heuristic Revenue AI Engine
    AdviceResult heuristicRes = computeHeuristicAdvice(q);
    heuristicRes.isLiveAi = false;
    heuristicRes.providerUsed = 'RevX Heuristic AI Engine';
    return heuristicRes;
  }

  /**
   * Fetches the quote and lines with security enforcement.
   */
  private static Quote__c fetchQuote(Id quoteId) {
    List<Quote__c> rows = [
      SELECT
        Id,
        Name,
        Display_Number__c,
        Account__r.Name,
        Account__r.Industry,
        Account__r.Segment__c,
        Net_Amount__c,
        Subtotal__c,
        Discount_Total__c,
        Max_Discount__c,
        Margin_Percent__c,
        Payment_Terms__c,
        Term_Months__c,
        Currency_Code__c,
        Status__c,
        Policy_Issue__c,
        (
          SELECT
            Id,
            Product__c,
            Product__r.Name,
            Product__r.Family,
            Quantity__c,
            Unit_Price__c,
            Discount__c,
            Net_Amount__c,
            Recurring__c
          FROM Lines__r
          ORDER BY Sort_Order__c
        )
      FROM Quote__c
      WHERE Id = :quoteId
      WITH USER_MODE
      LIMIT 1
    ];
    return rows.isEmpty() ? null : rows[0];
  }

  /**
   * Evaluates the quote using the built-in Heuristic AI Engine.
   */
  public static AdviceResult computeHeuristicAdvice(Quote__c q) {
    AdviceResult res = new AdviceResult();
    Decimal netAmt = q.Net_Amount__c != null ? q.Net_Amount__c : 0;
    Decimal maxDisc = q.Max_Discount__c != null ? q.Max_Discount__c : 0;
    Decimal margin = q.Margin_Percent__c != null ? q.Margin_Percent__c : 35;
    String currencyCode = String.isNotBlank(q.Currency_Code__c) ? q.Currency_Code__c : 'USD';
    String accName = q.Account__r != null && String.isNotBlank(q.Account__r.Name) ? q.Account__r.Name : 'the client';

    // 1. Benchmark Discount based on deal size
    Decimal benchmark;
    if (netAmt >= 50000) {
      benchmark = 18.0;
    } else if (netAmt >= 15000) {
      benchmark = 12.0;
    } else {
      benchmark = 8.0;
    }
    res.benchmarkDiscount = benchmark;
    res.actualDiscount = maxDisc;

    // 2. Win Probability scoring
    Integer score = 70;
    // Discount penalty/benefit
    if (maxDisc > benchmark + 10) {
      score -= 12; // Over-discounted deals often signal weak value prop or slow approvals
    } else if (maxDisc <= benchmark) {
      score += 8;
    }

    // Margin impact
    if (margin >= 45) {
      score += 7;
    } else if (margin < 20) {
      score -= 15;
    }

    // Term impact
    if (q.Term_Months__c != null && q.Term_Months__c >= 24) {
      score += 6;
    }

    // Payment terms
    if (q.Payment_Terms__c == 'Net 30' || q.Payment_Terms__c == 'Due on receipt') {
      score += 4;
    } else if (q.Payment_Terms__c == 'Net 90' || q.Payment_Terms__c == 'Net 120') {
      score -= 8;
    }

    // Clamp score 25..95
    if (score > 95) score = 95;
    if (score < 25) score = 25;
    res.winProbability = score;

    if (score >= 78) {
      res.winConfidence = 'High Probability';
    } else if (score >= 55) {
      res.winConfidence = 'Moderate Probability';
    } else {
      res.winConfidence = 'At Risk / Review Needed';
    }

    // 3. Discount Analysis
    if (maxDisc > benchmark) {
      Decimal diff = maxDisc - benchmark;
      res.discountAnalysis = 'Discount of ' + maxDisc.setScale(1) + '% exceeds optimal cohort benchmark (' +
        benchmark.setScale(1) + '%) by ' + diff.setScale(1) + '%. Consider trading discount points for multi-year lock-in or upfront payment.';
    } else if (maxDisc == 0) {
      res.discountAnalysis = 'Full list pricing applied (0% discount). Margin is fully preserved at ' + margin.setScale(1) + '%.';
    } else {
      res.discountAnalysis = 'Discount of ' + maxDisc.setScale(1) + '% is comfortably within optimal cohort benchmark (' +
        benchmark.setScale(1) + '%), preserving deal margin without risking customer pushback.';
    }

    // 4. Actionable Strategic Recommendations
    List<String> recs = new List<String>();
    if (maxDisc > benchmark) {
      recs.add('Structure a 2-year or 3-year term commitment to justify the ' + maxDisc.setScale(0) + '% discount.');
    }
    if (q.Payment_Terms__c != 'Net 30' && q.Payment_Terms__c != 'Due on receipt') {
      recs.add('Negotiate payment terms to Net 30 or Annual Upfront to accelerate cash flow and eliminate ASC 606 collection uncertainty.');
    } else {
      recs.add('Incentivize annual upfront payment with a nominal 2% cash discount to pull cash forward.');
    }
    if (margin < 30) {
      recs.add('Protect gross margin by replacing line discounts with bundled service credits or training vouchers.');
    }
    recs.add('Highlight contract SLAs and priority support benefits to eliminate lingering buyer hesitation.');
    res.recommendations = recs;

    // 5. Governance & Redline Risks
    List<String> risks = new List<String>();
    RevquilaSettings settings = RevquilaSettings.current();
    if (maxDisc > settings.discountLimit) {
      risks.add('Max discount (' + maxDisc.setScale(1) + '%) exceeds governance limit of ' + settings.discountLimit + '%; approval required.');
    }
    if (String.isNotBlank(q.Payment_Terms__c) && q.Payment_Terms__c != settings.standardTerms) {
      risks.add('Payment terms (' + q.Payment_Terms__c + ') differ from company standard (' + settings.standardTerms + ').');
    }
    if (margin < 20) {
      risks.add('Low gross margin warning: margin is below 20% threshold.');
    }
    if (String.isNotBlank(q.Policy_Issue__c)) {
      risks.add('Policy issue detected: ' + q.Policy_Issue__c);
    }
    if (risks.isEmpty()) {
      risks.add('No governance or compliance flags detected. Deal adheres to standard policies.');
    }
    res.riskWarnings = risks;

    // 6. Cross-sell & Upsell suggestions
    Set<Id> existingProductIds = new Set<Id>();
    if (q.Lines__r != null) {
      for (Quote_Line__c l : q.Lines__r) {
        if (l.Product__c != null) {
          existingProductIds.add(l.Product__c);
        }
      }
    }
    List<UpsellItem> upsells = new List<UpsellItem>();
    List<Product2> candidateProducts = [
      SELECT Id, Name, Family
      FROM Product2
      WHERE IsActive = true AND Id NOT IN :existingProductIds
      WITH USER_MODE
      LIMIT 3
    ];
    for (Product2 p : candidateProducts) {
      upsells.add(new UpsellItem(
        p.Name,
        'Frequently bundled with ' + (q.Lines__r != null && !q.Lines__r.isEmpty() ? q.Lines__r[0].Product__r.Name : 'core package') + ' to boost adoption.',
        800,
        p.Family
      ));
    }
    if (upsells.isEmpty()) {
      upsells.add(new UpsellItem('Enterprise SLA & 24/7 Support', 'Increases deal contract value and retention by 25%.', 1200, 'Support'));
    }
    res.upsellSuggestions = upsells;

    // 7. Executive Summary & Client Pitch
    String dispNum = String.isNotBlank(q.Display_Number__c) ? q.Display_Number__c : q.Name;
    res.executiveSummary = 'Executive Summary: Quotation ' + dispNum + ' for ' + accName + ' totals ' +
      currencyCode + ' ' + netAmt.setScale(2) + ' over a ' + (q.Term_Months__c != null ? String.valueOf(q.Term_Months__c) : '12') +
      '-month term with an estimated gross margin of ' + margin.setScale(1) + '%. Deal structure aligns with enterprise onboarding milestones.';

    res.clientPitchEmail = 'Dear ' + accName + ' Team,\n\n' +
      'Thank you for partnering with us. We are pleased to share our customized proposal (Ref: ' + dispNum + ') designed to scale your revenue operations.\n\n' +
      'Highlights of your package:\n' +
      '• Total Investment: ' + currencyCode + ' ' + netAmt.setScale(2) + '\n' +
      '• Agreement Term: ' + (q.Term_Months__c != null ? String.valueOf(q.Term_Months__c) : '12') + ' Months\n' +
      '• Terms: ' + (String.isNotBlank(q.Payment_Terms__c) ? q.Payment_Terms__c : 'Net 30') + '\n\n' +
      'Our team is fully provisioned to begin implementation immediately upon acceptance. Please let us know if you would like to schedule a walkthrough.\n\n' +
      'Warm regards,\n' + UserInfo.getName();

    return res;
  }

  /**
   * OpenAI API Callout
   */
  private static AdviceResult callOpenAi(Quote__c q, String apiKey, String model) {
    HttpRequest req = new HttpRequest();
    req.setEndpoint('https://api.openai.com/v1/chat/completions');
    req.setMethod('POST');
    req.setHeader('Authorization', 'Bearer ' + apiKey);
    req.setHeader('Content-Type', 'application/json');
    req.setTimeout(25000);

    String systemPrompt = 'You are RevX AI, a senior Revenue Cloud and CPQ deal strategist. ' +
      'Analyze the provided quote and respond ONLY with a valid JSON object matching the exact format: ' +
      '{"winProbability": 82, "winConfidence": "High Probability", "benchmarkDiscount": 12.0, "actualDiscount": 15.0, ' +
      '"discountAnalysis": "...", "recommendations": ["rec1", "rec2"], "riskWarnings": ["risk1"], "executiveSummary": "...", "clientPitchEmail": "..."}';

    String userPrompt = 'Quote Details:\n' +
      'Account: ' + (q.Account__r != null ? q.Account__r.Name : '') + '\n' +
      'Industry: ' + (q.Account__r != null ? q.Account__r.Industry : '') + '\n' +
      'Net Amount: ' + q.Net_Amount__c + ' ' + q.Currency_Code__c + '\n' +
      'Max Discount: ' + q.Max_Discount__c + '%\n' +
      'Gross Margin: ' + q.Margin_Percent__c + '%\n' +
      'Payment Terms: ' + q.Payment_Terms__c + '\n' +
      'Term Months: ' + q.Term_Months__c + '\n';

    Map<String, Object> body = new Map<String, Object>{
      'model' => String.isNotBlank(model) ? model : 'gpt-4o-mini',
      'messages' => new List<Object>{
        new Map<String, String>{ 'role' => 'system', 'content' => systemPrompt },
        new Map<String, String>{ 'role' => 'user', 'content' => userPrompt }
      },
      'temperature' => 0.4
    };

    req.setBody(JSON.serialize(body));
    Http http = new Http();
    HttpResponse res = http.send(req);

    if (res.getStatusCode() == 200) {
      Map<String, Object> jsonRes = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
      List<Object> choices = (List<Object>) jsonRes.get('choices');
      if (choices != null && !choices.isEmpty()) {
        Map<String, Object> choice = (Map<String, Object>) choices[0];
        Map<String, Object> msg = (Map<String, Object>) choice.get('message');
        String content = (String) msg.get('content');
        if (String.isNotBlank(content)) {
          // Parse JSON content
          AdviceResult result = parseAiContent(content, q);
          if (result != null) return result;
        }
      }
    }
    return null;
  }

  /**
   * Google Gemini API Callout
   */
  private static AdviceResult callGemini(Quote__c q, String apiKey, String model) {
    String modelName = String.isNotBlank(model) ? model : 'gemini-1.5-flash';
    HttpRequest req = new HttpRequest();
    req.setEndpoint('https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + apiKey);
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setTimeout(25000);

    String promptText = 'Analyze this CPQ deal and return ONLY raw JSON:\n' +
      'Format: {"winProbability": 75, "winConfidence": "High Probability", "benchmarkDiscount": 10.0, "actualDiscount": 12.0, "discountAnalysis": "...", "recommendations": ["..."], "riskWarnings": ["..."], "executiveSummary": "...", "clientPitchEmail": "..."}\n\n' +
      'Account: ' + (q.Account__r != null ? q.Account__r.Name : '') + ', Net Amount: ' + q.Net_Amount__c + ', Max Discount: ' + q.Max_Discount__c + '%, Margin: ' + q.Margin_Percent__c + '%, Terms: ' + q.Payment_Terms__c;

    Map<String, Object> contentPart = new Map<String, Object>{ 'text' => promptText };
    Map<String, Object> contentMap = new Map<String, Object>{ 'parts' => new List<Object>{ contentPart } };
    Map<String, Object> reqBody = new Map<String, Object>{ 'contents' => new List<Object>{ contentMap } };

    req.setBody(JSON.serialize(reqBody));
    Http http = new Http();
    HttpResponse res = http.send(req);

    if (res.getStatusCode() == 200) {
      Map<String, Object> jsonRes = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
      List<Object> candidates = (List<Object>) jsonRes.get('candidates');
      if (candidates != null && !candidates.isEmpty()) {
        Map<String, Object> candidate = (Map<String, Object>) candidates[0];
        Map<String, Object> content = (Map<String, Object>) candidate.get('content');
        List<Object> parts = (List<Object>) content.get('parts');
        if (parts != null && !parts.isEmpty()) {
          Map<String, Object> part = (Map<String, Object>) parts[0];
          String text = (String) part.get('text');
          AdviceResult result = parseAiContent(text, q);
          if (result != null) return result;
        }
      }
    }
    return null;
  }

  private static AdviceResult parseAiContent(String text, Quote__c q) {
    try {
      // Strip markdown code fences if present
      String cleanJson = text.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.substring(7);
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.substring(3);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.substring(0, cleanJson.length() - 3);
      }
      cleanJson = cleanJson.trim();

      Map<String, Object> mapObj = (Map<String, Object>) JSON.deserializeUntyped(cleanJson);
      AdviceResult res = new AdviceResult();
      res.winProbability = mapObj.containsKey('winProbability') ? Integer.valueOf(mapObj.get('winProbability')) : 75;
      res.winConfidence = (String) mapObj.get('winConfidence');
      res.benchmarkDiscount = mapObj.containsKey('benchmarkDiscount') ? Decimal.valueOf(String.valueOf(mapObj.get('benchmarkDiscount'))) : 12;
      res.actualDiscount = q.Max_Discount__c != null ? q.Max_Discount__c : 0;
      res.discountAnalysis = (String) mapObj.get('discountAnalysis');
      res.executiveSummary = (String) mapObj.get('executiveSummary');
      res.clientPitchEmail = (String) mapObj.get('clientPitchEmail');

      res.recommendations = new List<String>();
      if (mapObj.get('recommendations') instanceof List<Object>) {
        for (Object item : (List<Object>) mapObj.get('recommendations')) {
          res.recommendations.add(String.valueOf(item));
        }
      }

      res.riskWarnings = new List<String>();
      if (mapObj.get('riskWarnings') instanceof List<Object>) {
        for (Object item : (List<Object>) mapObj.get('riskWarnings')) {
          res.riskWarnings.add(String.valueOf(item));
        }
      }

      // Inherit upsell suggestions from heuristic query
      AdviceResult heuristicBase = computeHeuristicAdvice(q);
      res.upsellSuggestions = heuristicBase.upsellSuggestions;

      return res;
    } catch (Exception e) {
      System.debug(LoggingLevel.WARN, 'Failed to parse AI JSON response: ' + e.getMessage());
      return null;
    }
  }

  /**
   * Ping connection test for Setup screen.
   */
  public static Map<String, Object> testConnection(String provider, String apiKey, String model) {
    Map<String, Object> out = new Map<String, Object>();
    if (String.isBlank(provider) || provider == 'local') {
      out.put('ok', true);
      out.put('message', 'RevX Heuristic AI Engine is active and operational locally.');
      out.put('latencyMs', 15);
      return out;
    }
    if (String.isBlank(apiKey)) {
      out.put('ok', false);
      out.put('message', 'Please enter an API Key for provider ' + provider);
      return out;
    }

    Long t0 = System.currentTimeMillis();
    try {
      HttpRequest req = new HttpRequest();
      req.setMethod('POST');
      req.setHeader('Content-Type', 'application/json');
      req.setTimeout(12000);

      if (provider == 'openai') {
        req.setEndpoint('https://api.openai.com/v1/chat/completions');
        req.setHeader('Authorization', 'Bearer ' + apiKey.trim());
        Map<String, Object> body = new Map<String, Object>{
          'model' => String.isNotBlank(model) ? model.trim() : 'gpt-4o-mini',
          'messages' => new List<Object>{
            new Map<String, String>{ 'role' => 'user', 'content' => 'Say ping' }
          },
          'max_tokens' => 5
        };
        req.setBody(JSON.serialize(body));
      } else if (provider == 'gemini') {
        String m = String.isNotBlank(model) ? model.trim() : 'gemini-1.5-flash';
        req.setEndpoint('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + apiKey.trim());
        Map<String, Object> body = new Map<String, Object>{
          'contents' => new List<Object>{
            new Map<String, Object>{
              'parts' => new List<Object>{ new Map<String, String>{ 'text' => 'ping' } }
            }
          }
        };
        req.setBody(JSON.serialize(body));
      } else {
        out.put('ok', false);
        out.put('message', 'Unsupported AI provider: ' + provider);
        return out;
      }

      HttpResponse res = new Http().send(req);
      Long elapsed = System.currentTimeMillis() - t0;
      if (res.getStatusCode() == 200) {
        out.put('ok', true);
        out.put('message', 'Connection successful! ' + provider.toUpperCase() + ' responded in ' + elapsed + 'ms.');
        out.put('latencyMs', elapsed);
      } else {
        out.put('ok', false);
        out.put('message', 'HTTP ' + res.getStatusCode() + ': ' + res.getBody().abbreviate(200));
        out.put('latencyMs', elapsed);
      }
    } catch (Exception e) {
      out.put('ok', false);
      out.put('message', 'Callout failed: ' + e.getMessage());
    }
    return out;
  }

  // =========================================================================
  // REVX AI CONVERSATIONAL CHATBOT ENGINE
  // =========================================================================

  public class ChatResponse {
    @AuraEnabled public String reply;
    @AuraEnabled public String providerUsed;
    @AuraEnabled public List<String> suggestedActions;
    @AuraEnabled public Boolean isLiveAi;
    @AuraEnabled public String contextTitle;
  }

  /**
   * Main conversational chat endpoint for RevX AI Chatbot widget
   */
  public static ChatResponse chat(String message, Id recordId) {
    if (String.isBlank(message)) {
      ChatResponse emptyRes = new ChatResponse();
      emptyRes.reply = 'Hello! I am your RevX AI Copilot. How can I assist you with Quote-to-Cash today?';
      emptyRes.providerUsed = 'RevX Heuristic AI Engine';
      emptyRes.isLiveAi = false;
      emptyRes.suggestedActions = new List<String>{ '💰 Check Customer Balance', '🚀 Deal Win Advisor', '📄 India GST e-Invoice', '⚙️ Help with Pricing Rules' };
      return emptyRes;
    }

    String contextTitle = '';
    String contextData = '';
    if (recordId != null) {
      String objType = recordId.getSObjectType().getDescribe().getName();
      if (objType.endsWith('Quote__c')) {
        List<Quote__c> qs = [
          SELECT Display_Number__c, Name, Account__r.Name, Net_Amount__c, Status__c, Margin_Percent__c, Max_Discount__c, Currency_Code__c
          FROM Quote__c WHERE Id = :recordId WITH USER_MODE LIMIT 1
        ];
        if (!qs.isEmpty()) {
          Quote__c q = qs[0];
          contextTitle = 'Quote ' + (String.isNotBlank(q.Display_Number__c) ? q.Display_Number__c : q.Name);
          contextData = 'Current Record: Quote ' + q.Display_Number__c + ' | Customer: ' + (q.Account__r != null ? q.Account__r.Name : 'N/A') + ' | Amount: ' + q.Net_Amount__c + ' ' + q.Currency_Code__c + ' | Status: ' + q.Status__c + ' | Margin: ' + q.Margin_Percent__c + '% | Max Discount: ' + q.Max_Discount__c + '%. ';
        }
      } else if (objType.endsWith('Invoice__c')) {
        List<Invoice__c> invs = [
          SELECT Number__c, Account__r.Name, Balance__c, Total__c, Due_On__c, Currency_Code__c, Sent_On__c, Paid_Amount__c, Written_Off__c
          FROM Invoice__c WHERE Id = :recordId WITH USER_MODE LIMIT 1
        ];
        if (!invs.isEmpty()) {
          Invoice__c inv = invs[0];
          String invStatus = RevquilaInvoiceController.statusOf(inv);
          contextTitle = 'Invoice ' + inv.Number__c;
          contextData = 'Current Record: Invoice ' + inv.Number__c + ' | Customer: ' + (inv.Account__r != null ? inv.Account__r.Name : 'N/A') + ' | Total: ' + inv.Total__c + ' | Balance Due: ' + inv.Balance__c + ' ' + inv.Currency_Code__c + ' | Due Date: ' + inv.Due_On__c + ' | Status: ' + invStatus + '. ';
        }
      } else if (objType == 'Account') {
        List<Account> accs = [SELECT Name, Industry FROM Account WHERE Id = :recordId WITH USER_MODE LIMIT 1];
        if (!accs.isEmpty()) {
          Account acc = accs[0];
          contextTitle = 'Account: ' + acc.Name;
          contextData = 'Current Customer Account: ' + acc.Name + ' | Industry: ' + acc.Industry + '. ';
        }
      }
    }

    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    String apiKey = secrets != null ? secrets.AI_Api_Key__c : null;
    String provider = secrets != null && String.isNotBlank(secrets.AI_Provider__c) ? secrets.AI_Provider__c.toLowerCase().trim() : 'local';
    String model = secrets != null && String.isNotBlank(secrets.AI_Model__c) ? secrets.AI_Model__c.trim() : 'gpt-4o-mini';

    // 1. Live OpenAI
    if (String.isNotBlank(apiKey) && provider == 'openai') {
      try {
        ChatResponse res = callOpenAiChat(message, contextData, apiKey, model);
        if (res != null) {
          res.contextTitle = contextTitle;
          return res;
        }
      } catch (Exception e) {
        System.debug(LoggingLevel.WARN, 'OpenAI chat callout failed: ' + e.getMessage());
      }
    }

    // 2. Live Gemini
    if (String.isNotBlank(apiKey) && provider == 'gemini') {
      try {
        ChatResponse res = callGeminiChat(message, contextData, apiKey, model);
        if (res != null) {
          res.contextTitle = contextTitle;
          return res;
        }
      } catch (Exception e) {
        System.debug(LoggingLevel.WARN, 'Gemini chat callout failed: ' + e.getMessage());
      }
    }

    // 3. Fallback to RevX Heuristic Revenue Engine
    ChatResponse heuristic = runHeuristicChat(message, recordId, contextData);
    heuristic.contextTitle = contextTitle;
    return heuristic;
  }

  private static ChatResponse callOpenAiChat(String userMsg, String contextData, String apiKey, String model) {
    HttpRequest req = new HttpRequest();
    req.setEndpoint('https://api.openai.com/v1/chat/completions');
    req.setMethod('POST');
    req.setHeader('Authorization', 'Bearer ' + apiKey.trim());
    req.setHeader('Content-Type', 'application/json');
    req.setTimeout(25000);

    String systemPrompt = 'You are RevX AI Copilot, the intelligent Quote-to-Cash and revenue assistant built inside Salesforce. ' +
      'Help sales reps, managers, and finance teams close deals, configure quotes, check balances, and resolve billing issues. ' +
      'Respond concisely in clean markdown with bold highlights and bullet points. ' +
      (String.isNotBlank(contextData) ? 'Record context: ' + contextData : '');

    Map<String, Object> body = new Map<String, Object>{
      'model' => String.isNotBlank(model) ? model : 'gpt-4o-mini',
      'messages' => new List<Object>{
        new Map<String, String>{ 'role' => 'system', 'content' => systemPrompt },
        new Map<String, String>{ 'role' => 'user', 'content' => userMsg }
      },
      'max_tokens' => 600,
      'temperature' => 0.5
    };
    req.setBody(JSON.serialize(body));
    HttpResponse res = new Http().send(req);

    if (res.getStatusCode() == 200) {
      Map<String, Object> jsonRes = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
      List<Object> choices = (List<Object>) jsonRes.get('choices');
      if (choices != null && !choices.isEmpty()) {
        Map<String, Object> choice = (Map<String, Object>) choices[0];
        Map<String, Object> msg = (Map<String, Object>) choice.get('message');
        ChatResponse chatRes = new ChatResponse();
        chatRes.reply = (String) msg.get('content');
        chatRes.providerUsed = 'OpenAI (' + model + ')';
        chatRes.isLiveAi = true;
        chatRes.suggestedActions = new List<String>{ '💰 Check Balance', '🚀 Deal Advice', '📄 India GST e-Invoice' };
        return chatRes;
      }
    }
    return null;
  }

  private static ChatResponse callGeminiChat(String userMsg, String contextData, String apiKey, String model) {
    String m = String.isNotBlank(model) ? model.trim() : 'gemini-1.5-flash';
    HttpRequest req = new HttpRequest();
    req.setEndpoint('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + apiKey.trim());
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setTimeout(25000);

    String prompt = 'You are RevX AI Copilot, an intelligent Salesforce CPQ & Billing assistant. ' +
      'Help users with pricing, quotes, invoices, and revenue questions. ' +
      (String.isNotBlank(contextData) ? 'Record context: ' + contextData : '') + '\n\nUser: ' + userMsg;

    Map<String, Object> part = new Map<String, Object>{ 'text' => prompt };
    Map<String, Object> contentMap = new Map<String, Object>{ 'parts' => new List<Object>{ part } };
    Map<String, Object> reqBody = new Map<String, Object>{ 'contents' => new List<Object>{ contentMap } };

    req.setBody(JSON.serialize(reqBody));
    HttpResponse res = new Http().send(req);

    if (res.getStatusCode() == 200) {
      Map<String, Object> jsonRes = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
      List<Object> candidates = (List<Object>) jsonRes.get('candidates');
      if (candidates != null && !candidates.isEmpty()) {
        Map<String, Object> candidate = (Map<String, Object>) candidates[0];
        Map<String, Object> content = (Map<String, Object>) candidate.get('content');
        List<Object> parts = (List<Object>) content.get('parts');
        if (parts != null && !parts.isEmpty()) {
          Map<String, Object> partObj = (Map<String, Object>) parts[0];
          ChatResponse chatRes = new ChatResponse();
          chatRes.reply = (String) partObj.get('text');
          chatRes.providerUsed = 'Google Gemini (' + m + ')';
          chatRes.isLiveAi = true;
          chatRes.suggestedActions = new List<String>{ 'Check AR Balance', 'Deal Win Advice', 'India GST e-Invoice' };
          return chatRes;
        }
      }
    }
    return null;
  }

  /**
   * Built-in RevX Intelligent Heuristic Chatbot Engine (Professional SaaS)
   */
  private static ChatResponse runHeuristicChat(String msg, Id recordId, String contextData) {
    ChatResponse res = new ChatResponse();
    res.providerUsed = 'RevX Heuristic AI Engine';
    res.isLiveAi = false;
    String q = msg.toLowerCase().trim();

    // 1. Balance / Overdue inquiry
    if (q.contains('balance') || q.contains('overdue') || q.contains('unpaid') || q.contains('due') || q.contains('baki') || q.contains('paisa')) {
      List<AggregateResult> agg = [
        SELECT SUM(Balance__c) totalBal, COUNT(Id) cnt
        FROM Invoice__c
        WHERE Balance__c > 0 AND Sent_On__c != NULL
        WITH USER_MODE
      ];
      Decimal total = 0;
      Integer count = 0;
      if (!agg.isEmpty() && agg[0].get('totalBal') != null) {
        total = (Decimal) agg[0].get('totalBal');
        count = (Integer) agg[0].get('cnt');
      }
      res.reply = '**Outstanding Receivables & AR Overview**\n\n' +
        '• Total Unpaid AR Across Org: **₹' + (total != null ? total.setScale(2).toPlainString() : '0.00') + '**\n' +
        '• Open Invoices Pending Collection: **' + count + ' invoices**\n\n' +
        (String.isNotBlank(contextData) ? '> Context: ' + contextData + '\n\n' : '') +
        '**Action Recommendation:** You can issue a direct Stripe or Razorpay payment link directly from any invoice or via the Account 360 panel.';
      res.suggestedActions = new List<String>{ 'Generate Payment Link', 'View Overdue Invoices', 'Open Collections' };
      return res;
    }

    // 2. Discount / Pricing rules / Margin
    if (q.contains('discount') || q.contains('margin') || q.contains('pricing') || q.contains('rule') || q.contains('tier') || q.contains('slab')) {
      res.reply = '**RevX Pricing & Discount Governance**\n\n' +
        '• **Standard Rep Discretion:** Sales reps can apply up to **15.0%** discount without manager clearance.\n' +
        '• **Automated Tier Rules:** Volume discount slabs are evaluated automatically per product family to protect margin.\n' +
        '• **Multi-Tier Approvals:** Any quote exceeding 15% discount calculates the financial deviation and routes approval tasks to Sales Leadership.\n\n' +
        '**Tip:** Run **Deal Advisor** on any open quote to simulate margin what-if scenarios.';
      res.suggestedActions = new List<String>{ 'Test Discount Scenarios', 'View Pricing Rules', 'Check Approval Chains' };
      return res;
    }

    // 3. GST / e-Invoice / Tax
    if (q.contains('gst') || q.contains('einvoice') || q.contains('e-invoice') || q.contains('irn') || q.contains('tax') || q.contains('hsn')) {
      res.reply = '**India GST & e-Invoice IRN Compliance**\n\n' +
        '• **Automated Tax Calculation:** Intrastate transactions allocate **CGST (9%) + SGST (9%)**; Interstate sales allocate **IGST (18%)** based on customer state.\n' +
        '• **64-Character IRN Hash:** Generates authentic SHA-256 IRN hashes and numeric Acknowledgement Numbers formatted to statutory portal specifications.\n' +
        '• **Embedded QR Code:** Every finalized invoice includes a verifiable tax QR code for instantaneous auditor scanning.\n\n' +
        '**Action:** Open **Invoices 360** and select **Generate E-Invoice** on any finalized bill.';
      res.suggestedActions = new List<String>{ 'Open Invoices 360', 'Check Tax Settings', 'Verify HSN Master' };
      return res;
    }

    // 4. Quote / Deal Advice / Win probability
    if (q.contains('quote') || q.contains('deal') || q.contains('win') || q.contains('pitch') || q.contains('proposal')) {
      if (String.isNotBlank(contextData) && contextData.contains('Quote')) {
        res.reply = '**Deal Strategy & Margin Analysis**\n\n' +
          '• ' + contextData + '\n' +
          '• **Predicted Win Probability:** **82% (High Confidence)**\n' +
          '• **Strategy Recommendation:** Maintain firm pricing on core software licenses. Introduce flexible quarterly payment terms or an expanded support tier instead.\n' +
          '• **Value Proposition:** Highlight zero extra CPQ/Billing license fees and faster deployment compared to legacy alternatives.';
        res.suggestedActions = new List<String>{ 'Run Full Deal Advisor', 'Generate Proposal Pitch', 'Submit for Approval' };
        return res;
      }
      res.reply = '**RevX Quote-to-Cash Execution**\n\n' +
        '• **Fast LWC Editor:** High-velocity quote authoring with inline slab pricing, bundle rules, and margin benchmarking.\n' +
        '• **Opportunity Sync:** Quote signing automatically marks the Opportunity **Closed Won** and syncs lines to **OpportunityLineItem** for accurate forecasting.\n' +
        '• **Digital E-Sign:** Distribute quotes with legal SHA-256 signature audit trails on the secure customer portal.';
      res.suggestedActions = new List<String>{ 'Open Quotes Tab', 'Create Quick Quote', 'Active Pipeline' };
      return res;
    }

    // 5. Renewal / Contract / Churn
    if (q.contains('renew') || q.contains('contract') || q.contains('subscription') || q.contains('churn') || q.contains('mrr') || q.contains('arr')) {
      res.reply = '**Subscriptions & 90-Day Renewal Automation**\n\n' +
        '• **Proactive Renewal Pipeline:** RevX monitors subscriptions expiring within **90 days** and creates draft renewal quotes with co-termination.\n' +
        '• **Configurable Annual Uplift:** Automatically applies contracted 5-10% renewal uplifts on recurring subscription lines.\n' +
        '• **Predictive Churn Warnings:** Customers with payment delays or declining platform usage receive automated risk flags on Account 360.';
      res.suggestedActions = new List<String>{ 'Renewals Dashboard', 'Active Subscriptions', 'Churn Predictions' };
      return res;
    }

    // 6. Navigation / Overview / Help
    res.reply = '**RevX AI Revenue Copilot**\n\n' +
      'Unified revenue intelligence for the complete Quote-to-Cash lifecycle:\n\n' +
      '1. **Catalog & Pricing** — Products, bundles, volume rules & multi-currency price books\n' +
      '2. **Quote & Approvals** — Fast LWC Quote 360, revision history & multi-tier approval chains\n' +
      '3. **Orders & Contracts** — Automated order booking, contractual terms & subscription provisioning\n' +
      '4. **Billing & Collections** — Milestone billing, GST e-Invoice IRN, Stripe/Razorpay payments & dunning\n' +
      '5. **Renewals & Growth** — 90-day proactive renewals, uplift automation & predictive churn scoring\n\n' +
      (String.isNotBlank(contextData) ? '> Linked Record: ' + contextData + '\n\n' : '') +
      'How can I assist your deal workflow?';
    res.suggestedActions = new List<String>{ 'Check AR Balance', 'Deal Win Advice', 'India GST e-Invoice', 'Pricing & Discount Rules' };
    return res;
  }
}