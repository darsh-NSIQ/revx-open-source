import React from 'react';
import { Currency } from '../types';
import { Globe2, Search, Bell, Sparkles, Download, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  onQuickNewQuote?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currency, setCurrency, onQuickNewQuote }) => {
  const currencies: Currency[] = ['USD', 'INR', 'EUR', 'GBP'];

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#090d16]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Search Input */}
      <div className="flex items-center gap-3 w-80">
        <div className="relative w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search quotes, accounts, IRN..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* FX Currency Selector */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          {currencies.map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                currency === c
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Live FX Sync Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
          <Globe2 size={13} className="text-indigo-400" />
          <span>FX Real-time</span>
        </div>

        {/* Action Button: Quick Quote */}
        {onQuickNewQuote && (
          <button
            onClick={onQuickNewQuote}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-medium shadow-sm shadow-indigo-600/30 transition-all"
          >
            <Sparkles size={13} />
            <span>New Quote 360</span>
          </button>
        )}

        <div className="h-5 w-[1px] bg-slate-800" />

        {/* User / Org Info */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white">
            AD
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-medium text-slate-200">Admin User</div>
            <div className="text-[10px] text-slate-500">Local Instance</div>
          </div>
        </div>
      </div>
    </header>
  );
};
