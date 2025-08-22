'use client';

import { createContext, useContext, useMemo } from 'react';
import type { UiBundle } from '@/lib/i18n';
import { makeT } from '@/lib/i18n';

const I18nCtx = createContext<{ locale: string; dict: Record<string, any>; t: (k: string, p?: Record<string, any>, o?: { fallback?: string })=>string } | null>(null);

export function I18nProvider({ bundle, children }: { bundle: UiBundle; children: React.ReactNode }) {
  const baseT = useMemo(() => makeT(bundle.dict), [bundle.dict]);
  const boundT = useMemo(() => (
    (k: string, p?: Record<string, any>, o?: { fallback?: string }) => baseT(k, p, { locale: bundle.locale, fallback: o?.fallback })
  ), [baseT, bundle.locale]);
  const value = useMemo(() => ({ locale: bundle.locale, dict: bundle.dict, t: boundT }), [bundle.locale, bundle.dict, boundT]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const ctx = useContext(I18nCtx);
  return ctx?.t ?? ((k: string) => k);
}
