// File: pim-frontend/src/app/dashboard/settings/i18n/new/page.tsx
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createUiTranslation, type ActionState } from '../actions';

export default function NewUiTranslationPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createUiTranslation, {} as ActionState);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Новий переклад UI</h1>
        <Link href="/dashboard/settings/i18n" className="rounded border px-3 py-1 text-sm">Назад</Link>
      </div>

      {state?.error && <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state?.ok && <div className="mb-2 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">{state.ok}</div>}

      <form action={action} className="max-w-lg space-y-3">
        <div>
          <label className="block text-sm">Namespace</label>
          <input name="namespace" required className="mt-1 w-full rounded border px-3 py-2" placeholder="sidebar" />
        </div>
        <div>
          <label className="block text-sm">Key</label>
          <input name="key" required className="mt-1 w-full rounded border px-3 py-2" placeholder="home" />
        </div>
        <div>
          <label className="block text-sm">Locale</label>
          <input name="locale" required className="mt-1 w-full rounded border px-3 py-2" placeholder="uk" />
        </div>
        <div>
          <label className="block text-sm">Value</label>
          <textarea name="value" required className="mt-1 h-32 w-full rounded border px-3 py-2" />
        </div>
        <button disabled={pending} className="rounded bg-zinc-800 px-4 py-2 text-white">Зберегти</button>
      </form>
    </div>
  );
}
