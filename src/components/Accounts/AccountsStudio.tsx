import React, { useState, useMemo } from 'react';
import { Currency, Account, Contact, Opportunity, Quote, Order, Contract, Subscription, Invoice } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  Building2, 
  Search, 
  Plus, 
  Filter, 
  Phone, 
  Globe, 
  Mail, 
  MapPin, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Users, 
  Target, 
  Layers, 
  Package, 
  FileCheck2, 
  Receipt, 
  DollarSign, 
  Activity, 
  ShieldCheck, 
  Edit2, 
  Trash2, 
  X, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Zap,
  Tag
} from 'lucide-react';

interface AccountsStudioProps {
  currency: Currency;
  accounts: Account[];
  contacts: Contact[];
  opportunities: Opportunity[];
  quotes: Quote[];
  orders: Order[];
  contracts: Contract[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  onUpdateAccount: (account: Account) => void;
  onCreateAccount: (account: Account) => void;
  onDeleteAccount: (accountId: string) => void;
  onCreateContact?: (contact: Contact) => void;
  onCreateOpportunity?: (opp: Opportunity) => void;
  onNavigateToRecord?: (tab: string, recordId?: string) => void;
  onLaunchCPQQuote?: (opp: Opportunity) => void;
}

export const AccountsStudio: React.FC<AccountsStudioProps> = ({
  currency,
  accounts,
  contacts,
  opportunities,
  quotes,
  orders,
  contracts,
  subscriptions,
  invoices,
  onUpdateAccount,
  onCreateAccount,
  onDeleteAccount,
  onCreateContact,
  onCreateOpportunity,
  onNavigateToRecord,
  onLaunchCPQQuote,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'details' | 'related'>('related');
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal states
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);
  const [isCreateOppOpen, setIsCreateOppOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form states for new Account
  const [formName, setFormName] = useState('');
  const [formIndustry, setFormIndustry] = useState<Account['industry']>('Software & Technology');
  const [formType, setFormType] = useState<Account['type']>('Customer');
  const [formAnnualRevenue, setFormAnnualRevenue] = useState<number>(1000000);
  const [formWebsite, setFormWebsite] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formCountry, setFormCountry] = useState('United States');
  const [formTaxNumber, setFormTaxNumber] = useState('');
  const [formTier, setFormTier] = useState<Account['tier']>('Tier 1 Strategic');
  const [formNotes, setFormNotes] = useState('');

  // Form states for new Contact on Account
  const [newContactFirstName, setNewContactFirstName] = useState('');
  const [newContactLastName, setNewContactLastName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactTitle, setNewContactTitle] = useState('');
  const [newContactDepartment, setNewContactDepartment] = useState<Contact['department']>('Engineering');
  const [newContactIsPrimary, setNewContactIsPrimary] = useState(false);

  // Form states for new Opportunity on Account
  const [newOppName, setNewOppName] = useState('');
  const [newOppAmount, setNewOppAmount] = useState<number>(50000);
  const [newOppCloseDate, setNewOppCloseDate] = useState('2026-11-30');

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        acc.name.toLowerCase().includes(q) ||
        acc.accountNumber.toLowerCase().includes(q) ||
        acc.industry.toLowerCase().includes(q) ||
        acc.billingAddress.city.toLowerCase().includes(q);
      const matchesIndustry = industryFilter === 'all' || acc.industry === industryFilter;
      const matchesType = typeFilter === 'all' || acc.type === typeFilter;
      return matchesSearch && matchesIndustry && matchesType;
    });
  }, [accounts, searchQuery, industryFilter, typeFilter]);

  // Related Child Records for Selected Account
  const accountContacts = useMemo(() => {
    if (!selectedAccount) return [];
    return contacts.filter(
      (c) => c.accountId === selectedAccount.id || c.accountName.toLowerCase() === selectedAccount.name.toLowerCase()
    );
  }, [contacts, selectedAccount]);

  const accountOpportunities = useMemo(() => {
    if (!selectedAccount) return [];
    return opportunities.filter(
      (o) => o.accountName.toLowerCase() === selectedAccount.name.toLowerCase()
    );
  }, [opportunities, selectedAccount]);

  const accountQuotes = useMemo(() => {
    if (!selectedAccount) return [];
    return quotes.filter(
      (q) => q.accountName.toLowerCase() === selectedAccount.name.toLowerCase()
    );
  }, [quotes, selectedAccount]);

  const accountOrders = useMemo(() => {
    if (!selectedAccount) return [];
    return orders.filter(
      (o) => o.accountName.toLowerCase() === selectedAccount.name.toLowerCase()
    );
  }, [orders, selectedAccount]);

  const accountSubscriptions = useMemo(() => {
    if (!selectedAccount) return [];
    return subscriptions.filter(
      (s) => s.accountName.toLowerCase() === selectedAccount.name.toLowerCase()
    );
  }, [subscriptions, selectedAccount]);

  const accountInvoices = useMemo(() => {
    if (!selectedAccount) return [];
    return invoices.filter(
      (i) => i.accountName.toLowerCase() === selectedAccount.name.toLowerCase()
    );
  }, [invoices, selectedAccount]);

  // Handle Save / Edit Account
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingAccount) {
      const updated: Account = {
        ...editingAccount,
        name: formName,
        industry: formIndustry,
        type: formType,
        annualRevenue: formAnnualRevenue,
        website: formWebsite,
        phone: formPhone,
        tier: formTier,
        notes: formNotes,
        taxRegistrationNumber: formTaxNumber,
        billingAddress: {
          ...editingAccount.billingAddress,
          street: formStreet,
          city: formCity,
          state: formState,
          country: formCountry,
        },
      };
      onUpdateAccount(updated);
    } else {
      const newAcc: Account = {
        id: `acc-${Date.now()}`,
        name: formName,
        accountNumber: `ACC-2026-00${accounts.length + 1}`,
        industry: formIndustry,
        type: formType,
        annualRevenue: formAnnualRevenue,
        currency,
        website: formWebsite || 'https://example.com',
        phone: formPhone || '+1 (555) 000-0000',
        ownerName: 'Alexander Hayes',
        tier: formTier,
        healthScore: 88,
        createdAt: new Date().toISOString().split('T')[0],
        notes: formNotes,
        taxRegistrationNumber: formTaxNumber || 'US-EIN-99-9999999',
        billingAddress: {
          street: formStreet || '100 Main Street',
          city: formCity || 'New York',
          state: formState || 'NY',
          postalCode: '10001',
          country: formCountry,
        },
      };
      onCreateAccount(newAcc);
    }

    setIsCreateAccountOpen(false);
    setEditingAccount(null);
  };

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount(acc);
    setFormName(acc.name);
    setFormIndustry(acc.industry);
    setFormType(acc.type);
    setFormAnnualRevenue(acc.annualRevenue);
    setFormWebsite(acc.website);
    setFormPhone(acc.phone);
    setFormTier(acc.tier);
    setFormStreet(acc.billingAddress.street);
    setFormCity(acc.billingAddress.city);
    setFormState(acc.billingAddress.state);
    setFormCountry(acc.billingAddress.country);
    setFormTaxNumber(acc.taxRegistrationNumber || '');
    setFormNotes(acc.notes || '');
    setIsCreateAccountOpen(true);
  };

  const handleCreateContactOnAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !newContactLastName.trim()) return;

    const fullName = `${newContactFirstName.trim()} ${newContactLastName.trim()}`.trim();
    const newCon: Contact = {
      id: `con-${Date.now()}`,
      accountId: selectedAccount.id,
      accountName: selectedAccount.name,
      firstName: newContactFirstName,
      lastName: newContactLastName,
      fullName,
      email: newContactEmail || `${newContactFirstName.toLowerCase()}@${selectedAccount.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      phone: newContactPhone || selectedAccount.phone,
      title: newContactTitle || 'Director',
      department: newContactDepartment,
      isPrimaryContact: newContactIsPrimary,
      createdAt: new Date().toISOString().split('T')[0],
    };

    if (onCreateContact) onCreateContact(newCon);
    setIsCreateContactOpen(false);
    setNewContactFirstName('');
    setNewContactLastName('');
    setNewContactEmail('');
    setNewContactPhone('');
    setNewContactTitle('');
  };

  const handleCreateOppOnAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !newOppName.trim()) return;

    const newOpp: Opportunity = {
      id: `opp-${Date.now()}`,
      name: newOppName,
      accountName: selectedAccount.name,
      amount: newOppAmount,
      currency,
      stage: 'Prospecting',
      probabilityPct: 10,
      closeDate: newOppCloseDate,
      ownerName: selectedAccount.ownerName,
      dealType: 'New Business',
      forecastCategory: 'Pipeline',
      primaryContact: accountContacts[0]?.fullName || 'David Miller',
      contactEmail: accountContacts[0]?.email || 'contact@example.com',
    };

    if (onCreateOpportunity) onCreateOpportunity(newOpp);
    setIsCreateOppOpen(false);
    setNewOppName('');
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* If an account is selected: Show Salesforce Standard Account 360 View */}
      {selectedAccount ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Back Button & Account ID Breadcrumb */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedAccountId(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0176d3] hover:text-[#014486] transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to All Accounts</span>
            </button>
            <span className="text-[11px] font-mono text-[#5c6678]">
              Account ID: <span className="font-bold text-[#181c25]">{selectedAccount.accountNumber}</span>
            </span>
          </div>

          {/* Account 360 Highlights Panel */}
          <div className="bg-white rounded-xl border border-[#dde1e9] p-5 shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#edf1f7]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#0176d3] to-[#2563eb] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20">
                      {selectedAccount.type}
                    </span>
                    <span className="text-xs text-[#5c6678] font-semibold">
                      {selectedAccount.industry}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-500/25">
                      Health Score: {selectedAccount.healthScore}/100
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#10233f] mt-1">
                    {selectedAccount.name}
                  </h1>
                  <div className="flex items-center gap-3 text-xs text-[#5c6678] mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Globe size={13} className="text-[#0176d3]" />
                      <a href={selectedAccount.website} target="_blank" rel="noreferrer" className="text-[#0176d3] hover:underline">
                        {selectedAccount.website.replace('https://', '')}
                      </a>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone size={13} className="text-[#5c6678]" />
                      <span>{selectedAccount.phone}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-[#5c6678]" />
                      <span>{selectedAccount.billingAddress.city}, {selectedAccount.billingAddress.country}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsCreateContactOpen(true)}
                  className="rq-btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Plus size={13} />
                  <span>New Contact</span>
                </button>
                <button
                  onClick={() => setIsCreateOppOpen(true)}
                  className="rq-btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Target size={13} className="text-emerald-600" />
                  <span>New Opportunity</span>
                </button>
                <button
                  onClick={() => handleOpenEdit(selectedAccount)}
                  className="rq-btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Edit2 size={13} />
                  <span>Edit</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
              <div>
                <span className="text-[#5c6678] font-medium block">Annual Revenue:</span>
                <span className="text-sm font-extrabold text-[#10233f] font-mono mt-0.5 block">
                  {formatCurrency(convertCurrency(selectedAccount.annualRevenue, selectedAccount.currency, currency), currency)}
                </span>
              </div>
              <div>
                <span className="text-[#5c6678] font-medium block">Account Tier:</span>
                <span className="text-sm font-extrabold text-[#0176d3] mt-0.5 block">
                  {selectedAccount.tier}
                </span>
              </div>
              <div>
                <span className="text-[#5c6678] font-medium block">Account Owner:</span>
                <span className="text-sm font-bold text-[#181c25] mt-0.5 block">
                  {selectedAccount.ownerName}
                </span>
              </div>
              <div>
                <span className="text-[#5c6678] font-medium block">Active Subscriptions:</span>
                <span className="text-sm font-extrabold text-emerald-700 font-mono mt-0.5 block">
                  {accountSubscriptions.length} Subscriptions ({accountQuotes.length} Quotes)
                </span>
              </div>
            </div>
          </div>

          {/* Sub-tab Navigation (Details vs Related Lists) */}
          <div className="flex items-center gap-2 border-b border-[#dde1e9] pb-1">
            <button
              onClick={() => setActiveSubTab('related')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'related'
                  ? 'bg-white text-[#015ba5] shadow-2xs border border-[#dde1e9]'
                  : 'text-[#5c6678] hover:text-[#181c25]'
              }`}
            >
              <Layers size={14} />
              <span>Related Lists</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#eef4ff] text-[#015ba5] text-[10px] font-bold">
                {accountContacts.length + accountOpportunities.length + accountQuotes.length + accountOrders.length + accountSubscriptions.length + accountInvoices.length}
              </span>
            </button>
            <button
              onClick={() => setActiveSubTab('details')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'details'
                  ? 'bg-white text-[#015ba5] shadow-2xs border border-[#dde1e9]'
                  : 'text-[#5c6678] hover:text-[#181c25]'
              }`}
            >
              <FileText size={14} />
              <span>Account Details</span>
            </button>
          </div>

          {/* Sub-view: Related Lists (CRITICAL REQUIREMENT) */}
          {activeSubTab === 'related' && (
            <div className="space-y-5">
              {/* 1. Related Contacts */}
              <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#edf1f7]">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[#0176d3]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f]">
                      Related Contacts ({accountContacts.length})
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsCreateContactOpen(true)}
                    className="rq-btn-secondary text-xs flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>Add Contact</span>
                  </button>
                </div>

                {accountContacts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {accountContacts.map((con) => (
                      <div
                        key={con.id}
                        className="p-3.5 rounded-xl border border-[#dde1e9] bg-[#fbfcfe] hover:bg-white hover:border-[#0176d3]/40 transition-all shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-[#10233f]">
                            {con.fullName}
                          </span>
                          {con.isPrimaryContact && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-500/25">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#5c6678]">
                          {con.title} · <span className="font-semibold text-[#181c25]">{con.department}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 text-[11px] text-[#5c6678] space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className="text-slate-400" />
                            <a href={`mailto:${con.email}`} className="text-[#0176d3] hover:underline truncate">
                              {con.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone size={12} className="text-slate-400" />
                            <span>{con.phone}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-[#5c6678] bg-[#f8fafc] rounded-lg">
                    No contacts linked to this account yet. Click "+ Add Contact" to add the first decision maker.
                  </div>
                )}
              </div>

              {/* 2. Related Opportunities */}
              <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#edf1f7]">
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-emerald-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f]">
                      Related Opportunities ({accountOpportunities.length})
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsCreateOppOpen(true)}
                    className="rq-btn-secondary text-xs flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>Add Opportunity</span>
                  </button>
                </div>

                {accountOpportunities.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Opportunity Name</th>
                          <th className="py-2.5 px-3">Stage</th>
                          <th className="py-2.5 px-3">Probability</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Close Date</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf1f7]">
                        {accountOpportunities.map((opp) => (
                          <tr key={opp.id} className="hover:bg-[#fafcff]">
                            <td className="py-2.5 px-3 font-bold text-[#10233f]">
                              {opp.name}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-500/25">
                                {opp.stage}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono">{opp.probabilityPct}%</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-[#181c25]">
                              {formatCurrency(convertCurrency(opp.amount, opp.currency, currency), currency)}
                            </td>
                            <td className="py-2.5 px-3 text-[#5c6678] font-mono">{opp.closeDate}</td>
                            <td className="py-2.5 px-3 text-right">
                              {onLaunchCPQQuote && (
                                <button
                                  onClick={() => onLaunchCPQQuote(opp)}
                                  className="text-[11px] font-bold text-[#0176d3] hover:underline"
                                >
                                  Launch CPQ →
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-[#5c6678] bg-[#f8fafc] rounded-lg">
                    No pipeline opportunities linked to this account.
                  </div>
                )}
              </div>

              {/* 3. Related CPQ Quotes */}
              <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#edf1f7]">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-[#0176d3]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f]">
                      Related CPQ Quotes &amp; Proposals ({accountQuotes.length})
                    </h3>
                  </div>
                </div>

                {accountQuotes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Quote #</th>
                          <th className="py-2.5 px-3">Signer Contact</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Grand Total</th>
                          <th className="py-2.5 px-3">eSign Seal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf1f7]">
                        {accountQuotes.map((q) => (
                          <tr key={q.id} className="hover:bg-[#fafcff]">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#0176d3]">
                              {q.quoteNumber}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[#181c25]">{q.contactName}</td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                q.status === 'Signed' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {q.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-[#10233f]">
                              {formatCurrency(convertCurrency(q.totalAmount, q.currency, currency), currency)}
                            </td>
                            <td className="py-2.5 px-3">
                              {q.signatureDigest ? (
                                <span className="text-[10px] font-mono text-emerald-700 flex items-center gap-1 font-bold">
                                  <ShieldCheck size={13} />
                                  SHA-256 Verified
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Awaiting eSign</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-[#5c6678] bg-[#f8fafc] rounded-lg">
                    No CPQ quotes generated for this account yet.
                  </div>
                )}
              </div>

              {/* 4. Related Contracts & Subscriptions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-[#dde1e9] p-4 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#edf1f7]">
                    <FileCheck2 size={16} className="text-purple-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f]">
                      Contracts &amp; Subscriptions ({accountSubscriptions.length})
                    </h3>
                  </div>
                  {accountSubscriptions.length > 0 ? (
                    <div className="space-y-2">
                      {accountSubscriptions.map((sub) => (
                        <div key={sub.id} className="p-2.5 rounded-lg border border-[#dde1e9] bg-[#f8fafc] text-xs flex items-center justify-between">
                          <div>
                            <div className="font-bold text-[#10233f]">{sub.productName}</div>
                            <div className="text-[10px] text-[#5c6678]">Renewal: {sub.renewalDate} · {sub.tier}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-emerald-700">
                              {formatCurrency(convertCurrency(sub.mrr, sub.currency, currency), currency)}/mo
                            </div>
                            {sub.isGrandfathered && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800">
                                Locked Price
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-[#5c6678]">No active subscriptions.</div>
                  )}
                </div>

                {/* 5. Related Invoices */}
                <div className="bg-white rounded-xl border border-[#dde1e9] p-4 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#edf1f7]">
                    <Receipt size={16} className="text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f]">
                      Invoices &amp; GST IRN ({accountInvoices.length})
                    </h3>
                  </div>
                  {accountInvoices.length > 0 ? (
                    <div className="space-y-2">
                      {accountInvoices.map((inv) => (
                        <div key={inv.id} className="p-2.5 rounded-lg border border-[#dde1e9] bg-[#f8fafc] text-xs flex items-center justify-between">
                          <div>
                            <div className="font-mono font-bold text-[#0176d3]">{inv.invoiceNumber}</div>
                            <div className="text-[10px] text-[#5c6678]">Due: {inv.dueDate} · {inv.status}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-[#10233f]">
                              {formatCurrency(convertCurrency(inv.amount, inv.currency, currency), currency)}
                            </div>
                            {inv.irnNumber && (
                              <span className="text-[9px] font-mono text-emerald-700 font-bold">
                                IRN Generated
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-[#5c6678]">No invoices generated.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sub-view: Details Tab */}
          {activeSubTab === 'details' && (
            <div className="bg-white rounded-xl border border-[#dde1e9] p-5 sm:p-6 shadow-2xs space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* General Information */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#10233f] uppercase tracking-wider border-b border-slate-100 pb-2">
                    Account Information
                  </h4>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Account Name:</span>
                    <span className="font-bold text-[#181c25]">{selectedAccount.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Account Number:</span>
                    <span className="font-mono font-bold text-[#0176d3]">{selectedAccount.accountNumber}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Industry:</span>
                    <span className="font-semibold text-[#181c25]">{selectedAccount.industry}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Type:</span>
                    <span className="font-semibold text-[#181c25]">{selectedAccount.type}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Annual Revenue:</span>
                    <span className="font-mono font-bold text-[#181c25]">
                      {formatCurrency(convertCurrency(selectedAccount.annualRevenue, selectedAccount.currency, currency), currency)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Tax Registration / EIN:</span>
                    <span className="font-mono text-[#181c25]">{selectedAccount.taxRegistrationNumber || 'N/A'}</span>
                  </div>
                </div>

                {/* Address & Communication */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#10233f] uppercase tracking-wider border-b border-slate-100 pb-2">
                    Address &amp; Governance
                  </h4>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Billing Address:</span>
                    <span className="font-medium text-[#181c25] text-right">
                      {selectedAccount.billingAddress.street}, {selectedAccount.billingAddress.city}, {selectedAccount.billingAddress.state} {selectedAccount.billingAddress.postalCode}, {selectedAccount.billingAddress.country}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Phone:</span>
                    <span className="font-medium text-[#181c25]">{selectedAccount.phone}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Website:</span>
                    <a href={selectedAccount.website} target="_blank" rel="noreferrer" className="text-[#0176d3] hover:underline">
                      {selectedAccount.website}
                    </a>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Account Tier:</span>
                    <span className="font-bold text-[#0176d3]">{selectedAccount.tier}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-[#5c6678]">Created Date:</span>
                    <span className="text-[#181c25]">{selectedAccount.createdAt}</span>
                  </div>
                </div>
              </div>

              {selectedAccount.notes && (
                <div className="p-3.5 bg-[#f8fafc] rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-[#10233f] block mb-1">Executive Notes:</span>
                  <p className="text-[#5c6678] italic leading-relaxed">{selectedAccount.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Accounts Table / List View */
        <div className="space-y-4">
          {/* Header Bar */}
          <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0176d3] to-[#2563eb] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Building2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-extrabold text-[#10233f]">
                      Accounts 360
                    </h1>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-500/25">
                      CRM Core
                    </span>
                  </div>
                  <p className="text-xs text-[#5c6678] mt-0.5">
                    Enterprise customer accounts with parent-child relationships, linked contacts, and Quote-to-Cash child history.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingAccount(null);
                  setFormName('');
                  setFormAnnualRevenue(1000000);
                  setFormWebsite('');
                  setFormPhone('');
                  setIsCreateAccountOpen(true);
                }}
                className="rq-btn-primary text-xs flex items-center gap-1.5 shrink-0"
              >
                <Plus size={14} />
                <span>New Account</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="mt-4 pt-3 border-t border-[#edf1f7] flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5c6678]" />
                <input
                  type="text"
                  placeholder="Search accounts by name, number, industry, or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f8fafc] border border-[#dde1e9] rounded-lg text-[#10233f] placeholder:text-slate-400 focus:bg-white focus:border-[#0176d3] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={industryFilter}
                  onChange={(e) => setIndustryFilter(e.target.value)}
                  className="text-xs bg-white border border-[#dde1e9] rounded-lg px-2.5 py-1.5 text-[#10233f] outline-none"
                >
                  <option value="all">All Industries</option>
                  <option value="Software & Technology">Software &amp; Technology</option>
                  <option value="Financial Services">Financial Services</option>
                  <option value="Retail & E-Commerce">Retail &amp; E-Commerce</option>
                  <option value="Aerospace">Aerospace</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-xs bg-white border border-[#dde1e9] rounded-lg px-2.5 py-1.5 text-[#10233f] outline-none"
                >
                  <option value="all">All Account Types</option>
                  <option value="Customer">Customer</option>
                  <option value="Prospect">Prospect</option>
                  <option value="Enterprise Partner">Enterprise Partner</option>
                </select>
              </div>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="bg-white rounded-xl border border-[#dde1e9] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Account Name</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Industry</th>
                    <th className="py-3 px-3">Annual Revenue</th>
                    <th className="py-3 px-3">Health</th>
                    <th className="py-3 px-3">Owner</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f7]">
                  {filteredAccounts.map((acc) => {
                    const convRev = convertCurrency(acc.annualRevenue, acc.currency, currency);
                    return (
                      <tr
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className="hover:bg-[#fafcff] transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-bold text-[#10233f] group-hover:text-[#0176d3] flex items-center gap-2">
                          <Building2 size={15} className="text-[#0176d3] shrink-0" />
                          <div>
                            <div>{acc.name}</div>
                            <div className="text-[10px] font-mono text-[#5c6678] font-normal">{acc.accountNumber} · {acc.billingAddress.city}</div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            acc.type === 'Customer' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-[#5c6678]">{acc.industry}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-[#10233f]">
                          {formatCurrency(convRev, currency)}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${acc.healthScore}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] font-bold text-emerald-700">{acc.healthScore}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-[#5c6678]">{acc.ownerName}</td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(acc)}
                              className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-[#015ba5] text-xs font-semibold border border-[#dde1e9] transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="Edit Account"
                            >
                              <Edit2 size={11} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setSelectedAccountId(acc.id)}
                              className="text-xs font-bold text-[#0176d3] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>View 360</span>
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Create / Edit Account */}
      {isCreateAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10233f]/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[#dde1e9] bg-[#f8fafc] flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-[#10233f]">
                {editingAccount ? 'Edit Account' : 'New Enterprise Account'}
              </h3>
              <button
                onClick={() => setIsCreateAccountOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c6678] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div>
                <label className="font-bold text-[#10233f] block mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none focus:border-[#0176d3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Industry</label>
                  <select
                    value={formIndustry}
                    onChange={(e) => setFormIndustry(e.target.value as Account['industry'])}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  >
                    <option value="Software & Technology">Software &amp; Technology</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Retail & E-Commerce">Retail &amp; E-Commerce</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Aerospace">Aerospace</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Account Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as Account['type'])}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  >
                    <option value="Customer">Customer</option>
                    <option value="Prospect">Prospect</option>
                    <option value="Enterprise Partner">Enterprise Partner</option>
                    <option value="Strategic Account">Strategic Account</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Annual Revenue (USD)</label>
                  <input
                    type="number"
                    value={formAnnualRevenue}
                    onChange={(e) => setFormAnnualRevenue(Number(e.target.value))}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Account Tier</label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as Account['tier'])}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  >
                    <option value="Tier 1 Strategic">Tier 1 Strategic</option>
                    <option value="Tier 2 Mid-Market">Tier 2 Mid-Market</option>
                    <option value="Tier 3 Emerging">Tier 3 Emerging</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Website</label>
                  <input
                    type="url"
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">City</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">State</label>
                  <input
                    type="text"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Country</label>
                  <input
                    type="text"
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#dde1e9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateAccountOpen(false)}
                  className="rq-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rq-btn-primary text-xs"
                >
                  {editingAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Contact to Account */}
      {isCreateContactOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10233f]/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[#dde1e9] bg-[#f8fafc] flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-[#10233f]">
                Add Contact to {selectedAccount.name}
              </h3>
              <button
                onClick={() => setIsCreateContactOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c6678] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateContactOnAccount} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">First Name</label>
                  <input
                    type="text"
                    value={newContactFirstName}
                    onChange={(e) => setNewContactFirstName(e.target.value)}
                    placeholder="e.g. Rachel"
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newContactLastName}
                    onChange={(e) => setNewContactLastName(e.target.value)}
                    placeholder="e.g. Green"
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#10233f] block mb-1">Business Email</label>
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="rachel@company.com"
                  className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Job Title</label>
                  <input
                    type="text"
                    value={newContactTitle}
                    onChange={(e) => setNewContactTitle(e.target.value)}
                    placeholder="e.g. Director of Infrastructure"
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Department</label>
                  <select
                    value={newContactDepartment}
                    onChange={(e) => setNewContactDepartment(e.target.value as Contact['department'])}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Finance & Procurement">Finance &amp; Procurement</option>
                    <option value="Executive">Executive</option>
                    <option value="Operations">Operations</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="primaryContactCheck"
                  checked={newContactIsPrimary}
                  onChange={(e) => setNewContactIsPrimary(e.target.checked)}
                  className="accent-[#0176d3] rounded"
                />
                <label htmlFor="primaryContactCheck" className="text-xs font-semibold text-[#181c25] cursor-pointer">
                  Mark as Primary Decision Maker on this Account
                </label>
              </div>

              <div className="pt-4 border-t border-[#dde1e9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateContactOpen(false)}
                  className="rq-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rq-btn-primary text-xs"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Opportunity to Account */}
      {isCreateOppOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10233f]/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[#dde1e9] bg-[#f8fafc] flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-[#10233f]">
                New Opportunity for {selectedAccount.name}
              </h3>
              <button
                onClick={() => setIsCreateOppOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c6678] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateOppOnAccount} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-[#10233f] block mb-1">Opportunity Name *</label>
                <input
                  type="text"
                  required
                  value={newOppName}
                  onChange={(e) => setNewOppName(e.target.value)}
                  placeholder="e.g. Enterprise Expansion FY27"
                  className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Expected Amount ({currency})</label>
                  <input
                    type="number"
                    value={newOppAmount}
                    onChange={(e) => setNewOppAmount(Number(e.target.value))}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Target Close Date</label>
                  <input
                    type="date"
                    value={newOppCloseDate}
                    onChange={(e) => setNewOppCloseDate(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#dde1e9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOppOpen(false)}
                  className="rq-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rq-btn-primary text-xs"
                >
                  Create Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
