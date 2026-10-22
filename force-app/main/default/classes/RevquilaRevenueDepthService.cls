/**
 * RevquilaRevenueDepthService
 * ASC 606 / IFRS 15 Advanced Revenue Recognition Engine:
 * - Multiple Performance Obligations (SSP allocation)
 * - Contract Modification Handling (Prospective, Cumulative Catch-up, Termination)
 * - Credit Note Revenue Adjustments (Deferred & Contra-Revenue)
 * - Unbilled Revenue (Contract Asset) linked to Usage Metering
 * - Month-End Period Lock Governance
 * - External Accounting Sync Formats (Tally Prime XML, QuickBooks Online JSON, Zoho Books JSON)
 * - ASC 606 Advanced Reporting (Rollforward, Billings vs Revenue, Revenue by Product)
 */
public with sharing class RevquilaRevenueDepthService {

    public class RevenueException extends Exception {}

    public class RollforwardReport {
        @AuraEnabled public Decimal beginningDeferred { get; set; }
        @AuraEnabled public Decimal newBillings { get; set; }
        @AuraEnabled public Decimal recognizedRevenue { get; set; }
        @AuraEnabled public Decimal creditNoteAdjustments { get; set; }
        @AuraEnabled public Decimal endingDeferred { get; set; }
        @AuraEnabled public String currencyCode { get; set; }
    }

    public class BillingVsRevenueMonth {
        @AuraEnabled public String monthKey { get; set; }
        @AuraEnabled public String monthLabel { get; set; }
        @AuraEnabled public Decimal billedAmount { get; set; }
        @AuraEnabled public Decimal recognizedAmount { get; set; }
        @AuraEnabled public Decimal variance { get; set; }
    }

    public class ProductRevenueSummary {
        @AuraEnabled public String productId { get; set; }
        @AuraEnabled public String productName { get; set; }
        @AuraEnabled public String pobType { get; set; }
        @AuraEnabled public String revenueMethod { get; set; }
        @AuraEnabled public Decimal totalAmount { get; set; }
        @AuraEnabled public Decimal recognizedAmount { get; set; }
        @AuraEnabled public Decimal deferredAmount { get; set; }
    }

    public class PeriodLockView {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public Date startDate { get; set; }
        @AuraEnabled public Date endDate { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public Datetime lockedOn { get; set; }
        @AuraEnabled public String lockedByName { get; set; }
        @AuraEnabled public Datetime reopenedOn { get; set; }
        @AuraEnabled public String reopenedByName { get; set; }
        @AuraEnabled public String reopenedReason { get; set; }
        @AuraEnabled public String notes { get; set; }
    }

    /* =========================================================================
     * 1. MULTIPLE PERFORMANCE OBLIGATIONS (SSP ALLOCATION)
     * ========================================================================= */

    /**
     * Allocates transaction price across multiple performance obligations (POBs)
     * using Standalone Selling Price (SSP) ratios:
     * Allocated Price_i = (SSP_i / Sum(SSP)) * Total Transaction Price
     */
    public static void allocateSSPForInvoice(Id invoiceId) {
        Invoice__c invoice = [
            SELECT Id, Account__c, Order__c, Subscription__c, Issued_On__c, Period_Start__c, Period_End__c,
                   Exchange_Rate__c, Country__c, Currency_Code__c, Total__c, Net_Amount__c,
                   (SELECT Id, Product__c, Product__r.Name, Product__r.Revenue_Method__c, Product__r.POB_Type__c,
                           Product__r.SSP__c, Description__c, Net_Amount__c, Recurring__c,
                           Start_Date__c, End_Date__c, Term_Months__c FROM Lines__r)
            FROM Invoice__c
            WHERE Id = :invoiceId
            WITH SYSTEM_MODE
        ];

        if (invoice.Lines__r.isEmpty()) {
            return;
        }

        // Delete existing un-recognized schedules if re-allocating
        List<Revenue_Schedule__c> existingSchedules = [
            SELECT Id, (SELECT Id, Recognized__c FROM Periods__r)
            FROM Revenue_Schedule__c
            WHERE Invoice__c = :invoiceId
            WITH SYSTEM_MODE
        ];
        Boolean canReplace = true;
        for (Revenue_Schedule__c sch : existingSchedules) {
            for (Revenue_Schedule_Line__c l : sch.Periods__r) {
                if (l.Recognized__c == true) {
                    canReplace = false;
                    break;
                }
            }
        }
        if (!existingSchedules.isEmpty()) {
            if (!canReplace) {
                // Lines already recognized; do not replace
                return;
            }
            delete as system existingSchedules;
        }

        Decimal totalTxPrice = 0;
        Decimal totalSSP = 0;
        List<Decimal> sspList = new List<Decimal>();
        List<Decimal> lineAmounts = new List<Decimal>();

        for (Invoice_Line__c line : invoice.Lines__r) {
            Decimal baseAmount = RevquilaCore.toBase(line.Net_Amount__c, invoice.Exchange_Rate__c);
            lineAmounts.add(baseAmount);
            totalTxPrice += baseAmount;

            Decimal lineSSP = line.Product__r.SSP__c;
            if (lineSSP == null || lineSSP <= 0) {
                lineSSP = baseAmount;
            }
            sspList.add(lineSSP);
            totalSSP += lineSSP;
        }

        if (totalTxPrice <= 0) {
            return;
        }

        String fallbackMethod = RevquilaSettings.current().revenueMethod;
        List<Revenue_Schedule__c> schedulesToInsert = new List<Revenue_Schedule__c>();
        List<List<Revenue_Schedule_Line__c>> linesPerSchedule = new List<List<Revenue_Schedule_Line__c>>();
        Decimal allocatedRunningSum = 0;
        Integer maxIndex = 0;
        Decimal maxSSP = -1;

        for (Integer i = 0; i < invoice.Lines__r.size(); i++) {
            Invoice_Line__c line = invoice.Lines__r[i];
            Decimal ssp = sspList[i];
            if (ssp > maxSSP) {
                maxSSP = ssp;
                maxIndex = i;
            }

            Decimal allocated;
            Decimal ratio = 0;
            if (totalSSP > 0) {
                ratio = (ssp / totalSSP) * 100;
                allocated = RevquilaCore.money((ssp / totalSSP) * totalTxPrice);
            } else {
                allocated = lineAmounts[i];
                ratio = totalTxPrice > 0 ? (allocated / totalTxPrice) * 100 : 0;
            }
            allocatedRunningSum += allocated;

            String pobType = line.Product__r.POB_Type__c;
            if (String.isBlank(pobType)) {
                pobType = line.Recurring__c ? 'license' : 'other';
            }

            String method = line.Product__r.Revenue_Method__c;
            if (String.isBlank(method)) {
                if (pobType == 'support' || pobType == 'license') {
                    method = 'ratable';
                } else if (pobType == 'implementation') {
                    method = 'milestone';
                } else {
                    method = line.Recurring__c ? fallbackMethod : 'point_in_time';
                }
            }

            Date start = line.Start_Date__c != null ? line.Start_Date__c : (invoice.Period_Start__c != null ? invoice.Period_Start__c : invoice.Issued_On__c);
            Date finish = line.End_Date__c != null ? line.End_Date__c : invoice.Period_End__c;
            if (finish == null || finish < start) {
                finish = line.Recurring__c ? start.addMonths(line.Term_Months__c == null ? 12 : line.Term_Months__c.intValue()).addDays(-1) : start;
            }
            if (method == 'ratable' && !line.Recurring__c && finish == start) {
                method = 'point_in_time';
            }

            Revenue_Schedule__c sch = new Revenue_Schedule__c(
                Invoice__c = invoice.Id,
                Order__c = invoice.Order__c,
                Subscription__c = invoice.Subscription__c,
                Account__c = invoice.Account__c,
                Product__c = line.Product__c,
                Description__c = (line.Description__c == null ? line.Product__r.Name : line.Description__c).abbreviate(255),
                Method__c = method,
                POB_Type__c = pobType,
                SSP_Price__c = ssp,
                Allocated_Amount__c = allocated,
                Allocation_Ratio__c = ratio.setScale(2),
                Start_Date__c = start,
                End_Date__c = finish,
                Total__c = allocated,
                Status__c = 'open',
                Country__c = invoice.Country__c,
                Currency_Code__c = RevquilaSettings.current().home.currencyCode,
                Exchange_Rate__c = 1,
                Modification_Type__c = 'none'
            );
            schedulesToInsert.add(sch);
        }

        // Adjust cents discrepancy onto the highest SSP obligation
        Decimal diff = totalTxPrice - allocatedRunningSum;
        if (diff != 0 && !schedulesToInsert.isEmpty()) {
            schedulesToInsert[maxIndex].Allocated_Amount__c += diff;
            schedulesToInsert[maxIndex].Total__c += diff;
        }

        insert as system schedulesToInsert;

        // Generate lines for each schedule
        List<Revenue_Schedule_Line__c> linesToInsert = new List<Revenue_Schedule_Line__c>();
        for (Revenue_Schedule__c sch : schedulesToInsert) {
            List<Revenue_Schedule_Line__c> splitLines = splitRatableLines(sch.Method__c, sch.Start_Date__c, sch.End_Date__c, sch.Total__c);
            for (Revenue_Schedule_Line__c row : splitLines) {
                row.Revenue_Schedule__c = sch.Id;
                row.Adjustment_Type__c = 'ssp_allocation';
                linesToInsert.add(row);
            }
        }
        if (!linesToInsert.isEmpty()) {
            insert as system linesToInsert;
        }
    }

    private static List<Revenue_Schedule_Line__c> splitRatableLines(String method, Date start, Date finish, Decimal amount) {
        List<Revenue_Schedule_Line__c> rows = new List<Revenue_Schedule_Line__c>();
        if (method != 'ratable' || start == null || finish == null || start >= finish) {
            rows.add(new Revenue_Schedule_Line__c(
                Period_Start__c = start,
                Period_End__c = method == 'milestone' ? finish : start,
                Amount__c = amount,
                Adjustment_Type__c = 'original'
            ));
            return rows;
        }
        Integer totalDays = start.daysBetween(finish) + 1;
        Decimal given = 0;
        Date cursor = start;
        while (cursor <= finish) {
            Date monthEnd = cursor.toStartOfMonth().addMonths(1).addDays(-1);
            Date periodEnd = monthEnd < finish ? monthEnd : finish;
            Decimal share;
            if (periodEnd == finish) {
                share = RevquilaCore.money(amount - given);
            } else {
                share = RevquilaCore.money(amount * (cursor.daysBetween(periodEnd) + 1) / totalDays);
            }
            given += share;
            rows.add(new Revenue_Schedule_Line__c(
                Period_Start__c = cursor,
                Period_End__c = periodEnd,
                Amount__c = share,
                Adjustment_Type__c = 'original'
            ));
            cursor = periodEnd.addDays(1);
        }
        return rows;
    }

    /* =========================================================================
     * 2. CONTRACT MODIFICATION HANDLING (ASC 606)
     * ========================================================================= */

    /**
     * Recalculates revenue schedules on contract/subscription modification:
     * - prospective: leaves recognized revenue untouched, redistributes remaining unearned balance over remaining periods.
     * - cumulative_catch_up: recalculates revenue as if new contract terms applied from day 1, posts catch-up adjustment in current period.
     * - termination: zeroes out future unearned schedule lines and completes/cancels schedule.
     */
    public static void handleContractModification(Id subscriptionId, String modificationType, String reason) {
        if (String.isBlank(modificationType)) {
            modificationType = 'prospective';
        }

        List<Revenue_Schedule__c> schedules = [
            SELECT Id, Account__c, Total__c, Method__c, Start_Date__c, End_Date__c,
                   Recognized_Amount__c, Deferred_Amount__c, Status__c,
                   (SELECT Id, Period_Start__c, Period_End__c, Amount__c, Recognized__c, Period_Locked__c, Adjustment_Type__c
                    FROM Periods__r
                    ORDER BY Period_Start__c ASC)
            FROM Revenue_Schedule__c
            WHERE Subscription__c = :subscriptionId
            WITH SYSTEM_MODE
        ];

        if (schedules.isEmpty()) {
            return;
        }

        Subscription__c sub = [
            SELECT Id, Start_Date__c, Renewal_Date__c, Contract_MRR__c, Status__c
            FROM Subscription__c
            WHERE Id = :subscriptionId
            WITH SYSTEM_MODE
        ];

        Date today = Date.today();
        List<Revenue_Schedule_Line__c> linesToUpdate = new List<Revenue_Schedule_Line__c>();
        List<Revenue_Schedule_Line__c> linesToDelete = new List<Revenue_Schedule_Line__c>();
        List<Revenue_Schedule_Line__c> linesToInsert = new List<Revenue_Schedule_Line__c>();
        List<Revenue_Schedule__c> schedulesToUpdate = new List<Revenue_Schedule__c>();

        for (Revenue_Schedule__c sch : schedules) {
            sch.Modification_Type__c = modificationType;

            Decimal alreadyRecognized = 0;
            List<Revenue_Schedule_Line__c> openLines = new List<Revenue_Schedule_Line__c>();
            for (Revenue_Schedule_Line__c line : sch.Periods__r) {
                if (line.Recognized__c == true) {
                    alreadyRecognized += RevquilaCore.orZero(line.Amount__c);
                } else if (!line.Period_Locked__c) {
                    openLines.add(line);
                }
            }

            if (modificationType == 'termination') {
                for (Revenue_Schedule_Line__c l : openLines) {
                    linesToDelete.add(l);
                }
                sch.Status__c = 'complete';
                schedulesToUpdate.add(sch);
                continue;
            }

            if (openLines.isEmpty()) {
                schedulesToUpdate.add(sch);
                continue;
            }

            Decimal remainingContractValue = (RevquilaCore.orZero(sub.Contract_MRR__c) * 12);
            Date modStart = openLines[0].Period_Start__c;
            Date modEnd = sch.End_Date__c != null && sch.End_Date__c > modStart ? sch.End_Date__c : sub.Renewal_Date__c;
            if (modEnd == null || modEnd <= modStart) {
                modEnd = modStart.addMonths(12).addDays(-1);
            }

            if (modificationType == 'prospective') {
                // Remove future open lines and regenerate them ratably with remaining consideration
                for (Revenue_Schedule_Line__c l : openLines) {
                    linesToDelete.add(l);
                }
                Decimal unearnedAmount = remainingContractValue > 0 ? remainingContractValue : RevquilaCore.orZero(sch.Deferred_Amount__c);
                List<Revenue_Schedule_Line__c> newLines = splitRatableLines(sch.Method__c, modStart, modEnd, unearnedAmount);
                for (Revenue_Schedule_Line__c nl : newLines) {
                    nl.Revenue_Schedule__c = sch.Id;
                    nl.Adjustment_Type__c = 'modification';
                    linesToInsert.add(nl);
                }
                sch.Total__c = alreadyRecognized + unearnedAmount;
                schedulesToUpdate.add(sch);

            } else if (modificationType == 'cumulative_catch_up') {
                // Cumulative catch up: recalculate percentage of entire term that has elapsed
                Date originStart = sch.Start_Date__c != null ? sch.Start_Date__c : sub.Start_Date__c;
                Integer elapsedDays = originStart != null ? originStart.daysBetween(today) : 0;
                Integer fullTermDays = originStart != null && modEnd != null ? originStart.daysBetween(modEnd) : 365;
                if (fullTermDays <= 0) fullTermDays = 1;
                if (elapsedDays < 0) elapsedDays = 0;
                if (elapsedDays > fullTermDays) elapsedDays = fullTermDays;

                Decimal newTotalValue = remainingContractValue > 0 ? remainingContractValue : sch.Total__c;
                Decimal expectedRecognized = RevquilaCore.money(newTotalValue * ((Decimal)elapsedDays / fullTermDays));
                Decimal catchUpAdjustment = expectedRecognized - alreadyRecognized;

                // Insert immediate catch-up line in current period
                if (catchUpAdjustment != 0) {
                    Revenue_Schedule_Line__c catchUpLine = new Revenue_Schedule_Line__c(
                        Revenue_Schedule__c = sch.Id,
                        Period_Start__c = today.toStartOfMonth(),
                        Period_End__c = today,
                        Amount__c = catchUpAdjustment,
                        Recognized__c = true,
                        Recognized_On__c = today,
                        Adjustment_Type__c = 'modification'
                    );
                    linesToInsert.add(catchUpLine);
                }

                // Redistribute remaining balance over open periods
                for (Revenue_Schedule_Line__c l : openLines) {
                    linesToDelete.add(l);
                }
                Decimal remainingAfterCatchUp = newTotalValue - expectedRecognized;
                if (remainingAfterCatchUp > 0 && modEnd > today) {
                    List<Revenue_Schedule_Line__c> futureLines = splitRatableLines(sch.Method__c, today.addDays(1), modEnd, remainingAfterCatchUp);
                    for (Revenue_Schedule_Line__c fl : futureLines) {
                        fl.Revenue_Schedule__c = sch.Id;
                        fl.Adjustment_Type__c = 'modification';
                        linesToInsert.add(fl);
                    }
                }
                sch.Total__c = newTotalValue;
                schedulesToUpdate.add(sch);
            }
        }

        if (!linesToDelete.isEmpty()) {
            delete as system linesToDelete;
        }
        if (!linesToInsert.isEmpty()) {
            insert as system linesToInsert;
        }
        if (!schedulesToUpdate.isEmpty()) {
            update as system schedulesToUpdate;
        }

        // Log Revenue Event
        Revenue_Event__c evt = new Revenue_Event__c(
            Subscription__c = subscriptionId,
            Title__c = 'Contract Modification Recalculated',
            Detail__c = 'Modification (' + modificationType + '): ' + (reason == null ? 'Subscription terms modified' : reason),
            Kind__c = 'Revenue Schedule Reallocated',
            Occurred_On__c = Date.today(),
            Tone__c = RevquilaCore.TONE_ACCENT
        );
        insert as system evt;
    }

    /* =========================================================================
     * 3. CREDIT NOTE REVENUE ADJUSTMENTS
     * ========================================================================= */

    /**
     * When a credit note is created, reduces deferred revenue first;
     * any remaining excess is recognized as a contra-revenue adjustment in the current open period.
     */
    public static void applyCreditNoteRevenueAdjustment(Id creditNoteId) {
        Credit_Note__c cn = [
            SELECT Id, Amount__c, Invoice__c, Reason__c, Issued_On__c
            FROM Credit_Note__c
            WHERE Id = :creditNoteId
            WITH SYSTEM_MODE
        ];

        if (cn.Invoice__c == null || cn.Amount__c == null || cn.Amount__c <= 0) {
            return;
        }

        List<Revenue_Schedule__c> schedules = [
            SELECT Id, Total__c, Recognized_Amount__c, Deferred_Amount__c, Status__c,
                   (SELECT Id, Period_Start__c, Period_End__c, Amount__c, Recognized__c, Period_Locked__c
                    FROM Periods__r
                    WHERE Period_Locked__c = FALSE
                    ORDER BY Period_Start__c DESC)
            FROM Revenue_Schedule__c
            WHERE Invoice__c = :cn.Invoice__c
            WITH SYSTEM_MODE
        ];

        if (schedules.isEmpty()) {
            return;
        }

        Decimal creditRemaining = cn.Amount__c;
        List<Revenue_Schedule_Line__c> linesToUpdate = new List<Revenue_Schedule_Line__c>();
        List<Revenue_Schedule_Line__c> linesToDelete = new List<Revenue_Schedule_Line__c>();
        List<Revenue_Schedule_Line__c> linesToInsert = new List<Revenue_Schedule_Line__c>();
        List<Revenue_Schedule__c> schedulesToUpdate = new List<Revenue_Schedule__c>();

        for (Revenue_Schedule__c sch : schedules) {
            if (creditRemaining <= 0) break;

            for (Revenue_Schedule_Line__c line : sch.Periods__r) {
                if (creditRemaining <= 0) break;
                if (line.Recognized__c == false) {
                    Decimal currentAmount = RevquilaCore.orZero(line.Amount__c);
                    if (currentAmount <= creditRemaining) {
                        creditRemaining -= currentAmount;
                        linesToDelete.add(line);
                    } else {
                        line.Amount__c = currentAmount - creditRemaining;
                        line.Adjustment_Type__c = 'credit_note';
                        linesToUpdate.add(line);
                        creditRemaining = 0;
                    }
                }
            }
        }

        // If credit exceeds unearned deferred revenue, post contra-revenue line on primary schedule
        if (creditRemaining > 0 && !schedules.isEmpty()) {
            Revenue_Schedule__c primary = schedules[0];
            Revenue_Schedule_Line__c contraLine = new Revenue_Schedule_Line__c(
                Revenue_Schedule__c = primary.Id,
                Period_Start__c = cn.Issued_On__c != null ? cn.Issued_On__c.toStartOfMonth() : Date.today().toStartOfMonth(),
                Period_End__c = cn.Issued_On__c != null ? cn.Issued_On__c : Date.today(),
                Amount__c = -creditRemaining,
                Recognized__c = true,
                Recognized_On__c = cn.Issued_On__c != null ? cn.Issued_On__c : Date.today(),
                Adjustment_Type__c = 'credit_note'
            );
            linesToInsert.add(contraLine);
        }

        if (!linesToDelete.isEmpty()) {
            delete as system linesToDelete;
        }
        if (!linesToUpdate.isEmpty()) {
            update as system linesToUpdate;
        }
        if (!linesToInsert.isEmpty()) {
            insert as system linesToInsert;
        }

        // Audit Event
        Revenue_Event__c evt = new Revenue_Event__c(
            Invoice__c = cn.Invoice__c,
            Revenue_Schedule__c = schedules[0].Id,
            Title__c = 'Credit Note Revenue Adjustment',
            Detail__c = 'Adjusted ' + cn.Amount__c + ' for Credit Note: ' + (cn.Reason__c == null ? '' : cn.Reason__c),
            Kind__c = 'Credit Adjustment',
            Occurred_On__c = cn.Issued_On__c != null ? cn.Issued_On__c : Date.today(),
            Tone__c = RevquilaCore.TONE_WARN
        );
        insert as system evt;
    }

    /* =========================================================================
     * 4. UNBILLED REVENUE (CONTRACT ASSET) & USAGE METERING
     * ========================================================================= */

    /**
     * Calculates unbilled revenue (ASC 606 Contract Asset) for metered usage records.
     */
    public static Decimal calculateUnbilledRevenue(Id subscriptionId) {
        List<Usage_Record__c> unbilled = [
            SELECT Id, Quantity__c, Subscription_Item__r.Usage_Price__c, Subscription_Item__r.Unit_Price__c
            FROM Usage_Record__c
            WHERE Subscription__c = :subscriptionId AND Billed__c = FALSE
            WITH SYSTEM_MODE
        ];

        Decimal unbilledTotal = 0;
        for (Usage_Record__c u : unbilled) {
            Decimal rate = u.Subscription_Item__r.Usage_Price__c != null ? u.Subscription_Item__r.Usage_Price__c : u.Subscription_Item__r.Unit_Price__c;
            unbilledTotal += RevquilaCore.orZero(u.Quantity__c) * RevquilaCore.orZero(rate);
        }

        // Update active revenue schedule's Contract Asset balance
        List<Revenue_Schedule__c> activeSchedules = [
            SELECT Id, Contract_Asset_Balance__c
            FROM Revenue_Schedule__c
            WHERE Subscription__c = :subscriptionId AND Status__c = 'open'
            WITH SYSTEM_MODE
            LIMIT 1
        ];
        if (!activeSchedules.isEmpty()) {
            activeSchedules[0].Contract_Asset_Balance__c = unbilledTotal;
            update as system activeSchedules;
        }

        return unbilledTotal;
    }

    /**
     * Accrues unbilled revenue into earned revenue ahead of the invoicing cycle.
     */
    public static void accrueUnbilledRevenue(Id subscriptionId, Date accrualDate) {
        Decimal unbilledAmount = calculateUnbilledRevenue(subscriptionId);
        if (unbilledAmount <= 0) {
            return;
        }

        List<Revenue_Schedule__c> activeSchedules = [
            SELECT Id, Account__c
            FROM Revenue_Schedule__c
            WHERE Subscription__c = :subscriptionId AND Status__c = 'open'
            WITH SYSTEM_MODE
            LIMIT 1
        ];

        if (activeSchedules.isEmpty()) {
            return;
        }

        Revenue_Schedule_Line__c accrualLine = new Revenue_Schedule_Line__c(
            Revenue_Schedule__c = activeSchedules[0].Id,
            Period_Start__c = accrualDate.toStartOfMonth(),
            Period_End__c = accrualDate,
            Amount__c = unbilledAmount,
            Recognized__c = true,
            Recognized_On__c = accrualDate,
            Adjustment_Type__c = 'unbilled_accrual'
        );
        insert as system accrualLine;

        // Reset unbilled contract asset balance
        activeSchedules[0].Contract_Asset_Balance__c = 0;
        update as system activeSchedules;
    }

    /* =========================================================================
     * 5. PERIOD LOCK (MONTH-END CLOSE) GOVERNANCE
     * ========================================================================= */

    /**
     * Closes and locks an accounting period. Prevents modification or recognition
     * of revenue lines ending within the period.
     */
    public static Revenue_Period_Lock__c lockPeriod(Date startDate, Date endDate, String notes) {
        RevquilaCore.need(startDate != null && endDate != null && startDate <= endDate, 'Valid start and end dates required to lock a period.');

        String periodName = DateTime.newInstance(startDate, Time.newInstance(0,0,0,0)).format('yyyy-MMM');

        Revenue_Period_Lock__c lockRecord = new Revenue_Period_Lock__c(
            Name = 'Period ' + periodName,
            Period_Start__c = startDate,
            Period_End__c = endDate,
            Status__c = 'Locked',
            Locked_On__c = DateTime.now(),
            Locked_By__c = UserInfo.getUserId(),
            Notes__c = notes
        );
        insert as system lockRecord;

        // Mark all lines within period as Period_Locked__c
        List<Revenue_Schedule_Line__c> linesInPeriod = [
            SELECT Id, Period_Locked__c
            FROM Revenue_Schedule_Line__c
            WHERE Period_End__c >= :startDate AND Period_End__c <= :endDate
            WITH SYSTEM_MODE
            LIMIT 10000
        ];
        for (Revenue_Schedule_Line__c line : linesInPeriod) {
            line.Period_Locked__c = true;
        }
        if (!linesInPeriod.isEmpty()) {
            update as system linesInPeriod;
        }

        try {
            RevquilaAuditService.log(
                RevquilaAuditService.EVENT_PERIOD_LOCK,
                lockRecord.Id,
                lockRecord.Name,
                'Revenue_Period_Lock__c',
                'Period Lock',
                'Open',
                'Locked (' + startDate + ' to ' + endDate + ')',
                notes
            );
        } catch (Exception ex) {
            System.debug(LoggingLevel.WARN, 'Audit log deferred: ' + ex.getMessage());
        }

        return lockRecord;
    }

    /**
     * Reopens a locked period with mandatory justification reason.
     */
    public static Revenue_Period_Lock__c reopenPeriod(Id periodLockId, String reason) {
        RevquilaCore.need(String.isNotBlank(reason), 'Justification reason is required to reopen a closed accounting period.');

        Revenue_Period_Lock__c lockRecord = [
            SELECT Id, Name, Period_Start__c, Period_End__c, Status__c
            FROM Revenue_Period_Lock__c
            WHERE Id = :periodLockId
            WITH SYSTEM_MODE
        ];

        lockRecord.Status__c = 'Reopened';
        lockRecord.Reopened_On__c = DateTime.now();
        lockRecord.Reopened_By__c = UserInfo.getUserId();
        lockRecord.Reopened_Reason__c = reason;
        update as system lockRecord;

        // Unlock corresponding lines
        List<Revenue_Schedule_Line__c> linesInPeriod = [
            SELECT Id, Period_Locked__c
            FROM Revenue_Schedule_Line__c
            WHERE Period_End__c >= :lockRecord.Period_Start__c AND Period_End__c <= :lockRecord.Period_End__c
            WITH SYSTEM_MODE
            LIMIT 10000
        ];
        for (Revenue_Schedule_Line__c line : linesInPeriod) {
            line.Period_Locked__c = false;
        }
        if (!linesInPeriod.isEmpty()) {
            update as system linesInPeriod;
        }

        try {
            RevquilaAuditService.log(
                RevquilaAuditService.EVENT_PERIOD_REOPEN,
                lockRecord.Id,
                lockRecord.Name,
                'Revenue_Period_Lock__c',
                'Period Reopen',
                'Locked',
                'Reopened',
                reason
            );
        } catch (Exception ex) {
            System.debug(LoggingLevel.WARN, 'Audit log deferred: ' + ex.getMessage());
        }

        return lockRecord;
    }

    /**
     * Validates that lines are not within any active locked periods.
     * Throws an exception or adds errors if attempted.
     */
    public static void validatePeriodNotLocked(List<Revenue_Schedule_Line__c> lines) {
        List<Revenue_Period_Lock__c> activeLocks = [
            SELECT Period_Start__c, Period_End__c, Name
            FROM Revenue_Period_Lock__c
            WHERE Status__c = 'Locked'
            WITH SYSTEM_MODE
        ];

        if (activeLocks.isEmpty()) {
            return;
        }

        for (Revenue_Schedule_Line__c line : lines) {
            Date targetDate = line.Period_End__c != null ? line.Period_End__c : line.Period_Start__c;
            if (targetDate == null) continue;

            for (Revenue_Period_Lock__c lockRec : activeLocks) {
                if (targetDate >= lockRec.Period_Start__c && targetDate <= lockRec.Period_End__c) {
                    line.addError('Accounting period ' + lockRec.Name + ' is LOCKED. Changes are prohibited without authorized reopening.');
                    break;
                }
            }
        }
    }

    public static List<PeriodLockView> getPeriodLocks() {
        List<PeriodLockView> result = new List<PeriodLockView>();
        for (Revenue_Period_Lock__c row : [
            SELECT Id, Name, Period_Start__c, Period_End__c, Status__c, Locked_On__c, Locked_By__r.Name,
                   Reopened_On__c, Reopened_By__r.Name, Reopened_Reason__c, Notes__c
            FROM Revenue_Period_Lock__c
            WITH SYSTEM_MODE
            ORDER BY Period_Start__c DESC
            LIMIT 50
        ]) {
            PeriodLockView v = new PeriodLockView();
            v.id = row.Id;
            v.name = row.Name;
            v.startDate = row.Period_Start__c;
            v.endDate = row.Period_End__c;
            v.status = row.Status__c;
            v.lockedOn = row.Locked_On__c;
            v.lockedByName = row.Locked_By__r?.Name;
            v.reopenedOn = row.Reopened_On__c;
            v.reopenedByName = row.Reopened_By__r?.Name;
            v.reopenedReason = row.Reopened_Reason__c;
            v.notes = row.Notes__c;
            result.add(v);
        }
        return result;
    }

    /* =========================================================================
     * 6. ACCOUNTING SYNC ENGINES (TALLY PRIME, QUICKBOOKS, ZOHO BOOKS)
     * ========================================================================= */

    /**
     * Generates Tally Prime XML Journal import payload for recognized revenue entries.
     */
    public static String generateTallyXml(Date fromDate, Date toDate) {
        List<Revenue_Schedule_Line__c> rows = [
            SELECT Id, Recognized_On__c, Amount__c,
                   Revenue_Schedule__r.Name, Revenue_Schedule__r.Account__r.Name,
                   Revenue_Schedule__r.Product__r.Name, Revenue_Schedule__r.Invoice__r.Number__c
            FROM Revenue_Schedule_Line__c
            WHERE Recognized__c = TRUE AND Recognized_On__c >= :fromDate AND Recognized_On__c <= :toDate
            WITH SYSTEM_MODE
            ORDER BY Recognized_On__c
            LIMIT 1000
        ];

        String xml = '<ENVELOPE>\n' +
            '  <HEADER>\n' +
            '    <TALLYREQUEST>Import Data</TALLYREQUEST>\n' +
            '  </HEADER>\n' +
            '  <BODY>\n' +
            '    <IMPORTDATA>\n' +
            '      <REQUESTDESC>\n' +
            '        <REPORTNAME>Vouchers</REPORTNAME>\n' +
            '      </REQUESTDESC>\n' +
            '      <REQUESTDATA>\n';

        for (Revenue_Schedule_Line__c r : rows) {
            String dateStr = DateTime.newInstance(r.Recognized_On__c, Time.newInstance(0,0,0,0)).format('yyyyMMdd');
            String narration = 'RevX Recognized Revenue: ' + (r.Revenue_Schedule__r.Product__r?.Name != null ? r.Revenue_Schedule__r.Product__r.Name : r.Revenue_Schedule__r.Name);
            Decimal amt = RevquilaCore.money(r.Amount__c);

            xml += '        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n' +
                '          <VOUCHER VCHTYPE="Journal" ACTION="Create">\n' +
                '            <DATE>' + dateStr + '</DATE>\n' +
                '            <NARRATION>' + escapeXml(narration) + '</NARRATION>\n' +
                '            <ALLLEDGERENTRIES.LIST>\n' +
                '              <LEDGERNAME>Deferred Revenue</LEDGERNAME>\n' +
                '              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n' +
                '              <AMOUNT>-' + amt.toPlainString() + '</AMOUNT>\n' +
                '            </ALLLEDGERENTRIES.LIST>\n' +
                '            <ALLLEDGERENTRIES.LIST>\n' +
                '              <LEDGERNAME>Sales Revenue</LEDGERNAME>\n' +
                '              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n' +
                '              <AMOUNT>' + amt.toPlainString() + '</AMOUNT>\n' +
                '            </ALLLEDGERENTRIES.LIST>\n' +
                '          </VOUCHER>\n' +
                '        </TALLYMESSAGE>\n';
        }

        xml += '      </REQUESTDATA>\n' +
            '    </IMPORTDATA>\n' +
            '  </BODY>\n' +
            '</ENVELOPE>';

        return xml;
    }

    /**
     * Generates QuickBooks Online REST API JournalEntry JSON structure.
     */
    public static String generateQuickBooksJson(Date fromDate, Date toDate) {
        List<Revenue_Schedule_Line__c> rows = [
            SELECT Id, Recognized_On__c, Amount__c,
                   Revenue_Schedule__r.Name, Revenue_Schedule__r.Account__r.Name,
                   Revenue_Schedule__r.Product__r.Name
            FROM Revenue_Schedule_Line__c
            WHERE Recognized__c = TRUE AND Recognized_On__c >= :fromDate AND Recognized_On__c <= :toDate
            WITH SYSTEM_MODE
            ORDER BY Recognized_On__c
            LIMIT 500
        ];

        List<Map<String, Object>> entries = new List<Map<String, Object>>();
        for (Revenue_Schedule_Line__c r : rows) {
            Decimal amt = RevquilaCore.money(r.Amount__c);
            String descr = 'RevX Earned: ' + (r.Revenue_Schedule__r.Product__r?.Name != null ? r.Revenue_Schedule__r.Product__r.Name : r.Revenue_Schedule__r.Name);

            List<Map<String, Object>> lines = new List<Map<String, Object>>();
            // Debit Deferred Revenue
            lines.add(new Map<String, Object>{
                'DetailType' => 'JournalEntryLineDetail',
                'Amount' => amt,
                'Description' => descr,
                'JournalEntryLineDetail' => new Map<String, Object>{
                    'PostingType' => 'Debit',
                    'AccountRef' => new Map<String, Object>{ 'name' => 'Deferred Revenue' }
                }
            });
            // Credit Revenue
            lines.add(new Map<String, Object>{
                'DetailType' => 'JournalEntryLineDetail',
                'Amount' => amt,
                'Description' => descr,
                'JournalEntryLineDetail' => new Map<String, Object>{
                    'PostingType' => 'Credit',
                    'AccountRef' => new Map<String, Object>{ 'name' => 'Revenue' }
                }
            });

            entries.add(new Map<String, Object>{
                'TxnDate' => String.valueOf(r.Recognized_On__c),
                'DocNumber' => 'REV-' + r.Id,
                'PrivateNote' => descr,
                'Line' => lines
            });
        }

        return JSON.serializePretty(new Map<String, Object>{
            'BatchItemRequest' => entries,
            'source' => 'Revquila CPQ & Billing',
            'exportedAt' => DateTime.now()
        });
    }

    /**
     * Generates Zoho Books API Journal JSON payload.
     */
    public static String generateZohoBooksJson(Date fromDate, Date toDate) {
        List<Revenue_Schedule_Line__c> rows = [
            SELECT Id, Recognized_On__c, Amount__c,
                   Revenue_Schedule__r.Name, Revenue_Schedule__r.Account__r.Name,
                   Revenue_Schedule__r.Product__r.Name
            FROM Revenue_Schedule_Line__c
            WHERE Recognized__c = TRUE AND Recognized_On__c >= :fromDate AND Recognized_On__c <= :toDate
            WITH SYSTEM_MODE
            ORDER BY Recognized_On__c
            LIMIT 500
        ];

        List<Map<String, Object>> journals = new List<Map<String, Object>>();
        for (Revenue_Schedule_Line__c r : rows) {
            Decimal amt = RevquilaCore.money(r.Amount__c);
            String note = 'RevX Recognition: ' + (r.Revenue_Schedule__r.Product__r?.Name != null ? r.Revenue_Schedule__r.Product__r.Name : r.Revenue_Schedule__r.Name);

            List<Map<String, Object>> lineItems = new List<Map<String, Object>>{
                new Map<String, Object>{
                    'account_name' => 'Deferred Revenue',
                    'debit_or_credit' => 'd',
                    'amount' => amt,
                    'description' => note
                },
                new Map<String, Object>{
                    'account_name' => 'Operating Revenue',
                    'debit_or_credit' => 'c',
                    'amount' => amt,
                    'description' => note
                }
            };

            journals.add(new Map<String, Object>{
                'journal_date' => String.valueOf(r.Recognized_On__c),
                'reference_number' => 'REV-' + r.Id,
                'notes' => note,
                'line_items' => lineItems
            });
        }

        return JSON.serializePretty(new Map<String, Object>{
            'journals' => journals,
            'count' => journals.size(),
            'platform' => 'RevX ASC 606 Engine'
        });
    }

    private static String escapeXml(String s) {
        if (s == null) return '';
        return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace('\'', '&apos;');
    }

    /* =========================================================================
     * 7. ASC 606 ADVANCED REPORTS
     * ========================================================================= */

    /**
     * Generates Deferred Revenue Rollforward report:
     * Beginning Deferred + New Billings - Recognized Revenue +/- Adjustments = Ending Deferred
     */
    public static RollforwardReport getRollforwardReport(Date fromDate, Date toDate) {
        RollforwardReport rep = new RollforwardReport();
        rep.currencyCode = RevquilaSettings.current().home.currencyCode;

        // Beginning deferred: sum of unrecognized lines before fromDate
        Decimal beg = 0;
        for (Revenue_Schedule_Line__c l : [
            SELECT Amount__c FROM Revenue_Schedule_Line__c
            WHERE Period_Start__c < :fromDate AND (Recognized__c = FALSE OR Recognized_On__c >= :fromDate)
            WITH SYSTEM_MODE
        ]) {
            beg += RevquilaCore.orZero(l.Amount__c);
        }
        rep.beginningDeferred = RevquilaCore.money(beg);

        // New billings: schedules created between fromDate and toDate
        Decimal billings = 0;
        for (Revenue_Schedule__c sch : [
            SELECT Total__c FROM Revenue_Schedule__c
            WHERE Start_Date__c >= :fromDate AND Start_Date__c <= :toDate
            WITH SYSTEM_MODE
        ]) {
            billings += RevquilaCore.orZero(sch.Total__c);
        }
        rep.newBillings = RevquilaCore.money(billings);

        // Recognized revenue in window
        Decimal recognized = 0;
        for (Revenue_Schedule_Line__c l : [
            SELECT Amount__c FROM Revenue_Schedule_Line__c
            WHERE Recognized__c = TRUE AND Recognized_On__c >= :fromDate AND Recognized_On__c <= :toDate
            WITH SYSTEM_MODE
        ]) {
            recognized += RevquilaCore.orZero(l.Amount__c);
        }
        rep.recognizedRevenue = RevquilaCore.money(recognized);

        // Credit note adjustments in window
        Decimal credits = 0;
        for (Credit_Note__c cn : [
            SELECT Amount__c FROM Credit_Note__c
            WHERE Issued_On__c >= :fromDate AND Issued_On__c <= :toDate
            WITH SYSTEM_MODE
        ]) {
            credits += RevquilaCore.orZero(cn.Amount__c);
        }
        rep.creditNoteAdjustments = RevquilaCore.money(credits);

        rep.endingDeferred = rep.beginningDeferred + rep.newBillings - rep.recognizedRevenue - rep.creditNoteAdjustments;
        return rep;
    }

    /**
     * Compares Billings vs Revenue month-by-month.
     */
    public static List<BillingVsRevenueMonth> getBillingsVsRevenue(Date fromDate, Date toDate) {
        Map<String, BillingVsRevenueMonth> monthsMap = new Map<String, BillingVsRevenueMonth>();

        Date cursor = fromDate.toStartOfMonth();
        Date finish = toDate.toStartOfMonth();
        while (cursor <= finish) {
            String key = DateTime.newInstance(cursor, Time.newInstance(0,0,0,0)).format('yyyy-MM');
            String label = DateTime.newInstance(cursor, Time.newInstance(0,0,0,0)).format('MMM yyyy');
            BillingVsRevenueMonth m = new BillingVsRevenueMonth();
            m.monthKey = key;
            m.monthLabel = label;
            m.billedAmount = 0;
            m.recognizedAmount = 0;
            m.variance = 0;
            monthsMap.put(key, m);
            cursor = cursor.addMonths(1);
        }

        // Aggregate Billings from Invoices
        for (Invoice__c inv : [
            SELECT Issued_On__c, Total__c, Exchange_Rate__c
            FROM Invoice__c
            WHERE Issued_On__c >= :fromDate AND Issued_On__c <= :toDate
            WITH SYSTEM_MODE
        ]) {
            if (inv.Issued_On__c == null) continue;
            String key = DateTime.newInstance(inv.Issued_On__c, Time.newInstance(0,0,0,0)).format('yyyy-MM');
            BillingVsRevenueMonth m = monthsMap.get(key);
            if (m != null) {
                m.billedAmount += RevquilaCore.toBase(inv.Total__c, inv.Exchange_Rate__c);
            }
        }

        // Aggregate Recognized Revenue from lines
        for (Revenue_Schedule_Line__c l : [
            SELECT Recognized_On__c, Amount__c
            FROM Revenue_Schedule_Line__c
            WHERE Recognized__c = TRUE AND Recognized_On__c >= :fromDate AND Recognized_On__c <= :toDate
            WITH SYSTEM_MODE
        ]) {
            if (l.Recognized_On__c == null) continue;
            String key = DateTime.newInstance(l.Recognized_On__c, Time.newInstance(0,0,0,0)).format('yyyy-MM');
            BillingVsRevenueMonth m = monthsMap.get(key);
            if (m != null) {
                m.recognizedAmount += RevquilaCore.orZero(l.Amount__c);
            }
        }

        List<BillingVsRevenueMonth> results = new List<BillingVsRevenueMonth>();
        for (String k : monthsMap.keySet()) {
            BillingVsRevenueMonth item = monthsMap.get(k);
            item.billedAmount = RevquilaCore.money(item.billedAmount);
            item.recognizedAmount = RevquilaCore.money(item.recognizedAmount);
            item.variance = RevquilaCore.money(item.billedAmount - item.recognizedAmount);
            results.add(item);
        }
        return results;
    }

    /**
     * Breakdown of revenue grouped by Product and POB Type.
     */
    public static List<ProductRevenueSummary> getRevenueByProduct(Date fromDate, Date toDate) {
        Map<Id, ProductRevenueSummary> summaryMap = new Map<Id, ProductRevenueSummary>();

        for (Revenue_Schedule__c sch : [
            SELECT Product__c, Product__r.Name, Product__r.POB_Type__c, Method__c, Total__c,
                   Recognized_Amount__c, Deferred_Amount__c
            FROM Revenue_Schedule__c
            WHERE Start_Date__c >= :fromDate AND Start_Date__c <= :toDate AND Product__c != NULL
            WITH SYSTEM_MODE
        ]) {
            Id prodId = sch.Product__c;
            ProductRevenueSummary s = summaryMap.get(prodId);
            if (s == null) {
                s = new ProductRevenueSummary();
                s.productId = prodId;
                s.productName = sch.Product__r?.Name;
                s.pobType = sch.Product__r?.POB_Type__c != null ? sch.Product__r.POB_Type__c : 'license';
                s.revenueMethod = sch.Method__c;
                s.totalAmount = 0;
                s.recognizedAmount = 0;
                s.deferredAmount = 0;
                summaryMap.put(prodId, s);
            }
            s.totalAmount += RevquilaCore.orZero(sch.Total__c);
            s.recognizedAmount += RevquilaCore.orZero(sch.Recognized_Amount__c);
            s.deferredAmount += RevquilaCore.orZero(sch.Deferred_Amount__c);
        }

        List<ProductRevenueSummary> listSummary = summaryMap.values();
        for (ProductRevenueSummary item : listSummary) {
            item.totalAmount = RevquilaCore.money(item.totalAmount);
            item.recognizedAmount = RevquilaCore.money(item.recognizedAmount);
            item.deferredAmount = RevquilaCore.money(item.deferredAmount);
        }
        return listSummary;
    }
}
