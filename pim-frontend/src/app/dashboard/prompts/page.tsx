// File: pim-frontend/src/app/dashboard/prompts/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PromptsPage() {
  const supabase = createServerComponentClient({ cookies });

  const { data: prompts, error } = await supabase
    .from('ai_prompts')
    .select('id, name, target_field')
    .order('name', { ascending: true });

  const typedPrompts = prompts as Array<{ id: string; name: string; target_field: string | null }> | null;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Керування AI Промтами</h1>
        <Link
          href="/dashboard/prompts/new"
          className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Створити промт
        </Link>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <caption className="sr-only">Список AI-промтів</caption>
            <thead className="border-b bg-gray-50 text-left text-sm font-medium text-gray-500">
              <tr>
                <th scope="col" className="px-6 py-3">Назва</th>
                <th scope="col" className="px-6 py-3">Цільове поле</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {error && (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-sm text-red-600">
                    Помилка завантаження: {error.message}
                  </td>
                </tr>
              )}
              {!error && typedPrompts && typedPrompts.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-gray-500">
                    Промти відсутні. Створіть перший за допомогою кнопки вище.
                  </td>
                </tr>
              )}
              {!error && typedPrompts && typedPrompts.length > 0 && (
                typedPrompts.map((prompt) => (
                  <tr key={prompt.id}>
                    <td className="px-6 py-4 font-medium">{prompt.name}</td>
                    <td className="px-6 py-4 text-gray-600">{prompt.target_field || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}