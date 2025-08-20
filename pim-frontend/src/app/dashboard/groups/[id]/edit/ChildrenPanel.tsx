'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { importChildrenAction, type ImportActionState } from '../../actions';
import { useChildrenDnD } from './children/useChildrenDnD';
import SelectExistingModal from './children/SelectExistingModal';
import ImportChildrenModal from './children/ImportChildrenModal';
import ExportChildrenModal from './children/ExportChildrenModal';
import type { Child } from './children/types';

export default function ChildrenPanel({ groupId, parentId, children }: { groupId: string; parentId: string | null; children: Child[] }) {
  const router = useRouter();
  const { dragId, setDragId, overId, onDragStart, onDragOverList, onDragOverChild } = useChildrenDnD();
  const [showSelect, setShowSelect] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  async function submitMove(child_id: string, new_parent_id: string) {
    const res = await fetch('/dashboard/groups/move', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ child_id, new_parent_id, context_id: groupId }),
    });
    if (res.ok) router.refresh(); else alert('Не вдалося перемістити.');
  }
  async function onDropToList(e: React.DragEvent) {
    e.preventDefault(); if (!dragId) return; if (parentId) await submitMove(dragId, parentId); setDragId(null);
  }
  async function onDropToChild(e: React.DragEvent, id: string) {
    e.preventDefault(); if (!dragId) return; if (dragId !== id) await submitMove(dragId, id); setDragId(null);
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
            className={`group rounded border p-1 hover:bg-gray-50 cursor-pointer ${overId===c.id ? 'bg-gray-50' : ''}`}
            title="Перетягніть на вузол, щоб зробити його батьком"
          >
            <a href={`/dashboard/groups/${c.id}/edit`} className="block text-zinc-700 no-underline hover:no-underline">{c.name}</a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-gray-500">Підказка: перетягніть елемент на інший, щоб зробити його дочірнім. Перетягніть у порожню область панелі, щоб підняти на рівень вище.</p>

      <div className="mt-3 flex gap-2">
        <button className="btn" onClick={()=>setShowSelect(true)}>+ Додати існуючі</button>
        <button className="btn" onClick={()=>setShowImport(true)}>⇪ Імпорт</button>
        <button className="btn" onClick={()=>setShowExport(true)}>⇩ Експорт</button>
      </div>

      {showSelect && <SelectExistingModal groupId={groupId} onClose={()=>setShowSelect(false)} />}
      {showImport && <ImportChildrenModal parentId={groupId} onClose={()=>setShowImport(false)} />}
      {showExport && <ExportChildrenModal parentId={groupId} children={children} onClose={()=>setShowExport(false)} />}
    </div>
  );
}
