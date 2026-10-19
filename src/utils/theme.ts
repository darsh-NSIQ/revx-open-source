/**
 * Dynamic Branding Theme Engine
 * Automatically applies brand accent color and its computed shades
 * to CSS variables (--rq-acc, --rq-acc2, --rq-acc-deep, --rq-acc-rgb)
 * across the entire application in real-time.
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function adjustBrightness(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const adjust = (val: number) => {
    const adjusted = Math.round(val + (percent / 100) * (percent > 0 ? 255 - val : val));
    return Math.min(255, Math.max(0, adjusted));
  };
  const newR = adjust(r);
  const newG = adjust(g);
  const newB = adjust(b);
  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}

export function applyBrandTheme(accentHex: string, logoUrl?: string): void {
  if (typeof document === 'undefined') return;
  
  if (!accentHex || !/^#([0-9A-F]{3}){1,2}$/i.test(accentHex)) {
    accentHex = '#0176d3';
  }

  const root = document.documentElement;
  const { r, g, b } = hexToRgb(accentHex);
  const lighter = adjustBrightness(accentHex, 35);
  const deeper = adjustBrightness(accentHex, -25);

  root.style.setProperty('--rq-acc', accentHex);
  root.style.setProperty('--rq-acc2', lighter);
  root.style.setProperty('--rq-acc-deep', deeper);
  root.style.setProperty('--rq-acc-rgb', `${r}, ${g}, ${b}`);

  // Broadcast event so any listening React components can re-render immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('revx_brand_change', {
        detail: { accent: accentHex, logo: logoUrl, lighter, deeper },
      })
    );
  }
}
