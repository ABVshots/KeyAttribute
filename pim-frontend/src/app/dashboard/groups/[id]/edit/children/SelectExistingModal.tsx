'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SelectItem } from './types';

export default function SelectExistingModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<SelectItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const res = await fetch(`/dashboard/groups/select?group_id=${encodeURIComponent(groupId)}&q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setItems(d.items ?? []); }
    } finally { setLoading(false); }
  }

  function toggle(id: string) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function submit() {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return onClose();
    setSubmitting(true);
    try {
      for (const id of ids) {
        const res = await fetch('/dashboard/groups/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ child_id: id, new_parent_id: groupId, context_id: groupId }),
        });
        if (!res.ok) throw new Error('move failed');
      }
      router.refresh();
      onClose();
    } catch (e) {
      alert('Не вдалося додати деякі записи');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Додати існуючі записи</h3>
          <button onClick={onClose} className="text-sm">✕</button>
        </div>
        <div className="mb-3 flex gap-2">
          <input value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&search()} placeholder="Пошук..." className="w-full rounded border px-2 py-1 text-sm" />
          <button onClick={search} disabled={loading} className="rounded border px-3 py-1 text-xs">{loading?'Пошук…':'Знайти'}</button>
        </div>
        <div className="max-h-80 overflow-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 p-2"><input type="checkbox" onChange={(e)=>{
                  const v = e.target.checked; setSelected(Object.fromEntries(items.map(it=>[it.id, v])));
                }} /></th>
                <th className="p-2">Назва</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t">
                  <td className="p-2"><input type="checkbox" checked={!!selected[it.id]} onChange={()=>toggle(it.id)} /></td>
                  <td className="p-2">{it.name}</td>
                </tr>
              ))}
              {(!items || items.length===0) && (
                <tr><td colSpan={2} className="p-4 text-center text-gray-500">Нічого не знайдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-1 text-xs">Скасувати</button>
          <button onClick={submit} disabled={submitting} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{submitting?'Додавання…':'Додати вибрані'}</button>
        </div>
      </div>
    </div>
  );
}
