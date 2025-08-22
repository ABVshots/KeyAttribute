"use client";

import { useEffect, useMemo, useState } from 'react';

type Item = { id: number; namespace: string; key: string; locale: string; count: number; last_seen: string; path?: string };

export default function MissingActions() {
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/i18n/missing', { cache: 'no-store' });
    const j = await res.json();
    setItems(j.items||[]);
  }

  useEffect(()=>{ load(); },[]);

  const selectedIds = useMemo(()=> Object.keys(sel).filter(k=>sel[Number(k)]).map(Number), [sel]);

  async function removeSelected() {
    setLoading(true); setError(null);
    try {
      // batch delete by calling DELETE for each id (simple client batching)
      await Promise.all(selectedIds.map(id => fetch(`/api/i18n/missing?id=${id}`, { method: 'DELETE' })));
      setSel({});
      await load();
      setNote('Видалено');
    } catch (e:any) { setError(e.message||'error'); } finally { setLoading(false); }
  }

  async function clearAll() {
    setLoading(true); setError(null);
    try { await fetch('/api/i18n/missing', { method: 'DELETE' }); await load(); setNote('Очищено'); }
    catch (e:any) { setError(e.message||'error'); } finally { setLoading(false); }
  }

  function exportCsv() {
    const header = ['id','namespace','key','locale','count','last_seen','path'];
    const rows = items.map(i=> [i.id, i.namespace, i.key, i.locale, i.count, i.last_seen, i.path||'']);
    const csv = [header, ...rows].map(cols => cols.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `i18n-missing-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  async function resolveSelected() {
    if (selectedIds.length === 0) return;
    setLoading(true); setError(null); setNote(null);
    try {
      const res = await fetch('/api/i18n/missing/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selectedIds }) });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || 'resolve_failed');
      setNote(`Створено ключів: ${j.createdKeys || 0}`);
      await load();
    } catch (e:any) { setError(e.message||'error'); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <button onClick={load} className="rounded border px-2 py-1 text-xs">Оновити</button>
        <button onClick={exportCsv} className="rounded border px-2 py-1 text-xs">Експорт CSV</button>
        <button onClick={resolveSelected} disabled={selectedIds.length===0 || loading} className="rounded border px-2 py-1 text-xs disabled:opacity-50">Створити ключі</button>
        <button onClick={removeSelected} disabled={selectedIds.length===0 || loading} className="rounded border px-2 py-1 text-xs disabled:opacity-50">Видалити обране</button>
        <button onClick={clearAll} disabled={loading} className="rounded border px-2 py-1 text-xs">Очистити все</button>
        {error && <span className="text-xs text-red-600">{error}</span>}
        {note && <span className="text-xs text-green-600">{note}</span>}
      </div>
      <div className="max-h-72 overflow-auto rounded border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="p-2"><input type="checkbox" onChange={(e)=>{
                const checked = e.target.checked; const next: Record<number, boolean> = {};
                items.forEach(i=>{ next[i.id] = checked; }); setSel(next);
              }} /></th>
              <th className="p-2">Namespace</th>
              <th className="p-2">Key</th>
              <th className="p-2">Locale</th>
              <th className="p-2">Count</th>
              <th className="p-2">Last seen</th>
              <th className="p-2">Path</th>
            </tr>
          </thead>
          <tbody>
            {items.length===0 ? (
              <tr><td colSpan={7} className="p-3 text-center text-gray-500">Порожньо</td></tr>
            ) : items.map(i => (
              <tr key={i.id} className="border-t">
                <td className="p-2"><input type="checkbox" checked={!!sel[i.id]} onChange={(e)=> setSel(p=> ({...p,[i.id]: e.target.checked}))} /></td>
                <td className="p-2">{i.namespace}</td>
                <td className="p-2">{i.key}</td>
                <td className="p-2">{i.locale}</td>
                <td className="p-2">{i.count}</td>
                <td className="p-2">{new Date(i.last_seen).toLocaleString()}</td>
                <td className="p-2">{i.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
