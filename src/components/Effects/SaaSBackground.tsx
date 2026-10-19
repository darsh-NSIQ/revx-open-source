import React, { useEffect, useRef } from 'react';

/**
 * Premium Modern SaaS Background Engine
 * Features:
 * - 4 floating, continuously breathing animated Aurora Gradient Orbs (Cyan, Violet, Salesforce Blue, Emerald)
 * - Precision high-tech developer grid with subtle crosshair nodes (+)
 * - Dynamic mouse-driven spotlight beam illuminating the grid beneath the cursor
 * - Fixed position behind entire application (pointer-events: none, z-0)
 * - Ultra-lightweight and 60fps/120fps optimized
 */
export const SaaSBackground: React.FC = () => {
  const mouseBeamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (mouseBeamRef.current) {
        mouseBeamRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* 1. Base Gradient Canvas */}
      <div className="absolute inset-0 bg-[#f8fafc]" />

      {/* 2. Floating Animated SaaS Aurora Orbs */}
      {/* Orb 1: Cyan / Salesforce Blue floating orb (Top-Right) */}
      <div 
        className="absolute -top-32 -right-32 w-[650px] h-[650px] rounded-full blur-[100px] pointer-events-none opacity-40 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(var(--rq-acc-rgb, 1, 118, 211), 0.4) 0%, rgba(var(--rq-acc-rgb, 1, 118, 211), 0.2) 40%, transparent 70%)',
          animationDuration: '8s',
        }}
      />

      {/* Orb 2: Electric Indigo / Violet drifting orb (Top-Left) */}
      <div 
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[90px] pointer-events-none opacity-30 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, rgba(99, 102, 241, 0.25) 45%, transparent 70%)',
          animationDuration: '10s',
          animationDelay: '1.5s',
        }}
      />

      {/* Orb 3: Fresh Emerald / Teal luminous glow (Bottom-Center) */}
      <div 
        className="absolute -bottom-48 left-1/3 w-[700px] h-[700px] rounded-full blur-[110px] pointer-events-none opacity-25 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, rgba(6, 182, 212, 0.2) 40%, transparent 70%)',
          animationDuration: '12s',
          animationDelay: '3s',
        }}
      />

      {/* Orb 4: Soft Rose / Purple accent glow (Center-Right) */}
      <div 
        className="absolute top-1/2 -right-20 w-[500px] h-[500px] rounded-full blur-[95px] pointer-events-none opacity-20 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(244, 63, 94, 0.3) 0%, rgba(144, 80, 233, 0.2) 45%, transparent 70%)',
          animationDuration: '9s',
          animationDelay: '4.5s',
        }}
      />

      {/* 3. High-Tech Crosshair Grid Pattern (Linear / Stripe developer aesthetic) */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-[0.35]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern 
            id="saas-tech-grid" 
            width="36" 
            height="36" 
            patternUnits="userSpaceOnUse"
          >
            {/* Grid Line */}
            <path 
              d="M 36 0 L 0 0 0 36" 
              fill="none" 
              stroke="rgba(1, 118, 211, 0.12)" 
              strokeWidth="0.8" 
            />
            {/* Intersection Crosshair (+) */}
            <path 
              d="M 0 3 L 0 -3 M -3 0 L 3 0" 
              stroke="rgba(1, 118, 211, 0.28)" 
              strokeWidth="1" 
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#saas-tech-grid)" />
      </svg>

      {/* 4. Mouse-Reactive Spotlight Beam (Illuminates the technical grid under cursor) */}
      <div
        ref={mouseBeamRef}
        className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none opacity-45"
        style={{
          background: 'radial-gradient(circle, rgba(var(--rq-acc-rgb, 1, 118, 211), 0.18) 0%, transparent 70%)',
          filter: 'blur(20px)',
          willChange: 'transform',
        }}
      />

      {/* 5. Vignette radial mask to keep center clean and edges atmospheric */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 20%, transparent 40%, rgba(248, 250, 252, 0.6) 80%, rgba(248, 250, 252, 0.95) 100%)',
        }}
      />
    </div>
  );
};
