'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { updateGroupNamesAllLocales, type NamesPayload } from '../../actions';

type LocaleRow = { locale: string; label: string; value: string };

type Tab = 'names' | 'media' | 'notes';

export default function NamesModal({ open, onClose, groupId }: { open: boolean; onClose: () => void; groupId: string }) {
  const [tab, setTab] = useState<Tab>('names');
  const [rows, setRows] = useState<LocaleRow[]>([]);
  const [coverUrl, setCoverUrl] = useState('');
  const [notes, setNotes] = useState<Array<{ id: string; locale: string | null; kind: string; content: string; created_at: string }>>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void load();
    async function load() {
      setLoading(true);
      try {
        const localesRes = await fetch(`/dashboard/groups/tree/names/locales?group_id=${encodeURIComponent(groupId)}`, { cache: 'no-store' });
        const data = (await localesRes.json()) as { locales: Array<{ locale: string; label: string; value: string }>, cover?: string, notes?: any[] };
        setRows(data.locales);
        // Load media cover and notes separately
        const mediaRes = await fetch(`/dashboard/groups/tree/names/media?group_id=${encodeURIComponent(groupId)}`, { cache: 'no-store' });
        if (mediaRes.ok) {
          const m = await mediaRes.json();
          setCoverUrl(m.cover_url ?? '');
        }
        const notesRes = await fetch(`/dashboard/groups/tree/names/notes?group_id=${encodeURIComponent(groupId)}`, { cache: 'no-store' });
        if (notesRes.ok) {
          const n = await notesRes.json();
          setNotes(n.notes ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
  }, [open, groupId]);

  async function saveNames() {
    setSaving(true);
    try {
      const payload: NamesPayload = { id: groupId, entries: rows.map(r => ({ locale: r.locale, name: r.value })) };
      await updateGroupNamesAllLocales(payload);
      onClose();
    } finally { setSaving(false); }
  }

  async function saveCover(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/dashboard/groups/tree/names/media`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: groupId, url: coverUrl }) });
      onClose();
    } finally { setSaving(false); }
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await fetch(`/dashboard/groups/tree/names/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: groupId, content: newNote }) });
      onClose();
    } finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Редагування</h3>
          <button onClick={onClose} className="text-sm">✕</button>
        </div>

        <div className="mb-3 flex gap-2 text-xs">
          <button className={`rounded px-2 py-1 ${tab==='names' ? 'bg-zinc-800 text-white' : 'border'}`} onClick={() => setTab('names')}>Names</button>
          <button className={`rounded px-2 py-1 ${tab==='media' ? 'bg-zinc-800 text-white' : 'border'}`} onClick={() => setTab('media')}>Media</button>
          <button className={`rounded px-2 py-1 ${tab==='notes' ? 'bg-zinc-800 text-white' : 'border'}`} onClick={() => setTab('notes')}>Notes</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Завантаження…</p>
        ) : tab === 'names' ? (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.locale} className="grid grid-cols-5 items-center gap-2">
                <div className="col-span-1 text-xs text-gray-600">{r.label} <span className="text-gray-400">({r.locale})</span></div>
                <input
                  className="col-span-4 rounded border px-2 py-1 text-sm"
                  value={r.value}
                  onChange={(e) => setRows((prev) => prev.map(x => x.locale === r.locale ? { ...x, value: e.target.value } : x))}
                  placeholder="Назва…"
                />
              </div>
            ))}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded border px-3 py-1 text-xs">Скасувати</button>
              <button onClick={saveNames} disabled={saving} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{saving ? 'Збереження…' : 'Зберегти'}</button>
            </div>
          </div>
        ) : tab === 'media' ? (
          <form onSubmit={saveCover} className="space-y-2">
            <label className="text-sm">Cover image URL</label>
            <input className="w-full rounded border px-2 py-1 text-sm" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-xs">Скасувати</button>
              <button type="submit" disabled={saving} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{saving ? 'Збереження…' : 'Зберегти'}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={addNote} className="space-y-2">
            <label className="text-sm">Нотатка</label>
            <textarea className="w-full rounded border px-2 py-1 text-sm" rows={4} value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-xs">Скасувати</button>
              <button type="submit" disabled={saving} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{saving ? 'Збереження…' : 'Додати'}</button>
            </div>
            {notes.length > 0 && (
              <div className="mt-3 space-y-1 text-xs">
                {notes.map(n => (
                  <div key={n.id} className="rounded border p-2"><div className="text-gray-500">{new Date(n.created_at).toLocaleString()}</div><div>{n.content}</div></div>
                ))}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
