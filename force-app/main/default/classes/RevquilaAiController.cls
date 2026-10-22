/**
 * Revquila AI Controller: Exposes AI Deal Optimization, Proposal Pitch Generation,
 * Risk Redline Analysis, and Connection Testing to LWC components.
 */
public with sharing class RevquilaAiController {
  /**
   * Retrieves AI Deal Advisory for a quote.
   */
  @AuraEnabled
  public static RevquilaAiService.AdviceResult getAdvice(Id quoteId) {
    try {
      RevquilaCore.need(quoteId != null, 'Quote ID is required.');
      return RevquilaAiService.getAdvice(quoteId);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Generates a proposal summary and client email pitch.
   */
  @AuraEnabled
  public static Map<String, String> generateProposal(Id quoteId) {
    try {
      RevquilaCore.need(quoteId != null, 'Quote ID is required.');
      RevquilaAiService.AdviceResult res = RevquilaAiService.getAdvice(quoteId);
      Map<String, String> out = new Map<String, String>();
      out.put('executiveSummary', res.executiveSummary);
      out.put('clientPitchEmail', res.clientPitchEmail);
      return out;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Returns current AI status and provider info for the UI.
   */
  @AuraEnabled
  public static Map<String, Object> getAiStatus() {
    try {
      Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
      Map<String, Object> out = new Map<String, Object>();
      String provider = (secrets != null && String.isNotBlank(secrets.AI_Provider__c))
        ? secrets.AI_Provider__c.toLowerCase().trim()
        : 'local';
      String model = (secrets != null && String.isNotBlank(secrets.AI_Model__c))
        ? secrets.AI_Model__c.trim()
        : 'gpt-4o-mini';
      Boolean hasKey = (secrets != null && String.isNotBlank(secrets.AI_Api_Key__c));

      out.put('provider', provider);
      out.put('model', model);
      out.put('hasKey', hasKey);
      out.put('isLive', hasKey && (provider == 'openai' || provider == 'gemini'));
      return out;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Tests AI connection from Setup screen.
   */
  @AuraEnabled
  public static Map<String, Object> testConnection(String provider, String apiKey, String model) {
    try {
      RevquilaCore.need(RevquilaCore.isAdmin(), 'You need Revquila Admin permission to test AI connection.');
      return RevquilaAiService.testConnection(provider, apiKey, model);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Conversational RevX AI Chatbot endpoint
   */
  @AuraEnabled
  public static RevquilaAiService.ChatResponse chat(String message, Id recordId) {
    try {
      return RevquilaAiService.chat(message, recordId);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }
}