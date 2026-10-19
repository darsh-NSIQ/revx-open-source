import React, { useState, useEffect, useRef } from 'react';
import { Quote, Order, Invoice, Currency, Opportunity } from '../../types';
import { formatCurrency } from '../../utils/format';
import { 
  Search, 
  X, 
  Layers, 
  Package, 
  FileCheck2, 
  Receipt, 
  FileSignature, 
  BarChart3, 
  PieChart, 
  Settings, 
  Plus, 
  Sparkles, 
  Zap, 
  TrendingUp, 
  ArrowRight,
  Command,
  Activity,
  ShieldAlert,
  Target,
  Share2,
  CheckCircle2,
  Network,
  Building2,
  Users,
  Workflow
} from 'lucide-react';

interface CommandPaletteModalProps {
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onSelectQuote: (quoteId: string) => void;
  onNewQuote: () => void;
  onRunDemoFlow: () => void;
  onOpenCompetitorMatrix: () => void;
  onOpenArchitectureModal?: () => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  quotes: Quote[];
  orders: Order[];
  invoices: Invoice[];
  opportunities?: Opportunity[];
  onSelectOpportunity?: (oppId: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  onClose,
  onNavigate,
  onSelectQuote,
  onNewQuote,
  onRunDemoFlow,
  onOpenCompetitorMatrix,
  onOpenArchitectureModal,
  currency,
  setCurrency,
  quotes,
  orders,
  invoices,
  opportunities = [],
  onSelectOpportunity,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const tabs = [
    { id: 'command-center', label: 'Revenue Command Center (Home)', icon: BarChart3, category: 'Navigation' },
    // Stage 1: CRM & Pipeline
    { id: 'leads', label: 'Inbound Leads & Qualification (#1.1)', icon: Target, category: 'Stage 1: CRM & Deals' },
    { id: 'accounts', label: 'Enterprise Accounts 360 & Hierarchy (#1.2)', icon: Building2, category: 'Stage 1: CRM & Deals' },
    { id: 'contacts', label: 'Decision Makers & Signatories (#1.3)', icon: Users, category: 'Stage 1: CRM & Deals' },
    { id: 'opportunities', label: 'Sales Process & Pipeline (#1.4)', icon: Target, category: 'Stage 1: CRM & Deals' },
    // Stage 2: CPQ & Closing
    { id: 'quotes', label: 'CPQ Quotes & Tiered Pricing Rules (#2.1)', icon: Layers, category: 'Stage 2: CPQ & Closing' },
    { id: 'approvals', label: 'Oracle CPQ™ Approval Matrix & Governance (#2.2)', icon: CheckCircle2, category: 'Stage 2: CPQ & Closing' },
    { id: 'dealroom', label: 'DealHub™ Digital DealRoom & Telemetry (#2.3)', icon: Share2, category: 'Stage 2: CPQ & Closing' },
    { id: 'esign', label: 'Native Cryptographic eSignatures SHA-256 (#2.4)', icon: FileSignature, category: 'Stage 2: CPQ & Closing' },
    // Stage 3: Orders & Subscriptions
    { id: 'orders', label: 'Provisioned Customer Orders (#3.1)', icon: Package, category: 'Stage 3: Orders & Subs' },
    { id: 'contracts', label: 'Contracts & Subscriptions (Chargebee Lifecycle #3.2)', icon: FileCheck2, category: 'Stage 3: Orders & Subs' },
    { id: 'hierarchy', label: 'BillingPlatform™ Account Hierarchy (#3.3)', icon: Network, category: 'Stage 3: Orders & Subs' },
    // Stage 4: Billing & Collections
    { id: 'metering', label: 'Usage Metering & Event Mediation (Zuora+ #4.1)', icon: Activity, category: 'Stage 4: Billing & Cash' },
    { id: 'invoices', label: 'GST Tax Invoices & Real-time NIC IRN (#4.2)', icon: Receipt, category: 'Stage 4: Billing & Cash' },
    { id: 'collect', label: 'Collections & ML Smart Dunning (#4.3)', icon: ShieldAlert, category: 'Stage 4: Billing & Cash' },
    // Stage 5: Revenue & Governance
    { id: 'revrec', label: 'Revenue Recognition (ASC 606 / IFRS 15 #5.1)', icon: PieChart, category: 'Stage 5: Revenue & Exec' },
    { id: 'war-room', label: 'Executive War Room & Retention Analytics (#5.2)', icon: TrendingUp, category: 'Stage 5: Revenue & Exec' },
    { id: 'setup', label: 'Setup Cockpit & Enterprise Baseline Data (#5.3)', icon: Settings, category: 'Stage 5: Revenue & Exec' },
  ];

  const filteredOpportunities = opportunities.filter(
    (o) =>
      o.name.toLowerCase().includes(query.toLowerCase()) ||
      o.accountName.toLowerCase().includes(query.toLowerCase()) ||
      (o.primaryContact && o.primaryContact.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredQuotes = quotes.filter(
    (q) =>
      q.quoteNumber.toLowerCase().includes(query.toLowerCase()) ||
      q.accountName.toLowerCase().includes(query.toLowerCase()) ||
      q.contactName.toLowerCase().includes(query.toLowerCase())
  );

  const filteredTabs = tabs.filter((t) =>
    t.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-[#10233f]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Search Input Box */}
        <div className="p-3.5 border-b border-[#dde1e9] flex items-center gap-3 bg-[#fbfcfe]">
          <Search size={18} className="text-[#0176d3] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search quotes, accounts, navigation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[#10233f] placeholder:text-[#94a3b8] focus:outline-none font-medium"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono text-[#64748b] bg-[#f0f3f8] px-1.5 py-0.5 rounded border border-[#dde1e9]">
              ESC to exit
            </span>
            <button
              onClick={onClose}
              className="text-[#64748b] hover:text-[#10233f] p-1 rounded hover:bg-[#f0f3f8]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Action List */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {/* Quick Actions */}
          <div>
            <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider px-2 mb-1.5">
              Quick Actions
            </div>
            <div className="space-y-1">
              <button
                onClick={() => {
                  onClose();
                  onNewQuote();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#eef4ff] text-left transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0176d3] border border-blue-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Plus size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#10233f]">Launch CPQ Studio (New Quote)</div>
                    <div className="text-[10.5px] text-[#5c6678]">Create a tiered pricing quote with instant margin analysis</div>
                  </div>
                </div>
                <ArrowRight size={13} className="text-[#94a3b8] group-hover:text-[#0176d3]" />
              </button>

              {onOpenArchitectureModal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenArchitectureModal();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-sky-50 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-[#0176d3] border border-sky-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Workflow size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#10233f]">Open Q2C Architecture &amp; Use Cases Blueprint</div>
                      <div className="text-[10.5px] text-[#5c6678]">5-stage enterprise lifecycle from Lead Gen to ASC 606 revenue recognition</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#0176d3] bg-sky-100/80 px-2 py-0.5 rounded font-mono">
                    Blueprint
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  onClose();
                  onRunDemoFlow();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-left transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Zap size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#10233f]">Execute Autonomous Quote-to-Cash Pipeline</div>
                    <div className="text-[10.5px] text-[#5c6678]">Interactive 7-step enterprise execution across full revenue lifecycle</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded font-mono">
                  1-Click Execute
                </span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenCompetitorMatrix();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 text-left transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#10233f]">RevX vs Competitors Advantage Matrix</div>
                    <div className="text-[10.5px] text-[#5c6678]">Compare RevX against Salesforce CPQ, DealHub, and Stripe Billing</div>
                  </div>
                </div>
                <ArrowRight size={13} className="text-[#94a3b8] group-hover:text-purple-700" />
              </button>
            </div>
          </div>

          {/* Navigation Items */}
          {filteredTabs.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider px-2 mb-1.5">
                Go to Workspace Tab
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {filteredTabs.map((t) => {
                  const IconComp = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        onClose();
                        onNavigate(t.id);
                      }}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#f0f3f8] text-left transition-colors"
                    >
                      <IconComp size={15} className="text-[#0176d3] shrink-0" />
                      <span className="text-xs font-semibold text-[#10233f] truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Opportunities Matching Query */}
          {filteredOpportunities.length > 0 && query.trim() !== '' && (
            <div>
              <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <Target size={12} className="text-[#0176d3]" />
                <span>Opportunities ({filteredOpportunities.length})</span>
              </div>
              <div className="space-y-1">
                {filteredOpportunities.slice(0, 4).map((opp) => (
                  <button
                    key={opp.id}
                    onClick={() => {
                      onClose();
                      onNavigate('opportunities');
                      if (onSelectOpportunity) onSelectOpportunity(opp.id);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#eef4ff] border border-transparent hover:border-[#0176d3]/30 text-left transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#10233f]">{opp.name}</span>
                      </div>
                      <div className="text-[10.5px] text-[#5c6678]">
                        Account: {opp.accountName} • Stage: <span className="font-semibold text-[#0176d3]">{opp.stage}</span> ({opp.probabilityPct}%)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-xs text-[#10233f]">
                        {formatCurrency(opp.amount, opp.currency)}
                      </div>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-500/20">
                        {opp.forecastCategory}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quotes Matching Query */}
          {filteredQuotes.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider px-2 mb-1.5">
                Quotes ({filteredQuotes.length})
              </div>
              <div className="space-y-1">
                {filteredQuotes.slice(0, 4).map((q) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      onClose();
                      onSelectQuote(q.id);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#f8fafc] border border-transparent hover:border-[#dde1e9] text-left transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#0176d3]">{q.quoteNumber}</span>
                        <span className="text-xs font-bold text-[#10233f]">{q.accountName}</span>
                      </div>
                      <div className="text-[10.5px] text-[#5c6678]">Signer: {q.contactName} ({q.contactEmail})</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-xs text-[#10233f]">
                        {formatCurrency(q.totalAmount, q.currency)}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        {q.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#dde1e9] bg-[#fbfcfe] flex items-center justify-between text-[11px] text-[#64748b]">
          <div className="flex items-center gap-2">
            <span>Currency:</span>
            <div className="flex items-center gap-1">
              {(['USD', 'INR', 'EUR', 'GBP'] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                    currency === c ? 'bg-[#0176d3] text-white' : 'hover:bg-[#e2e8f0]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <span className="font-mono">RevX Global Command Engine</span>
        </div>
      </div>
    </div>
  );
};
