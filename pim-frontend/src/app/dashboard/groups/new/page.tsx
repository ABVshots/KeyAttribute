// File: pim-frontend/src/app/dashboard/groups/new/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { createGroup } from '../actions';
import SubmitButton from '../../items/new/SubmitButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function tS(k: string, _p?: Record<string, any>, o?: { fallback?: string }) { return o?.fallback || k; }

export default async function NewGroupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

  const sp = (await searchParams) ?? {};
  const qpError = typeof sp.error === 'string' ? sp.error : undefined;
  const qpMessage = typeof sp.message === 'string' ? sp.message : undefined;

  return (
    <div>
      <h1 className="text-3xl font-bold">{tS('groups.new.title', undefined, { fallback: 'Нова група' })}</h1>

      {(qpError || gtError || pgError) && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {qpMessage || tS('groups.new.loadError', undefined, { fallback: 'Сталася помилка завантаження даних. Спробуйте ще раз.' })}
        </div>
      )}

      <form
        action={createGroup}
        className="mt-8 max-w-lg rounded-lg border bg-white p-8 shadow-sm"
      >
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">{tS('groups.new.nameLabel', undefined, { fallback: 'Назва групи' })}</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              pattern=".{1,120}"
              title={tS('groups.new.nameTitle', undefined, { fallback: 'Від 1 до 120 символів' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="type_id" className="block text-sm font-medium text-gray-700">{tS('groups.new.typeLabel', undefined, { fallback: 'Тип групи' })}</label>
            <select
              id="type_id"
              name="type_id"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
              defaultValue=""
            >
              <option value="" disabled>{tS('groups.new.typePlaceholder', undefined, { fallback: 'Оберіть тип...' })}</option>
              {groupTypes?.map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="parent_id" className="block text-sm font-medium text-gray-700">{tS('groups.new.parentLabel', undefined, { fallback: 'Батьківська група (опціонально)' })}</label>
            <select
              id="parent_id"
              name="parent_id"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
              defaultValue=""
            >
              <option value="">{tS('groups.new.parentNone', undefined, { fallback: 'Немає' })}</option>
              {parentGroups?.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <Link href="/dashboard/groups" className="rounded-lg border bg-white px-5 py-2 text-sm">{tS('common.cancel', undefined, { fallback: 'Скасувати' })}</Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}