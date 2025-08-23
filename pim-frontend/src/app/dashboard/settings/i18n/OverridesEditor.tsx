'use client';

import { useEffect, useState } from 'react';
import { etagFetchJson } from '@/lib/etagFetch';

export default function OverridesEditor() {
  const [ns, setNs] = useState('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [locale, setLocale] = useState('en');
  const [locales, setLocales] = useState<string[]>(['en']);
  const [items, setItems] = useState<Array<{ keyId: string; key: string; value: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { void loadNs(); void loadLocales(); }, []);
  useEffect(() => { if (ns && locale) void load(); }, [ns, locale]);

  async function loadNs() {
    const res = await fetch('/api/i18n/namespaces', { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setNamespaces(d.items||[]); setNs(d.items?.[0]||''); }
  }
  async function loadLocales() {
    const res = await fetch('/api/i18n/ui-languages', { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); const list = (d.locales||[]); setLocales(list.length?list:['en','uk']); setLocale(d.def || list[0] || 'en'); }
  }
  async function load() {
    setLoading(true);
    try {
      const d = await etagFetchJson<{ items: any[] }>(`/api/i18n/overrides?ns=${encodeURIComponent(ns)}&locale=${encodeURIComponent(locale)}`);
      setItems(d.items||[]);
    } finally { setLoading(false); }
  }
  async function save(kid: string, val: string) {
    try {
      const res = await fetch('/api/i18n/overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyId: kid, locale, value: val }) });
      if (!res.ok) {
        const j = await res.json().catch(()=>({}));
        if (j?.error === 'icu_mismatch') {
          const msg = `ICU placeholders mismatch with base 'en'.\nMissing: [${(j.missing||[]).join(', ')}]\nExtra: [${(j.extra||[]).join(', ')}]\nЗберегти всупереч попередженню?`;
          if (confirm(msg)) {
            const res2 = await fetch('/api/i18n/overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyId: kid, locale, value: val, allowMismatch: 1 }) });
            if (!res2.ok) {
              const j2 = await res2.json().catch(()=>({}));
              alert(j2?.error || `Помилка (${res2.status})`);
            }
          }
        } else {
          alert(j?.error || `Помилка (${res.status})`);
        }
      }
    } catch (e:any) {
      alert(e.message || 'Помилка збереження');
    }
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 bg-white/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex items-center gap-2 text-sm">
          <select value={ns} onChange={(e)=>setNs(e.target.value)} className="rounded border px-2 py-1">
            {namespaces.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={locale} onChange={(e)=>setLocale(e.target.value)} className="rounded border px-2 py-1">
            {locales.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={load} className="rounded border px-3 py-1">Оновити</button>
        </div>
      </div>
      <div className="rounded border bg-white hidden md:block">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="p-2">Key</th><th className="p-2">Override</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 8 }).map((_,i)=> (
              <tr key={i} className="border-t">
                <td className="p-2"><div className="h-4 w-48 animate-pulse rounded bg-gray-200" /></td>
                <td className="p-2"><div className="h-6 w-full animate-pulse rounded bg-gray-200" /></td>
                <td className="p-2 text-right text-xs text-gray-500">&nbsp;</td>
              </tr>
            ))}
            {!loading && items.length===0 && <tr><td colSpan={3} className="p-2 text-gray-500">Немає записів</td></tr>}
            {items.map(it => (
              <tr key={it.keyId} className="border-t">
                <td className="p-2 font-mono text-xs">{it.key}</td>
                <td className="p-2"><textarea defaultValue={it.value} onBlur={(e)=>save(it.keyId, e.target.value)} className="h-16 w-full rounded border p-2 text-sm" /></td>
                <td className="p-2 text-right text-xs text-gray-500">blur to save</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        <ul className="divide-y rounded border bg-white">
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="p-3 space-y-2">
              <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-16 w-full animate-pulse rounded bg-gray-200" />
            </li>
          ))}
          {!loading && items.length===0 && <li className="p-3 text-gray-500">Немає записів</li>}
          {items.map(it => (
            <li key={it.keyId} className="p-3 space-y-2">
              <div className="font-mono text-xs">{it.key}</div>
              <textarea defaultValue={it.value} onBlur={(e)=>save(it.keyId, e.target.value)} className="h-20 w-full rounded border p-2 text-sm" />
              <div className="text-right text-[10px] text-gray-500">blur to save</div>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile sticky action bar */}
      <div className="h-14 md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-white px-4 py-2 md:hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        <div className="mx-auto flex max-w-screen-sm items-center justify-between">
          <button onClick={()=>window.scrollTo({ top: 0, behavior: 'smooth' })} className="rounded border px-3 py-1 text-sm">Вгору</button>
          <button onClick={load} className="rounded border px-3 py-1 text-sm">Оновити</button>
        </div>
      </div>
    </div>
  );
}
