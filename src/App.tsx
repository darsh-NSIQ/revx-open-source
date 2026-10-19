import React, { useState, useEffect } from 'react';
import { Currency, Quote, Invoice, Order, Contract, Subscription, Opportunity, Account, Contact, Lead } from './types';
import { 
  INITIAL_QUOTES, 
  INITIAL_INVOICES, 
  INITIAL_ORDERS, 
  INITIAL_CONTRACTS, 
  INITIAL_SUBSCRIPTIONS,
  INITIAL_OPPORTUNITIES,
  INITIAL_ACCOUNTS,
  INITIAL_CONTACTS,
  INITIAL_LEADS
} from './data/mockData';
import {
  loadQuotes,
  saveQuotes,
  loadOrders,
  saveOrders,
  loadContracts,
  saveContracts,
  loadSubscriptions,
  saveSubscriptions,
  loadInvoices,
  saveInvoices,
  loadOpportunities,
  saveOpportunities,
  loadAccounts,
  saveAccounts,
  loadContacts,
  saveContacts,
  loadLeads,
  saveLeads,
  resetAllDataToDefault,
  exportAllStateAsJSON,
  loadSetupConfig
} from './utils/storage';
import { applyBrandTheme } from './utils/theme';
import { SalesforceHeader } from './components/Navigation/SalesforceHeader';
import { CommandCenter } from './components/CommandCenter/CommandCenter';
import { LeadsStudio } from './components/Leads/LeadsStudio';
import { AccountsStudio } from './components/Accounts/AccountsStudio';
import { ContactsStudio } from './components/Contacts/ContactsStudio';
import { OpportunitiesStudio } from './components/Opportunities/OpportunitiesStudio';
import { QuotesList } from './components/Quotes/QuotesList';
import { Quote360 } from './components/Quotes/Quote360';
import { CPQStudio } from './components/CPQ/CPQStudio';
import { OrdersStudio } from './components/Orders/OrdersStudio';
import { ContractsStudio } from './components/Contracts/ContractsStudio';
import { ESignStudio } from './components/ESign/ESignStudio';
import { SignModal } from './components/ESign/SignModal';
import { InvoicesStudio } from './components/Billing/InvoicesStudio';
import { UsageMeteringStudio } from './components/Metering/UsageMeteringStudio';
import { CollectStudio } from './components/Collect/CollectStudio';
import { WarRoom } from './components/WarRoom/WarRoom';
import { RevRecStudio } from './components/RevRec/RevRecStudio';
import { SetupCockpit } from './components/Setup/SetupCockpit';
import { CompetitorMatrixModal } from './components/Modal/CompetitorMatrixModal';
import { CommandPaletteModal } from './components/Modal/CommandPaletteModal';
import { GuidedQ2CDemoModal } from './components/Modal/GuidedQ2CDemoModal';
import { DealRoomStudio } from './components/DealRoom/DealRoomStudio';
import { ApprovalMatrixStudio } from './components/Approvals/ApprovalMatrixStudio';
import { AccountHierarchyStudio } from './components/BillingPlatform/AccountHierarchyStudio';
import { Q2CArchitectureModal } from './components/Modal/Q2CArchitectureModal';
import { CursorMotion } from './components/Effects/CursorMotion';
import { SaaSBackground } from './components/Effects/SaaSBackground';
import { generateIRN } from './utils/crypto';

export function App() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) return tabParam;
      const hash = window.location.hash.replace('#', '');
      return hash || 'command-center';
    } catch {
      return 'command-center';
    }
  });

  // Keep URL search param in sync with activeTab
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== activeTab) {
        url.searchParams.set('tab', activeTab);
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // ignore
    }
  }, [activeTab]);

  // Synchronize dynamic branding accent color & logo across application
  useEffect(() => {
    try {
      const cfg = loadSetupConfig();
      if (cfg.brand?.accent) {
        applyBrandTheme(cfg.brand.accent, cfg.brand.logo);
      }
    } catch (e) {
      console.warn('[Brand Theme] Failed to load brand config:', e);
    }
  }, []);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts());
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts());
  const [leads, setLeads] = useState<Lead[]>(() => loadLeads());
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => loadOpportunities());
  const [quotes, setQuotes] = useState<Quote[]>(() => loadQuotes());
  const [orders, setOrders] = useState<Order[]>(() => loadOrders());
  const [contracts, setContracts] = useState<Contract[]>(() => loadContracts());
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => loadSubscriptions());
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadInvoices());
  
  // Navigation State for Quote 360 & CPQ
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isCreatingQuote, setIsCreatingQuote] = useState<boolean>(false);
  const [cpqInitialOpportunity, setCpqInitialOpportunity] = useState<{
    id: string;
    name: string;
    accountName: string;
    contactName?: string;
    contactEmail?: string;
  } | null>(null);
  const [signingQuote, setSigningQuote] = useState<Quote | null>(null);

  // Global Dialog Modals for Ergonomics & Competitor Demonstration
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isCompetitorMatrixOpen, setIsCompetitorMatrixOpen] = useState<boolean>(false);
  const [isGuidedDemoOpen, setIsGuidedDemoOpen] = useState<boolean>(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('architecture') === 'true' || params.get('blueprint') === 'true';
    } catch {
      return false;
    }
  });

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Auto-persist CRM & Quote-to-Cash data to localStorage
  useEffect(() => {
    saveAccounts(accounts);
  }, [accounts]);

  useEffect(() => {
    saveContacts(contacts);
  }, [contacts]);

  useEffect(() => {
    saveLeads(leads);
  }, [leads]);

  useEffect(() => {
    saveOpportunities(opportunities);
  }, [opportunities]);

  useEffect(() => {
    saveQuotes(quotes);
  }, [quotes]);

  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

  useEffect(() => {
    saveContracts(contracts);
  }, [contracts]);

  useEffect(() => {
    saveSubscriptions(subscriptions);
  }, [subscriptions]);

  useEffect(() => {
    saveInvoices(invoices);
  }, [invoices]);

  const handleResetFactoryData = () => {
    resetAllDataToDefault();
    setAccounts(INITIAL_ACCOUNTS);
    setContacts(INITIAL_CONTACTS);
    setLeads(INITIAL_LEADS);
    setOpportunities(INITIAL_OPPORTUNITIES);
    setQuotes(INITIAL_QUOTES);
    setOrders(INITIAL_ORDERS);
    setContracts(INITIAL_CONTRACTS);
    setSubscriptions(INITIAL_SUBSCRIPTIONS);
    setInvoices(INITIAL_INVOICES);
    setSelectedQuoteId(null);
  };

  const handleExportStateJSON = () => {
    exportAllStateAsJSON({
      exportedAt: new Date().toISOString(),
      currency,
      accounts,
      contacts,
      leads,
      opportunities,
      quotes,
      orders,
      contracts,
      subscriptions,
      invoices,
    });
  };

  const selectedQuote = quotes.find((q) => q.id === selectedQuoteId) || null;

  // Inject full enterprise deal across all 9 tabs
  const handleInjectDemoDeal = (data: {
    quote: Quote;
    order: Order;
    contract: Contract;
    subscription: Subscription;
    invoice: Invoice;
  }) => {
    setQuotes((prev) => [data.quote, ...prev]);
    setOrders((prev) => [data.order, ...prev]);
    setContracts((prev) => [data.contract, ...prev]);
    setSubscriptions((prev) => [data.subscription, ...prev]);
    setInvoices((prev) => [data.invoice, ...prev]);
    setSelectedQuoteId(data.quote.id);
  };

  // Update record handlers for all objects & tabs
  const handleUpdateQuote = (updatedQuote: Quote) => {
    setQuotes((prev) => prev.map((q) => (q.id === updatedQuote.id ? updatedQuote : q)));
  };

  const handleUpdateOrder = (updatedOrder: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
  };

  const handleUpdateContract = (updatedContract: Contract) => {
    setContracts((prev) => prev.map((c) => (c.id === updatedContract.id ? updatedContract : c)));
  };

  const handleUpdateSubscription = (updatedSub: Subscription) => {
    setSubscriptions((prev) => prev.map((s) => (s.id === updatedSub.id ? updatedSub : s)));
  };

  const handleUpdateInvoice = (updatedInvoice: Invoice) => {
    setInvoices((prev) => prev.map((i) => (i.id === updatedInvoice.id ? updatedInvoice : i)));
  };

  // Add new quote from CPQ studio
  const handleAddQuote = (newQuote: Quote) => {
    setQuotes([newQuote, ...quotes]);
    setIsCreatingQuote(false);
    setSelectedQuoteId(newQuote.id);

    // If quote was launched from an opportunity, link it and advance stage to 'Proposal / CPQ Quote'
    if (cpqInitialOpportunity) {
      setOpportunities((prev) =>
        prev.map((opp) => {
          if (opp.id === cpqInitialOpportunity.id) {
            return {
              ...opp,
              quoteId: newQuote.id,
              quoteNumber: newQuote.quoteNumber,
              amount: newQuote.totalAmount,
              stage: 'Proposal / CPQ Quote',
              probabilityPct: 75,
              forecastCategory: 'Commit',
              nextStep: 'Customer Review & eSignature Envelope Dispatch',
            };
          }
          return opp;
        })
      );
      setCpqInitialOpportunity(null);
    }
  };

  // CRM Account Handlers
  const handleCreateAccount = (newAccount: Account) => {
    setAccounts((prev) => [newAccount, ...prev]);
  };

  const handleUpdateAccount = (updatedAccount: Account) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === updatedAccount.id ? updatedAccount : a))
    );
  };

  const handleDeleteAccount = (accountId: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  };

  // CRM Contact Handlers
  const handleCreateContact = (newContact: Contact) => {
    setContacts((prev) => [newContact, ...prev]);
  };

  const handleUpdateContact = (updatedContact: Contact) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === updatedContact.id ? updatedContact : c))
    );
  };

  const handleDeleteContact = (contactId: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
  };

  // CRM Lead Handlers & Conversion Action
  const handleCreateLead = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === updatedLead.id ? updatedLead : l))
    );
  };

  const handleDeleteLead = (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  };

  const handleConvertLead = (data: {
    lead: Lead;
    account: Account;
    contact: Contact;
    opportunity?: Opportunity;
    launchCPQImmediately?: boolean;
  }) => {
    setLeads((prev) => prev.map((l) => (l.id === data.lead.id ? data.lead : l)));

    setAccounts((prev) => {
      const exists = prev.some(
        (a) => a.id === data.account.id || a.name.toLowerCase() === data.account.name.toLowerCase()
      );
      return exists ? prev : [data.account, ...prev];
    });

    setContacts((prev) => {
      const exists = prev.some(
        (c) => c.id === data.contact.id || (c.email && c.email.toLowerCase() === data.contact.email?.toLowerCase())
      );
      return exists ? prev : [data.contact, ...prev];
    });

    if (data.opportunity) {
      setOpportunities((prev) => [data.opportunity!, ...prev]);
      if (data.launchCPQImmediately) {
        handleLaunchCPQFromOpp(data.opportunity);
        return;
      }
    }

    setActiveTab('accounts');
  };

  // Opportunity Handlers
  const handleCreateOpportunity = (newOpp: Opportunity) => {
    setOpportunities((prev) => [newOpp, ...prev]);
  };

  const handleUpdateOpportunity = (updatedOpp: Opportunity) => {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === updatedOpp.id ? updatedOpp : o))
    );
  };

  const handleDeleteOpportunity = (oppId: string) => {
    setOpportunities((prev) => prev.filter((o) => o.id !== oppId));
  };

  const handleLaunchCPQFromOpp = (opp: Opportunity) => {
    setCpqInitialOpportunity({
      id: opp.id,
      name: opp.name,
      accountName: opp.accountName,
      contactName: opp.primaryContact,
      contactEmail: opp.contactEmail,
    });
    setSelectedQuoteId(null);
    setIsCreatingQuote(true);
    setActiveTab('quotes');
  };

  const handleViewQuoteFromOpp = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setIsCreatingQuote(false);
    setActiveTab('quotes');
  };

  // Stage Advance on Quote 360 (Chevron Path)
  const handleAdvanceStage = (quoteId: string, nextStatus: Quote['status']) => {
    if (nextStatus === 'Signed') {
      const q = quotes.find((item) => item.id === quoteId);
      if (q) setSigningQuote(q);
      return;
    }

    setQuotes((prev) =>
      prev.map((q) => {
        if (q.id === quoteId) {
          return {
            ...q,
            status: nextStatus,
          };
        }
        return q;
      })
    );
  };

  // Automated Salesforce End-to-End Q2C Master Pipeline upon Quote E-Signing
  const handleSignComplete = (
    quoteId: string,
    signatureData: string,
    digest: string,
    signerName: string
  ) => {
    const targetQuote = quotes.find((q) => q.id === quoteId);

    // 1. Mark Quote as Signed with SHA-256 Digest
    setQuotes((prev) =>
      prev.map((q) => {
        if (q.id === quoteId) {
          return {
            ...q,
            status: 'Signed',
            signatureData,
            signatureDigest: digest,
            signedByName: signerName,
            signedAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
          };
        }
        return q;
      })
    );

    // 1b. Automatically advance linked Opportunity to Closed Won
    setOpportunities((prev) =>
      prev.map((opp) => {
        if (
          opp.quoteId === quoteId ||
          (targetQuote && opp.quoteNumber === targetQuote.quoteNumber) ||
          (targetQuote && targetQuote.opportunityName && opp.name === targetQuote.opportunityName)
        ) {
          return {
            ...opp,
            stage: 'Closed Won',
            probabilityPct: 100,
            forecastCategory: 'Closed',
            notes: `${opp.notes ? opp.notes + ' • ' : ''}Closed Won via verified eSign (SHA-256: ${digest.substring(0, 10)}...) on ${new Date().toISOString().split('T')[0]}`,
          };
        }
        return opp;
      })
    );

    if (signingQuote && signingQuote.id === quoteId) {
      setSigningQuote((prev) =>
        prev
          ? {
              ...prev,
              status: 'Signed',
              signatureData,
              signatureDigest: digest,
              signedByName: signerName,
              signedAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
            }
          : null
      );
    }

    if (targetQuote) {
      const todayStr = new Date().toISOString().split('T')[0];
      const nextYearStr = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];

      // 2. Automatically spawn Activated Order
      const newOrderNum = `ORD-2026-00${orders.length + 45}`;
      const newOrder: Order = {
        id: `ord-${Date.now()}`,
        orderNumber: newOrderNum,
        quoteNumber: targetQuote.quoteNumber,
        accountName: targetQuote.accountName,
        status: 'Activated',
        totalAmount: targetQuote.totalAmount,
        currency: targetQuote.currency,
        orderedDate: todayStr,
        activatedDate: todayStr,
        itemsCount: targetQuote.items.length,
      };
      setOrders((prev) => [newOrder, ...prev]);

      // 3. Automatically spawn Master Service Agreement Contract
      const newContractNum = `CNT-2026-00${contracts.length + 20}`;
      const newContract: Contract = {
        id: `con-${Date.now()}`,
        contractNumber: newContractNum,
        accountName: targetQuote.accountName,
        quoteNumber: targetQuote.quoteNumber,
        status: 'Activated',
        startDate: todayStr,
        endDate: nextYearStr,
        contractTermMonths: 12,
        totalContractValue: targetQuote.totalAmount,
        currency: targetQuote.currency,
        autoRenew: true,
      };
      setContracts((prev) => [newContract, ...prev]);

      // 4. Automatically spawn Recurring Subscription lines
      const newSub: Subscription = {
        id: `sub-${Date.now()}`,
        subscriptionNumber: `SUB-2026-00${subscriptions.length + 85}`,
        contractNumber: newContractNum,
        productName: targetQuote.items[0]?.productName || 'RevX Core Platform',
        accountName: targetQuote.accountName,
        status: 'Active',
        mrr: targetQuote.totalAmount / 12,
        currency: targetQuote.currency,
        startDate: todayStr,
        renewalDate: nextYearStr,
        quantity: targetQuote.items[0]?.quantity || 1,
      };
      setSubscriptions((prev) => [newSub, ...prev]);

      // 5. Automatically spawn Indian GST Tax Invoice with IRN
      const newInvNum = `INV-2026-00${invoices.length + 95}`;
      const irn = generateIRN('27AABCR9999P1ZQ', newInvNum, '2026-27');
      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: newInvNum,
        quoteNumber: targetQuote.quoteNumber,
        accountName: targetQuote.accountName,
        amount: targetQuote.totalAmount,
        currency: targetQuote.currency,
        status: 'Issued',
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        irnNumber: irn,
        gstAmount: targetQuote.taxTotal,
      };
      setInvoices((prev) => [newInvoice, ...prev]);
    }
  };

  // Pay Invoice callback
  const handlePayInvoice = (invoiceId: string, method: 'Razorpay' | 'Stripe') => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: 'Paid',
            paymentMethod: method,
            paidAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
          };
        }
        return inv;
      })
    );
  };

  // Generate Invoice from Order
  const handleGenerateInvoiceFromOrder = (order: Order) => {
    const invNo = `INV-2026-00${invoices.length + 96}`;
    const irn = generateIRN('27AABCR9999P1ZQ', invNo, '2026-27');
    const newInv: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invNo,
      quoteNumber: order.quoteNumber,
      accountName: order.accountName,
      amount: order.totalAmount,
      currency: order.currency,
      status: 'Issued',
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      irnNumber: irn,
      gstAmount: order.totalAmount * 0.18,
    };
    setInvoices([newInv, ...invoices]);
    setActiveTab('invoices');
  };

  return (
    <div className="min-h-screen text-[#181c25] flex flex-col font-sans relative">
      {/* 1. Dynamic Modern SaaS Background (Aurora Orbs + Crosshair Grid + Mouse Beam) */}
      <SaaSBackground />

      {/* 2. Interactive SaaS Cursor Motion (Precision Dot + Magnetic Ring + Ripples) */}
      <CursorMotion />

      {/* Level 1 & 2: Salesforce Global Header and Navigation Tabs */}
      <SalesforceHeader
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'quotes') {
            setIsCreatingQuote(false);
          } else {
            setCpqInitialOpportunity(null);
          }
        }}
        currency={currency}
        setCurrency={setCurrency}
        onNewQuote={() => {
          setActiveTab('quotes');
          setIsCreatingQuote(true);
          setSelectedQuoteId(null);
          setCpqInitialOpportunity(null);
        }}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenCompetitorMatrix={() => setIsCompetitorMatrixOpen(true)}
        onRunDemoFlow={() => setIsGuidedDemoOpen(true)}
        onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
      />

      {/* Main Salesforce Workspace Area with true full-screen fluid width */}
      <main className="flex-1 w-full px-4 sm:px-6 py-5 space-y-5 relative z-10">
        {/* Tab 1: Command Center (Home) */}
        {activeTab === 'command-center' && (
          <CommandCenter
            currency={currency}
            quotes={quotes}
            invoices={invoices}
            orders={orders}
            onNavigate={(tab) => {
              setActiveTab(tab);
              if (tab === 'quotes') {
                setIsCreatingQuote(false);
                setSelectedQuoteId(null);
              }
            }}
            onOpenSignModal={(q) => setSigningQuote(q)}
            onOpenCompetitorMatrix={() => setIsCompetitorMatrixOpen(true)}
            onRunDemoFlow={() => setIsGuidedDemoOpen(true)}
          />
        )}

        {/* Tab: Leads (Prospect Qualification & 1-Click Conversion) */}
        {activeTab === 'leads' && (
          <LeadsStudio
            currency={currency}
            leads={leads}
            onCreateLead={handleCreateLead}
            onUpdateLead={handleUpdateLead}
            onDeleteLead={handleDeleteLead}
            onConvertLead={handleConvertLead}
          />
        )}

        {/* Tab: Accounts (Enterprise Account 360 & Q2C Related Lists) */}
        {activeTab === 'accounts' && (
          <AccountsStudio
            currency={currency}
            accounts={accounts}
            contacts={contacts}
            opportunities={opportunities}
            quotes={quotes}
            orders={orders}
            contracts={contracts}
            subscriptions={subscriptions}
            invoices={invoices}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
            onDeleteAccount={handleDeleteAccount}
            onCreateContact={handleCreateContact}
            onCreateOpportunity={handleCreateOpportunity}
            onLaunchCPQQuote={handleLaunchCPQFromOpp}
            onNavigateToRecord={(tab, recordId) => {
              if (tab === 'quotes' && recordId) {
                setSelectedQuoteId(recordId);
                setIsCreatingQuote(false);
              }
              setActiveTab(tab);
            }}
          />
        )}

        {/* Tab: Contacts (Decision Makers & Signatories) */}
        {activeTab === 'contacts' && (
          <ContactsStudio
            currency={currency}
            contacts={contacts}
            accounts={accounts}
            opportunities={opportunities}
            quotes={quotes}
            onCreateContact={handleCreateContact}
            onUpdateContact={handleUpdateContact}
            onDeleteContact={handleDeleteContact}
            onLaunchCPQQuote={handleLaunchCPQFromOpp}
            onNavigateToAccount={() => {
              setActiveTab('accounts');
            }}
          />
        )}

        {/* Tab 2: Opportunities (Sales Process & Pipeline) */}
        {activeTab === 'opportunities' && (
          <OpportunitiesStudio
            currency={currency}
            opportunities={opportunities}
            quotes={quotes}
            onCreateOpportunity={handleCreateOpportunity}
            onUpdateOpportunity={handleUpdateOpportunity}
            onDeleteOpportunity={handleDeleteOpportunity}
            onLaunchCPQQuote={handleLaunchCPQFromOpp}
            onViewQuote={handleViewQuoteFromOpp}
          />
        )}

        {/* Tab 3: Quotes (CPQ / Quote 360 / Quotes List) */}
        {activeTab === 'quotes' && (
          <>
            {isCreatingQuote ? (
              <CPQStudio
                currency={currency}
                quotes={quotes}
                onAddQuote={handleAddQuote}
                onOpenSignModal={(q) => setSigningQuote(q)}
                initialOpportunity={cpqInitialOpportunity}
              />
            ) : selectedQuote ? (
              <Quote360
                quote={selectedQuote}
                currency={currency}
                onBack={() => setSelectedQuoteId(null)}
                onOpenSignModal={(q) => setSigningQuote(q)}
                onAdvanceStage={handleAdvanceStage}
                onOpenAiAdvisor={() => {}}
                onUpdateQuote={handleUpdateQuote}
                relatedOrder={orders.find((o) => o.quoteNumber === selectedQuote.quoteNumber)}
                relatedContract={contracts.find((c) => c.quoteNumber === selectedQuote.quoteNumber)}
                relatedInvoice={invoices.find((i) => i.quoteNumber === selectedQuote.quoteNumber)}
              />
            ) : (
              <QuotesList
                currency={currency}
                quotes={quotes}
                onSelectQuote={(q) => setSelectedQuoteId(q.id)}
                onOpenNewQuoteModal={() => setIsCreatingQuote(true)}
                onOpenSignModal={(q) => setSigningQuote(q)}
                onUpdateQuote={handleUpdateQuote}
              />
            )}
          </>
        )}

        {/* Tab: DealHub Digital DealRoom */}
        {activeTab === 'dealroom' && (
          <DealRoomStudio
            currency={currency}
            onOpenSignModal={(qNum) => {
              const q = quotes.find((item) => item.quoteNumber === qNum);
              if (q) setSigningQuote(q);
            }}
          />
        )}

        {/* Tab: Oracle CPQ Approval Matrix */}
        {activeTab === 'approvals' && (
          <ApprovalMatrixStudio
            currency={currency}
            quotes={quotes}
          />
        )}

        {/* Tab: Orders */}
        {activeTab === 'orders' && (
          <OrdersStudio
            currency={currency}
            orders={orders}
            onGenerateInvoiceFromOrder={handleGenerateInvoiceFromOrder}
            onUpdateOrder={handleUpdateOrder}
          />
        )}

        {/* Tab: Contracts & Subscriptions (Chargebee Lifecycle & Retention) */}
        {activeTab === 'contracts' && (
          <ContractsStudio
            currency={currency}
            contracts={contracts}
            subscriptions={subscriptions}
            onUpdateSubscription={handleUpdateSubscription}
            onUpdateContract={handleUpdateContract}
            onCreateSubscription={(newSub) => {
              setSubscriptions((prev) => [newSub, ...prev]);
            }}
          />
        )}

        {/* Tab: Invoices */}
        {activeTab === 'invoices' && (
          <InvoicesStudio
            currency={currency}
            invoices={invoices}
            quotes={quotes}
            onPayInvoice={handlePayInvoice}
            onGenerateInvoiceFromQuote={() => {}}
            onUpdateInvoice={handleUpdateInvoice}
          />
        )}

        {/* Tab: BillingPlatform Account Hierarchy & Dynamic Rating */}
        {activeTab === 'hierarchy' && (
          <AccountHierarchyStudio
            currency={currency}
          />
        )}

        {/* Tab 6: Usage Metering (Zuora Metering & Mediation+) */}
        {activeTab === 'metering' && (
          <UsageMeteringStudio
            currency={currency}
            onGenerateInvoice={(newInv) => setInvoices((prev) => [newInv, ...prev])}
          />
        )}

        {/* Tab 7: Collections & Smart Dunning (Zuora Collect+) */}
        {activeTab === 'collect' && (
          <CollectStudio
            currency={currency}
            onPayInvoice={handlePayInvoice}
          />
        )}

        {/* Tab 8: eSign Studio */}
        {activeTab === 'esign' && (
          <ESignStudio
            quotes={quotes}
            onOpenSignModal={(q) => setSigningQuote(q)}
          />
        )}

        {/* Tab 7: Executive War Room */}
        {activeTab === 'war-room' && (
          <WarRoom
            currency={currency}
            quotes={quotes}
            invoices={invoices}
            onNavigate={(tab) => {
              setActiveTab(tab);
              if (tab === 'quotes') {
                setIsCreatingQuote(false);
                setSelectedQuoteId(null);
              }
            }}
            onOpenSignModal={(q) => setSigningQuote(q)}
          />
        )}

        {/* Tab 8: Revenue (ASC 606) */}
        {activeTab === 'revrec' && (
          <RevRecStudio currency={currency} />
        )}

        {/* Tab 9: Setup */}
        {activeTab === 'setup' && (
          <SetupCockpit 
            onResetFactoryData={handleResetFactoryData}
            onExportStateJSON={handleExportStateJSON}
          />
        )}
      </main>

      {/* Digital eSign Modal with Certificate of Completion */}
      {signingQuote && (
        <SignModal
          quote={signingQuote}
          onClose={() => setSigningQuote(null)}
          onSignComplete={handleSignComplete}
        />
      )}

      {/* Competitor Parity & Advantage Matrix Modal */}
      {isCompetitorMatrixOpen && (
        <CompetitorMatrixModal
          onClose={() => setIsCompetitorMatrixOpen(false)}
          onRunDemoFlow={() => setIsGuidedDemoOpen(true)}
        />
      )}

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      {isCommandPaletteOpen && (
        <CommandPaletteModal
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigate={(tab) => {
            setActiveTab(tab);
            if (tab === 'quotes') {
              setIsCreatingQuote(false);
              setSelectedQuoteId(null);
            }
          }}
          onSelectQuote={(quoteId) => {
            setActiveTab('quotes');
            setIsCreatingQuote(false);
            setSelectedQuoteId(quoteId);
          }}
          onNewQuote={() => {
            setActiveTab('quotes');
            setIsCreatingQuote(true);
            setSelectedQuoteId(null);
            setCpqInitialOpportunity(null);
          }}
          onSelectOpportunity={(oppId) => {
            setActiveTab('opportunities');
          }}
          onRunDemoFlow={() => setIsGuidedDemoOpen(true)}
          onOpenCompetitorMatrix={() => setIsCompetitorMatrixOpen(true)}
          onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
          currency={currency}
          setCurrency={setCurrency}
          quotes={quotes}
          orders={orders}
          invoices={invoices}
          opportunities={opportunities}
        />
      )}

      {/* Guided 7-Step Autonomous Q2C Master Pipeline Simulator */}
      {isGuidedDemoOpen && (
        <GuidedQ2CDemoModal
          onClose={() => setIsGuidedDemoOpen(false)}
          currency={currency}
          onInjectDemoDeal={handleInjectDemoDeal}
          onNavigate={(tab) => {
            setActiveTab(tab);
            if (tab === 'quotes') {
              setIsCreatingQuote(false);
            }
          }}
        />
      )}

      {/* Q2C End-to-End Enterprise Architecture & Use Cases Blueprint Modal */}
      <Q2CArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
        activeTab={activeTab}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'quotes') {
            setIsCreatingQuote(false);
          }
          setIsArchitectureModalOpen(false);
        }}
      />
    </div>
  );
}

export default App;
