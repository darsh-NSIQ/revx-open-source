import React, { useState, useMemo } from 'react';
import { Currency, Opportunity, OpportunityStage, Quote } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import {
  Target,
  Plus,
  Search,
  Filter,
  Kanban,
  Table as TableIcon,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Building,
  User,
  Zap,
  CheckCircle2,
  XCircle,
  FileText,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowUpRight,
  Mail,
  Edit2,
  Trash2,
  X,
  Sliders,
  DollarSign,
  Briefcase
} from 'lucide-react';

interface OpportunitiesStudioProps {
  currency: Currency;
  opportunities: Opportunity[];
  quotes: Quote[];
  onUpdateOpportunity: (opp: Opportunity) => void;
  onCreateOpportunity: (opp: Opportunity) => void;
  onDeleteOpportunity: (oppId: string) => void;
  onLaunchCPQQuote: (opp: Opportunity) => void;
  onViewQuote: (quoteId: string) => void;
}

const STAGE_CONFIG: {
  stage: OpportunityStage;
  label: string;
  defaultProbability: number;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
}[] = [
  {
    stage: 'Prospecting',
    label: '1. Prospecting',
    defaultProbability: 10,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
    badgeBg: 'bg-slate-100 text-slate-700',
  },
  {
    stage: 'Qualification',
    label: '2. Qualification',
    defaultProbability: 25,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50/50',
    borderColor: 'border-blue-300',
    badgeBg: 'bg-blue-100 text-blue-700',
  },
  {
    stage: 'Needs Analysis',
    label: '3. Needs Analysis',
    defaultProbability: 50,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50/50',
    borderColor: 'border-indigo-300',
    badgeBg: 'bg-indigo-100 text-indigo-700',
  },
  {
    stage: 'Proposal / CPQ Quote',
    label: '4. Proposal / Quote',
    defaultProbability: 75,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50/50',
    borderColor: 'border-amber-300',
    badgeBg: 'bg-amber-100 text-amber-800',
  },
  {
    stage: 'Negotiation & Review',
    label: '5. Negotiation',
    defaultProbability: 90,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50/50',
    borderColor: 'border-purple-300',
    badgeBg: 'bg-purple-100 text-purple-800',
  },
  {
    stage: 'Closed Won',
    label: '6. Closed Won',
    defaultProbability: 100,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50/50',
    borderColor: 'border-emerald-300',
    badgeBg: 'bg-emerald-100 text-emerald-800',
  },
  {
    stage: 'Closed Lost',
    label: '7. Closed Lost',
    defaultProbability: 0,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50/50',
    borderColor: 'border-rose-300',
    badgeBg: 'bg-rose-100 text-rose-800',
  },
];

export const OpportunitiesStudio: React.FC<OpportunitiesStudioProps> = ({
  currency,
  opportunities,
  quotes,
  onUpdateOpportunity,
  onCreateOpportunity,
  onDeleteOpportunity,
  onLaunchCPQQuote,
  onViewQuote,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewDeal, setIsNewDeal] = useState(false);

  // Form State for modal
  const [formName, setFormName] = useState('');
  const [formAccountName, setFormAccountName] = useState('');
  const [formAmount, setFormAmount] = useState(50000);
  const [formStage, setFormStage] = useState<OpportunityStage>('Qualification');
  const [formProbability, setFormProbability] = useState(25);
  const [formCloseDate, setFormCloseDate] = useState('');
  const [formOwnerName, setFormOwnerName] = useState('Priya Nambiar');
  const [formDealType, setFormDealType] = useState<Opportunity['dealType']>('New Business');
  const [formLeadSource, setFormLeadSource] = useState('Enterprise Strategic Accounts');
  const [formForecastCategory, setFormForecastCategory] = useState<Opportunity['forecastCategory']>('Pipeline');
  const [formPrimaryContact, setFormPrimaryContact] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formNextStep, setFormNextStep] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLossReason, setFormLossReason] = useState('');

  // Unique owners
  const owners = useMemo(() => {
    const list = Array.from(new Set(opportunities.map((o) => o.ownerName)));
    return list;
  }, [opportunities]);

  // Telemetry Calculations
  const metrics = useMemo(() => {
    let totalPipeline = 0;
    let weightedForecast = 0;
    let openCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    let wonValue = 0;

    opportunities.forEach((opp) => {
      const convertedVal = convertCurrency(opp.amount, opp.currency, currency);
      if (opp.stage === 'Closed Won') {
        wonCount += 1;
        wonValue += convertedVal;
      } else if (opp.stage === 'Closed Lost') {
        lostCount += 1;
      } else {
        openCount += 1;
        totalPipeline += convertedVal;
        weightedForecast += (convertedVal * opp.probabilityPct) / 100;
      }
    });

    const totalClosed = wonCount + lostCount;
    const winRate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 100;
    const avgDealSize = openCount > 0 ? totalPipeline / openCount : 0;

    return {
      totalPipeline,
      weightedForecast,
      openCount,
      wonCount,
      wonValue,
      winRate,
      avgDealSize,
      totalDeals: opportunities.length,
    };
  }, [opportunities, currency]);

  // Filtered Opportunities
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      const matchesSearch =
        opp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opp.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (opp.primaryContact && opp.primaryContact.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStage = stageFilter === 'ALL' || opp.stage === stageFilter;
      const matchesOwner = ownerFilter === 'ALL' || opp.ownerName === ownerFilter;

      return matchesSearch && matchesStage && matchesOwner;
    });
  }, [opportunities, searchQuery, stageFilter, ownerFilter]);

  const openNewDealModal = () => {
    setIsNewDeal(true);
    setFormName('');
    setFormAccountName('');
    setFormAmount(75000);
    setFormStage('Prospecting');
    setFormProbability(10);
    setFormCloseDate(new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0]);
    setFormOwnerName('Devon Vance');
    setFormDealType('New Business');
    setFormLeadSource('Inbound Web Form');
    setFormForecastCategory('Pipeline');
    setFormPrimaryContact('');
    setFormContactEmail('');
    setFormNextStep('Schedule Initial Discovery Call');
    setFormNotes('');
    setFormLossReason('');
    setIsModalOpen(true);
  };

  const openEditModal = (opp: Opportunity) => {
    setIsNewDeal(false);
    setEditingOpp(opp);
    setFormName(opp.name);
    setFormAccountName(opp.accountName);
    setFormAmount(opp.amount);
    setFormStage(opp.stage);
    setFormProbability(opp.probabilityPct);
    setFormCloseDate(opp.closeDate);
    setFormOwnerName(opp.ownerName);
    setFormDealType(opp.dealType);
    setFormLeadSource(opp.leadSource || 'Enterprise Strategic Accounts');
    setFormForecastCategory(opp.forecastCategory);
    setFormPrimaryContact(opp.primaryContact || '');
    setFormContactEmail(opp.contactEmail || '');
    setFormNextStep(opp.nextStep || '');
    setFormNotes(opp.notes || '');
    setFormLossReason(opp.lossReason || '');
    setIsModalOpen(true);
  };

  const handleStageSelectInForm = (newStage: OpportunityStage) => {
    setFormStage(newStage);
    const cfg = STAGE_CONFIG.find((s) => s.stage === newStage);
    if (cfg) {
      setFormProbability(cfg.defaultProbability);
      if (newStage === 'Closed Won') {
        setFormForecastCategory('Closed');
      } else if (newStage === 'Closed Lost') {
        setFormForecastCategory('Pipeline');
      } else if (newStage === 'Negotiation & Review' || newStage === 'Proposal / CPQ Quote') {
        setFormForecastCategory('Commit');
      } else {
        setFormForecastCategory('Pipeline');
      }
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formAccountName) return;

    if (isNewDeal) {
      const newOpp: Opportunity = {
        id: `opp-${Date.now()}`,
        name: formName,
        accountName: formAccountName,
        amount: Number(formAmount) || 0,
        currency,
        stage: formStage,
        probabilityPct: Number(formProbability) || 0,
        closeDate: formCloseDate || new Date().toISOString().split('T')[0],
        ownerName: formOwnerName,
        dealType: formDealType,
        leadSource: formLeadSource,
        forecastCategory: formForecastCategory,
        primaryContact: formPrimaryContact,
        contactEmail: formContactEmail,
        nextStep: formNextStep,
        notes: formNotes,
        lossReason: formStage === 'Closed Lost' ? formLossReason : undefined,
      };
      onCreateOpportunity(newOpp);
    } else if (editingOpp) {
      const updated: Opportunity = {
        ...editingOpp,
        name: formName,
        accountName: formAccountName,
        amount: Number(formAmount) || 0,
        stage: formStage,
        probabilityPct: Number(formProbability) || 0,
        closeDate: formCloseDate,
        ownerName: formOwnerName,
        dealType: formDealType,
        leadSource: formLeadSource,
        forecastCategory: formForecastCategory,
        primaryContact: formPrimaryContact,
        contactEmail: formContactEmail,
        nextStep: formNextStep,
        notes: formNotes,
        lossReason: formStage === 'Closed Lost' ? formLossReason : undefined,
      };
      onUpdateOpportunity(updated);
    }
    setIsModalOpen(false);
  };

  const advanceStage = (opp: Opportunity, direction: 'next' | 'prev') => {
    const stageOrder: OpportunityStage[] = [
      'Prospecting',
      'Qualification',
      'Needs Analysis',
      'Proposal / CPQ Quote',
      'Negotiation & Review',
      'Closed Won',
    ];
    const currentIndex = stageOrder.indexOf(opp.stage);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= 0 && nextIndex < stageOrder.length) {
      const newStage = stageOrder[nextIndex];
      const cfg = STAGE_CONFIG.find((s) => s.stage === newStage);
      const updated: Opportunity = {
        ...opp,
        stage: newStage,
        probabilityPct: cfg ? cfg.defaultProbability : opp.probabilityPct,
        forecastCategory:
          newStage === 'Closed Won'
            ? 'Closed'
            : newStage === 'Negotiation & Review'
            ? 'Commit'
            : 'Pipeline',
      };
      onUpdateOpportunity(updated);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Level 1: Salesforce Lightning Highlights Panel */}
      <div className="rq-card p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20 flex items-center gap-1.5 shadow-2xs">
                <Target size={13} className="text-[#0176d3]" />
                Sales Process &amp; Deal Pipeline
              </span>
              <span className="text-xs text-[#5c6678] font-medium hidden sm:inline">
                Salesforce CRM Parity • Opportunity Lifecycle
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-[#10233f] tracking-tight">
              Enterprise Opportunities Pipeline
            </h1>
            <p className="text-xs text-[#5c6678] mt-0.5">
              Track deals from initial Prospecting to Closed Won, with seamless 1-click CPQ Quote generation and automated Q2C activation.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Switcher: Kanban vs Table */}
            <div className="bg-[#f0f3f8] p-0.5 rounded-lg border border-[#dde1e9] flex items-center shadow-2xs">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-white text-[#015ba5] shadow-xs'
                    : 'text-[#5c6678] hover:text-[#10233f]'
                }`}
                title="Kanban Board View"
              >
                <Kanban size={14} />
                <span>Kanban</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-[#015ba5] shadow-xs'
                    : 'text-[#5c6678] hover:text-[#10233f]'
                }`}
                title="Table View"
              >
                <TableIcon size={14} />
                <span>Table</span>
              </button>
            </div>

            {/* New Opportunity Action */}
            <button
              onClick={openNewDealModal}
              className="rq-btn-primary text-xs flex items-center gap-1.5 shadow-sm shadow-[#0176d3]/20"
            >
              <Plus size={14} />
              <span>New Opportunity</span>
            </button>
          </div>
        </div>
      </div>

      {/* Level 2: Top Telemetry & Forecasting Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Open Pipeline */}
        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-[#0176d3] rq-stagger-1 group">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-bold text-[10.5px] uppercase tracking-wider">Total Open Pipeline</span>
            <span className="text-[10px] font-bold text-[#015ba5] bg-[#eef4ff] px-2 py-0.5 rounded-full border border-[#0176d3]/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0176d3] animate-pulse" />
              {metrics.openCount} Active Deals
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 tracking-tight group-hover:text-[#0176d3] transition-colors tabular-nums">
            {formatCurrency(metrics.totalPipeline, currency)}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Avg Deal Size</span>
            <span className="font-bold text-slate-800 font-mono">
              {formatCurrency(metrics.avgDealSize, currency)}
            </span>
          </div>
        </div>

        {/* Metric 2: Weighted ARR Forecast */}
        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-emerald-500 rq-stagger-2 group">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-bold text-[10.5px] uppercase tracking-wider text-emerald-800">Weighted Forecast</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Expected ARR
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700 tracking-tight tabular-nums">
            {formatCurrency(metrics.weightedForecast, currency)}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Probability-Weighted</span>
            <span className="font-bold text-emerald-700">Predictive</span>
          </div>
        </div>

        {/* Metric 3: Win Rate */}
        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-indigo-500 rq-stagger-3 group">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-bold text-[10.5px] uppercase tracking-wider text-indigo-900">Win Rate</span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-500/20">
              Closed Deals
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-indigo-700 tracking-tight tabular-nums">
            {metrics.winRate.toFixed(1)}%
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Closed Won</span>
            <span className="font-bold text-slate-800 font-mono">
              {metrics.wonCount} won ({formatCurrency(metrics.wonValue, currency)})
            </span>
          </div>
        </div>

        {/* Metric 4: CPQ Integration Readiness */}
        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-amber-500 rq-stagger-4 group">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-bold text-[10.5px] uppercase tracking-wider text-amber-900">CPQ Conversion</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-500/20">
              Quotes Linked
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-700 tracking-tight tabular-nums">
            {opportunities.filter((o) => o.quoteId).length} / {opportunities.length}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Ready to Contract</span>
            <span className="font-bold text-amber-800">1-Click Launch</span>
          </div>
        </div>
      </div>

      {/* Level 3: Search, Filter, and Controls Bar */}
      <div className="rq-card p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-[#5c6678] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by deal name, account, or contact..."
              className="w-full bg-[#f8fafc] border border-[#dde1e9] focus:border-[#0176d3] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          {/* Stage Filter */}
          <div className="flex items-center gap-1.5 text-xs text-[#5c6678]">
            <Filter size={13} />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-2.5 py-1.5 text-xs text-[#181c25] focus:outline-none focus:border-[#0176d3]"
            >
              <option value="ALL">All Stages ({opportunities.length})</option>
              {STAGE_CONFIG.map((s) => (
                <option key={s.stage} value={s.stage}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Owner Filter */}
          {owners.length > 1 && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-2.5 py-1.5 text-xs text-[#181c25] focus:outline-none focus:border-[#0176d3]"
            >
              <option value="ALL">All Owners</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Level 4: Main Workspace View (Kanban or Table) */}
      {viewMode === 'kanban' ? (
        /* Salesforce Lightning Kanban Pipeline */
        <div className="overflow-x-auto pb-4 pt-1">
          <div className="flex items-start gap-4 min-w-[1400px]">
            {STAGE_CONFIG.map((col) => {
              const stageDeals = filteredOpportunities.filter((o) => o.stage === col.stage);
              const stageTotalVal = stageDeals.reduce(
                (acc, o) => acc + convertCurrency(o.amount, o.currency, currency),
                0
              );

              return (
                <div
                  key={col.stage}
                  className={`flex-1 min-w-[240px] max-w-[280px] rounded-xl border ${col.borderColor} ${col.bgColor} p-3 flex flex-col space-y-3 shadow-2xs transition-all`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-black/5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${col.color}`}>{col.label}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${col.badgeBg}`}>
                          {stageDeals.length}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono font-bold text-[#10233f] mt-0.5">
                        {formatCurrency(stageTotalVal, currency)}
                      </div>
                    </div>
                  </div>

                  {/* Deals Cards in this stage */}
                  <div className="space-y-3 flex-1">
                    {stageDeals.length === 0 ? (
                      <div className="p-4 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-600 bg-white/50">
                        No deals in this stage
                      </div>
                    ) : (
                      stageDeals.map((deal) => {
                        const convertedDealAmount = convertCurrency(deal.amount, deal.currency, currency);
                        const linkedQuote = quotes.find((q) => q.id === deal.quoteId || q.quoteNumber === deal.quoteNumber);

                        return (
                          <div
                            key={deal.id}
                            className="bg-white rounded-lg border border-[#dde1e9] p-3.5 shadow-2xs hover:shadow-md hover:border-[#0176d3]/60 transition-all duration-200 group relative space-y-2.5"
                          >
                            {/* Card Top: Deal Name & Quick Action */}
                            <div className="flex items-start justify-between gap-2">
                              <button
                                onClick={() => openEditModal(deal)}
                                className="text-xs font-extrabold text-[#10233f] hover:text-[#0176d3] text-left transition-colors leading-tight line-clamp-2"
                              >
                                {deal.name}
                              </button>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEditModal(deal)}
                                  title="Edit Opportunity"
                                  className="p-1 text-slate-600 hover:text-[#0176d3] hover:bg-slate-100 rounded"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => onDeleteOpportunity(deal.id)}
                                  title="Delete Opportunity"
                                  className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Account & Deal Type Badge */}
                            <div className="flex items-center justify-between text-[11px] text-[#5c6678]">
                              <div className="flex items-center gap-1 truncate max-w-[150px]">
                                <Building size={11} className="text-[#0176d3] shrink-0" />
                                <span className="truncate font-medium">{deal.accountName}</span>
                              </div>
                              <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                {deal.dealType}
                              </span>
                            </div>

                            {/* Deal Value & Probability Bar */}
                            <div>
                              <div className="flex items-baseline justify-between">
                                <span className="text-sm font-extrabold font-mono text-[#10233f]">
                                  {formatCurrency(convertedDealAmount, currency)}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 font-mono">
                                  {deal.probabilityPct}% win
                                </span>
                              </div>
                              {/* Probability bar */}
                              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-1">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    deal.probabilityPct >= 75
                                      ? 'bg-emerald-500'
                                      : deal.probabilityPct >= 40
                                      ? 'bg-amber-500'
                                      : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${deal.probabilityPct}%` }}
                                />
                              </div>
                            </div>

                            {/* Target Close Date & Owner */}
                            <div className="flex items-center justify-between text-[10.5px] text-[#5c6678] pt-1 border-t border-[#f0f3f8]">
                              <div className="flex items-center gap-1">
                                <Calendar size={11} className="text-slate-400" />
                                <span>{deal.closeDate}</span>
                              </div>
                              <div className="flex items-center gap-1 font-medium text-slate-700">
                                <div className="w-4 h-4 rounded-full bg-[#0176d3]/10 text-[#0176d3] flex items-center justify-center text-[9px] font-bold">
                                  {deal.ownerName.charAt(0)}
                                </div>
                                <span className="truncate max-w-[70px]">{deal.ownerName.split(' ')[0]}</span>
                              </div>
                            </div>

                            {/* Primary Contact & Next Step snippet */}
                            {deal.nextStep && (
                              <div className="p-1.5 rounded bg-[#f8fafc] border border-[#edf1f7] text-[10.5px] text-slate-600 line-clamp-1 flex items-center gap-1">
                                <span className="font-bold text-[#0176d3] text-[9.5px]">NEXT:</span>
                                <span className="truncate">{deal.nextStep}</span>
                              </div>
                            )}

                            {/* CPQ Quote Bridge & Stage Advance Actions */}
                            <div className="pt-2 border-t border-[#edf1f7] space-y-1.5">
                              {deal.quoteId ? (
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    onClick={() => onViewQuote(deal.quoteId!)}
                                    className="w-full py-1 px-2 rounded bg-emerald-50 text-emerald-800 border border-emerald-300/60 hover:bg-emerald-100 text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                                  >
                                    <FileText size={12} className="text-emerald-600" />
                                    <span>Quote {deal.quoteNumber || linkedQuote?.quoteNumber || ''}</span>
                                    {linkedQuote?.status && (
                                      <span className="text-[9px] uppercase px-1 rounded bg-emerald-200 text-emerald-900 ml-1">
                                        {linkedQuote.status}
                                      </span>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => onLaunchCPQQuote(deal)}
                                  className="w-full py-1 px-2 rounded bg-gradient-to-r from-[#015ba5] to-[#0176d3] text-white hover:brightness-105 text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all"
                                >
                                  <Zap size={11} className="text-amber-300 fill-amber-300" />
                                  <span>Launch CPQ Quote</span>
                                </button>
                              )}

                              {/* Stage Chevron Nav Buttons */}
                              <div className="flex items-center justify-between text-[10px] text-slate-600 pt-0.5">
                                <button
                                  onClick={() => advanceStage(deal, 'prev')}
                                  disabled={deal.stage === 'Prospecting' || deal.stage === 'Closed Lost'}
                                  className="px-1.5 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-0.5"
                                  title="Previous Stage"
                                >
                                  <ChevronLeft size={11} />
                                  <span>Prev</span>
                                </button>
                                <span className="text-[9.5px] font-mono text-slate-500">
                                  {deal.forecastCategory}
                                </span>
                                <button
                                  onClick={() => advanceStage(deal, 'next')}
                                  disabled={deal.stage === 'Closed Won' || deal.stage === 'Closed Lost'}
                                  className="px-1.5 py-0.5 rounded text-[#0176d3] font-bold hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-0.5"
                                  title="Advance Stage"
                                >
                                  <span>Next</span>
                                  <ChevronRight size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Salesforce Lightning Table View */
        <div className="rq-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#dde1e9] text-[#5c6678] font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Opportunity Name</th>
                  <th className="py-3 px-3">Account</th>
                  <th className="py-3 px-3">Stage</th>
                  <th className="py-3 px-3">Probability</th>
                  <th className="py-3 px-3 text-right">Amount ({currency})</th>
                  <th className="py-3 px-3">Close Date</th>
                  <th className="py-3 px-3">Owner</th>
                  <th className="py-3 px-3">Primary Quote</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f7]">
                {filteredOpportunities.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-slate-600">
                      No opportunities match the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOpportunities.map((opp) => {
                    const convertedAmount = convertCurrency(opp.amount, opp.currency, currency);
                    const cfg = STAGE_CONFIG.find((s) => s.stage === opp.stage);
                    const linkedQuote = quotes.find((q) => q.id === opp.quoteId || q.quoteNumber === opp.quoteNumber);

                    return (
                      <tr key={opp.id} className="hover:bg-[#fbfcfe] transition-colors group">
                        <td className="py-3 px-4">
                          <button
                            onClick={() => openEditModal(opp)}
                            className="font-extrabold text-[#10233f] hover:text-[#0176d3] transition-colors text-left"
                          >
                            {opp.name}
                          </button>
                          <div className="text-[10px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                            <span className="font-semibold">{opp.dealType}</span>
                            <span>•</span>
                            <span>{opp.forecastCategory}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium text-[#10233f]">
                          <div className="flex items-center gap-1.5">
                            <Building size={12} className="text-[#0176d3]" />
                            <span>{opp.accountName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                              cfg?.badgeBg || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {opp.stage}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span>{opp.probabilityPct}%</span>
                            <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#0176d3]"
                                style={{ width: `${opp.probabilityPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#10233f]">
                          {formatCurrency(convertedAmount, currency)}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {opp.closeDate}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {opp.ownerName}
                        </td>
                        <td className="py-3 px-3">
                          {opp.quoteId ? (
                            <button
                              onClick={() => onViewQuote(opp.quoteId!)}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold hover:bg-emerald-100 flex items-center gap-1 transition-all"
                            >
                              <FileText size={11} className="text-emerald-600" />
                              <span>{opp.quoteNumber || linkedQuote?.quoteNumber || 'View Quote'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onLaunchCPQQuote(opp)}
                              className="px-2 py-1 rounded bg-[#eef4ff] text-[#015ba5] border border-[#0176d3]/30 text-[11px] font-bold hover:bg-[#0176d3] hover:text-white flex items-center gap-1 transition-all"
                            >
                              <Zap size={11} />
                              <span>Create Quote</span>
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(opp)}
                              title="Edit Opportunity"
                              className="p-1 text-slate-600 hover:text-[#0176d3] hover:bg-slate-100 rounded"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => onDeleteOpportunity(opp.id)}
                              title="Delete Opportunity"
                              className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Level 5: Salesforce Opportunity Detail / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0176d3]/10 text-[#0176d3] flex items-center justify-center">
                  <Target size={18} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#10233f]">
                    {isNewDeal ? 'New Enterprise Opportunity' : 'Edit Opportunity Details'}
                  </h2>
                  <p className="text-xs text-[#5c6678]">
                    Salesforce CRM Pipeline Management &amp; BANT Qualification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Salesforce Chevron Stage Selector */}
            <div className="px-5 pt-4 pb-2 bg-[#f8fafc] border-b border-slate-200">
              <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wider block mb-1.5">
                Salesforce Stage Progression (Click to advance)
              </label>
              <div className="flex items-center overflow-x-auto pb-2 gap-1">
                {STAGE_CONFIG.map((s, idx) => {
                  const isCurrent = formStage === s.stage;
                  const isPast = STAGE_CONFIG.findIndex((c) => c.stage === formStage) > idx;

                  return (
                    <button
                      type="button"
                      key={s.stage}
                      onClick={() => handleStageSelectInForm(s.stage)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md border whitespace-nowrap transition-all ${
                        isCurrent
                          ? 'bg-[#0176d3] text-white border-[#0176d3] shadow-xs'
                          : isPast
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveModal} className="p-5 space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Deal Name */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Opportunity Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Acme Corp CPQ & Usage Billing Expansion 2026"
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  />
                </div>

                {/* Account Name */}
                <div>
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAccountName}
                    onChange={(e) => setFormAccountName(e.target.value)}
                    placeholder="e.g. Acme Global Inc."
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  />
                </div>

                {/* Deal Amount */}
                <div>
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Expected Amount ({currency}) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={0}
                      value={formAmount}
                      onChange={(e) => setFormAmount(Number(e.target.value))}
                      className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs font-mono font-bold text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Target Close Date */}
                <div>
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Target Close Date
                  </label>
                  <input
                    type="date"
                    value={formCloseDate}
                    onChange={(e) => setFormCloseDate(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  />
                </div>

                {/* Deal Owner */}
                <div>
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Opportunity Owner
                  </label>
                  <input
                    type="text"
                    value={formOwnerName}
                    onChange={(e) => setFormOwnerName(e.target.value)}
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  />
                </div>

                {/* Deal Type */}
                <div>
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Deal Type
                  </label>
                  <select
                    value={formDealType}
                    onChange={(e) => setFormDealType(e.target.value as Opportunity['dealType'])}
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  >
                    <option value="New Business">New Business</option>
                    <option value="Existing - Expansion">Existing - Expansion</option>
                    <option value="Renewal">Renewal</option>
                    <option value="Contract Amendment">Contract Amendment</option>
                  </select>
                </div>

                {/* Forecast Category */}
                <div>
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Forecast Category
                  </label>
                  <select
                    value={formForecastCategory}
                    onChange={(e) => setFormForecastCategory(e.target.value as Opportunity['forecastCategory'])}
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  >
                    <option value="Pipeline">Pipeline</option>
                    <option value="Best Case">Best Case</option>
                    <option value="Commit">Commit</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                {/* Lead Source */}
                <div>
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Lead Source
                  </label>
                  <input
                    type="text"
                    value={formLeadSource}
                    onChange={(e) => setFormLeadSource(e.target.value)}
                    placeholder="e.g. Enterprise Accounts, Gartner, Inbound"
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  />
                </div>

                {/* Probability Slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-[#475569]">
                      Win Probability: {formProbability}%
                    </label>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={formProbability}
                    onChange={(e) => setFormProbability(Number(e.target.value))}
                    className="w-full accent-[#0176d3]"
                  />
                </div>

                {/* Primary Contact */}
                <div>
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Primary Contact Name
                  </label>
                  <input
                    type="text"
                    value={formPrimaryContact}
                    onChange={(e) => setFormPrimaryContact(e.target.value)}
                    placeholder="e.g. David Miller"
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  />
                </div>

                {/* Primary Contact Email */}
                <div>
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={formContactEmail}
                    onChange={(e) => setFormContactEmail(e.target.value)}
                    placeholder="e.g. david@acmeglobal.com"
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  />
                </div>

                {/* Next Step */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Next Step / Action Item
                  </label>
                  <input
                    type="text"
                    value={formNextStep}
                    onChange={(e) => setFormNextStep(e.target.value)}
                    placeholder="e.g. Schedule MSA Legal Review &amp; Dispatch CPQ Quote"
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  />
                </div>

                {/* Loss Reason (if Closed Lost) */}
                {formStage === 'Closed Lost' && (
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-rose-700 block mb-1">
                      Loss Reason *
                    </label>
                    <input
                      type="text"
                      required
                      value={formLossReason}
                      onChange={(e) => setFormLossReason(e.target.value)}
                      placeholder="e.g. Competitor pricing, budget freeze, project postponed"
                      className="w-full bg-rose-50/50 border border-rose-300 focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500/15 transition-all shadow-2xs"
                    />
                  </div>
                )}

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-[#475569] block mb-1">
                    Internal Deal Notes &amp; BANT Criteria
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Budget allocated, Authority confirmed, Need validated, Timeline established..."
                    className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-lg px-3 py-2 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <div>
                  {!isNewDeal && editingOpp && (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteOpportunity(editingOpp.id);
                        setIsModalOpen(false);
                      }}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rq-btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rq-btn-primary text-xs flex items-center gap-1.5 shadow-sm shadow-[#0176d3]/20"
                  >
                    <CheckCircle2 size={14} />
                    <span>{isNewDeal ? 'Create Opportunity' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
