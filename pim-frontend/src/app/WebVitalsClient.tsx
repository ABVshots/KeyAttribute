'use client';

import { useEffect } from 'react';

export default function WebVitalsClient() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;
    try {
      const log = (name: string, value: number, detail?: any) => {
        // eslint-disable-next-line no-console
        console.log(`[web-vitals] ${name}:`, value.toFixed(2), detail || '');
      };
      // CLS
      let cls = 0;
      const poCLS = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any) {
          if (!entry.hadRecentInput) {
            cls += entry.value || 0;
            log('CLS', cls, { sources: (entry.sources||[]).length });
          }
        }
      });
      poCLS.observe({ type: 'layout-shift', buffered: true } as any);

      // LCP
      const poLCP = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as any;
        if (last) log('LCP', last.startTime || last.renderTime || 0);
      });
      poLCP.observe({ type: 'largest-contentful-paint', buffered: true } as any);

      // INP (Event timing)
      const poINP = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[];
        const worst = entries.sort((a,b)=> (b.duration||0) - (a.duration||0))[0];
        if (worst) log('INP', worst.duration || 0, { type: worst.name });
      });
      poINP.observe({ type: 'event', buffered: true } as any);

      return () => {
        try { poCLS.disconnect(); poLCP.disconnect(); poINP.disconnect(); } catch {}
      };
    } catch {}
  }, []);
  return null;
}
