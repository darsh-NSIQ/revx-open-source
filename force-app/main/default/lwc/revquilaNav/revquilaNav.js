import LOGO from "@salesforce/resourceUrl/revquilaLogo";

// The namespace the code runs under: "Revquila" in the namespaced org and in the
// managed package, undefined in an org without one. Tab and component names need
// it, and a resource URL is where LWC exposes it: /resource/<id>/Revquila__revquilaLogo
export const NAMESPACE = (LOGO.match(/([A-Za-z0-9]+)__revquilaLogo/) || [])[1];

function tabPage(name) {
  return {
    type: "standard__navItemPage",
    attributes: { apiName: NAMESPACE ? `${NAMESPACE}__${name}` : name }
  };
}

// A URL-addressable component showing one record, picked by a c__ state parameter
function recordPage(componentName, state) {
  return {
    type: "standard__component",
    attributes: { componentName: `${NAMESPACE || "c"}__${componentName}` },
    state
  };
}

export const COMMAND_CENTER_PAGE = tabPage("Revquila_Command_Center");
export const CATALOG_PAGE = tabPage("Revquila_Catalog");
export const PRICING_PAGE = tabPage("Revquila_Pricing");
export const GUIDED_SELLING_PAGE = tabPage("Revquila_Guided_Selling");
export const ORDERS_PAGE = tabPage("Revquila_Orders");
export const CONTRACTS_PAGE = tabPage("Revquila_Contracts");
export const QUOTES_PAGE = tabPage("Revquila_Quotes");
export const APPROVALS_PAGE = tabPage("Revquila_Approvals");
export const SUBSCRIPTIONS_PAGE = tabPage("Revquila_Subscriptions");
export const USAGE_PAGE = tabPage("Revquila_Usage");
export const INVOICES_PAGE = tabPage("Revquila_Invoices");
export const DUNNING_PAGE = tabPage("Revquila_Dunning");
export const REVENUE_PAGE = tabPage("Revquila_Revenue");
export const WAR_ROOM_PAGE = tabPage("Revquila_War_Room");
export const RENEWALS_PAGE = tabPage("Revquila_Renewals");
export const TEMPLATES_PAGE = tabPage("Revquila_Templates");
export const SETUP_PAGE = tabPage("Revquila_Setup");

/** The Quote 360 view of one quote. The view reads state.c__quote. */
export function quotePage(quoteId) {
  return recordPage("revquilaQuote360", { c__quote: quoteId });
}

/** The Invoice 360 view of one invoice. The view reads state.c__invoice. */
export function invoicePage(invoiceId) {
  return recordPage("revquilaInvoice360", { c__invoice: invoiceId });
}

/** The Order 360 view of one order. The view reads state.c__order. */
export function orderPage(orderId) {
  return recordPage("revquilaOrder360", { c__order: orderId });
}

/** The Contract 360 view of one contract. The view reads state.c__contract. */
export function contractPage(contractId) {
  return recordPage("revquilaContract360", { c__contract: contractId });
}

/** The Subscription 360 view of one subscription. The view reads state.c__subscription. */
export function subscriptionPage(subscriptionId) {
  return recordPage("revquilaSubscription360", {
    c__subscription: subscriptionId
  });
}