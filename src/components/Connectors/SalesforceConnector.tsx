import React, { useState } from 'react';
import { 
  Zap, 
  Server, 
  Cloud, 
  CheckCircle2, 
  RefreshCw, 
  ArrowLeftRight, 
  Key, 
  ShieldCheck, 
  ExternalLink,
  Code2,
  Terminal,
  Database
} from 'lucide-react';

interface SalesforceConnectorProps {
  isStandalone: boolean;
  setIsStandalone: (val: boolean) => void;
}

export const SalesforceConnector: React.FC<SalesforceConnectorProps> = ({ 
  isStandalone, 
  setIsStandalone 
}) => {
  const [sfOrgUrl, setSfOrgUrl] = useState('https://orgfarm-d4394fd34c-dev-ed.my.salesforce.com');
  const [clientId, setClientId] = useState('3MVG9...ConnectedAppRevX');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'testing' | 'connected'>('connected');

  const handleTestSync = () => {
    setSyncStatus('testing');
    setTimeout(() => {
      setSyncStatus('connected');
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Open Source Architecture &amp; CRM Connectors</span>
            <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
              Zero Vendor Lock-In
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            RevX runs 100% standalone with its own database, or optionally connects bi-directionally to Salesforce CRM.
          </p>
        </div>
      </div>

      {/* Mode Switcher Toggle Card */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Runtime Deployment Mode</span>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                isStandalone
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
              }`}
            >
              {isStandalone ? 'Pure Standalone (Zero Salesforce)' : 'Hybrid Salesforce Sync'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            {isStandalone
              ? 'All Quotes, E-Signatures, Invoices, and ASC 606 ledger tables run offline / self-hosted in PostgreSQL & S3 without any Salesforce license cost.'
              : 'RevX acts as an ultra-fast CPQ & native eSign frontend while bi-directionally syncing Quotes & Orders to Salesforce Standard Objects.'}
          </p>
        </div>

        <button
          onClick={() => setIsStandalone(!isStandalone)}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            isStandalone
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25'
          }`}
        >
          <ArrowLeftRight size={14} />
          <span>Switch to {isStandalone ? 'Hybrid Sync Mode' : 'Pure Standalone'}</span>
        </button>
      </div>

      {/* Architecture Visual Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Standalone Card */}
        <div className={`glass-card p-5 rounded-xl border transition-all ${isStandalone ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-slate-800'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-white">1. Pure Standalone Open-Source</h3>
            </div>
            {isStandalone && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Ideal for startups, mid-market companies, and self-hosted environments that do not want Salesforce fees.
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span><b>Database:</b> PostgreSQL / SQLite (Prisma ORM)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span><b>Files &amp; Signatures:</b> Local Disk or MinIO / AWS S3</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span><b>PDF Engine:</b> Headless Chromium / PDF-lib (Zero Flying Saucer bugs)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span><b>License Cost:</b> $0 / Forever Free (MIT Open Source)</span>
            </div>
          </div>
        </div>

        {/* Hybrid Salesforce Card */}
        <div className={`glass-card p-5 rounded-xl border transition-all ${!isStandalone ? 'border-indigo-500/50 bg-indigo-950/10' : 'border-slate-800'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cloud size={18} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-white">2. Optional Salesforce Sync Plugin</h3>
            </div>
            {!isStandalone && (
              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">
            For enterprises wanting best-of-both-worlds: Lightning-fast RevX UI + Salesforce CRM central data warehouse.
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 size={14} className="text-indigo-400" />
              <span><b>Auth:</b> Connected App OAuth2 (JWT Bearer Flow)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 size={14} className="text-indigo-400" />
              <span><b>Sync:</b> Bi-directional REST API (Quotes, Accounts, Opportunities)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 size={14} className="text-indigo-400" />
              <span><b>Files Archiving:</b> Auto-push Certificate PDF to <code>ContentVersion</code></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 size={14} className="text-indigo-400" />
              <span><b>Fallback:</b> Continues operating if Salesforce API hits rate limits</span>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Settings Box */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-indigo-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Salesforce Connected App Credentials (Optional)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> API v68.0 Ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 font-medium">Salesforce Org MyDomain URL</label>
            <input
              type="text"
              value={sfOrgUrl}
              onChange={(e) => setSfOrgUrl(e.target.value)}
              className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-medium">Consumer Key / Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-slate-500">
            Target Org: <code>darshdesai937+2.b4b7a84bfe5b@agentforce.com</code>
          </span>
          <button
            onClick={handleTestSync}
            disabled={syncStatus === 'testing'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <RefreshCw size={12} className={syncStatus === 'testing' ? 'animate-spin' : ''} />
            <span>{syncStatus === 'testing' ? 'Verifying OAuth...' : 'Test Connection'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
