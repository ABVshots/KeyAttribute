'use client';

import { useTransition } from 'react';

export default function LocaleSwitcher({ value, locales }: { value: string; locales: string[] }) {
  const [pending, start] = useTransition();

  function setCookieLocale(loc: string) {
    start(async () => {
      await fetch('/api/ui-locale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: loc }) });
      window.location.reload();
    });
  }

  return (
    <select value={value} onChange={(e)=>setCookieLocale(e.target.value)} className="w-full rounded border bg-zinc-800 px-2 py-1 text-sm text-white">
      {locales.map(l => <option key={l} value={l}>{l}</option>)}
    </select>
  );
}
