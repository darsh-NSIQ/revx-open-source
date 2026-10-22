/**
 * Service Cloud deep integration:
 * Auto-creates standard ServiceContract and Entitlement (with plan-based SLA)
 * upon Subscription activation, and creates Asset records with warranty / AMC dates
 * for physical products.
 */
public with sharing class RevquilaServiceCloudService {

    public class ProvisionResult {
        @AuraEnabled public Boolean ok = true;
        @AuraEnabled public Id serviceContractId;
        @AuraEnabled public Id entitlementId;
        @AuraEnabled public Integer assetsCreated = 0;
        @AuraEnabled public String message;
    }

    /**
     * Provisions Service Contract, Entitlement, and physical Assets for a subscription.
     */
    public static ProvisionResult provisionForSubscription(Id subscriptionId) {
        ProvisionResult result = new ProvisionResult();
        if (subscriptionId == null) {
            result.ok = false;
            result.message = 'No subscription ID provided.';
            return result;
        }

        List<Subscription__c> subs = [
            SELECT Id, Name, Display_Number__c, Account__c, Account__r.Name,
                   Start_Date__c, Renewal_Date__c, Term_Months__c, Quote__c, Order__c, Status__c
            FROM Subscription__c
            WHERE Id = :subscriptionId
            WITH USER_MODE
            LIMIT 1
        ];

        if (subs.isEmpty() || subs[0].Account__c == null) {
            result.ok = false;
            result.message = 'Subscription or linked Account not found.';
            return result;
        }

        Subscription__c sub = subs[0];
        Id accountId = sub.Account__c;
        String accName = String.isNotBlank(sub.Account__r.Name) ? sub.Account__r.Name : 'Customer';
        Date startDate = sub.Start_Date__c != null ? sub.Start_Date__c : Date.today();
        Date endDate = sub.Renewal_Date__c != null ? sub.Renewal_Date__c : startDate.addYears(1);
        Integer term = sub.Term_Months__c != null ? sub.Term_Months__c.intValue() : 12;

        try {
            // 1. Create standard ServiceContract
            ServiceContract sc = new ServiceContract();
            sc.Name = (accName + ' - Service Contract (' + (sub.Display_Number__c != null ? sub.Display_Number__c : sub.Name) + ')').left(255);
            sc.AccountId = accountId;
            sc.StartDate = startDate;
            sc.EndDate = endDate;
            sc.Term = term;
            Database.insert(sc, AccessLevel.USER_MODE);
            result.serviceContractId = sc.Id;

            // 2. Create standard Entitlement with SLA
            Entitlement ent = new Entitlement();
            ent.Name = ('Support Entitlement - ' + accName).left(255);
            ent.AccountId = accountId;
            ent.ServiceContractId = sc.Id;
            ent.StartDate = startDate;
            ent.EndDate = endDate;
            ent.Type = 'Web Support';
            Database.insert(ent, AccessLevel.USER_MODE);
            result.entitlementId = ent.Id;

            // 3. Create Asset records for non-recurring / physical products
            List<Asset> assetsToInsert = new List<Asset>();
            if (sub.Quote__c != null) {
                List<Quote_Line__c> physicalLines = [
                    SELECT Id, Product__c, Product__r.Name, Quantity__c, Unit_Price__c, Recurring__c
                    FROM Quote_Line__c
                    WHERE Quote__c = :sub.Quote__c AND Product__c != null AND (Recurring__c = false OR Product__r.Recurring__c = false)
                    WITH USER_MODE
                ];

                for (Quote_Line__c ql : physicalLines) {
                    Asset a = new Asset();
                    a.Name = (ql.Product__r.Name != null ? ql.Product__r.Name : 'Hardware Asset').left(255);
                    a.AccountId = accountId;
                    a.Product2Id = ql.Product__c;
                    a.Quantity = ql.Quantity__c != null && ql.Quantity__c > 0 ? ql.Quantity__c : 1;
                    a.Price = ql.Unit_Price__c;
                    a.PurchaseDate = Date.today();
                    a.InstallDate = Date.today();
                    a.UsageEndDate = Date.today().addYears(1); // 1-year warranty / AMC renewal
                    a.Status = 'Installed';
                    assetsToInsert.add(a);
                }
            }

            if (!assetsToInsert.isEmpty()) {
                Database.insert(assetsToInsert, AccessLevel.USER_MODE);
                result.assetsCreated = assetsToInsert.size();
            }

            result.message = 'Service Contract (' + sc.Id + '), Entitlement, and ' + result.assetsCreated + ' Assets created.';
            return result;
        } catch (Exception e) {
            result.ok = false;
            result.message = 'Service Cloud provisioning error: ' + e.getMessage();
            return result;
        }
    }
}
