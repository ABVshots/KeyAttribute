'use client';

import { useEffect, useMemo, useState, startTransition, type FormEvent } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateGroupNamesAllLocalesAction,
  type NamesActionState,
  upsertGroupTextsAction,
  reorderGroupTextsAction,
  deleteGroupTextAction,
  type TextsActionState,
  upsertGroupPropertiesAction,
  deleteGroupPropertyAction,
  type PropertiesActionState,
  addGroupNoteAction,
  deleteGroupNoteAction,
  updateGroupNoteAction,
  reorderGroupNotesAction,
  type NotesActionState,
  setGroupCoverUrlAction,
  type MediaActionState,
} from '../../actions';

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(()=>setMsg(null), 2000); return () => clearTimeout(t); }, [msg]);
  return { msg, ok: (m: string) => setMsg(m) };
}

export default function EditorTabs({ groupId }: { groupId: string }) {
  const [tab, setTab] = useState<'names' | 'descriptions' | 'media' | 'notes' | 'properties'>('names');
  const toast = useToast();
  return (
    <div>
      {toast.msg && <div className="mb-2 rounded bg-green-100 px-3 py-1 text-xs text-green-800">{toast.msg}</div>}
      <div className="mb-3 flex gap-2 text-xs">
        {(['names','descriptions','media','notes','properties'] as const).map(t => (
          <button key={t} className={`rounded px-2 py-1 ${tab===t ? 'bg-zinc-800 text-white' : 'border'}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'names' && <NamesTab groupId={groupId} toast={toast} />}
      {tab === 'descriptions' && <DescriptionsMultiTab groupId={groupId} toast={toast} />}
      {tab === 'media' && <MediaTab groupId={groupId} toast={toast} />}
      {tab === 'notes' && <NotesTab groupId={groupId} toast={toast} />}
      {tab === 'properties' && <PropertiesTab groupId={groupId} toast={toast} />}
    </div>
  );
}

function NamesTab({ groupId, toast }: { groupId: string; toast: ReturnType<typeof useToast> }) {
  const [rows, setRows] = useState<Array<{ locale: string; label: string; value: string }>>([]);
  const router = useRouter();
  const [state, formAction, pending] = useActionState<NamesActionState, FormData>(updateGroupNamesAllLocalesAction, {} as NamesActionState);
  useEffect(() => { void (async () => {
    const res = await fetch(`/dashboard/groups/tree/names/locales?group_id=${encodeURIComponent(groupId)}`);
    if (res.ok) { const data = await res.json(); setRows(data.locales ?? []); }
  })(); }, [groupId]);
  async function save(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('group_id', groupId);
    fd.append('entries', JSON.stringify(rows.map(r=>({ locale:r.locale, name:r.value }))));
    startTransition(() => { formAction(fd); });
    toast.ok('Збережено');
    router.refresh();
  }
  return (
    <form onSubmit={save} className="space-y-2">
      {rows.map(r => (
        <div key={r.locale} className="grid grid-cols-5 items-center gap-2">
          <div className="col-span-1 text-xs text-gray-600">{r.label} <span className="text-gray-400">({r.locale})</span></div>
          <input className="col-span-4 rounded border px-2 py-1 text-sm" value={r.value} onChange={(e)=>setRows(prev=>prev.map(x=>x.locale===r.locale?{...x,value:e.target.value}:x))} />
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{pending?'Збереження…':'Зберегти'}</button>
      </div>
    </form>
  );
}

function DescriptionsMultiTab({ groupId, toast }: { groupId: string; toast: ReturnType<typeof useToast> }) {
  const [items, setItems] = useState<Array<{ id?: string; locale: string | null; key: string; content: string; sort_order?: number }>>([]);
  const [locales, setLocales] = useState<Array<{ code: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const router = useRouter();
  const [upsertState, upsertAction, upserting] = useActionState<TextsActionState, FormData>(upsertGroupTextsAction, {} as TextsActionState);
  const [reorderState, reorderAction] = useActionState<TextsActionState, FormData>(reorderGroupTextsAction, {} as TextsActionState);
  const [deleteState, deleteAction] = useActionState<TextsActionState, FormData>(deleteGroupTextAction, {} as TextsActionState);

  useEffect(() => { void (async () => {
    setLoading(true);
    try {
      const locRes = await fetch(`/dashboard/groups/tree/names/locales?group_id=${encodeURIComponent(groupId)}`);
      if (locRes.ok) { const d = await locRes.json(); setLocales((d.locales ?? []).map((l: any) => ({ code: l.locale, label: l.label }))); }
      const res = await fetch(`/dashboard/groups/edit/texts?group_id=${encodeURIComponent(groupId)}&key=description`, { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setItems(d.items ?? []); }
    } finally { setLoading(false); }
  })(); }, [groupId]);

  function addNew() { setItems(prev => [...prev, { locale: locales[0]?.code ?? null, key: 'description', content: '' }]); }
  async function saveAll() {
    const fd = new FormData();
    fd.append('group_id', groupId);
    fd.append('key', 'description');
    fd.append('items', JSON.stringify(items));
    startTransition(() => { upsertAction(fd); });
    toast.ok('Збережено');
    router.refresh();
  }
  async function remove(id?: string, idx?: number) {
    if (!id) { setItems(prev => prev.filter((_, i) => i !== idx)); return; }
    const fd = new FormData();
    fd.append('group_id', groupId);
    fd.append('id', id);
    startTransition(() => { deleteAction(fd); });
    setItems(prev => prev.filter((_, i) => i !== idx));
    toast.ok('Видалено');
  }

  function onDragStart(e: React.DragEvent, id: string) { setDragId(id); e.dataTransfer.effectAllowed = 'move'; }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  async function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault(); if (!dragId || dragId === targetId) return;
    const current = [...items];
    const fromIdx = current.findIndex(i => i.id === dragId);
    const toIdx = current.findIndex(i => i.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    const reordered = current.map((n, idx) => ({ ...n, sort_order: idx }));
    setItems(reordered);
    setDragId(null);
    const fd = new FormData();
    fd.append('group_id', groupId);
    fd.append('order', JSON.stringify(reordered.filter(n=>n.id).map(n => ({ id: n.id!, sort_order: n.sort_order ?? 0 }))));
    startTransition(() => { reorderAction(fd); });
    toast.ok('Порядок збережено');
  }

  if (loading) return <p className="text-sm text-gray-500">Завантаження…</p>;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.id ?? `new-${i}`} draggable={!!it.id} onDragStart={(e)=>it.id && onDragStart(e, it.id)} onDragOver={onDragOver} onDrop={(e)=>it.id && onDrop(e, it.id)} className="grid grid-cols-6 items-start gap-2">
          <select className="col-span-1 rounded border px-2 py-1 text-sm" value={it.locale ?? ''} onChange={(e)=>setItems(prev=>prev.map((x,ix)=>ix===i?{...x,locale:e.target.value||null}:x))}>
            <option value="">—</option>
            {locales.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <textarea className="col-span-4 rounded border px-2 py-1 text-sm" rows={3} value={it.content} onChange={(e)=>setItems(prev=>prev.map((x,ix)=>ix===i?{...x,content:e.target.value}:x))} />
          <button onClick={()=>remove(it.id, i)} className="col-span-1 rounded border px-2 py-1 text-xs">Видалити</button>
        </div>
      ))}
      <div className="flex justify-between">
        <button onClick={addNew} className="rounded border px-3 py-1 text-xs">+ Додати опис</button>
        <button onClick={saveAll} disabled={upserting} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{upserting?'Збереження…':'Зберегти'}</button>
      </div>
    </div>
  );
}

function MediaTab({ groupId, toast }: { groupId: string; toast: ReturnType<typeof useToast> }) {
  const [url, setUrl] = useState('');
  const router = useRouter();
  const [state, action, pending] = useActionState<MediaActionState, FormData>(setGroupCoverUrlAction, {} as MediaActionState);
  useEffect(() => { void (async () => {
    const res = await fetch(`/dashboard/groups/tree/names/media?group_id=${encodeURIComponent(groupId)}`);
    if (res.ok) { const data = await res.json(); setUrl(data.cover_url ?? ''); }
  })(); }, [groupId]);
  async function save(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('group_id', groupId);
    fd.append('url', url);
    startTransition(() => { action(fd); });
    toast.ok('Збережено');
    router.refresh();
  }
  const valid = useMemo(() => /^https?:\/\//i.test(url), [url]);
  return (
    <form onSubmit={save} className="space-y-3">
      <label className="text-sm">Cover image URL</label>
      <input className="w-full rounded border px-2 py-1 text-sm" value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://..." />
      {valid && (
        <div className="rounded border bg-white p-2">
          <p className="mb-2 text-xs text-gray-600">Попередній перегляд (lazy):</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="cover" loading="lazy" className="max-h-64 w-auto rounded" />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{pending?'Збереження…':'Зберегти'}</button>
      </div>
    </form>
  );
}

function NotesTab({ groupId, toast }: { groupId: string; toast: ReturnType<typeof useToast> }) {
  const [items, setItems] = useState<Array<{ id: string; content: string; created_at: string; sort_order?: number }>>([]);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const router = useRouter();
  const [addState, addAction, adding] = useActionState<NotesActionState, FormData>(addGroupNoteAction, {} as NotesActionState);
  const [delState, delAction] = useActionState<NotesActionState, FormData>(deleteGroupNoteAction, {} as NotesActionState);
  const [updState, updAction, updating] = useActionState<NotesActionState, FormData>(updateGroupNoteAction, {} as NotesActionState);
  const [reorderState, reorderAction] = useActionState<NotesActionState, FormData>(reorderGroupNotesAction, {} as NotesActionState);

  useEffect(() => { void reload(); }, [groupId]);
  async function reload() {
    const res = await fetch(`/dashboard/groups/tree/names/notes?group_id=${encodeURIComponent(groupId)}`, { cache: 'no-store' });
    if (res.ok) { const data = await res.json(); setItems(data.notes ?? []); }
  }
  async function add(e: FormEvent) {
    e.preventDefault(); if (!text.trim()) return;
    const fd = new FormData(); fd.append('group_id', groupId); fd.append('content', text.trim());
    startTransition(() => { addAction(fd); }); setText(''); await reload(); toast.ok('Додано');
  }
  async function remove(id: string) {
    const fd = new FormData(); fd.append('group_id', groupId); fd.append('id', id);
    startTransition(() => { delAction(fd); }); setItems(prev => prev.filter(n => n.id !== id)); toast.ok('Видалено');
  }
  async function saveEdit(id: string) {
    if (!editing) return;
    const fd = new FormData(); fd.append('group_id', groupId); fd.append('id', id); fd.append('content', editing.content);
    startTransition(() => { updAction(fd); }); setItems(prev => prev.map(n => n.id === id ? { ...n, content: editing.content } : n)); setEditing(null); toast.ok('Збережено');
  }
  function onDragStart(e: any, id: string) { setDragId(id); if (e?.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }
  function onDragOver(e: any) { if (e?.preventDefault) e.preventDefault(); }
  async function onDrop(e: any, targetId: string) {
    if (e?.preventDefault) e.preventDefault(); if (!dragId || dragId === targetId) return;
    const current = [...items];
    const fromIdx = current.findIndex(i => i.id === dragId);
    const toIdx = current.findIndex(i => i.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    const reordered = current.map((n, idx) => ({ ...n, sort_order: idx }));
    setItems(reordered);
    setDragId(null);
    const fd = new FormData(); fd.append('group_id', groupId); fd.append('order', JSON.stringify(reordered.map(n => ({ id: n.id, sort_order: n.sort_order ?? 0 }))));
    startTransition(() => { reorderAction(fd); });
    toast.ok('Порядок збережено');
  }

  return (
    <div className="space-y-2">
      <form onSubmit={add} className="space-y-2">
        <textarea className="w-full rounded border px-2 py-1 text-sm" rows={4} value={text} onChange={(e)=>setText(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="submit" disabled={adding} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{adding?'Збереження…':'Додати'}</button>
        </div>
      </form>
      <div className="space-y-1 text-xs">
        {items.map(n => (
          <div key={n.id} draggable onDragStart={(e)=>onDragStart(e, n.id)} onDragOver={onDragOver} onDrop={(e)=>onDrop(e, n.id)} className="rounded border p-2">
            <div className="text-gray-500">{new Date(n.created_at).toLocaleString()}</div>
            {editing?.id === n.id ? (
              <>
                <textarea className="mt-1 w-full rounded border px-2 py-1 text-sm" rows={4} value={editing.content} onChange={(e)=>setEditing({ ...editing, content: e.target.value })} />
                <div className="mt-2 flex gap-2">
                  <button onClick={()=>saveEdit(n.id)} disabled={updating} className="rounded bg-zinc-800 px-2 py-1 text-white disabled:opacity-60">{updating?'Збереження…':'Зберегти'}</button>
                  <button onClick={()=>setEditing(null)} className="rounded border px-2 py-1">Скасувати</button>
                </div>
              </>
            ) : (
              <div className="mt-1 flex items-start justify-between gap-2">
                <div className="whitespace-pre-wrap break-words">{n.content}</div>
                <div className="shrink-0 space-x-2">
                  <button onClick={()=>setEditing({ id: n.id, content: n.content })} className="rounded border px-2 py-1">Редагувати</button>
                  <button onClick={()=>remove(n.id)} className="rounded border px-2 py-1">Видалити</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertiesTab({ groupId, toast }: { groupId: string; toast: ReturnType<typeof useToast> }) {
  const [items, setItems] = useState<Array<{ id?: string; key: string; value_text?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [propsState, propsAction, propsPending] = useActionState<PropertiesActionState, FormData>(upsertGroupPropertiesAction, {} as PropertiesActionState);
  const [delPropsState, delPropsAction] = useActionState<PropertiesActionState, FormData>(deleteGroupPropertyAction, {} as PropertiesActionState);

  useEffect(() => { void (async () => { setLoading(true); try {
    const res = await fetch(`/dashboard/groups/edit/properties?group_id=${encodeURIComponent(groupId)}`);
    if (res.ok) { const d = await res.json(); setItems(d.items ?? []); }
  } finally { setLoading(false); } })(); }, [groupId]);

  function addNew() { setItems(prev => [...prev, { key: '', value_text: '' }]); }
  async function saveAll() {
    const fd = new FormData();
    fd.append('group_id', groupId);
    fd.append('items', JSON.stringify(items));
    startTransition(() => { propsAction(fd); });
    toast.ok('Збережено');
    router.refresh();
  }
  async function removeItem(id?: string, idx?: number) {
    if (!id) { setItems(prev => prev.filter((_, i) => i !== idx)); return; }
    const fd = new FormData();
    fd.append('group_id', groupId);
    fd.append('id', id);
    startTransition(() => { delPropsAction(fd); });
    setItems(prev => prev.filter((_, i) => i !== idx));
    toast.ok('Видалено');
  }

  if (loading) return <p className="text-sm text-gray-500">Завантаження…</p>;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.id ?? `new-${i}`} className="grid grid-cols-6 items-center gap-2">
          <input className="col-span-2 rounded border px-2 py-1 text-sm" placeholder="key" value={it.key} onChange={(e)=>setItems(prev=>prev.map((x,ix)=>ix===i?{...x,key:e.target.value}:x))} />
          <input className="col-span-3 rounded border px-2 py-1 text-sm" placeholder="value" value={it.value_text ?? ''} onChange={(e)=>setItems(prev=>prev.map((x,ix)=>ix===i?{...x,value_text:e.target.value}:x))} />
          <button onClick={()=>removeItem(it.id, i)} className="col-span-1 rounded border px-2 py-1 text-xs">Видалити</button>
        </div>
      ))}
      <div className="flex justify-between">
        <button onClick={addNew} className="rounded border px-3 py-1 text-xs">+ Додати властивість</button>
        <button onClick={saveAll} disabled={propsPending} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{propsPending?'Збереження…':'Зберегти'}</button>
      </div>
    </div>
  );
}
