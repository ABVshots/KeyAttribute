'use client';

import { useEffect, useState } from 'react';

export function LanguagesManager() {
  const [items, setItems] = useState<string[]>([]);
  const [def, setDef] = useState<string | null>(null);
  const [loc, setLoc] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    const res = await fetch('/api/i18n/ui-languages', { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setItems(d.locales || []); setDef(d.def || null); }
  }

  async function add() {
    const v = loc.trim(); if (!v) return;
    const res = await fetch('/api/i18n/ui-languages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: v }) });
    if (res.ok) { setLoc(''); await load(); }
  }

  async function del(l: string) {
    const res = await fetch(`/api/i18n/ui-languages?locale=${encodeURIComponent(l)}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  async function makeDefault(l: string) {
    const res = await fetch('/api/i18n/ui-languages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: l }) });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex gap-2">
        <input value={loc} onChange={(e)=>setLoc(e.target.value)} placeholder="uk" className="rounded border px-2 py-1" />
        <button onClick={add} className="rounded border px-3 py-1">Додати мову UI</button>
      </div>
      <ul className="divide-y rounded border bg-white">
        {items.map(l => (
          <li key={l} className="flex items-center justify-between p-2">
            <span>{l} {def===l && <em className="text-xs text-green-600">(default)</em>}</span>
            <div className="flex gap-2">
              <button onClick={()=>makeDefault(l)} className="rounded border px-2 py-1 text-xs">За замовчуванням</button>
              <button onClick={()=>del(l)} className="rounded border px-2 py-1 text-xs">Видалити</button>
            </div>
          </li>
        ))}
        {items.length===0 && <li className="p-2 text-gray-500">Немає мов</li>}
      </ul>
    </div>
  );
}
