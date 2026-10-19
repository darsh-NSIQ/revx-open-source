import React, { useEffect, useRef, useState } from 'react';

/**
 * Clean SaaS Ambient Cursor Motion & Card Spotlight Engine
 * - No intrusive round rings or artificial dots on the cursor (retains 100% clean native cursor)
 * - Smooth ambient trailing spotlight aura that naturally illuminates cards and the background
 * - Dynamic card spotlight injector: sets --mouse-x & --mouse-y on hovered cards for Linear/Stripe style surface glow
 * - Hardware accelerated using requestAnimationFrame
 * - pointer-events: none (zero obstruction to clicks, selection, or inputs)
 */
export const CursorMotion: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const mousePos = useRef({ x: -200, y: -200 });
  const auraPos = useRef({ x: -200, y: -200 });
  const auraRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    // Only enable on devices with fine pointer (mouse/trackpad), not touch screens
    if (typeof window === 'undefined' || window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);

      // Check if hovering an interactive element or card
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = Boolean(
          target.closest('button, a, input, select, textarea, [role="button"], .rq-card, .rq-card-elevated, tr, .cursor-pointer')
        );
        setIsHovered(isInteractive);

        // Inject dynamic card spotlight coordinates onto closest card
        const cardEl = target.closest('.rq-card, .rq-card-elevated') as HTMLElement | null;
        if (cardEl) {
          const rect = cardEl.getBoundingClientRect();
          cardEl.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
          cardEl.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        }
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    // Smooth physics animation loop for trailing ambient glow
    const updateMotion = () => {
      const auraEase = 0.12;
      auraPos.current.x += (mousePos.current.x - auraPos.current.x) * auraEase;
      auraPos.current.y += (mousePos.current.y - auraPos.current.y) * auraEase;

      if (auraRef.current) {
        auraRef.current.style.transform = `translate3d(${auraPos.current.x}px, ${auraPos.current.y}px, 0)`;
      }

      animFrameId.current = requestAnimationFrame(updateMotion);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    animFrameId.current = requestAnimationFrame(updateMotion);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
      {/* Ambient Luminous Trail (Soft Cyan & Electric Blue Aura - Zero visible ring or dot) */}
      <div
        ref={auraRef}
        className={`absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-300 ${
          isHovered ? 'w-[520px] h-[520px] opacity-25' : 'w-[380px] h-[380px] opacity-15'
        }`}
        style={{
          background: 'radial-gradient(circle, rgba(1, 118, 211, 0.4) 0%, rgba(26, 185, 255, 0.22) 40%, rgba(144, 80, 233, 0.1) 65%, transparent 80%)',
          filter: 'blur(40px)',
          willChange: 'transform',
        }}
      />
    </div>
  );
};
