// File: pim-frontend/src/app/dashboard/groups/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GroupsPage() {
  const supabase = createServerComponentClient({ cookies });

  // Завантажуємо групи та пов'язані з ними типи
  const { data: groups, error } = await supabase
    .from('groups')
    .select(`
      id,
      name,
      group_types ( label )
    `)
    .order('created_at', { ascending: false });

  const typedGroups = groups as Array<{
    id: string;
    name: string;
    group_types: { label: string } | null;
  }> | null;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Керування Групами</h1>
        <Link
          href="/dashboard/groups/new"
          className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Додати групу
        </Link>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <caption className="sr-only">Список груп</caption>
            <thead className="border-b bg-gray-50 text-left text-sm font-medium text-gray-500">
              <tr>
                <th scope="col" className="px-6 py-3">Назва Групи</th>
                <th scope="col" className="px-6 py-3">Тип</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {error && (
                <tr>
                  <td colSpan={2} className="p-4 text-sm text-red-600">{error.message}</td>
                </tr>
              )}
              {!error && typedGroups && typedGroups.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-gray-500">У вас ще немає жодної групи.</td>
                </tr>
              )}
              {!error && typedGroups && typedGroups.length > 0 && (
                typedGroups.map((group) => (
                  <tr key={group.id}>
                    <td className="px-6 py-4 font-medium">{group.name}</td>
                    <td className="px-6 py-4 text-gray-600">{group.group_types?.label ?? '—'}</td>
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