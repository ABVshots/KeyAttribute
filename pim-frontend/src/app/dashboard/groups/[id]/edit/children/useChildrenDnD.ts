'use client';
import { useState } from 'react';

export function useChildrenDnD() {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch {}
  }
  function onDragOverList(e: React.DragEvent) { e.preventDefault(); setOverId(null); }
  function onDragOverChild(e: React.DragEvent, id: string) { e.preventDefault(); setOverId(id); }

  return { dragId, setDragId, overId, setOverId, onDragStart, onDragOverList, onDragOverChild };
}
