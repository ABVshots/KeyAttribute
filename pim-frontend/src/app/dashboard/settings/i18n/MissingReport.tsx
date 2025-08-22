'use client';

import { useEffect, useState } from 'react';

export default function MissingReport() {
  const [items, setItems] = useState<Array<{ id: number; namespace: string; key: string; locale: string; count: number; last_seen: string; path: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/i18n/missing', { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setItems(d.items || []); }
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function clear(id?: number) {
    const url = id ? `/api/i18n/missing?id=${id}` : '/api/i18n/missing';
    await fetch(url, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <button onClick={()=>load()} className="rounded border px-3 py-1">Оновити</button>
        <button onClick={()=>clear()} className="rounded border px-3 py-1">Очистити все</button>
      </div>
      <div className="rounded border bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="p-2">Namespace</th><th className="p-2">Key</th><th className="p-2">Locale</th><th className="p-2">Count</th><th className="p-2">Last seen</th><th className="p-2">Path</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-2 text-gray-500">Завантаження…</td></tr>}
            {!loading && items.length===0 && <tr><td colSpan={7} className="p-2 text-gray-500">Нічого не бракує</td></tr>}
            {items.map(it => (
              <tr key={it.id} className="border-t">
                <td className="p-2">{it.namespace}</td>
                <td className="p-2">{it.key}</td>
                <td className="p-2">{it.locale}</td>
                <td className="p-2">{it.count}</td>
                <td className="p-2">{new Date(it.last_seen).toLocaleString()}</td>
                <td className="p-2">{it.path}</td>
                <td className="p-2 text-right"><button onClick={()=>clear(it.id)} className="rounded border px-2 py-1 text-xs">Прибрати</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
