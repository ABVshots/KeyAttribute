'use client';

import { useActionState, useState } from 'react';
import { importUiTranslations, type ImportState } from './actions';

export default function ImportBox() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importUiTranslations, {} as ImportState);
  const [dry, setDry] = useState(false);
  const [text, setText] = useState('');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    setText(t);
  }

  return (
    <form action={(fd)=>{ fd.set('dry_run', dry ? '1' : '0'); return action(fd); }} className="space-y-2 text-sm">
      {state?.error && <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{state.error}</div>}
      {state?.ok && <div className="rounded border border-green-200 bg-green-50 p-2 text-xs text-green-700">{state.ok}</div>}
      <div className="flex items-center gap-2">
        <input type="file" accept=".json,.csv" onChange={onFile} className="text-xs" />
        <span className="text-xs text-gray-500">JSON масив/вкладений або CSV (namespace,key,locale,value чи namespace,key,en,uk,...)</span>
      </div>
      <textarea name="payload" required className="h-40 w-full rounded border p-2 font-mono" placeholder='[{"namespace":"sidebar","key":"home","locale":"uk","value":"Головна"}] або {"sidebar": {"home": {"uk":"Головна"}}}' value={text} onChange={(e)=>setText(e.target.value)} />
      <label className="flex items-center gap-2"><input type="checkbox" checked={dry} onChange={(e)=>setDry(e.target.checked)} /> Dry‑run</label>
      {state?.details && (
        <div className="rounded border p-2">
          <div className="mb-1 text-xs">Створення: {state.details.created}, Оновлення: {state.details.updated}</div>
          <div className="max-h-40 overflow-auto">
            <ul className="text-xs">
              {state.details.items.slice(0,50).map((x,i)=>(<li key={i}>{x.op} · {x.namespace}.{x.key} [{x.locale}]</li>))}
            </ul>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={()=>setText('')} className="rounded border px-3 py-1">Очистити</button>
        <button disabled={pending} className="rounded bg-zinc-800 px-3 py-1 text-white">{pending ? (dry ? 'Перевірка…' : 'Імпорт…') : (dry ? 'Перевірити' : 'Імпортувати')}</button>
      </div>
    </form>
  );
}
