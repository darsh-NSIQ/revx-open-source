import React, { useState, useMemo } from 'react';
import { Currency, Lead, LeadStatus, Account, Contact, Opportunity } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  UserCheck, 
  Search, 
  Plus, 
  Filter, 
  Phone, 
  Mail, 
  Building2, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Edit2, 
  Trash2, 
  X, 
  ExternalLink, 
  ChevronRight, 
  Zap, 
  Sparkles, 
  DollarSign, 
  Target, 
  Layers,
  ArrowRight
} from 'lucide-react';

interface LeadsStudioProps {
  currency: Currency;
  leads: Lead[];
  onUpdateLead: (lead: Lead) => void;
  onCreateLead: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => void;
  onConvertLead: (data: {
    lead: Lead;
    account: Account;
    contact: Contact;
    opportunity?: Opportunity;
    launchCPQImmediately?: boolean;
  }) => void;
}

const LEAD_STAGES: { status: LeadStatus; label: string }[] = [
  { status: 'New', label: '1. New' },
  { status: 'Contacted', label: '2. Contacted' },
  { status: 'Working', label: '3. Working' },
  { status: 'Nurturing', label: '4. Nurturing' },
  { status: 'Qualified', label: '5. Qualified' },
  { status: 'Converted', label: '6. Converted' },
];

export const LeadsStudio: React.FC<LeadsStudioProps> = ({
  currency,
  leads,
  onUpdateLead,
  onCreateLead,
  onDeleteLead,
  onConvertLead,
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // Convert Lead Modal Form States
  const [convertAccountName, setConvertAccountName] = useState('');
  const [convertContactName, setConvertContactName] = useState('');
  const [convertCreateOpp, setConvertCreateOpp] = useState(true);
  const [convertOppName, setConvertOppName] = useState('');
  const [convertOppAmount, setConvertOppAmount] = useState<number>(50000);
  const [convertLaunchCPQ, setConvertLaunchCPQ] = useState(false);

  // New Lead Form States
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEstimatedARR, setFormEstimatedARR] = useState<number>(50000);
  const [formStatus, setFormStatus] = useState<LeadStatus>('New');
  const [formRating, setFormRating] = useState<Lead['rating']>('Warm');
  const [formLeadSource, setFormLeadSource] = useState<Lead['leadSource']>('Web Inbound');
  const [formIndustry, setFormIndustry] = useState('Software & Technology');
  const [formNotes, setFormNotes] = useState('');

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  );

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        l.fullName.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      const matchesRating = ratingFilter === 'all' || l.rating === ratingFilter;
      return matchesSearch && matchesStatus && matchesRating;
    });
  }, [leads, searchQuery, statusFilter, ratingFilter]);

  const handleOpenConvertModal = (lead: Lead) => {
    setConvertAccountName(lead.company);
    setConvertContactName(lead.fullName);
    setConvertCreateOpp(true);
    setConvertOppName(`${lead.company} - Enterprise SaaS`);
    setConvertOppAmount(lead.estimatedARR);
    setConvertLaunchCPQ(false);
    setIsConvertModalOpen(true);
  };

  const handleExecuteConversion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    // 1. Create New Account
    const newAccount: Account = {
      id: `acc-${Date.now()}`,
      name: convertAccountName || selectedLead.company,
      accountNumber: `ACC-2026-00${Date.now().toString().slice(-3)}`,
      industry: 'Software & Technology',
      type: 'Customer',
      annualRevenue: selectedLead.estimatedARR * 10,
      currency,
      website: `https://${selectedLead.company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      phone: selectedLead.phone,
      ownerName: selectedLead.ownerName,
      tier: 'Tier 2 Mid-Market',
      healthScore: 90,
      createdAt: new Date().toISOString().split('T')[0],
      billingAddress: {
        street: '100 Enterprise Way',
        city: selectedLead.city || 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: selectedLead.country || 'United States',
      },
    };

    // 2. Create New Contact
    const newContact: Contact = {
      id: `con-${Date.now()}`,
      accountId: newAccount.id,
      accountName: newAccount.name,
      firstName: selectedLead.firstName,
      lastName: selectedLead.lastName,
      fullName: selectedLead.fullName,
      email: selectedLead.email,
      phone: selectedLead.phone,
      title: selectedLead.title,
      department: 'Executive',
      isPrimaryContact: true,
      createdAt: new Date().toISOString().split('T')[0],
    };

    // 3. Create New Opportunity if enabled
    let newOpportunity: Opportunity | undefined = undefined;
    if (convertCreateOpp) {
      newOpportunity = {
        id: `opp-${Date.now()}`,
        name: convertOppName || `${newAccount.name} - Enterprise SaaS`,
        accountName: newAccount.name,
        amount: convertOppAmount,
        currency,
        stage: 'Qualification',
        probabilityPct: 25,
        closeDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
        ownerName: selectedLead.ownerName,
        dealType: 'New Business',
        forecastCategory: 'Pipeline',
        primaryContact: newContact.fullName,
        contactEmail: newContact.email,
      };
    }

    // 4. Mark Lead as Converted
    const updatedLead: Lead = {
      ...selectedLead,
      status: 'Converted',
      convertedAccountId: newAccount.id,
      convertedContactId: newContact.id,
      convertedOpportunityId: newOpportunity?.id,
      convertedAt: new Date().toISOString().split('T')[0],
    };

    onConvertLead({
      lead: updatedLead,
      account: newAccount,
      contact: newContact,
      opportunity: newOpportunity,
      launchCPQImmediately: convertLaunchCPQ,
    });

    setIsConvertModalOpen(false);
  };

  const handleAdvanceStatus = (newStatus: LeadStatus) => {
    if (!selectedLead) return;
    if (newStatus === 'Converted') {
      handleOpenConvertModal(selectedLead);
      return;
    }
    const updated: Lead = {
      ...selectedLead,
      status: newStatus,
    };
    onUpdateLead(updated);
  };

  const handleSaveLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLastName.trim() || !formCompany.trim()) return;

    const fullName = `${formFirstName.trim()} ${formLastName.trim()}`.trim();

    if (editingLead) {
      const updated: Lead = {
        ...editingLead,
        firstName: formFirstName,
        lastName: formLastName,
        fullName,
        company: formCompany,
        title: formTitle,
        email: formEmail,
        phone: formPhone,
        estimatedARR: formEstimatedARR,
        status: formStatus,
        rating: formRating,
        leadSource: formLeadSource,
        notes: formNotes,
      };
      onUpdateLead(updated);
    } else {
      const newL: Lead = {
        id: `lead-${Date.now()}`,
        leadNumber: `LEAD-2026-00${leads.length + 1}`,
        firstName: formFirstName,
        lastName: formLastName,
        fullName,
        company: formCompany,
        title: formTitle,
        email: formEmail,
        phone: formPhone,
        estimatedARR: formEstimatedARR,
        currency,
        status: formStatus,
        rating: formRating,
        leadSource: formLeadSource,
        industry: formIndustry,
        ownerName: 'Alexander Hayes',
        createdAt: new Date().toISOString().split('T')[0],
        notes: formNotes,
      };
      onCreateLead(newL);
    }

    setIsCreateModalOpen(false);
    setEditingLead(null);
  };

  const handleOpenEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormFirstName(lead.firstName);
    setFormLastName(lead.lastName);
    setFormCompany(lead.company);
    setFormTitle(lead.title);
    setFormEmail(lead.email);
    setFormPhone(lead.phone);
    setFormEstimatedARR(lead.estimatedARR);
    setFormStatus(lead.status);
    setFormRating(lead.rating);
    setFormLeadSource(lead.leadSource);
    setFormNotes(lead.notes || '');
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* If a Lead is Selected: Show Salesforce Lead 360 Record View */}
      {selectedLead ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Back Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedLeadId(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0176d3] hover:text-[#014486] transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to All Leads</span>
            </button>
            <span className="text-[11px] font-mono text-[#5c6678]">
              Lead ID: <span className="font-bold text-[#181c25]">{selectedLead.leadNumber}</span>
            </span>
          </div>

          {/* Lead 360 Highlights Panel */}
          <div className="bg-white rounded-xl border border-[#dde1e9] p-5 shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#edf1f7]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs shrink-0 font-bold text-lg">
                  <UserCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedLead.rating === 'Hot'
                        ? 'bg-rose-50 text-rose-700 border border-rose-500/25'
                        : selectedLead.rating === 'Warm'
                        ? 'bg-amber-50 text-amber-800 border border-amber-500/25'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {selectedLead.rating} Lead
                    </span>
                    <span className="text-xs text-[#5c6678]">
                      Source: {selectedLead.leadSource}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#10233f] mt-1">
                    {selectedLead.fullName}
                  </h1>
                  <p className="text-xs text-[#5c6678] mt-0.5">
                    {selectedLead.title} at{' '}
                    <strong className="text-[#10233f]">{selectedLead.company}</strong>
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedLead.status !== 'Converted' ? (
                  <button
                    onClick={() => handleOpenConvertModal(selectedLead)}
                    className="rq-btn-primary text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <Zap size={14} className="text-amber-300 fill-amber-300" />
                    <span>Convert Lead →</span>
                  </button>
                ) : (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    <span>Converted Account &amp; Contact Active</span>
                  </span>
                )}
                <button
                  onClick={() => handleOpenEdit(selectedLead)}
                  className="rq-btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Edit2 size={13} />
                  <span>Edit Lead</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
              <div>
                <span className="text-[#5c6678] font-medium block">Estimated ARR:</span>
                <span className="text-sm font-extrabold text-[#10233f] font-mono mt-0.5 block">
                  {formatCurrency(convertCurrency(selectedLead.estimatedARR, selectedLead.currency, currency), currency)}
                </span>
              </div>
              <div>
                <span className="text-[#5c6678] font-medium block">Email:</span>
                <a href={`mailto:${selectedLead.email}`} className="text-xs font-bold text-[#0176d3] mt-0.5 block truncate hover:underline">
                  {selectedLead.email}
                </a>
              </div>
              <div>
                <span className="text-[#5c6678] font-medium block">Phone:</span>
                <span className="text-xs font-bold text-[#181c25] mt-0.5 block">
                  {selectedLead.phone}
                </span>
              </div>
              <div>
                <span className="text-[#5c6678] font-medium block">Lead Owner:</span>
                <span className="text-xs font-bold text-[#181c25] mt-0.5 block">
                  {selectedLead.ownerName}
                </span>
              </div>
            </div>
          </div>

          {/* Salesforce Standard Chevron Path Bar */}
          <div className="bg-white rounded-xl border border-[#dde1e9] p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5c6678] block mb-2">
              Lead Progression Path
            </span>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {LEAD_STAGES.map((s) => {
                const isActive = selectedLead.status === s.status;
                const isConverted = selectedLead.status === 'Converted';
                return (
                  <button
                    key={s.status}
                    onClick={() => handleAdvanceStatus(s.status)}
                    className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? s.status === 'Converted'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-[#0176d3] text-white shadow-2xs'
                        : 'bg-[#f0f3f8] text-[#5c6678] hover:bg-slate-200'
                    }`}
                  >
                    <span>{s.label}</span>
                    {isActive && <CheckCircle2 size={13} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lead Details */}
          <div className="bg-white rounded-xl border border-[#dde1e9] p-5 sm:p-6 shadow-2xs space-y-4 text-xs">
            <h3 className="font-extrabold text-[#10233f] text-sm border-b border-[#edf1f7] pb-2">
              Lead Discovery &amp; Qualification Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-[#5c6678]">Company:</span>
                <span className="font-bold text-[#181c25]">{selectedLead.company}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-[#5c6678]">Job Title:</span>
                <span className="font-medium text-[#181c25]">{selectedLead.title}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-[#5c6678]">Industry:</span>
                <span className="font-semibold text-[#181c25]">{selectedLead.industry}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-[#5c6678]">Lead Rating:</span>
                <span className="font-bold text-amber-700">{selectedLead.rating}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-[#5c6678]">Created Date:</span>
                <span className="text-[#181c25]">{selectedLead.createdAt}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-[#5c6678]">Lead Status:</span>
                <span className="font-bold text-[#0176d3]">{selectedLead.status}</span>
              </div>
            </div>

            {selectedLead.notes && (
              <div className="p-3.5 bg-[#f8fafc] rounded-xl border border-slate-200">
                <span className="font-bold text-[#10233f] block mb-1">Qualification Discovery Notes:</span>
                <p className="text-[#5c6678] italic leading-relaxed">{selectedLead.notes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Leads List / Table View */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <UserCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-extrabold text-[#10233f]">
                      Leads 360 &amp; Conversion Pipeline
                    </h1>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-500/25">
                      CRM Core
                    </span>
                  </div>
                  <p className="text-xs text-[#5c6678] mt-0.5">
                    Capture inbound prospects, qualify BANT criteria, and 1-click convert into Accounts, Contacts, and CPQ Opportunities.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingLead(null);
                  setFormFirstName('');
                  setFormLastName('');
                  setFormCompany('');
                  setFormEmail('');
                  setFormPhone('');
                  setIsCreateModalOpen(true);
                }}
                className="rq-btn-primary text-xs flex items-center gap-1.5 shrink-0"
              >
                <Plus size={14} />
                <span>New Lead</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="mt-4 pt-3 border-t border-[#edf1f7] flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5c6678]" />
                <input
                  type="text"
                  placeholder="Search leads by prospect name, company, email, or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f8fafc] border border-[#dde1e9] rounded-lg text-[#10233f] placeholder:text-slate-400 focus:bg-white focus:border-[#0176d3] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs bg-white border border-[#dde1e9] rounded-lg px-2.5 py-1.5 text-[#10233f] outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Working">Working</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Converted">Converted</option>
                </select>

                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className="text-xs bg-white border border-[#dde1e9] rounded-lg px-2.5 py-1.5 text-[#10233f] outline-none"
                >
                  <option value="all">All Ratings</option>
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                </select>
              </div>
            </div>
          </div>

          {/* Leads Table */}
          <div className="bg-white rounded-xl border border-[#dde1e9] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Lead Name</th>
                    <th className="py-3 px-3">Company</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Rating</th>
                    <th className="py-3 px-3">Estimated ARR</th>
                    <th className="py-3 px-3">Lead Source</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f7]">
                  {filteredLeads.map((l) => {
                    const convARR = convertCurrency(l.estimatedARR, l.currency, currency);
                    return (
                      <tr
                        key={l.id}
                        onClick={() => setSelectedLeadId(l.id)}
                        className="hover:bg-[#fafcff] transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-bold text-[#10233f] group-hover:text-[#0176d3] flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {l.firstName[0]}{l.lastName[0]}
                          </div>
                          <div>
                            <div>{l.fullName}</div>
                            <div className="text-[10px] text-[#5c6678] font-normal">{l.title}</div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#181c25]">{l.company}</td>
                        <td className="py-3.5 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            l.status === 'Converted'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/25'
                              : l.status === 'Qualified'
                              ? 'bg-purple-50 text-purple-700 border border-purple-500/25'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            l.rating === 'Hot' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {l.rating}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-[#10233f]">
                          {formatCurrency(convARR, currency)}
                        </td>
                        <td className="py-3.5 px-3 text-[#5c6678]">{l.leadSource}</td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(l)}
                              className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-[#015ba5] text-xs font-semibold border border-[#dde1e9] transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="Edit Lead"
                            >
                              <Edit2 size={11} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setSelectedLeadId(l.id)}
                              className="text-xs font-bold text-[#0176d3] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>Open 360</span>
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

      {/* Signature Salesforce Action: Convert Lead Modal */}
      {isConvertModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10233f]/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[#dde1e9] bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#10233f]">
                    Convert Lead: {selectedLead.fullName}
                  </h3>
                  <p className="text-xs text-[#5c6678]">
                    Automatically create an Account, Contact, and Opportunity in 1 click.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConvertModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c6678] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecuteConversion} className="p-5 sm:p-6 space-y-4 text-xs">
              {/* Target 1: Account */}
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <Building2 size={15} />
                  <span>Account (Company) Creation</span>
                </div>
                <input
                  type="text"
                  required
                  value={convertAccountName}
                  onChange={(e) => setConvertAccountName(e.target.value)}
                  className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none font-bold"
                />
              </div>

              {/* Target 2: Contact */}
              <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                  <UserCheck size={15} />
                  <span>Primary Contact Creation</span>
                </div>
                <input
                  type="text"
                  required
                  value={convertContactName}
                  onChange={(e) => setConvertContactName(e.target.value)}
                  className="w-full bg-white border border-purple-300 rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none font-bold"
                />
              </div>

              {/* Target 3: Opportunity */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                    <Target size={15} className="text-emerald-700" />
                    <span>Create Sales Opportunity</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={convertCreateOpp}
                    onChange={(e) => setConvertCreateOpp(e.target.checked)}
                    className="accent-emerald-600 rounded"
                  />
                </div>

                {convertCreateOpp && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-emerald-900 block mb-1">Opportunity Name</label>
                      <input
                        type="text"
                        value={convertOppName}
                        onChange={(e) => setConvertOppName(e.target.value)}
                        className="w-full bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-xs text-[#10233f] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-emerald-900 block mb-1">Estimated Deal Amount</label>
                      <input
                        type="number"
                        value={convertOppAmount}
                        onChange={(e) => setConvertOppAmount(Number(e.target.value))}
                        className="w-full bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-xs text-[#10233f] outline-none font-mono font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#dde1e9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  className="rq-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rq-btn-primary text-xs flex items-center gap-1.5 shadow-md"
                >
                  <Zap size={13} className="text-amber-300 fill-amber-300" />
                  <span>Complete Conversion</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Lead Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10233f]/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[#dde1e9] bg-[#f8fafc] flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-[#10233f]">
                {editingLead ? 'Edit Lead' : 'New Inbound Lead'}
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c6678] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="p-5 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
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
                <label className="font-bold text-[#10233f] block mb-1">Company / Organization *</label>
                <input
                  type="text"
                  required
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                />
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
                  <label className="font-bold text-[#10233f] block mb-1">Estimated ARR ({currency})</label>
                  <input
                    type="number"
                    value={formEstimatedARR}
                    onChange={(e) => setFormEstimatedARR(Number(e.target.value))}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#10233f] block mb-1">Lead Rating</label>
                  <select
                    value={formRating}
                    onChange={(e) => setFormRating(e.target.value as Lead['rating'])}
                    className="w-full bg-white border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] outline-none"
                  >
                    <option value="Hot">Hot</option>
                    <option value="Warm">Warm</option>
                    <option value="Cold">Cold</option>
                  </select>
                </div>
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
                  {editingLead ? 'Save Changes' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
