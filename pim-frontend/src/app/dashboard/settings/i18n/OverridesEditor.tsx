'use client';

import { useEffect, useState } from 'react';

export default function OverridesEditor() {
  const [ns, setNs] = useState('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [locale, setLocale] = useState('en');
  const [locales, setLocales] = useState<string[]>(['en']);
  const [items, setItems] = useState<Array<{ keyId: string; key: string; value: string }>>([]);

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
    const res = await fetch(`/api/i18n/overrides?ns=${encodeURIComponent(ns)}&locale=${encodeURIComponent(locale)}`, { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setItems(d.items||[]); }
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
      <div className="flex items-center gap-2 text-sm">
        <select value={ns} onChange={(e)=>setNs(e.target.value)} className="rounded border px-2 py-1">
          {namespaces.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={locale} onChange={(e)=>setLocale(e.target.value)} className="rounded border px-2 py-1">
          {locales.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={load} className="rounded border px-3 py-1">Оновити</button>
      </div>
      <div className="rounded border bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="p-2">Key</th><th className="p-2">Override</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {items.length===0 && <tr><td colSpan={3} className="p-2 text-gray-500">Немає записів</td></tr>}
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
    </div>
  );
}
