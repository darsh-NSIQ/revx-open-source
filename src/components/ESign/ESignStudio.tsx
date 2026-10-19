import React from 'react';
import { Quote } from '../../types';
import { formatCurrency } from '../../utils/format';
import { 
  FileSignature, 
  ShieldCheck, 
  CheckCircle, 
  Clock, 
  Lock,
  Eye,
  KeyRound,
  FileCheck2,
  ChevronRight
} from 'lucide-react';

interface ESignStudioProps {
  quotes: Quote[];
  onOpenSignModal: (quote: Quote) => void;
}

export const ESignStudio: React.FC<ESignStudioProps> = ({ quotes, onOpenSignModal }) => {
  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Highlights Panel */}
      <div className="rq-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20">
                Native Digital E-Signature Engine
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                Zero Third-Party Costs
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-[#10233f] tracking-tight">
              Cryptographic Execution, Envelopes &amp; Legal Audit Trail
            </h1>
            <p className="text-xs text-[#5c6678] mt-0.5">
              US ESIGN, UETA, and Indian IT Act 2000 compliant digital signing with immutable SHA-256 seal.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Highlight Cards: Native Security & Cryptographic Telemetry Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Tile 1: SHA-256 Digest Sealing */}
        <div className="rq-card border-t-[3px] border-t-emerald-600 p-4 sm:p-4.5 group hover:shadow-md transition-all duration-200 bg-gradient-to-b from-emerald-50/15 via-white to-white flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between gap-2 h-7 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Lock size={14} />
                </div>
                <h3 className="text-xs font-bold text-[#10233f]">
                  SHA-256 Digest Sealing
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 h-6 px-2 text-[10px] font-bold text-emerald-800 bg-emerald-50 rounded-full border border-emerald-500/20 font-mono shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 rq-pulse-dot" />
                Engine Active
              </span>
            </div>

            {/* Digest snippet preview */}
            <div className="my-2.5 h-[36px] px-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] font-mono text-[10.5px] text-[#334155] flex items-center justify-between">
              <span className="text-emerald-700 font-bold truncate max-w-[170px]">0x9f4a...e12b7c</span>
              <span className="text-[9.5px] font-bold text-[#64748b] bg-white px-1.5 py-0.5 rounded border border-[#cbd5e1] shrink-0">256-Bit Seal</span>
            </div>

            <p className="text-[11px] text-[#5c6678] leading-relaxed min-h-[34px]">
              Every signed agreement receives an immutable 64-character hash computed at the exact instant of signature execution.
            </p>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-[#edf1f7] flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-500/20">✓ 100% Tamper Evident</span>
            <span className="text-[#64748b] font-medium font-mono">Zero Collisions</span>
          </div>
        </div>

        {/* Tile 2: Legal Admissibility */}
        <div className="rq-card border-t-[3px] border-t-[#0176d3] p-4 sm:p-4.5 group hover:shadow-md transition-all duration-200 bg-gradient-to-b from-blue-50/15 via-white to-white flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between gap-2 h-7 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0176d3] border border-blue-200/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck size={14} />
                </div>
                <h3 className="text-xs font-bold text-[#10233f]">
                  Legal Admissibility
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 h-6 px-2 text-[10px] font-bold text-[#015ba5] bg-[#eef4ff] rounded-full border border-[#0176d3]/20 font-mono shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0176d3] rq-pulse-dot" />
                Court Admissible
              </span>
            </div>

            {/* Standards Badges in matching container box */}
            <div className="my-2.5 h-[36px] px-2.5 rounded-lg bg-[#f0f7ff] border border-[#d0e4ff] font-mono text-[10.5px] text-[#015ba5] flex items-center justify-between">
              <span className="font-bold truncate max-w-[170px]">ESIGN &amp; IT Act 2000</span>
              <span className="text-[9.5px] font-bold text-[#014486] bg-white px-1.5 py-0.5 rounded border border-[#b8d8ff] shrink-0">§ 10A / UETA</span>
            </div>

            <p className="text-[11px] text-[#5c6678] leading-relaxed min-h-[34px]">
              Evidentiary audit trail captures signer IP address, client browser fingerprint, ISO timestamp, and completion certificates.
            </p>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-[#edf1f7] flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center font-semibold text-[#015ba5] bg-[#eef4ff] px-2 py-0.5 rounded border border-[#0176d3]/20">✓ Section 65B Admissible</span>
            <span className="text-[#64748b] font-medium font-mono">Non-Repudiation</span>
          </div>
        </div>

        {/* Tile 3: Self-Hosted & Private */}
        <div className="rq-card border-t-[3px] border-t-[#9050e9] p-4 sm:p-4.5 group hover:shadow-md transition-all duration-200 bg-gradient-to-b from-purple-50/15 via-white to-white flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between gap-2 h-7 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#9050e9] border border-purple-200/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <KeyRound size={14} />
                </div>
                <h3 className="text-xs font-bold text-[#10233f]">
                  Self-Hosted &amp; Private
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 h-6 px-2 text-[10px] font-bold text-purple-800 bg-purple-50 rounded-full border border-purple-500/20 font-mono shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 rq-pulse-dot" />
                Zero Cloud Leak
              </span>
            </div>

            {/* Architecture snippet */}
            <div className="my-2.5 h-[36px] px-2.5 rounded-lg bg-[#faf5ff] border border-[#e9d5ff] font-mono text-[10.5px] text-[#581c87] flex items-center justify-between">
              <span className="font-bold truncate max-w-[170px]">Vault: Postgres / S3 Private</span>
              <span className="text-[9.5px] font-bold text-purple-700 bg-white px-1.5 py-0.5 rounded border border-purple-200 shrink-0">Local Only</span>
            </div>

            <p className="text-[11px] text-[#5c6678] leading-relaxed min-h-[34px]">
              Signatures and agreement PDFs are stored strictly in your own database/S3 bucket. Zero data leaks to DocuSign or Adobe.
            </p>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-[#edf1f7] flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-500/20">✓ Zero SaaS Envelope Fee</span>
            <span className="text-[#64748b] font-medium font-mono">100% Private</span>
          </div>
        </div>
      </div>

      {/* Envelopes & Quotes Table */}
      <div className="rq-card overflow-hidden">
        <div className="p-4 border-b border-[#dde1e9] flex items-center justify-between bg-[#fbfcfe]">
          <div className="flex items-center gap-2">
            <FileSignature size={16} className="text-[#0176d3]" />
            <h2 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
              Active Signing Envelopes &amp; Audit Status
            </h2>
          </div>
          <span className="text-[11px] text-[#5c6678] font-semibold">
            {quotes.filter((q) => q.status === 'Signed').length} of {quotes.length} executed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Envelope / Quote</th>
                <th className="py-3 px-4">Customer Account</th>
                <th className="py-3 px-4">Authorized Signer</th>
                <th className="py-3 px-4">Total Value</th>
                <th className="py-3 px-4">Status &amp; Verification</th>
                <th className="py-3 px-4">Cryptographic Digest</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f7]">
              {quotes.map((quote) => {
                const isSigned = quote.status === 'Signed';
                return (
                  <tr key={quote.id} className="hover:bg-[#f5f8fc] transition-colors duration-150 group">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0176d3] group-hover:text-[#014486]">
                      {quote.quoteNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#181c25]">
                      {quote.accountName}
                    </td>
                    <td className="py-3.5 px-4 text-[#5c6678]">
                      <div>{quote.contactName}</div>
                      <div className="text-[10px] text-[#747e90]">{quote.contactEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#10233f]">
                      {formatCurrency(quote.totalAmount, quote.currency)}
                    </td>
                    <td className="py-3.5 px-4">
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-500/25">
                          <CheckCircle size={11} />
                          <span>Signed &amp; Certified</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-500/25">
                          <Clock size={11} />
                          <span>Pending Execution</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[10.5px] text-[#5c6678] max-w-[160px] truncate">
                      {isSigned && quote.signatureDigest ? (
                        <span title={quote.signatureDigest} className="text-emerald-700 font-mono font-bold">
                          {quote.signatureDigest.substring(0, 16)}...
                        </span>
                      ) : (
                        <span className="text-[#94a3b8]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isSigned ? (
                        <button
                          onClick={() => onOpenSignModal(quote)}
                          className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-[#015ba5] text-xs font-semibold border border-slate-200 transition-all flex items-center gap-1.5 ml-auto shadow-2xs"
                        >
                          <Eye size={12} />
                          <span>Certificate</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenSignModal(quote)}
                          className="rq-btn-primary"
                        >
                          <FileSignature size={12} />
                          <span>Sign Now</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
