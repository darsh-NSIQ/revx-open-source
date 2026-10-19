import React, { useState, useMemo } from 'react';
import { Currency, Contact, Account, Opportunity, Quote } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  Users, 
  Search, 
  Plus, 
  Filter, 
  Phone, 
  Mail, 
  Building2, 
  ArrowLeft, 
  Edit2, 
  Trash2, 
  X, 
  ExternalLink, 
  ChevronRight, 
  FileCheck2, 
  Target, 
  Layers, 
  ShieldCheck, 
  Calendar,
  Globe
} from 'lucide-react';

interface ContactsStudioProps {
  currency: Currency;
  contacts: Contact[];
  accounts: Account[];
  opportunities: Opportunity[];
  quotes: Quote[];
  onUpdateContact: (contact: Contact) => void;
  onCreateContact: (contact: Contact) => void;
  onDeleteContact: (contactId: string) => void;
  onNavigateToAccount?: (accountId: string) => void;
  onLaunchCPQQuote?: (opp: Opportunity) => void;
}

export const ContactsStudio: React.FC<ContactsStudioProps> = ({
  currency,
  contacts,
  accounts,
  opportunities,
  quotes,
  onUpdateContact,
  onCreateContact,
  onDeleteContact,
  onNavigateToAccount,
  onLaunchCPQQuote,
}) => {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'details' | 'related'>('related');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [primaryOnly, setPrimaryOnly] = useState(false);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form states
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formAccountId, setFormAccountId] = useState(accounts[0]?.id || '');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDepartment, setFormDepartment] = useState<Contact['department']>('Engineering');
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formLinkedin, setFormLinkedin] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  // Filtered Contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.accountName.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q);
      const matchesDept = departmentFilter === 'all' || c.department === departmentFilter;
      const matchesPrimary = !primaryOnly || c.isPrimaryContact;
      return matchesSearch && matchesDept && matchesPrimary;
    });
  }, [contacts, searchQuery, departmentFilter, primaryOnly]);

  // Lookup Parent Account
  const parentAccount = useMemo(() => {
    if (!selectedContact) return null;
    return accounts.find(
      (a) => a.id === selectedContact.accountId || a.name.toLowerCase() === selectedContact.accountName.toLowerCase()
    ) || null;
  }, [accounts, selectedContact]);

  // Related Opportunities for Contact
  const relatedOpportunities = useMemo(() => {
    if (!selectedContact) return [];
    return opportunities.filter(
      (o) =>
        o.primaryContact?.toLowerCase() === selectedContact.fullName.toLowerCase() ||
        o.contactEmail?.toLowerCase() === selectedContact.email.toLowerCase() ||
        o.accountName.toLowerCase() === selectedContact.accountName.toLowerCase()
    );
  }, [opportunities, selectedContact]);

  // Related Quotes for Contact
  const relatedQuotes = useMemo(() => {
    if (!selectedContact) return [];
    return quotes.filter(
      (q) =>
        q.contactName?.toLowerCase() === selectedContact.fullName.toLowerCase() ||
        q.contactEmail?.toLowerCase() === selectedContact.email.toLowerCase()
    );
  }, [quotes, selectedContact]);

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLastName.trim()) return;

    const acc = accounts.find((a) => a.id === formAccountId) || accounts[0];
    const fullName = `${formFirstName.trim()} ${formLastName.trim()}`.trim();

    if (editingContact) {
      const updated: Contact = {
        ...editingContact,
        firstName: formFirstName,
        lastName: formLastName,
        fullName,
        accountId: acc.id,
        accountName: acc.name,
        email: formEmail,
        phone: formPhone,
        title: formTitle,
        department: formDepartment,
        isPrimaryContact: formIsPrimary,
        linkedinUrl: formLinkedin,
        notes: formNotes,
      };
      onUpdateContact(updated);
    } else {
      const newCon: Contact = {
        id: `con-${Date.now()}`,
        accountId: acc.id,
        accountName: acc.name,
        firstName: formFirstName,
        lastName: formLastName,
        fullName,
        email: formEmail || `${formFirstName.toLowerCase()}@${acc.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
        phone: formPhone || acc.phone,
        title: formTitle || 'Director',
        department: formDepartment,
        isPrimaryContact: formIsPrimary,
        linkedinUrl: formLinkedin,
        notes: formNotes,
        createdAt: new Date().toISOString().split('T')[0],
      };
      onCreateContact(newCon);
    }

    setIsCreateModalOpen(false);
    setEditingContact(null);
  };

  const handleOpenEdit = (con: Contact) => {
    setEditingContact(con);
    setFormFirstName(con.firstName);
    setFormLastName(con.lastName);
    setFormAccountId(con.accountId);
    setFormEmail(con.email);
    setFormPhone(con.phone);
    setFormTitle(con.title);
    setFormDepartment(con.department);
    setFormIsPrimary(con.isPrimaryContact);
    setFormLinkedin(con.linkedinUrl || '');
    setFormNotes(con.notes || '');
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* If a contact is selected: Show Contact 360 View */}
      {selectedContact ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Back Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedContactId(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0176d3] hover:text-[#014486] transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to All Contacts</span>
            </button>
            <span className="text-[11px] font-mono text-[#5c6678]">
              Contact ID: <span className="font-bold text-[#181c25]">{selectedContact.id}</span>
            </span>
          </div>

          {/* Contact 360 Highlights Panel */}
          <div className="bg-white rounded-xl border border-[#dde1e9] p-5 shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#edf1f7]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#7c3aed] to-[#9333ea] text-white flex items-center justify-center shadow-xs shrink-0 font-bold text-lg">
                  {selectedContact.firstName[0]}{selectedContact.lastName[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                      {selectedContact.department}
                    </span>
                    {selectedContact.isPrimaryContact && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-500/25">
                        Primary Decision Maker
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#10233f] mt-1">
                    {selectedContact.fullName}
                  </h1>
                  <p className="text-xs text-[#5c6678] mt-0.5">
                    {selectedContact.title} at{' '}
                    <span className="font-extrabold text-[#0176d3]">
                      {selectedContact.accountName}
                    </span>
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={`mailto:${selectedContact.email}`}
                  className="rq-btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Mail size={13} />
                  <span>Send Email</span>
                </a>
                <button
                  onClick={() => handleOpenEdit(selectedContact)}
                  className="rq-btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Edit2 size={13} />
                  <span>Edit Contact</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
              <div>
                <span className="text-[#5c6678] font-medium block">Business Email:</span>
                <a href={`mailto:${selectedContact.email}`} className="text-xs font-bold text-[#0176d3] mt-0.5 block truncate hover:underline">
                  {selectedContact.email}
                </a>
              </div>
              <div>
                <span className="text-[#5c6678] font-medium block">Phone:</span>
                <span className="text-xs font-bold text-[#181c25] mt-0.5 block">
                  {selectedContact.phone}
                </span>
              </div>
              <div>
                <span className="text-[#5c6678] font-medium block">Account Lookup:</span>
                <span className="text-xs font-extrabold text-[#0176d3] mt-0.5 block truncate">
                  {selectedContact.accountName}
                </span>
              </div>
              <div>
                <span className="text-[#5c6678] font-medium block">Signed Quotes:</span>
                <span className="text-xs font-extrabold text-emerald-700 font-mono mt-0.5 block">
                  {relatedQuotes.length} Quotes On Record
                </span>
              </div>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-2 border-b border-[#dde1e9] pb-1">
            <button
              onClick={() => setActiveSubTab('related')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'related'
                  ? 'bg-white text-purple-700 shadow-2xs border border-[#dde1e9]'
                  : 'text-[#5c6678] hover:text-[#181c25]'
              }`}
            >
              <Layers size={14} />
              <span>Related Lists &amp; Lookups</span>
              <span className="px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold">
                {relatedOpportunities.length + relatedQuotes.length + (parentAccount ? 1 : 0)}
              </span>
            </button>
            <button
              onClick={() => setActiveSubTab('details')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'details'
                  ? 'bg-white text-purple-700 shadow-2xs border border-[#dde1e9]'
                  : 'text-[#5c6678] hover:text-[#181c25]'
              }`}
            >
              <span>Contact Details</span>
            </button>
          </div>

          {/* Sub-view: Related Lists (CRITICAL REQUIREMENT) */}
          {activeSubTab === 'related' && (
            <div className="space-y-5">
              {/* 1. Parent Account Lookup Card */}
              {parentAccount && (
                <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-[#edf1f7]">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-[#0176d3]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f]">
                        Parent Account Lookup
                      </h3>
                    </div>
                    {onNavigateToAccount && (
                      <button
                        onClick={() => onNavigateToAccount(parentAccount.id)}
                        className="text-xs font-bold text-[#0176d3] hover:underline flex items-center gap-1"
                      >
                        <span>Open Account 360</span>
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-[#f8fafc] p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[#5c6678] block">Company Name:</span>
                      <span className="font-extrabold text-[#10233f] text-sm mt-0.5 block">{parentAccount.name}</span>
                    </div>
                    <div>
                      <span className="text-[#5c6678] block">Industry:</span>
                      <span className="font-semibold text-[#181c25] mt-0.5 block">{parentAccount.industry}</span>
                    </div>
                    <div>
                      <span className="text-[#5c6678] block">Account Tier:</span>
                      <span className="font-bold text-[#0176d3] mt-0.5 block">{parentAccount.tier}</span>
                    </div>
                    <div>
                      <span className="text-[#5c6678] block">Health Score:</span>
                      <span className="font-mono font-bold text-emerald-700 mt-0.5 block">{parentAccount.healthScore}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Related Opportunities */}
              <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#edf1f7]">
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-emerald-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f]">
                      Related Opportunities ({relatedOpportunities.length})
                    </h3>
                  </div>
                </div>

                {relatedOpportunities.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Opportunity</th>
                          <th className="py-2.5 px-3">Stage</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Close Date</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf1f7]">
                        {relatedOpportunities.map((opp) => (
                          <tr key={opp.id} className="hover:bg-[#fafcff]">
                            <td className="py-2.5 px-3 font-bold text-[#10233f]">{opp.name}</td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                {opp.stage}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-[#181c25]">
                              {formatCurrency(convertCurrency(opp.amount, opp.currency, currency), currency)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[#5c6678]">{opp.closeDate}</td>
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
                  <div className="p-3 text-center text-xs text-[#5c6678]">No opportunities assigned.</div>
                )}
              </div>

              {/* 3. Signed Quotes & eSign Certificates */}
              <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-3 border-b border-[#edf1f7]">
                  <FileCheck2 size={16} className="text-purple-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f]">
                    Assigned Quotes &amp; eSign Envelopes ({relatedQuotes.length})
                  </h3>
                </div>

                {relatedQuotes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Quote Number</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Grand Total</th>
                          <th className="py-2.5 px-3">Cryptographic Digest</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf1f7]">
                        {relatedQuotes.map((q) => (
                          <tr key={q.id} className="hover:bg-[#fafcff]">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#0176d3]">{q.quoteNumber}</td>
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
                                <span className="font-mono text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                  <ShieldCheck size={13} />
                                  SHA-256: {q.signatureDigest.substring(0, 10)}...
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Pending Signature</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-[#5c6678]">No quotes associated with this contact.</div>
                )}
              </div>
            </div>
          )}

          {/* Sub-view: Details Tab */}
          {activeSubTab === 'details' && (
            <div className="bg-white rounded-xl border border-[#dde1e9] p-5 sm:p-6 shadow-2xs space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#5c6678]">Full Name:</span>
                  <span className="font-bold text-[#181c25]">{selectedContact.fullName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#5c6678]">Linked Account:</span>
                  <span className="font-extrabold text-[#0176d3]">{selectedContact.accountName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#5c6678]">Job Title:</span>
                  <span className="font-medium text-[#181c25]">{selectedContact.title}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#5c6678]">Department:</span>
                  <span className="font-semibold text-[#181c25]">{selectedContact.department}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#5c6678]">Business Email:</span>
                  <a href={`mailto:${selectedContact.email}`} className="text-[#0176d3] hover:underline">
                    {selectedContact.email}
                  </a>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#5c6678]">Phone Number:</span>
                  <span className="font-medium text-[#181c25]">{selectedContact.phone}</span>
                </div>
              </div>

              {selectedContact.linkedinUrl && (
                <div className="pt-2">
                  <a
                    href={selectedContact.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0a66c2] hover:underline"
                  >
                    <Globe size={14} />
                    <span>View LinkedIn Profile</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Contacts List / Table View */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7c3aed] to-[#9333ea] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-extrabold text-[#10233f]">
                      Contacts 360
                    </h1>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-500/25">
                      CRM Core
                    </span>
                  </div>
                  <p className="text-xs text-[#5c6678] mt-0.5">
                    Authorized signatories, procurement directors, and technical buyers linked to enterprise accounts.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingContact(null);
                  setFormFirstName('');
                  setFormLastName('');
                  setFormEmail('');
                  setFormPhone('');
                  setFormTitle('');
                  setIsCreateModalOpen(true);
                }}
                className="rq-btn-primary text-xs flex items-center gap-1.5 shrink-0"
              >
                <Plus size={14} />
                <span>New Contact</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="mt-4 pt-3 border-t border-[#edf1f7] flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5c6678]" />
                <input
                  type="text"
                  placeholder="Search contacts by name, email, account, or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f8fafc] border border-[#dde1e9] rounded-lg text-[#10233f] placeholder:text-slate-400 focus:bg-white focus:border-[#0176d3] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="text-xs bg-white border border-[#dde1e9] rounded-lg px-2.5 py-1.5 text-[#10233f] outline-none"
                >
                  <option value="all">All Departments</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Finance & Procurement">Finance &amp; Procurement</option>
                  <option value="Executive">Executive</option>
                </select>

                <button
                  type="button"
                  onClick={() => setPrimaryOnly(!primaryOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    primaryOnly
                      ? 'bg-purple-50 text-purple-700 border-purple-300'
                      : 'bg-white text-[#5c6678] border-[#dde1e9] hover:text-[#181c25]'
                  }`}
                >
                  Primary Only
                </button>
              </div>
            </div>
          </div>

          {/* Contacts Table */}
          <div className="bg-white rounded-xl border border-[#dde1e9] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Contact Name</th>
                    <th className="py-3 px-3">Title</th>
                    <th className="py-3 px-3">Account (Lookup)</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f7]">
                  {filteredContacts.map((con) => (
                    <tr
                      key={con.id}
                      onClick={() => setSelectedContactId(con.id)}
                      className="hover:bg-[#fafcff] transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-bold text-[#10233f] group-hover:text-[#0176d3] flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {con.firstName[0]}{con.lastName[0]}
                        </div>
                        <div>
                          <div>{con.fullName}</div>
                          {con.isPrimaryContact && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700">
                              Primary Decision Maker
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-[#5c6678] font-medium">{con.title}</td>
                      <td className="py-3.5 px-3 font-extrabold text-[#0176d3]">
                        {con.accountName}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[#5c6678]">{con.email}</td>
                      <td className="py-3.5 px-3 text-[#5c6678]">{con.phone}</td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(con)}
                            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-[#015ba5] text-xs font-semibold border border-[#dde1e9] transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            title="Edit Contact"
                          >
                            <Edit2 size={11} />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => setSelectedContactId(con.id)}
                            className="text-xs font-bold text-[#0176d3] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>View 360</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Contact Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10233f]/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[#dde1e9] bg-[#f8fafc] flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-[#10233f]">
                {editingContact ? 'Edit Contact' : 'New Contact'}
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c6678] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">First Name</label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#10233f] block mb-1">Account Lookup *</label>
                <select
                  value={formAccountId}
                  onChange={(e) => setFormAccountId(e.target.value)}
                  className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none font-bold"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.industry})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Business Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Job Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Department</label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value as Contact['department'])}
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
                  id="primaryContactCheckForm"
                  checked={formIsPrimary}
                  onChange={(e) => setFormIsPrimary(e.target.checked)}
                  className="accent-[#0176d3] rounded"
                />
                <label htmlFor="primaryContactCheckForm" className="text-xs font-semibold text-[#181c25] cursor-pointer">
                  Primary Decision Maker
                </label>
              </div>

              <div className="pt-4 border-t border-[#dde1e9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rq-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rq-btn-primary text-xs"
                >
                  {editingContact ? 'Save Changes' : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
