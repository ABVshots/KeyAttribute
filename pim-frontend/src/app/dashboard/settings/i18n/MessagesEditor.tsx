'use client';

import { useEffect, useMemo, useState } from 'react';

function extractPlaceholders(msg: string): string[] {
  const re = /\{\s*([\w.]+)\s*(?:,[^}]*)?}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(msg)) !== null) { if (m[1]) out.add(m[1]); }
  return Array.from(out);
}

export default function MessagesEditor() {
  const [ns, setNs] = useState('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [locale, setLocale] = useState('en');
  const [locales, setLocales] = useState<string[]>(['en']);
  const [items, setItems] = useState<Array<{ keyId: string; key: string; value: string; baseValue?: string }>>([]);
  const [loading, setLoading] = useState(false);

  const baseLocale = useMemo(() => (locales.includes('en') ? 'en' : locales[0] || 'en'), [locales]);

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
      const [curRes, baseRes] = await Promise.all([
        fetch(`/api/i18n/messages?ns=${encodeURIComponent(ns)}&locale=${encodeURIComponent(locale)}`, { cache: 'no-store' }),
        fetch(`/api/i18n/messages?ns=${encodeURIComponent(ns)}&locale=${encodeURIComponent(baseLocale)}`, { cache: 'no-store' })
      ]);
      const cur = curRes.ok ? await curRes.json() : { items: [] };
      const base = baseRes.ok ? await baseRes.json() : { items: [] };
      const baseMap = new Map<string, string>();
      (base.items||[]).forEach((it: any)=> baseMap.set(it.keyId, it.value));
      const merged = (cur.items||[]).map((it: any)=> ({ keyId: it.keyId, key: it.key, value: it.value, baseValue: baseMap.get(it.keyId) }));
      setItems(merged);
    } finally { setLoading(false); }
  }
  async function save(kid: string, val: string) {
    try {
      const res = await fetch('/api/i18n/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyId: kid, locale, value: val }) });
      if (!res.ok) {
        const j = await res.json().catch(()=>({}));
        if (j?.error === 'icu_mismatch') {
          const msg = `ICU placeholders mismatch with base 'en'.\nMissing: [${(j.missing||[]).join(', ')}]\nExtra: [${(j.extra||[]).join(', ')}]\nЗберегти всупереч попередженню?`;
          if (confirm(msg)) {
            const res2 = await fetch('/api/i18n/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyId: kid, locale, value: val, allowMismatch: 1 }) });
            if (!res2.ok) {
              const j2 = await res2.json().catch(()=>({}));
              alert(j2?.error || `Помилка (${res2.status})`);
            }
          }
        } else {
          alert(j?.error || `Помилка (${res.status})`);
        }
      }
    } catch (e: any) {
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
        <span className="text-xs text-gray-500">Базова локаль: {baseLocale}</span>
        <button onClick={load} className="rounded border px-3 py-1">Оновити</button>
      </div>
      <div className="rounded border bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="p-2">Key</th><th className="p-2">Value</th><th className="p-2 w-64">ICU</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={3} className="p-2 text-gray-500">Завантаження…</td></tr>}
            {!loading && items.length===0 && <tr><td colSpan={3} className="p-2 text-gray-500">Немає записів</td></tr>}
            {items.map(it => {
              const basePH = extractPlaceholders(it.baseValue||'');
              const curPH = extractPlaceholders(it.value||'');
              const missing = basePH.filter(p => !curPH.includes(p));
              const extra = curPH.filter(p => !basePH.includes(p));
              const hasWarn = baseLocale !== locale && (missing.length>0 || extra.length>0);
              return (
                <tr key={it.keyId} className="border-t align-top">
                  <td className="p-2 font-mono text-xs">{it.key}</td>
                  <td className="p-2">
                    <textarea defaultValue={it.value} onBlur={(e)=>save(it.keyId, e.target.value)} className={`h-16 w-full rounded border p-2 text-sm ${hasWarn ? 'border-yellow-400' : ''}`} />
                    {it.baseValue && (
                      <div className="mt-1 text-[10px] text-gray-500">Base: <span className="font-mono">{it.baseValue}</span></div>
                    )}
                  </td>
                  <td className="p-2 text-xs">
                    <div className="space-y-1">
                      <div>Base: {basePH.length ? basePH.map(p=> <span key={p} className="mr-1 rounded bg-gray-100 px-1">{`{${p}}`}</span>) : <span className="text-gray-400">—</span>}</div>
                      <div>Cur: {curPH.length ? curPH.map(p=> <span key={p} className="mr-1 rounded bg-gray-100 px-1">{`{${p}}`}</span>) : <span className="text-gray-400">—</span>}</div>
                      {hasWarn && (
                        <div className="text-yellow-700">Відмінності: {missing.length>0 && <span className="mr-2">missing [{missing.join(', ')}]</span>}{extra.length>0 && <span>extra [{extra.join(', ')}]</span>}</div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
