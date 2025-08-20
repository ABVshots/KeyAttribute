"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type NodeRef = { id: string; name: string };

export default function PathPanel({
  groupId,
  parentId,
  chain,
  siblings,
}: {
  groupId: string;
  parentId: string | null;
  chain: NodeRef[];
  siblings: NodeRef[];
}) {
  const router = useRouter();
  const [overCrumb, setOverCrumb] = useState<string | null>(null);

  async function submitMove(child_id: string, new_parent_id: string) {
    const res = await fetch('/dashboard/groups/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id, new_parent_id, context_id: groupId }),
    });
    if (res.ok) router.refresh();
    else alert('Не вдалося перемістити');
  }

  function getDragId(e: React.DragEvent): string | null {
    try {
      const v = e.dataTransfer.getData('text/plain');
      return v || null;
    } catch {
      return null;
    }
  }

  function onDragOverList(e: React.DragEvent) {
    e.preventDefault();
    setOverCrumb(null);
  }
  async function onDropToList(e: React.DragEvent) {
    e.preventDefault();
    const dragId = getDragId(e);
    if (!dragId) return;
    if (parentId) await submitMove(dragId, parentId);
  }

  function onDragOverCrumb(e: React.DragEvent, id: string) {
    e.preventDefault();
    setOverCrumb(id);
  }
  async function onDropToCrumb(e: React.DragEvent, id: string) {
    e.preventDefault();
    const dragId = getDragId(e);
    if (!dragId || dragId === id) return;
    await submitMove(dragId, id);
    setOverCrumb(null);
  }

  return (
    <aside className="w-64 rounded-lg border bg-white p-4">
      <div className="mb-4" onDragOver={onDragOverList} onDrop={onDropToList}>
        <h2 className="text-sm font-semibold text-gray-700">Шлях</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {chain.map((n, i) => (
            <li
              key={n.id}
              className={`flex items-center gap-1 rounded ${overCrumb === n.id ? 'bg-gray-50' : ''}`}
              onDragOver={(e) => onDragOverCrumb(e, n.id)}
              onDrop={(e) => onDropToCrumb(e, n.id)}
              title="Перетягніть сюди, щоб зробити це батьківським вузлом"
            >
              {i > 0 && <span className="text-gray-400">/</span>}
              <Link href={`/dashboard/groups/${n.id}/edit`} className={n.id === groupId ? 'font-medium' : 'text-zinc-700 underline'}>
                {n.name}
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] text-gray-500">Підказка: перетягніть елемент на елемент шляху, щоб зробити його батьком. Або перетягніть у порожню область над шляхом, щоб підняти на рівень вище.</p>
      </div>

      {siblings && siblings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700">На рівні</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {siblings.map((s) => (
              <li key={s.id}>
                <Link href={`/dashboard/groups/${s.id}/edit`} className="text-zinc-700 underline">{s.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
