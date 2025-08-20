'use client';
import { useState } from 'react';
import type { Child } from './types';

export default function ExportChildrenModal({ parentId, children, onClose }: { parentId: string; children: Child[]; onClose: () => void }) {
  const [format, setFormat] = useState<'csv' | 'json' | 'jsonLocales'>('csv');
  const [includeHeader, setIncludeHeader] = useState(true);

  function download() {
    if (format === 'jsonLocales') {
      // Fetch JSON with locales from API and download
      fetch(`/dashboard/groups/children/export?parent_id=${encodeURIComponent(parentId)}`, { cache: 'no-store' })
        .then(async (res) => {
          if (!res.ok) throw new Error('export_failed');
          const data = await res.json();
          const content = JSON.stringify(data, null, 2);
          const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `children-${parentId}-locales.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          onClose();
        })
        .catch(() => alert('Не вдалося експортувати'));
      return;
    }
    let content = '';
    let mime = 'text/plain;charset=utf-8';
    let filename = `children-${parentId}.${format}`;
    if (format === 'json') {
      content = JSON.stringify(children.map(c => ({ id: c.id, name: c.name })), null, 2);
      mime = 'application/json;charset=utf-8';
    } else {
      const rows = children.map(c => `${JSON.stringify(c.id)},${JSON.stringify(c.name)}`);
      content = includeHeader ? `id,name\n${rows.join('\n')}` : rows.join('\n');
      mime = 'text/csv;charset=utf-8';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Експорт дочірніх записів</h3>
          <button onClick={onClose} className="text-sm">✕</button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="mr-3 inline-flex items-center gap-2">
              <input type="radio" name="fmt" checked={format==='csv'} onChange={()=>setFormat('csv')} /> CSV
            </label>
            <label className="mr-3 inline-flex items-center gap-2">
              <input type="radio" name="fmt" checked={format==='json'} onChange={()=>setFormat('json')} /> JSON (простий)
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="fmt" checked={format==='jsonLocales'} onChange={()=>setFormat('jsonLocales')} /> JSON (з локалями)
            </label>
          </div>
          {format==='csv' && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={includeHeader} onChange={(e)=>setIncludeHeader(e.target.checked)} /> Додати заголовок (id,name)
            </label>
          )}
          <p className="text-xs text-gray-600">Експортується лише поточний список дочірніх вузлів.</p>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-1 text-xs">Скасувати</button>
          <button onClick={download} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white">Завантажити</button>
        </div>
      </div>
    </div>
  );
}
