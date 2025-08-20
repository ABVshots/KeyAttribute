'use client';
import { useState, startTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { importChildrenAction, type ImportActionState } from '../../../actions';

export default function ImportChildrenModal({ parentId, onClose }: { parentId: string; onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [dry, setDry] = useState(true);
  const [state, action, pending] = useActionState<ImportActionState, FormData>(importChildrenAction, {} as ImportActionState);

  function submit(runDry: boolean) {
    const fd = new FormData();
    fd.append('parent_id', parentId);
    fd.append('items', text);
    fd.append('dry_run', runDry ? '1' : '0');
    startTransition(() => { action(fd); });
    if (!runDry) {
      router.refresh();
      onClose();
    }
  }

  const hasDetails = !!state?.details;
  const summary = state?.ok ?? (state?.error ? `Помилка: ${state.error}` : '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Імпорт дочірніх записів</h3>
          <button onClick={onClose} className="text-sm">✕</button>
        </div>
        <p className="mb-2 text-xs text-gray-600">Вставте JSON масив, CSV (перший стовпець name або name_&lt;locale&gt;) або просто список рядків з назвами.</p>
        <textarea value={text} onChange={(e)=>setText(e.target.value)} rows={10} className="w-full rounded border px-2 py-1 text-sm" placeholder='{"items":[{"id":"...","names":{"en":"Item A","pl":"..."}}]}' />
        <div className="mt-2 flex items-center justify-between text-xs">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={dry} onChange={(e)=>setDry(e.target.checked)} /> Dry-run (без змін)</label>
          <div className="text-gray-600">{summary}</div>
        </div>

        {hasDetails && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded border p-2">
              <div className="mb-1 text-xs font-semibold">Буде створено ({state!.details!.create.length})</div>
              <ul className="max-h-40 overflow-auto text-xs text-gray-700">
                {state!.details!.create.map((c, i) => (
                  <li key={`c-${i}`} className="truncate"><span className="text-gray-500">{c.md5}</span> — {c.defaultName}</li>
                ))}
              </ul>
            </div>
            <div className="rounded border p-2">
              <div className="mb-1 text-xs font-semibold">Прилінкуємо за ID ({state!.details!.linkById.length})</div>
              <ul className="max-h-40 overflow-auto text-xs text-gray-700">
                {state!.details!.linkById.map((l, i) => (
                  <li key={`id-${i}`} className="truncate"><span className="text-gray-500">{l.id}</span> — {l.defaultName}</li>
                ))}
              </ul>
            </div>
            <div className="rounded border p-2">
              <div className="mb-1 text-xs font-semibold">Прилінкуємо за MD5 ({state!.details!.linkByMd5.length})</div>
              <ul className="max-h-40 overflow-auto text-xs text-gray-700">
                {state!.details!.linkByMd5.map((l, i) => (
                  <li key={`md5-${i}`} className="truncate"><span className="text-gray-500">{l.md5}</span> → <span className="text-gray-500">{l.matchedId}</span> — {l.defaultName}</li>
                ))}
              </ul>
            </div>
            <div className="rounded border p-2">
              <div className="mb-1 text-xs font-semibold">Оновимо переклади ({state!.details!.updateTranslations.length})</div>
              <ul className="max-h-40 overflow-auto text-xs text-gray-700">
                {state!.details!.updateTranslations.map((u, i) => (
                  <li key={`tr-${i}`} className="truncate"><span className="text-gray-500">{u.id}</span> — {u.defaultName}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-1 text-xs">Скасувати</button>
          {dry ? (
            <button onClick={()=>submit(true)} disabled={pending || !text.trim()} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{pending?'Перевірка…':'Перевірити'}</button>
          ) : (
            <button onClick={()=>submit(false)} disabled={pending || !text.trim()} className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-60">{pending?'Імпорт…':'Імпортувати'}</button>
          )}
          {hasDetails && (
            <button onClick={()=>submit(false)} disabled={pending} className="rounded bg-green-700 px-3 py-1 text-xs text-white disabled:opacity-60">Застосувати</button>
          )}
        </div>
      </div>
    </div>
  );
}
