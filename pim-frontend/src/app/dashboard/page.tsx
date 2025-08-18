// File: pim-frontend/src/app/dashboard/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import SearchComponent from './SearchComponent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Завантажуємо перші 10 товарів, від нових до старих, лише потрібні поля
  const { data: items, error } = await supabase
    .from('items')
    .select('id, sku, title, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  // Невелика допоміжна типізація для відображення
  const typedItems = items as Array<{ id: string; sku: string; title: string }> | null;

  return (
    <div>
      <h1 className="text-3xl font-bold">Вітаємо на головній панелі!</h1>
      <p className="mt-2 text-gray-600">Ваш email: {user?.email}</p>

      <div className="mt-8">
        <SearchComponent />
      </div>

      <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Ваші товари</h2>
        {error && <p className="text-red-500">Помилка завантаження: {error.message}</p>}
        {typedItems && typedItems.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {typedItems.map((item) => (
              <li key={item.id} className="rounded border p-3">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-gray-500">SKU: {item.sku}</p>
              </li>
            ))}
          </ul>
        ) : !error ? (
          <p className="mt-4 text-gray-500">У вас ще немає жодного товару.</p>
        ) : null}
      </div>
    </div>
  );
}