// File: pim-frontend/src/app/dashboard/features/new/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { createFeatureAttribute } from '../actions';
import SubmitButton from './SubmitButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NewFeatureAttributePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = createServerComponentClient({ cookies });

  // Завантажуємо довідники (value sets) для випадаючого списку
  const { data: valueSets, error: vsError } = await supabase
    .from('features')
    .select('id, name')
    .eq('feature_type', 'value_set')
    .order('name');

  const sp = (await searchParams) ?? {};
  const qpMessage = typeof sp.message === 'string' ? sp.message : undefined;
  const qpError = typeof sp.error === 'string' ? sp.error : undefined;

  return (
    <div>
      <h1 className="text-3xl font-bold">Новий атрибут</h1>

      {(qpError || vsError) && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {qpMessage || 'Сталася помилка. Спробуйте ще раз.'}
        </div>
      )}

      <form
        action={createFeatureAttribute}
        className="mt-8 max-w-lg rounded-lg border bg-white p-8 shadow-sm"
      >
        <div className="space-y-6">
          <div>
            <label htmlFor="label" className="block text-sm font-medium text-gray-700">Назва (Label)</label>
            <input
              id="label"
              name="label"
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="Наприклад, Тип напою"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">Код (Code)</label>
            <input
              id="code"
              name="code"
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              pattern="[A-Za-z0-9._-]{1,64}"
              title="Літери/цифри/._- до 64 символів"
              placeholder="Наприклад, BEVERAGE_TYPE"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="root_feature_id" className="block text-sm font-medium text-gray-700">Довідник значень (опціонально)</label>
            <select
              id="root_feature_id"
              name="root_feature_id"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-зinc-500"
              defaultValue=""
            >
              <option value="">Немає</option>
              {valueSets?.map((set) => (
                <option key={set.id} value={set.id}>{set.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <Link href="/dashboard/features" className="rounded-lg border bg-white px-5 py-2 text-sm">Скасувати</Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}