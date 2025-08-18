// File: pim-frontend/src/app/dashboard/features/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FeatureAttributesPage() {
  const supabase = createServerComponentClient({ cookies });

  const { data: attributes, error } = await supabase
    .from('feature_attributes')
    .select('id, code, label, root_feature_id')
    .order('label', { ascending: true })
    .order('code', { ascending: true });

  const typedAttributes = attributes as Array<{
    id: string;
    code: string;
    label: string;
    root_feature_id: string | null;
  }> | null;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Керування Атрибутами</h1>
        <Link
          href="/dashboard/features/new"
          className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Створити атрибут
        </Link>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <caption className="sr-only">Список атрибутів</caption>
            <thead className="border-b bg-gray-50 text-left text-sm font-medium text-gray-500">
              <tr>
                <th scope="col" className="px-6 py-3">Назва (Label)</th>
                <th scope="col" className="px-6 py-3">Код (Code)</th>
                <th scope="col" className="px-6 py-3">Підключений довідник</th>
                <th scope="col" className="px-6 py-3 text-right">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {error && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-sm text-red-600">
                    Помилка завантаження: {error.message}
                  </td>
                </tr>
              )}
              {!error && typedAttributes && typedAttributes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-gray-500">
                    Атрибути відсутні. Створіть перший за допомогою кнопки вище.
                  </td>
                </tr>
              )}
              {!error && typedAttributes && typedAttributes.length > 0 && (
                typedAttributes.map((attr) => (
                  <tr key={attr.id}>
                    <td className="px-6 py-4 font-medium">{attr.label}</td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">{attr.code}</td>
                    <td className="px-6 py-4 text-gray-600">{attr.root_feature_id ? 'Так' : 'Ні'}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/dashboard/features/${attr.id}/edit`} className="text-zinc-700 hover:underline">
                        Редагувати
                      </Link>
                    </td>
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