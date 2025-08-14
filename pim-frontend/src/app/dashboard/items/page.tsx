// File: pim-frontend/src/app/dashboard/items/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ItemsPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: items, error } = await supabase
    .from('items')
    .select('id, sku, title, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const typedItems = items as Array<{ id: string; sku: string; title: string }> | null;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Керування Товарами</h1>
        {/* Посилання на створення нового товару */}
        <Link
          href="/dashboard/items/new"
          className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Додати товар
        </Link>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <caption className="sr-only">Список товарів</caption>
            <thead className="border-b bg-gray-50 text-left text-sm font-medium text-gray-500">
              <tr>
                <th scope="col" className="px-6 py-3">Назва</th>
                <th scope="col" className="px-6 py-3">SKU</th>
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
              {!error && typedItems && typedItems.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-gray-500">
                    У вас ще немає жодного товару.
                  </td>
                </tr>
              )}
              {!error && typedItems && typedItems.length > 0 && (
                typedItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 font-medium">{item.title}</td>
                    <td className="px-6 py-4 text-gray-600">{item.sku}</td>
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