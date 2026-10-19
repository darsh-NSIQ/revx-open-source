import { Currency } from '../types';
import { CURRENCY_SYMBOLS, FX_RATES } from '../data/mockData';

export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  if (currency === 'INR') {
    return `${symbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function convertCurrency(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  // Convert from origin to USD, then USD to target
  const inUSD = amount / FX_RATES[from];
  return inUSD * FX_RATES[to];
}
