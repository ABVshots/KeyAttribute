'use client';

import { useEffect, useState, useActionState } from 'react';
import Link from 'next/link';
import { updateGroupNameAction, type GroupActionState } from '../actions';
import NamesModal from './names/NamesModal';

type Node = { id: string; name: string };

export default function TreeClient({ roots }: { roots: Node[] }) {
  return (
    <ul className="space-y-2">
      {roots.map((n) => (
        <li key={n.id} className="rounded border bg-white p-3">
          <NodeItem id={n.id} name={n.name} />
        </li>
      ))}
    </ul>
  );
}

function NodeItem({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState(name);
  const [state, formAction] = useActionState<GroupActionState, FormData>(updateGroupNameAction, {} as GroupActionState);
  const [namesOpen, setNamesOpen] = useState(false);

  useEffect(() => {
    if (open && children.length === 0) {
      void loadChildren();
    }
  }, [open]);

  async function loadChildren() {
    setLoading(true);
    try {
      const res = await fetch(`/dashboard/groups/tree/children?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = (await res.json()) as { nodes: Node[] };
      setChildren(data.nodes);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setOpen((v) => !v)} className="rounded border px-2 py-1 text-xs">
          {open ? '−' : '+'}
        </button>
        <form action={formAction} className="flex flex-1 items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input
            name="name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button type="submit" className="rounded bg-zinc-800 px-3 py-1 text-xs text-white">Зберегти</button>
          <button type="button" onClick={() => setNamesOpen(true)} className="rounded border px-3 py-1 text-xs">Names</button>
          <Link href={`/dashboard/dictionaries/groups/focus/${id}`} className="text-xs underline">Редагувати</Link>
        </form>
      </div>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      <NamesModal open={namesOpen} onClose={() => setNamesOpen(false)} groupId={id} />
      {open && (
        <div className="mt-2 border-l pl-4">
          {loading ? (
            <p className="text-xs text-gray-500">Завантаження…</p>
          ) : children.length === 0 ? (
            <p className="text-xs text-gray-500">Немає дочірніх сторінок</p>
          ) : (
            <ul className="space-y-2">
              {children.map((c) => (
                <li key={c.id} className="rounded border bg-white p-2">
                  <NodeItem id={c.id} name={c.name} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
