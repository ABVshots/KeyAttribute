'use client';

import { useEffect, useState } from 'react';
import { etagFetchJson } from '@/lib/etagFetch';

export default function KeysManager() {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [ns, setNs] = useState('');
  const [items, setItems] = useState<Array<{ id: string; namespace: string; key: string }>>([]);
  const [newNs, setNewNs] = useState('');
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { void loadNs(); }, []);
  useEffect(() => { void loadKeys(); }, [ns]);

  async function loadNs() {
    const res = await fetch('/api/i18n/namespaces', { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setNamespaces(d.items || []); setNs(d.items?.[0] || ''); }
  }
  async function loadKeys() {
    setLoading(true);
    try {
      const d = await etagFetchJson<{ items: Array<{ id: string; namespace: string; key: string }> }>(`/api/i18n/keys?ns=${encodeURIComponent(ns)}`);
      setItems(d.items || []);
    } finally { setLoading(false); }
  }

  async function addNs() {
    const v = newNs.trim(); if (!v) return;
    await fetch('/api/i18n/namespaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: v }) });
    setNewNs(''); await loadNs();
  }

  async function addKey() {
    const k = newKey.trim(); if (!k || !ns) return;
    await fetch('/api/i18n/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namespace: ns, key: k }) });
    setNewKey(''); await loadKeys();
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 bg-white/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex flex-wrap items-center gap-2">
          <select value={ns} onChange={(e)=>setNs(e.target.value)} className="rounded border px-2 py-1">
            {namespaces.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <input value={newNs} onChange={(e)=>setNewNs(e.target.value)} placeholder="новий namespace" className="rounded border px-2 py-1" />
          <button onClick={addNs} className="rounded border px-3 py-1">+ Namespace</button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="rounded border bg-white hidden md:block">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="p-2">Key</th></tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 10 }).map((_,i)=> (
              <tr key={i} className="border-t">
                <td className="p-2"><div className="h-4 w-60 animate-pulse rounded bg-gray-200" /></td>
              </tr>
            ))}
            {!loading && items.length===0 && <tr><td className="p-2 text-gray-500">Немає ключів</td></tr>}
            {items.map(it => (
              <tr key={it.id} className="border-t">
                <td className="p-2 font-mono">{it.key}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        <ul className="divide-y rounded border bg-white">
          {loading && Array.from({ length: 6 }).map((_, i)=>(
            <li key={i} className="p-2"><div className="h-4 w-48 animate-pulse rounded bg-gray-200" /></li>
          ))}
          {!loading && items.length===0 && <li className="p-2 text-gray-500">Немає ключів</li>}
          {items.map(it => (
            <li key={it.id} className="p-2">
              <div className="font-mono text-xs">{it.key}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="h-14" />
      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-white px-4 py-2 md:hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        <div className="mx-auto flex max-w-screen-sm items-center justify-between">
          <button onClick={()=>window.scrollTo({ top: 0, behavior: 'smooth' })} className="rounded border px-3 py-1 text-sm">Вгору</button>
          <div className="flex items-center gap-2">
            <input value={newKey} onChange={(e)=>setNewKey(e.target.value)} placeholder="новий ключ" className="w-40 rounded border px-2 py-1" />
            <button onClick={addKey} className="rounded border px-3 py-1 text-sm">+ Key</button>
          </div>
        </div>
      </div>
    </div>
  );
}
