'use client';

import { useEffect, useState } from 'react';

export default function KeysManager() {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [ns, setNs] = useState('');
  const [items, setItems] = useState<Array<{ id: string; namespace: string; key: string }>>([]);
  const [newNs, setNewNs] = useState('');
  const [newKey, setNewKey] = useState('');

  useEffect(() => { void loadNs(); }, []);
  useEffect(() => { void loadKeys(); }, [ns]);

  async function loadNs() {
    const res = await fetch('/api/i18n/namespaces', { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setNamespaces(d.items || []); setNs(d.items?.[0] || ''); }
  }
  async function loadKeys() {
    const res = await fetch(`/api/i18n/keys?ns=${encodeURIComponent(ns)}`, { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setItems(d.items || []); }
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
      <div className="flex items-center gap-2">
        <select value={ns} onChange={(e)=>setNs(e.target.value)} className="rounded border px-2 py-1">
          {namespaces.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input value={newNs} onChange={(e)=>setNewNs(e.target.value)} placeholder="новий namespace" className="rounded border px-2 py-1" />
        <button onClick={addNs} className="rounded border px-3 py-1">+ Namespace</button>
      </div>
      <div className="rounded border bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="p-2">Key</th></tr>
          </thead>
          <tbody>
            {items.length===0 && <tr><td className="p-2 text-gray-500">Немає ключів</td></tr>}
            {items.map(it => (
              <tr key={it.id} className="border-t">
                <td className="p-2 font-mono">{it.key}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <input value={newKey} onChange={(e)=>setNewKey(e.target.value)} placeholder="новий ключ (наприклад, title)" className="rounded border px-2 py-1" />
        <button onClick={addKey} className="rounded border px-3 py-1">+ Key</button>
      </div>
    </div>
  );
}
