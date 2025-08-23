// File: pim-frontend/src/app/dashboard/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import SearchComponent from './SearchComponent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Dashboard' };

function tS(k: string, _p?: Record<string, any>, o?: { fallback?: string }) { return o?.fallback || k; }

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: items, error } = await supabase
    .from('items')
    .select('id, sku, title, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  const typedItems = items as Array<{ id: string; sku: string; title: string }> | null;

  return (
    <div>
      <h1 className="text-3xl font-bold">{tS('dashboard.title', undefined, { fallback: 'Вітаємо на головній панелі!' })}</h1>
      <p className="mt-2 text-gray-600">{tS('dashboard.yourEmail', { email: user?.email || '' }, { fallback: `Ваш email: ${user?.email || ''}` })}</p>

      <div className="mt-8">
        <SearchComponent />
      </div>

      <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">{tS('dashboard.items.title', undefined, { fallback: 'Ваші товари' })}</h2>
        {error && <p className="text-red-500">{tS('dashboard.items.loadError', { msg: error.message }, { fallback: `Помилка завантаження: ${error.message}` })}</p>}
        {typedItems && typedItems.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {typedItems.map((item) => (
              <li key={item.id} className="rounded border p-3">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-gray-500">{tS('dashboard.items.sku', { sku: item.sku }, { fallback: `SKU: ${item.sku}` })}</p>
              </li>
            ))}
          </ul>
        ) : !error ? (
          <p className="mt-4 text-gray-500">{tS('dashboard.items.empty', undefined, { fallback: 'У вас ще немає жодного товару.' })}</p>
        ) : null}
      </div>
    </div>
  );
}