// File: pim-frontend/src/app/dashboard/groups/new/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { createGroup } from '../actions';
import SubmitButton from '../../items/new/SubmitButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NewGroupPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const supabase = createServerComponentClient({ cookies });

  // Завантажуємо типи груп та існуючі групи для селектів (відсортовано)
  const { data: groupTypes, error: gtError } = await supabase
    .from('group_types')
    .select('id, label')
    .order('label', { ascending: true })
    .limit(200);

  const { data: parentGroups, error: pgError } = await supabase
    .from('groups')
    .select('id, name')
    .order('name', { ascending: true })
    .limit(200);

  const qpError = typeof searchParams?.error === 'string' ? searchParams?.error : undefined;
  const qpMessage = typeof searchParams?.message === 'string' ? searchParams?.message : undefined;

  return (
    <div>
      <h1 className="text-3xl font-bold">Нова група</h1>

      {(qpError || gtError || pgError) && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {qpMessage || 'Сталася помилка завантаження даних. Спробуйте ще раз.'}
        </div>
      )}

      <form
        action={createGroup}
        className="mt-8 max-w-lg rounded-lg border bg-white p-8 shadow-sm"
      >
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Назва групи</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              pattern=".{1,120}"
              title="Від 1 до 120 символів"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="type_id" className="block text-sm font-medium text-gray-700">Тип групи</label>
            <select
              id="type_id"
              name="type_id"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
              defaultValue=""
            >
              <option value="" disabled>Оберіть тип...</option>
              {groupTypes?.map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="parent_id" className="block text-sm font-medium text-gray-700">Батьківська група (опціонально)</label>
            <select
              id="parent_id"
              name="parent_id"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
              defaultValue=""
            >
              <option value="">Немає</option>
              {parentGroups?.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <Link href="/dashboard/groups" className="rounded-lg border bg-white px-5 py-2 text-sm">Скасувати</Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}