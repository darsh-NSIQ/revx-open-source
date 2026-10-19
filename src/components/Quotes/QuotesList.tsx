import React, { useState } from 'react';
import { Currency, Quote } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  Layers, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Filter,
  FileSignature,
  ShieldCheck,
  Edit2,
  TrendingUp,
  Building2,
  Sparkles,
  Award,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { EditQuoteModal } from './EditQuoteModal';

interface QuotesListProps {
  currency: Currency;
  quotes: Quote[];
  onSelectQuote: (quote: Quote) => void;
  onOpenNewQuoteModal: () => void;
  onOpenSignModal: (quote: Quote) => void;
  onUpdateQuote?: (quote: Quote) => void;
}

export const QuotesList: React.FC<QuotesListProps> = ({
  currency,
  quotes,
  onSelectQuote,
  onOpenNewQuoteModal,
  onOpenSignModal,
  onUpdateQuote,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);

  const filteredQuotes = quotes.filter((q) => {
    const matchesStatus = filterStatus === 'all' || q.status.toLowerCase() === filterStatus.toLowerCase();
    const matchesSearch = 
      q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.contactName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate live pipeline metrics
  const totalACV = quotes.reduce((acc, q) => acc + convertCurrency(q.totalAmount, q.currency, currency), 0);
  const signedCount = quotes.filter((q) => q.status === 'Signed').length;
  const avgMargin = quotes.length ? quotes.reduce((acc, q) => acc + q.marginPct, 0) / quotes.length : 0;

  // Company avatar color generator
  const getAvatarGradient = (name: string) => {
    const colors = [
      'from-blue-600 to-indigo-600',
      'from-emerald-600 to-teal-700',
      'from-purple-600 to-pink-600',
      'from-amber-500 to-orange-600',
      'from-cyan-600 to-blue-700',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Highlights Panel with Glassmorphism */}
      <div className="rq-card p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0176d3] animate-pulse" />
                Salesforce CPQ &amp; RevCloud Standard
              </span>
              <span className="text-xs text-slate-500 font-medium">Enterprise Quote Lifecycle</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Quotation Pipeline &amp; Deal Velocity
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Real-time enterprise CPQ records, dynamic multi-tier discount approval matrices, and cryptographic SHA-256 digital signature chains.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenNewQuoteModal}
              className="rq-btn-primary text-xs cursor-pointer shadow-sm"
            >
              <Plus size={14} className="stroke-[2.5]" />
              <span>+ New CPQ Quote</span>
            </button>
          </div>
        </div>

        {/* Ambient Top Subtle Glow */}
        <div className="absolute top-0 right-0 w-80 h-32 bg-radial from-[#0176d3]/10 to-transparent pointer-events-none" />
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-[#0176d3] rq-stagger-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Quoted ACV</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-0.5">
              <ArrowUpRight size={10} /> +18.4%
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5 tabular-nums">
            {formatCurrency(totalACV, currency)}
          </div>
          <div className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <span>Compounding across active deals</span>
          </div>
        </div>

        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-emerald-500 rq-stagger-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Signed &amp; Sealed</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {((signedCount / (quotes.length || 1)) * 100).toFixed(0)}% Win Rate
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight mt-1.5 tabular-nums flex items-baseline gap-1.5">
            <span>{signedCount}</span>
            <span className="text-xs text-slate-500 font-semibold">/ {quotes.length} total</span>
          </div>
          <div className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 size={11} className="text-emerald-600" />
            <span>eSign Certificate Verified</span>
          </div>
        </div>

        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-indigo-500 rq-stagger-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Blended Margin</span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-500/20">
              Target &gt; 65%
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5 tabular-nums">
            {avgMargin.toFixed(1)}%
          </div>
          <div className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <Zap size={11} className="text-indigo-600" />
            <span>Automated discount guardrail</span>
          </div>
        </div>

        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-amber-500 rq-stagger-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Avg Cycle Time</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-500/20">
              -1.2 Days
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5 tabular-nums">
            1.8 Days
          </div>
          <div className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <Clock size={11} className="text-amber-600" />
            <span>From Draft to Fully Invoiced</span>
          </div>
        </div>
      </div>

      {/* Quotes List Table Card */}
      <div className="rq-card overflow-hidden rq-stagger-2">
        {/* Table Controls Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200/90 bg-white/70 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Filter Pills with Glass Segmented Styling */}
            <div className="flex items-center bg-slate-100/80 border border-slate-200/80 rounded-lg p-1 text-xs font-semibold">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  filterStatus === 'all'
                    ? 'bg-white text-[#0176d3] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Quotes ({quotes.length})
              </button>
              <button
                onClick={() => setFilterStatus('signed')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  filterStatus === 'signed'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Signed ({signedCount})
              </button>
              <button
                onClick={() => setFilterStatus('sent')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  filterStatus === 'sent'
                    ? 'bg-white text-[#0176d3] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pending ({quotes.length - signedCount})
              </button>
            </div>
          </div>

          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by quote # or account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rq-input pl-9 pr-8 text-xs font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Quotes Table */}
        <div className="overflow-x-auto">
          <table className="rq-table">
            <thead>
              <tr>
                <th>Quote Record</th>
                <th>Enterprise Customer</th>
                <th>Authorized Signer</th>
                <th>Contract Value</th>
                <th>Gross Margin</th>
                <th>Stage &amp; Security</th>
                <th>Validity</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((q, idx) => {
                const isSigned = q.status === 'Signed';
                const avatarGradient = getAvatarGradient(q.accountName);
                const initials = q.accountName
                  .split(' ')
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <tr
                    key={q.id}
                    onClick={() => onSelectQuote(q)}
                    className="cursor-pointer group"
                  >
                    <td className="font-mono font-bold text-[#0176d3] group-hover:text-[#014486]">
                      <div className="flex items-center gap-1.5">
                        <span className="tracking-tight">{q.quoteNumber}</span>
                        <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#0176d3]" />
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans font-normal">v2.1 Master</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-[10.5px] font-black shadow-xs shrink-0`}>
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-[#0176d3] transition-colors">{q.accountName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Building2 size={10} />
                            <span>Enterprise Account</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="font-medium text-slate-800">{q.contactName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{q.contactEmail}</div>
                    </td>
                    <td className="font-bold tabular-nums text-slate-900 font-mono text-[13px]">
                      {formatCurrency(convertCurrency(q.totalAmount, q.currency, currency), currency)}
                    </td>
                    <td>
                      <span className="rq-badge rq-badge-emerald tabular-nums">
                        {q.marginPct.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      {isSigned ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="rq-badge rq-badge-emerald">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Signed &amp; Sealed</span>
                          </span>
                          <span className="text-[9.5px] text-slate-400 font-mono flex items-center gap-0.5">
                            <ShieldCheck size={10} className="text-emerald-600" />
                            <span>SHA-256 Verified</span>
                          </span>
                        </div>
                      ) : (
                        <span className="rq-badge rq-badge-amber">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>{q.status}</span>
                        </span>
                      )}
                    </td>
                    <td className="text-slate-500 text-[11px] tabular-nums font-medium">
                      {q.validUntil}
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingQuote(q)}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 text-[#015ba5] text-xs font-semibold border border-slate-200 hover:border-[#0176d3]/40 transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="Edit Quote Details"
                        >
                          <Edit2 size={11} />
                          <span>Edit</span>
                        </button>
                        {isSigned ? (
                          <button
                            onClick={() => onOpenSignModal(q)}
                            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-[#015ba5] text-xs font-semibold border border-slate-200/90 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                          >
                            <ShieldCheck size={11} />
                            <span>Audit Seal</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onOpenSignModal(q)}
                            className="rq-btn-primary py-1 px-3 text-[11px] cursor-pointer"
                          >
                            Sign Now
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingQuote && onUpdateQuote && (
        <EditQuoteModal
          quote={editingQuote}
          currency={currency}
          onClose={() => setEditingQuote(null)}
          onSave={onUpdateQuote}
        />
      )}
    </div>
  );
};
