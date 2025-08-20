'use client';

import { useMemo, useState, useActionState, startTransition } from 'react';
import Link from 'next/link';
import { linkGroupsToParentAction, type LinkActionState } from './actions/links';
import { importChildrenAction, type ImportActionState } from './actions/importExport';

export type GroupRow = { id: string; name: string; created_at?: string; children?: number; cover?: boolean };

export default function ListClient({ rows, typeId }: { rows: GroupRow[]; typeId?: string }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [all, setAll] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [state, action, pending] = useActionState<LinkActionState, FormData>(linkGroupsToParentAction, {} as LinkActionState);
  const [impState, impAction, impPending] = useActionState<ImportActionState, FormData>(importChildrenAction, {} as ImportActionState);

  const ids = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  function toggleAll() {
    const next = !all; setAll(next);
    const map = Object.fromEntries(rows.map(r => [r.id, next] as const));
    setSelected(map);
  }
  function toggle(id: string) { setSelected(prev => ({ ...prev, [id]: !prev[id] })); }

  function doExport() {
    if (ids.length === 0) return;
    const url = `/dashboard/groups/export?ids=${encodeURIComponent(ids.join(','))}`;
    const a = document.createElement('a'); a.href = url; a.download = `groups-${ids.length}.json`; document.body.appendChild(a); a.click(); a.remove();
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <button onClick={toggleAll} className="rounded border px-2 py-1">{all ? 'Зняти' : 'Вибрати'} всі</button>
          <span className="text-gray-500">Вибрано: {ids.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={doExport} disabled={ids.length===0} className="rounded border px-3 py-1 disabled:opacity-60">Експорт JSON</button>
          <button onClick={()=>setShowImportModal(true)} disabled={!typeId} className="rounded border px-3 py-1 disabled:opacity-60">Імпорт</button>
          <button onClick={()=>setShowLinkModal(true)} disabled={ids.length===0 || !typeId} className="rounded border px-3 py-1 disabled:opacity-60">Лінкувати до батька</button>
        </div>
      </div>

      <table className="w-full table-auto text-sm">
        <thead className="border-b bg-gray-50 text-left font-medium text-gray-500">
          <tr>
            <th className="px-4 py-2 w-10"><input type="checkbox" checked={all} onChange={toggleAll} /></th>
            <th className="px-4 py-2">Назва</th>
            <th className="px-4 py-2">Діти</th>
            <th className="px-4 py-2">Cover</th>
            <th className="px-4 py-2">Створено</th>
            <th className="px-4 py-2">Focus</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="p-4 text-gray-500">Нічого не знайдено</td></tr>
          ) : rows.map(row => (
            <tr key={row.id}>
              <td className="px-4 py-2"><input type="checkbox" checked={!!selected[row.id]} onChange={()=>toggle(row.id)} /></td>
              <td className="px-4 py-2">{row.name || '—'}</td>
              <td className="px-4 py-2">{row.children ?? 0}</td>
              <td className="px-4 py-2">{row.cover ? '✓' : '—'}</td>
              <td className="px-4 py-2">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <Link href={`/dashboard/dictionaries/groups/focus/${row.id}${typeId ? `?type=${encodeURIComponent(typeId)}` : ''}`} className="rounded border px-2 py-1 text-xs">Focus</Link>
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <Link href={`/dashboard/dictionaries/groups/focus/${row.id}${typeId ? `?type=${encodeURIComponent(typeId)}` : ''}`} className="rounded border px-2 py-1 text-xs">Редагувати</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showLinkModal && typeId && (
        <ParentSelectModal typeId={typeId} ids={ids} onClose={()=>setShowLinkModal(false)} onSubmit={(parentId)=>{
          const fd = new FormData(); fd.append('parent_id', parentId); fd.append('ids', JSON.stringify(ids));
          startTransition(()=>action(fd)); setShowLinkModal(false);
        }} pending={pending} />
      )}

      {showImportModal && typeId && (
        <ImportModal
          typeId={typeId}
          pending={impPending}
          state={impState}
          onClose={()=>setShowImportModal(false)}
          onPreview={(parentId, items)=>{
            const fd = new FormData(); fd.append('parent_id', parentId); fd.append('items', items); fd.append('dry_run', '1');
            startTransition(()=>impAction(fd));
          }}
          onApply={(parentId, items)=>{
            const fd = new FormData(); fd.append('parent_id', parentId); fd.append('items', items); fd.append('dry_run', '0');
            startTransition(()=>impAction(fd));
          }}
        />
      )}
    </>
  );
}

function ParentSelectModal({ typeId, ids, pending, onClose, onSubmit }: { typeId: string; ids: string[]; pending?: boolean; onClose: ()=>void; onSubmit: (parentId: string)=>void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [parent, setParent] = useState<{ id: string; name: string } | null>(null);

  async function search() {
    setLoading(true);
    try {
      const res = await fetch(`/dashboard/groups/select-by-type?type_id=${encodeURIComponent(typeId)}&q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setItems(d.items ?? []); }
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Обрати батьківський вузол</h3>
          <button onClick={onClose} className="text-sm">✕</button>
        </div>
        <div className="mb-3 flex gap-2">
          <input value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&search()} placeholder="Пошук..." className="w-full rounded border px-2 py-1 text-sm" />
          <button onClick={search} disabled={loading} className="rounded border px-3 py-1 text-xs">{loading?'Пошук…':'Знайти'}</button>
        </div>
        <div className="max-h-80 overflow-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50"><tr><th className="p-2">Назва</th></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className={`border-t ${parent?.id===it.id ? 'bg-gray-50' : ''}`} onClick={()=>setParent(it)}>
                  <td className="p-2 cursor-pointer">{it.name}</td>
                </tr>
              ))}
              {(!items || items.length===0) && (
                <tr><td className="p-4 text-center text-gray-500">Нічого не знайдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-1 text-xs">Скасувати</button>
          <button onClick={()=>parent && onSubmit(parent.id)} disabled={!parent || pending} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{pending?'Застосування…':'Застосувати'}</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ typeId, pending, state, onClose, onPreview, onApply }: {
  typeId: string;
  pending?: boolean;
  state?: ImportActionState;
  onClose: ()=>void;
  onPreview: (parentId: string, items: string)=>void;
  onApply: (parentId: string, items: string)=>void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [parent, setParent] = useState<{ id: string; name: string } | null>(null);
  const [payload, setPayload] = useState('');
  const [didApply, setDidApply] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const res = await fetch(`/dashboard/groups/select-by-type?type_id=${encodeURIComponent(typeId)}&q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setItems(d.items ?? []); }
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Імпорт елементів (JSON/CSV/lines)</h3>
          <button onClick={onClose} className="text-sm">✕</button>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Батьківський вузол (для лінкування після імпорту)</label>
            <div className="mb-2 flex gap-2">
              <input value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&search()} placeholder="Пошук..." className="w-full rounded border px-2 py-1 text-sm" />
              <button onClick={search} disabled={loading} className="rounded border px-3 py-1 text-xs">{loading?'Пошук…':'Знайти'}</button>
            </div>
            <div className="max-h-48 overflow-auto rounded border">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50"><tr><th className="p-2">Назва</th></tr></thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className={`border-t ${parent?.id===it.id ? 'bg-gray-50' : ''}`} onClick={()=>setParent(it)}>
                      <td className="p-2 cursor-pointer">{it.name}</td>
                    </tr>
                  ))}
                  {(!items || items.length===0) && (
                    <tr><td className="p-4 text-center text-gray-500">Нічого не знайдено</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Вставте дані для імпорту</label>
            <textarea value={payload} onChange={(e)=>setPayload(e.target.value)} placeholder='Напр.: [ { "names": { "en": "Name" } } ] або CSV з колонками name,name_uk' className="h-48 w-full rounded border p-2 text-sm font-mono" />
            <p className="mt-1 text-xs text-gray-500">Підтримка: JSON масив, JSON з items[], CSV (name, name_[locale]), або рядки (по одному на рядок). Є dry‑run з md5‑звіркою.</p>
          </div>
        </div>

        {state?.error && <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">Помилка: {state.error}</div>}
        {state?.ok && (
          <div className="mb-2 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-800">
            <div className="mb-1">Результат: {state.ok}</div>
            {state.details && (
              <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                <div>
                  <div className="font-semibold">Створення ({state.details.create?.length||0})</div>
                  <ul className="list-disc pl-4">{state.details.create?.slice(0,10).map((x,i)=>(<li key={i}>{x.defaultName} · {x.md5}</li>))}</ul>
                </div>
                <div>
                  <div className="font-semibold">Лінк за id ({state.details.linkById?.length||0})</div>
                  <ul className="list-disc pl-4">{state.details.linkById?.slice(0,10).map((x,i)=>(<li key={i}>{x.id} · {x.defaultName}</li>))}</ul>
                </div>
                <div>
                  <div className="font-semibold">Лінк за md5 ({state.details.linkByMd5?.length||0})</div>
                  <ul className="list-disc pl-4">{state.details.linkByMd5?.slice(0,10).map((x,i)=>(<li key={i}>{x.matchedId} · {x.defaultName}</li>))}</ul>
                </div>
                <div>
                  <div className="font-semibold">Оновлення перекладів ({state.details.updateTranslations?.length||0})</div>
                  <ul className="list-disc pl-4">{state.details.updateTranslations?.slice(0,10).map((x,i)=>(<li key={i}>{x.id} · {x.defaultName}</li>))}</ul>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-1 text-xs">Закрити</button>
          <button onClick={()=>parent && onPreview(parent.id, payload)} disabled={!parent || !payload || pending} className="rounded border px-3 py-1 text-xs disabled:opacity-60">{pending?'…':'Попередній перегляд'}</button>
          <button onClick={()=>{ if (!parent || !payload) return; onApply(parent.id, payload); setDidApply(true); }} disabled={!parent || !payload || pending} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{pending?'Імпорт…':'Імпортувати'}</button>
        </div>
      </div>
    </div>
  );
}
