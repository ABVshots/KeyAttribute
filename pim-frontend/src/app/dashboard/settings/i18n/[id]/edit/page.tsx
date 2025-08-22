// File: pim-frontend/src/app/dashboard/settings/i18n/[id]/edit/page.tsx
'use client';

import React, { useEffect, useState, useActionState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateUiTranslation, deleteUiTranslation, type ActionState } from '../../actions';

export default function EditUiTranslationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const idNum = Number(id);
  const [row, setRow] = useState<{ id: number; namespace: string; key: string; locale: string; value: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [stateU, actionU, pendingU] = useActionState<ActionState, FormData>(updateUiTranslation, {} as ActionState);
  const [stateD, actionD, pendingD] = useActionState<ActionState, FormData>(deleteUiTranslation, {} as ActionState);
  const router = useRouter();
  const [submittedDelete, setSubmittedDelete] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/i18n/ui?id=${encodeURIComponent(String(idNum))}`, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setRow(d.row || null);
      } else {
        setRow(null);
      }
      setLoaded(true);
    }
    if (idNum) load();
  }, [idNum]);

  useEffect(() => {
    if (submittedDelete) {
      const t = setTimeout(() => router.replace('/dashboard/settings/i18n'), 200);
      return () => clearTimeout(t);
    }
  }, [submittedDelete, router]);

  if (!loaded) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Редагування UI перекладу</h1>
          <Link href="/dashboard/settings/i18n" className="rounded border px-3 py-1 text-sm">Назад</Link>
        </div>
        <p className="text-gray-500">Завантаження…</p>
      </div>
    );
  }

  if (loaded && !row) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Редагування UI перекладу</h1>
          <Link href="/dashboard/settings/i18n" className="rounded border px-3 py-1 text-sm">Назад</Link>
        </div>
        <div className="rounded border bg-white p-4">
          <p className="text-gray-600">Запис не знайдено.</p>
          <div className="mt-3 flex gap-2">
            <Link href="/dashboard/settings/i18n" className="rounded border px-3 py-1 text-sm">До списку</Link>
            <Link href="/dashboard/settings/i18n/new" className="rounded bg-zinc-800 px-3 py-1 text-sm text-white">+ Додати</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Редагування UI перекладу</h1>
        <Link href="/dashboard/settings/i18n" className="rounded border px-3 py-1 text-sm">Назад</Link>
      </div>

      {stateU?.error && <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{stateU.error}</div>}
      {stateU?.ok && <div className="mb-2 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">{stateU.ok}</div>}

      <div className="max-w-lg space-y-3">
        <form action={actionU} className="space-y-3">
          <input type="hidden" name="id" value={row!.id} />
          <div>
            <label className="block text-sm">Namespace</label>
            <input value={row!.namespace} disabled className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm">Key</label>
            <input value={row!.key} disabled className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm">Locale</label>
            <input value={row!.locale} disabled className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm">Value</label>
            <textarea name="value" defaultValue={row!.value} required className="mt-1 h-40 w-full rounded border px-3 py-2" />
          </div>
          <div className="flex gap-2">
            <button disabled={pendingU} className="rounded bg-zinc-800 px-4 py-2 text-white">Зберегти</button>
          </div>
        </form>
        <form
          action={actionD}
          onSubmit={(e)=>{ if(!confirm('Видалити запис?')) { e.preventDefault(); return; } setSubmittedDelete(true); }}
        >
          <input type="hidden" name="id" value={row!.id} />
          <button disabled={pendingD || submittedDelete} className="rounded border px-4 py-2">
            {pendingD || submittedDelete ? 'Видалення…' : 'Видалити'}
          </button>
        </form>
      </div>
    </div>
  );
}
