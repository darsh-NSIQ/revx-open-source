/**
 * Payment Trigger: handles installment allocations and accounting reconciliation.
 */
trigger RevquilaPaymentTrigger on Payment__c (after insert) {
  if (Trigger.isAfter && Trigger.isInsert) {
    RevquilaPaymentTriggerHandler.handleAfterInsert(Trigger.new);
  }
}
