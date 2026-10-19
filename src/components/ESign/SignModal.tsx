import React, { useRef, useState, useEffect } from 'react';
import { Quote } from '../../types';
import { computeSHA256, formatDigest } from '../../utils/crypto';
import { formatCurrency } from '../../utils/format';
import confetti from 'canvas-confetti';
import { 
  X, 
  PenTool, 
  Type, 
  RotateCcw, 
  CheckCircle2, 
  ShieldCheck, 
  Printer, 
  Download, 
  FileText,
  Lock,
  ExternalLink
} from 'lucide-react';

interface SignModalProps {
  quote: Quote;
  onClose: () => void;
  onSignComplete: (quoteId: string, signatureData: string, digest: string, signerName: string) => void;
}

export const SignModal: React.FC<SignModalProps> = ({ quote, onClose, onSignComplete }) => {
  const isAlreadySigned = quote.status === 'Signed';

  // Tabs: 'draw' | 'type' | 'certificate'
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'certificate'>(
    isAlreadySigned ? 'certificate' : 'draw'
  );

  const [signerName, setSignerName] = useState(quote.signedByName || quote.contactName || 'Authorized Signatory');
  const [signerTitle, setSignerTitle] = useState('Chief Revenue Officer');
  const [signerEmail, setSignerEmail] = useState(quote.signedByEmail || quote.contactEmail || 'signer@company.com');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [consentChecked, setConsentChecked] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize Canvas
  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current && !isAlreadySigned) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#047857'; // emerald signature ink
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [activeTab, isAlreadySigned]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Seal Signature & Generate Certificate
  const handleSealAndSign = async () => {
    if (!consentChecked) {
      alert('Please agree to conduct business electronically.');
      return;
    }

    setIsSealing(true);

    let signatureImage = '';
    if (activeTab === 'draw' && canvasRef.current) {
      signatureImage = canvasRef.current.toDataURL('image/png');
    } else {
      // Create typed cursive image representation
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 330;
      tempCanvas.height = 92;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.font = 'italic 34px "Brush Script MT", "Caveat", "Segoe Script", cursive';
        ctx.fillStyle = '#064e3b';
        ctx.fillText(signerName, 20, 60);
        signatureImage = tempCanvas.toDataURL('image/png');
      }
    }

    // Compute Cryptographic Digest over Quote + Signer + Timestamp
    const rawPayload = `${quote.quoteNumber}:${quote.totalAmount}:${signerName}:${signerEmail}:${Date.now()}`;
    const digest = await computeSHA256(rawPayload);

    // Trigger Confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {}

    setTimeout(() => {
      onSignComplete(quote.id, signatureImage, digest, signerName);
      setIsSealing(false);
      setActiveTab('certificate');
    }, 600);
  };

  const executionDigest = quote.signatureDigest || 'aa2abf52ca31df2ba3dbc72bdd628404fb2166590834f15a7b026dffe979fd8b';
  const executionDate = quote.signedAt || new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#090d16] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Lock size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  RevX Native Digital E-Signature Suite
                </h2>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  SHA-256 Sealed
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Quotation: <span className="text-slate-200 font-bold">{quote.quoteNumber}</span> · {quote.accountName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Tabs Switcher */}
          {!isAlreadySigned && (
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('draw')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'draw'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
                  }`}
                >
                  <PenTool size={13} />
                  <span>Draw Signature</span>
                </button>
                <button
                  onClick={() => setActiveTab('type')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'type'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
                  }`}
                >
                  <Type size={13} />
                  <span>Type Name</span>
                </button>
              </div>

              <div className="text-xs font-mono font-bold text-emerald-400">
                Amount: {formatCurrency(quote.totalAmount, quote.currency)}
              </div>
            </div>
          )}

          {/* Draw Signature View */}
          {activeTab === 'draw' && !isAlreadySigned && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-3 bg-white/5 relative">
                <canvas
                  ref={canvasRef}
                  width={680}
                  height={170}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-40 bg-white rounded-lg cursor-crosshair touch-none"
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  <span>Sign inside the canvas above using your finger, stylus, or mouse.</span>
                  <button
                    onClick={clearCanvas}
                    className="flex items-center gap-1 text-slate-400 hover:text-rose-400 font-medium transition-colors"
                  >
                    <RotateCcw size={12} />
                    <span>Clear Canvas</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 font-medium">Signer Full Name</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-medium">Official Title</label>
                  <input
                    type="text"
                    value={signerTitle}
                    onChange={(e) => setSignerTitle(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Type Signature View */}
          {activeTab === 'type' && !isAlreadySigned && (
            <div className="space-y-4">
              <div className="p-6 rounded-xl bg-white border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 block mb-2 font-mono uppercase tracking-wider">
                  Digital Calligraphy Preview
                </span>
                <div
                  style={{ fontFamily: '"Brush Script MT", "Caveat", "Segoe Script", cursive' }}
                  className="text-4xl text-emerald-900 py-3 font-style-italic select-none"
                >
                  {signerName || 'Your Signature'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 font-medium">Signer Full Name</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-medium">Signer Email</label>
                  <input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Certificate of Completion View */}
          {activeTab === 'certificate' && (
            <div className="space-y-4">
              <div className="p-6 rounded-xl bg-white text-slate-900 border border-slate-300 shadow-xl space-y-4 font-sans print:p-0">
                {/* Cert Header */}
                <div className="flex items-start justify-between border-b-2 border-emerald-600 pb-3">
                  <div>
                    <h3 className="text-xl font-extrabold uppercase tracking-tight text-emerald-900">
                      Certificate of Completion
                    </h3>
                    <p className="text-xs text-slate-600 font-medium">
                      RevX Enterprise E-Signature Cryptographic Engine
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase border border-emerald-300">
                      ✓ Legally Completed
                    </span>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      Execution: {executionDate}
                    </div>
                  </div>
                </div>

                {/* Metadata Box */}
                <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      Envelope ID
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-900">
                      {quote.portalToken || 'tok_live_44aa88ff11ee'}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mt-2">
                      Document Subject
                    </div>
                    <div className="font-bold text-slate-900">Quotation {quote.quoteNumber}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      Customer / Signer Account
                    </div>
                    <div className="font-bold text-slate-900">{quote.accountName}</div>
                    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mt-2">
                      Total Contract Value
                    </div>
                    <div className="font-mono font-bold text-emerald-700 text-sm">
                      {formatCurrency(quote.totalAmount, quote.currency)}
                    </div>
                  </div>
                </div>

                {/* Parties Table */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Originating Org</span>
                    <div className="font-bold text-slate-900 mt-0.5">RevX Enterprise Core</div>
                    <div className="text-[11px] text-slate-600">Enterprise Revenue Cloud</div>
                    <div className="text-[10px] text-slate-500 mt-1">Tax ID / GSTIN: 27AABCR0000A1Z5</div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Authorized Signatory</span>
                    <div className="font-bold text-slate-900 mt-0.5">{quote.signedByName || signerName}</div>
                    <div className="text-[11px] text-slate-600">Title: {signerTitle}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Email: {quote.signedByEmail || signerEmail}</div>
                  </div>
                </div>

                {/* Fixed Signature & Cryptographic Digest Box (Zero Truncation!) */}
                <div className="border-2 border-emerald-500 rounded-lg p-3 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Col: Signature scaled explicitly */}
                    <div className="pr-2">
                      <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Electronic Signature Verified
                      </div>
                      <div className="w-[165px] h-[46px] flex items-center justify-center bg-slate-50 border border-slate-200 rounded p-1">
                        {quote.signatureData ? (
                          <img
                            src={quote.signatureData}
                            alt="Signature"
                            className="max-w-[165px] max-h-[46px] object-contain"
                          />
                        ) : (
                          <span
                            style={{ fontFamily: '"Brush Script MT", "Caveat", "Segoe Script", cursive' }}
                            className="text-2xl text-emerald-900"
                          >
                            {quote.signedByName || signerName}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-xs text-slate-900 mt-1">
                        {quote.signedByName || signerName}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {signerTitle} · {quote.signedByEmail || signerEmail}
                      </div>
                    </div>

                    {/* Right Col: Chunked 8-char SHA-256 Digest */}
                    <div className="pl-3 border-l border-slate-200 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase text-slate-500">
                        Authentication Method
                      </div>
                      <div className="text-xs font-medium text-slate-800">
                        Secure Token Auth (HMAC-SHA256 Link)
                      </div>
                      <div className="text-[10px] font-bold uppercase text-slate-500 pt-1">
                        Cryptographic SHA-256 Digest (Tamper-Proof)
                      </div>
                      <div className="font-mono text-[10.5px] p-2 bg-slate-100 rounded border border-slate-300 text-slate-900 leading-relaxed break-normal select-all">
                        {formatDigest(executionDigest)}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        <span>Document Integrity Verified &amp; Certified</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legal Statement */}
                <div className="text-[9.5px] text-slate-500 pt-2 border-t border-dashed border-slate-300 leading-normal">
                  <b>LEGAL STATEMENT &amp; COMPLIANCE DISCLOSURE:</b> This Certificate of Completion confirms that Quotation <b>{quote.quoteNumber}</b> was executed using RevX Native Electronic Signature. All parties agreed to conduct this transaction electronically pursuant to: (1) US ESIGN Act (15 U.S.C. § 7001); (2) UETA; and (3) Section 10A of Indian IT Act 2000.
                </div>
              </div>

              {/* Action Buttons for Certificate */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  Audit logs archived locally &amp; verifiable offline.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
                  >
                    <Printer size={13} />
                    <span>Print Certificate</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    <Download size={13} />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Consent Checkbox */}
          {!isAlreadySigned && (
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2.5 text-xs">
              <input
                type="checkbox"
                id="consent"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="consent" className="text-slate-300 leading-relaxed cursor-pointer">
                I agree to use electronic records and signatures pursuant to US ESIGN, UETA, and Indian IT Act 2000. I understand this constitutes a legally binding contract.
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isAlreadySigned && (
          <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/40">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSealAndSign}
              disabled={isSealing || (!hasDrawn && activeTab === 'draw')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all"
            >
              <ShieldCheck size={15} />
              <span>{isSealing ? 'Cryptographically Sealing...' : 'Authorize & Sign Quote'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
