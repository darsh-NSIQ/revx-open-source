import { useState, useEffect } from 'react';

/**
 * Accessible Animation Hook: useReducedMotion
 * Follows WCAG 2.3.3 & C39 guidelines.
 * Accurately detects OS-level prefers-reduced-motion setting
 * and dynamically reacts to live system accessibility changes.
 */
export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  
  const getMatches = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('reduce') === '1') return true;
    } catch {
      // ignore
    }
    return window.matchMedia(query).matches;
  };

  const [reduced, setReduced] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = () => setReduced(getMatches());
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
