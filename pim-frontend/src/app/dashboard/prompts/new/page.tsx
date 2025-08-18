// File: pim-frontend/src/app/dashboard/prompts/new/page.tsx
import Link from 'next/link';
import { createPrompt } from '../actions';
import SubmitButton from './SubmitButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NewPromptPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const qpError = typeof sp.error === 'string' ? sp.error : undefined;
  const qpMessage = typeof sp.message === 'string' ? sp.message : undefined;

  return (
    <div>
      <h1 className="text-3xl font-bold">Новий AI Промт</h1>

      {(qpError) && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {qpMessage || 'Сталася помилка. Перевірте поля та спробуйте ще раз.'}
        </div>
      )}

      <form action={createPrompt} className="mt-8 max-w-2xl rounded-lg border bg-white p-8 shadow-sm">
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Назва промту</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={120}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="template" className="block text-sm font-medium text-gray-700">Шаблон (Промт)</label>
            <textarea
              id="template"
              name="template"
              required
              rows={10}
              className="mt-1 block w-full rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
              placeholder="Напр.: Створи SEO-опис для товару '{{title}}' з характеристиками: {{attributes}}..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Підтримуються плейсхолдери: <code className="rounded bg-gray-100 px-1">{'{{title}}'}</code>, <code className="rounded bg-gray-100 px-1">{'{{attributes}}'}</code>, інші — за вашою логікою.
            </p>
          </div>
          <div>
            <label htmlFor="target_field" className="block text-sm font-medium text-gray-700">Цільове поле (опціонально)</label>
            <input
              id="target_field"
              name="target_field"
              type="text"
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              placeholder="Наприклад, description"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
            />
          </div>
        </div>
        <div className="mt-8 flex justify-end space-x-4">
          <Link href="/dashboard/prompts" className="rounded-lg border bg-white px-5 py-2 text-sm">Скасувати</Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}