'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Child = { id: string; name: string };
type SelectItem = { id: string; name: string };

function SelectExistingModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
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
      // batch move each selected under current group
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

export default function ChildrenPanel({ groupId, parentId, children }: { groupId: string; parentId: string | null; children: Child[] }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [showSelect, setShowSelect] = useState(false);
  const router = useRouter();

  async function submitMove(child_id: string, new_parent_id: string) {
    const res = await fetch('/dashboard/groups/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id, new_parent_id, context_id: groupId }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      console.error('Move failed', await res.text());
      alert('Не вдалося перемістити.');
    }
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch {}
  }
  function onDragOverList(e: React.DragEvent) {
    e.preventDefault();
    setOverId(null);
  }
  async function onDropToList(e: React.DragEvent) {
    e.preventDefault();
    if (dragId == null) return;
    if (parentId) await submitMove(dragId, parentId);
    setDragId(null);
  }
  function onDragOverChild(e: React.DragEvent, id: string) {
    e.preventDefault();
    setOverId(id);
  }
  async function onDropToChild(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (dragId == null) return;
    if (dragId !== id) await submitMove(dragId, id);
    setDragId(null);
    setOverId(null);
  }

  return (
    <div className="mt-2" onDragOver={onDragOverList} onDrop={onDropToList}>
      <ul className="space-y-1 text-sm">
        {children.map((c) => (
          <li
            key={c.id}
            draggable
            onDragStart={(e)=>onDragStart(e, c.id)}
            onDragOver={(e)=>onDragOverChild(e, c.id)}
            onDrop={(e)=>onDropToChild(e, c.id)}
            className={`rounded border p-1 ${overId===c.id ? 'bg-gray-50' : ''}`}
            title="Перетягніть на вузол, щоб зробити його батьком"
          >
            <a href={`/dashboard/groups/${c.id}/edit`} className="text-zinc-700 underline">{c.name}</a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-gray-500">Підказка: перетягніть елемент на інший, щоб зробити його дочірнім. Перетягніть у порожню область панелі, щоб підняти на рівень вище.</p>

      <div className="mt-3">
        <button className="btn" onClick={()=>setShowSelect(true)}>+ Додати існуючі</button>
      </div>

      {showSelect && <SelectExistingModal groupId={groupId} onClose={()=>setShowSelect(false)} />}
    </div>
  );
}
