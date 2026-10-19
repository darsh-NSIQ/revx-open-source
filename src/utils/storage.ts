import { Quote, Order, Contract, Subscription, Invoice, Opportunity, Account, Contact, Lead } from '../types';
import {
  INITIAL_QUOTES,
  INITIAL_ORDERS,
  INITIAL_CONTRACTS,
  INITIAL_SUBSCRIPTIONS,
  INITIAL_INVOICES,
  INITIAL_OPPORTUNITIES,
  INITIAL_ACCOUNTS,
  INITIAL_CONTACTS,
  INITIAL_LEADS,
  INITIAL_SETUP_CONFIG,
} from '../data/mockData';
import { SetupConfig } from '../types';

const STORAGE_KEYS = {
  ACCOUNTS: 'revx_enterprise_accounts_v2',
  CONTACTS: 'revx_enterprise_contacts_v2',
  LEADS: 'revx_enterprise_leads_v2',
  OPPORTUNITIES: 'revx_enterprise_opportunities_v2',
  QUOTES: 'revx_enterprise_quotes_v2',
  ORDERS: 'revx_enterprise_orders_v2',
  CONTRACTS: 'revx_enterprise_contracts_v2',
  SUBSCRIPTIONS: 'revx_enterprise_subscriptions_v2',
  INVOICES: 'revx_enterprise_invoices_v2',
  SETUP_CONFIG: 'revx_enterprise_setup_config_v2',
};

function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T) : fallback;
  } catch (err) {
    console.warn(`[RevX Storage] Error parsing key ${key}:`, err);
    return fallback;
  }
}

function safeGetObject<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch (err) {
    console.warn(`[RevX Storage] Error parsing key ${key}:`, err);
    return fallback;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[RevX Storage] Error writing key ${key}:`, err);
  }
}

export function loadSetupConfig(): SetupConfig {
  const cfg = safeGetObject<SetupConfig>(STORAGE_KEYS.SETUP_CONFIG, INITIAL_SETUP_CONFIG);
  if (cfg.company?.name && (cfg.company.name.includes('Demo') || cfg.company.name.includes('Revquila'))) {
    cfg.company = { ...INITIAL_SETUP_CONFIG.company };
    safeSetItem(STORAGE_KEYS.SETUP_CONFIG, cfg);
  }
  return cfg;
}

export function saveSetupConfig(config: SetupConfig): void {
  safeSetItem(STORAGE_KEYS.SETUP_CONFIG, config);
}

export function loadAccounts(): Account[] {
  return safeGetItem<Account[]>(STORAGE_KEYS.ACCOUNTS, INITIAL_ACCOUNTS);
}

export function saveAccounts(accounts: Account[]): void {
  safeSetItem(STORAGE_KEYS.ACCOUNTS, accounts);
}

export function loadContacts(): Contact[] {
  return safeGetItem<Contact[]>(STORAGE_KEYS.CONTACTS, INITIAL_CONTACTS);
}

export function saveContacts(contacts: Contact[]): void {
  safeSetItem(STORAGE_KEYS.CONTACTS, contacts);
}

export function loadLeads(): Lead[] {
  return safeGetItem<Lead[]>(STORAGE_KEYS.LEADS, INITIAL_LEADS);
}

export function saveLeads(leads: Lead[]): void {
  safeSetItem(STORAGE_KEYS.LEADS, leads);
}

export function loadOpportunities(): Opportunity[] {
  return safeGetItem<Opportunity[]>(STORAGE_KEYS.OPPORTUNITIES, INITIAL_OPPORTUNITIES);
}

export function saveOpportunities(opportunities: Opportunity[]): void {
  safeSetItem(STORAGE_KEYS.OPPORTUNITIES, opportunities);
}

export function loadQuotes(): Quote[] {
  return safeGetItem<Quote[]>(STORAGE_KEYS.QUOTES, INITIAL_QUOTES);
}

export function saveQuotes(quotes: Quote[]): void {
  safeSetItem(STORAGE_KEYS.QUOTES, quotes);
}

export function loadOrders(): Order[] {
  return safeGetItem<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
}

export function saveOrders(orders: Order[]): void {
  safeSetItem(STORAGE_KEYS.ORDERS, orders);
}

export function loadContracts(): Contract[] {
  return safeGetItem<Contract[]>(STORAGE_KEYS.CONTRACTS, INITIAL_CONTRACTS);
}

export function saveContracts(contracts: Contract[]): void {
  safeSetItem(STORAGE_KEYS.CONTRACTS, contracts);
}

export function loadSubscriptions(): Subscription[] {
  return safeGetItem<Subscription[]>(STORAGE_KEYS.SUBSCRIPTIONS, INITIAL_SUBSCRIPTIONS);
}

export function saveSubscriptions(subscriptions: Subscription[]): void {
  safeSetItem(STORAGE_KEYS.SUBSCRIPTIONS, subscriptions);
}

export function loadInvoices(): Invoice[] {
  return safeGetItem<Invoice[]>(STORAGE_KEYS.INVOICES, INITIAL_INVOICES);
}

export function saveInvoices(invoices: Invoice[]): void {
  safeSetItem(STORAGE_KEYS.INVOICES, invoices);
}

export function resetAllDataToDefault(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('[RevX Storage] Reset failed:', err);
  }
}

export function exportAllStateAsJSON(payload: Record<string, unknown>): void {
  try {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `revx-q2c-export-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (err) {
    console.error('[RevX Storage] Export JSON error:', err);
  }
}
