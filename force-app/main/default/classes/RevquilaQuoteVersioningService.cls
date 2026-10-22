/**
 * RevquilaQuoteVersioningService
 * Enterprise quote revision and snapshot engine.
 * Generates audit-tracked point-in-time snapshots, line-level diff comparisons, and restoration capabilities.
 */
public with sharing class RevquilaQuoteVersioningService {

    public class LineSnapshot {
        public String id;
        public String productId;
        public String productName;
        public Decimal quantity;
        public Decimal unitPrice;
        public Decimal discountPercent;
        public Decimal total;
        public String billingFrequency;
        public String description;
        public Integer lineNumber;
    }

    public class HeaderSnapshot {
        public String name;
        public Decimal total;
        public Decimal netAmount;
        public Decimal discountTotal;
        public Decimal marginPercent;
        public String paymentTerms;
        public String status;
        public Date quoteDate;
        public Date validUntil;
    }

    public class LineDiff {
        @AuraEnabled public String productName;
        @AuraEnabled public String changeType; // ADDED, REMOVED, MODIFIED, UNCHANGED
        @AuraEnabled public Decimal oldQuantity;
        @AuraEnabled public Decimal newQuantity;
        @AuraEnabled public Decimal oldUnitPrice;
        @AuraEnabled public Decimal newUnitPrice;
        @AuraEnabled public Decimal oldDiscount;
        @AuraEnabled public Decimal newDiscount;
        @AuraEnabled public Decimal oldTotal;
        @AuraEnabled public Decimal newTotal;
        @AuraEnabled public String details;
    }

    public class HeaderDiff {
        @AuraEnabled public String fieldLabel;
        @AuraEnabled public String oldValue;
        @AuraEnabled public String newValue;
    }

    public class VersionComparison {
        @AuraEnabled public Integer versionA;
        @AuraEnabled public Integer versionB;
        @AuraEnabled public String authorA;
        @AuraEnabled public String authorB;
        @AuraEnabled public Datetime timestampA;
        @AuraEnabled public Datetime timestampB;
        @AuraEnabled public Decimal netA;
        @AuraEnabled public Decimal netB;
        @AuraEnabled public Decimal netDelta;
        @AuraEnabled public Decimal percentChange;
        @AuraEnabled public Decimal discountDelta;
        @AuraEnabled public Decimal marginDelta;
        @AuraEnabled public List<HeaderDiff> headerDiffs;
        @AuraEnabled public List<LineDiff> lineDiffs;
        @AuraEnabled public String summary;
    }

    /**
     * Creates a point-in-time snapshot of the given quote and lines.
     */
    public static Quote_Version__c createSnapshot(Id quoteId, String reason) {
        Quote__c q = [
            SELECT Id, Name, Total__c, Net_Amount__c, Discount_Total__c, Margin_Percent__c,
                   Payment_Terms__c, Status__c, Quote_Date__c, Valid_Until__c, Version__c,
                   (SELECT Id, Product__c, Product__r.Name, Quantity__c, Unit_Price__c,
                           Discount__c, Net_Amount__c, Sort_Order__c, Description__c
                    FROM Lines__r ORDER BY Sort_Order__c ASC)
            FROM Quote__c
            WHERE Id = :quoteId
            WITH USER_MODE
            LIMIT 1
        ];

        // Find existing versions to determine next version number
        List<Quote_Version__c> existingVersions = [
            SELECT Id, Version_Number__c, Total_Amount__c, Net_Amount__c, Lines_JSON__c, Header_JSON__c
            FROM Quote_Version__c
            WHERE Quote__c = :quoteId
            WITH USER_MODE
            ORDER BY Version_Number__c DESC
            LIMIT 1
        ];

        Integer nextVersion = 1;
        Quote_Version__c prevVersion = null;
        if (!existingVersions.isEmpty()) {
            prevVersion = existingVersions[0];
            nextVersion = (prevVersion.Version_Number__c != null) ? prevVersion.Version_Number__c.intValue() + 1 : 1;
        } else if (q.Version__c != null && q.Version__c > 0) {
            nextVersion = q.Version__c.intValue();
        }

        // Build line snapshot list
        List<LineSnapshot> lineList = new List<LineSnapshot>();
        Integer lineNum = 1;
        for (Quote_Line__c l : q.Lines__r) {
            LineSnapshot ls = new LineSnapshot();
            ls.id = l.Id;
            ls.productId = l.Product__c;
            ls.productName = l.Product__r != null ? l.Product__r.Name : 'Item ' + lineNum;
            ls.quantity = l.Quantity__c != null ? l.Quantity__c : 1;
            ls.unitPrice = l.Unit_Price__c != null ? l.Unit_Price__c : 0;
            ls.discountPercent = l.Discount__c != null ? l.Discount__c : 0;
            ls.total = l.Net_Amount__c != null ? l.Net_Amount__c : 0;
            ls.description = l.Description__c;
            ls.lineNumber = l.Sort_Order__c != null ? l.Sort_Order__c.intValue() : lineNum;
            lineList.add(ls);
            lineNum++;
        }

        HeaderSnapshot hs = new HeaderSnapshot();
        hs.name = q.Name;
        hs.total = q.Total__c;
        hs.netAmount = q.Net_Amount__c;
        hs.discountTotal = q.Discount_Total__c;
        hs.marginPercent = q.Margin_Percent__c;
        hs.paymentTerms = q.Payment_Terms__c;
        hs.status = q.Status__c;
        hs.quoteDate = q.Quote_Date__c;
        hs.validUntil = q.Valid_Until__c;

        // Generate diff summary vs previous version
        String diffSummary = generateSummary(prevVersion, q, lineList);

        Quote_Version__c qv = new Quote_Version__c(
            Quote__c = q.Id,
            Version_Number__c = nextVersion,
            Total_Amount__c = q.Total__c,
            Net_Amount__c = q.Net_Amount__c,
            Discount_Total__c = q.Discount_Total__c,
            Margin_Percent__c = q.Margin_Percent__c,
            Payment_Terms__c = q.Payment_Terms__c,
            Status__c = q.Status__c,
            Created_By_Name__c = UserInfo.getName(),
            Version_Reason__c = String.isBlank(reason) ? 'Version ' + nextVersion + ' revision' : reason,
            Changes_Summary__c = diffSummary,
            Lines_JSON__c = JSON.serialize(lineList),
            Header_JSON__c = JSON.serialize(hs),
            Is_Active__c = true
        );

        insert as system qv;

        // Log to Audit Trail
        RevquilaAuditService.log(
            RevquilaAuditService.EVENT_PRICING,
            q.Id,
            q.Name + ' (v' + nextVersion + ')',
            'Quote__c',
            'Snapshot v' + nextVersion,
            prevVersion != null ? 'v' + prevVersion.Version_Number__c + ' Net: ' + prevVersion.Net_Amount__c : 'Initial',
            'v' + nextVersion + ' Net: ' + q.Net_Amount__c,
            qv.Version_Reason__c + '. ' + diffSummary
        );

        return qv;
    }

    /**
     * Generates a human readable summary of differences between previous version and current snapshot.
     */
    private static String generateSummary(Quote_Version__c prev, Quote__c current, List<LineSnapshot> currentLines) {
        if (prev == null) {
            return 'Initial version v1 with ' + currentLines.size() + ' lines. Total Net: ' + (current.Net_Amount__c != null ? String.valueOf(current.Net_Amount__c) : '0');
        }
        List<String> notes = new List<String>();
        Decimal oldNet = prev.Net_Amount__c != null ? prev.Net_Amount__c : 0;
        Decimal newNet = current.Net_Amount__c != null ? current.Net_Amount__c : 0;
        if (oldNet != newNet) {
            Decimal diff = newNet - oldNet;
            notes.add('Net Amount shifted by ' + (diff > 0 ? '+' : '') + diff + ' (' + oldNet + ' -> ' + newNet + ')');
        }

        if (prev.Lines_JSON__c != null) {
            List<LineSnapshot> prevLines = (List<LineSnapshot>) JSON.deserialize(prev.Lines_JSON__c, List<LineSnapshot>.class);
            Map<String, LineSnapshot> prevMap = new Map<String, LineSnapshot>();
            for (LineSnapshot pl : prevLines) {
                prevMap.put(pl.productName, pl);
            }
            Integer added = 0;
            Integer modified = 0;
            for (LineSnapshot cl : currentLines) {
                if (!prevMap.containsKey(cl.productName)) {
                    added++;
                } else {
                    LineSnapshot pl = prevMap.get(cl.productName);
                    if (pl.quantity != cl.quantity || pl.unitPrice != cl.unitPrice || pl.discountPercent != cl.discountPercent) {
                        modified++;
                    }
                }
            }
            if (added > 0) notes.add(added + ' line(s) added');
            if (modified > 0) notes.add(modified + ' line(s) modified');
        }
        return notes.isEmpty() ? 'Terms or details updated with no financial variance.' : String.join(notes, '; ');
    }

    /**
     * Compares two quote versions in detail and returns structured diff.
     */
    public static VersionComparison compareVersions(Id versionAId, Id versionBId) {
        Quote_Version__c va = [
            SELECT Id, Version_Number__c, Total_Amount__c, Net_Amount__c, Discount_Total__c, Margin_Percent__c,
                   Payment_Terms__c, Status__c, Created_By_Name__c, CreatedDate, Lines_JSON__c, Header_JSON__c
            FROM Quote_Version__c
            WHERE Id = :versionAId
            WITH USER_MODE
        ];

        Quote_Version__c vb = [
            SELECT Id, Version_Number__c, Total_Amount__c, Net_Amount__c, Discount_Total__c, Margin_Percent__c,
                   Payment_Terms__c, Status__c, Created_By_Name__c, CreatedDate, Lines_JSON__c, Header_JSON__c
            FROM Quote_Version__c
            WHERE Id = :versionBId
            WITH USER_MODE
        ];

        VersionComparison comp = new VersionComparison();
        comp.versionA = va.Version_Number__c != null ? va.Version_Number__c.intValue() : 1;
        comp.versionB = vb.Version_Number__c != null ? vb.Version_Number__c.intValue() : 2;
        comp.authorA = va.Created_By_Name__c;
        comp.authorB = vb.Created_By_Name__c;
        comp.timestampA = va.CreatedDate;
        comp.timestampB = vb.CreatedDate;
        comp.netA = va.Net_Amount__c != null ? va.Net_Amount__c : 0;
        comp.netB = vb.Net_Amount__c != null ? vb.Net_Amount__c : 0;
        comp.netDelta = comp.netB - comp.netA;
        comp.percentChange = comp.netA > 0 ? ((comp.netDelta / comp.netA) * 100).setScale(2) : 0;
        comp.discountDelta = (vb.Discount_Total__c != null ? vb.Discount_Total__c : 0) - (va.Discount_Total__c != null ? va.Discount_Total__c : 0);
        comp.marginDelta = (vb.Margin_Percent__c != null ? vb.Margin_Percent__c : 0) - (va.Margin_Percent__c != null ? va.Margin_Percent__c : 0);

        // Header diffs
        comp.headerDiffs = new List<HeaderDiff>();
        if (va.Payment_Terms__c != vb.Payment_Terms__c) {
            HeaderDiff hd = new HeaderDiff();
            hd.fieldLabel = 'Payment Terms';
            hd.oldValue = va.Payment_Terms__c;
            hd.newValue = vb.Payment_Terms__c;
            comp.headerDiffs.add(hd);
        }
        if (va.Status__c != vb.Status__c) {
            HeaderDiff hd = new HeaderDiff();
            hd.fieldLabel = 'Status';
            hd.oldValue = va.Status__c;
            hd.newValue = vb.Status__c;
            comp.headerDiffs.add(hd);
        }

        // Line diffs
        comp.lineDiffs = new List<LineDiff>();
        List<LineSnapshot> linesA = (va.Lines_JSON__c != null) ? (List<LineSnapshot>) JSON.deserialize(va.Lines_JSON__c, List<LineSnapshot>.class) : new List<LineSnapshot>();
        List<LineSnapshot> linesB = (vb.Lines_JSON__c != null) ? (List<LineSnapshot>) JSON.deserialize(vb.Lines_JSON__c, List<LineSnapshot>.class) : new List<LineSnapshot>();

        Map<String, LineSnapshot> mapA = new Map<String, LineSnapshot>();
        for (LineSnapshot la : linesA) {
            mapA.put(la.productName, la);
        }
        Map<String, LineSnapshot> mapB = new Map<String, LineSnapshot>();
        for (LineSnapshot lb : linesB) {
            mapB.put(lb.productName, lb);
        }

        // Check lines in B against A
        for (String pName : mapB.keySet()) {
            LineSnapshot bLine = mapB.get(pName);
            LineDiff ld = new LineDiff();
            ld.productName = pName;
            ld.newQuantity = bLine.quantity;
            ld.newUnitPrice = bLine.unitPrice;
            ld.newDiscount = bLine.discountPercent;
            ld.newTotal = bLine.total;

            if (!mapA.containsKey(pName)) {
                ld.changeType = 'ADDED';
                ld.oldQuantity = 0;
                ld.oldUnitPrice = 0;
                ld.oldDiscount = 0;
                ld.oldTotal = 0;
                ld.details = 'New product line added in v' + comp.versionB;
            } else {
                LineSnapshot aLine = mapA.get(pName);
                ld.oldQuantity = aLine.quantity;
                ld.oldUnitPrice = aLine.unitPrice;
                ld.oldDiscount = aLine.discountPercent;
                ld.oldTotal = aLine.total;

                if (aLine.quantity != bLine.quantity || aLine.unitPrice != bLine.unitPrice || aLine.discountPercent != bLine.discountPercent) {
                    ld.changeType = 'MODIFIED';
                    List<String> mods = new List<String>();
                    if (aLine.quantity != bLine.quantity) mods.add('Qty ' + aLine.quantity + ' -> ' + bLine.quantity);
                    if (aLine.discountPercent != bLine.discountPercent) mods.add('Discount ' + aLine.discountPercent + '% -> ' + bLine.discountPercent + '%');
                    if (aLine.unitPrice != bLine.unitPrice) mods.add('Price ' + aLine.unitPrice + ' -> ' + bLine.unitPrice);
                    ld.details = String.join(mods, ', ');
                } else {
                    ld.changeType = 'UNCHANGED';
                    ld.details = 'Identical terms and pricing';
                }
            }
            comp.lineDiffs.add(ld);
        }

        // Check lines removed from A
        for (String pName : mapA.keySet()) {
            if (!mapB.containsKey(pName)) {
                LineSnapshot aLine = mapA.get(pName);
                LineDiff ld = new LineDiff();
                ld.productName = pName;
                ld.changeType = 'REMOVED';
                ld.oldQuantity = aLine.quantity;
                ld.oldUnitPrice = aLine.unitPrice;
                ld.oldDiscount = aLine.discountPercent;
                ld.oldTotal = aLine.total;
                ld.newQuantity = 0;
                ld.newUnitPrice = 0;
                ld.newDiscount = 0;
                ld.newTotal = 0;
                ld.details = 'Removed in v' + comp.versionB;
                comp.lineDiffs.add(ld);
            }
        }

        comp.summary = 'Compared v' + comp.versionA + ' to v' + comp.versionB + ': Net delta is ' + comp.netDelta + ' (' + comp.percentChange + '%).';
        return comp;
    }

    /**
     * Restores a quote to a previous snapshot state.
     */
    public static void restoreVersion(Id quoteId, Id versionId) {
        RevquilaSecurityGuard.requirePermission(RevquilaSecurityGuard.canEditPrices(), 'restore quote versions');

        Quote_Version__c qv = [
            SELECT Id, Version_Number__c, Total_Amount__c, Net_Amount__c, Discount_Total__c, Margin_Percent__c,
                   Payment_Terms__c, Lines_JSON__c, Header_JSON__c
            FROM Quote_Version__c
            WHERE Id = :versionId
            WITH USER_MODE
        ];

        Quote__c q = [SELECT Id, Name, Status__c, Version__c FROM Quote__c WHERE Id = :quoteId WITH USER_MODE];

        // Delete existing draft quote lines
        List<Quote_Line__c> existingLines = [SELECT Id FROM Quote_Line__c WHERE Quote__c = :quoteId WITH SYSTEM_MODE];
        if (!existingLines.isEmpty()) {
            delete as system existingLines;
        }

        // Reconstruct lines from snapshot
        List<Quote_Line__c> toInsert = new List<Quote_Line__c>();
        if (qv.Lines_JSON__c != null) {
            List<LineSnapshot> lines = (List<LineSnapshot>) JSON.deserialize(qv.Lines_JSON__c, List<LineSnapshot>.class);
            for (LineSnapshot ls : lines) {
                Quote_Line__c l = new Quote_Line__c(
                    Quote__c = quoteId,
                    Product__c = ls.productId,
                    Quantity__c = ls.quantity,
                    Unit_Price__c = ls.unitPrice,
                    Discount__c = ls.discountPercent,
                    Net_Amount__c = ls.total,
                    Sort_Order__c = ls.lineNumber,
                    Description__c = ls.description
                );
                toInsert.add(l);
            }
        }

        if (!toInsert.isEmpty()) {
            insert as system toInsert;
        }

        q.Status__c = 'Draft';
        q.Payment_Terms__c = qv.Payment_Terms__c;
        q.Net_Amount__c = qv.Net_Amount__c;
        q.Total__c = qv.Total_Amount__c;
        q.Discount_Total__c = qv.Discount_Total__c;
        q.Margin_Percent__c = qv.Margin_Percent__c;
        update as system q;

        // Log restore to audit trail
        RevquilaAuditService.log(
            RevquilaAuditService.EVENT_QUOTE_RESTORE,
            q.Id,
            q.Name,
            'Quote__c',
            'Restore Version',
            'Current',
            'Restored to v' + qv.Version_Number__c,
            'Quote was reverted back to snapshot v' + qv.Version_Number__c + ' by ' + UserInfo.getName()
        );
    }
}
