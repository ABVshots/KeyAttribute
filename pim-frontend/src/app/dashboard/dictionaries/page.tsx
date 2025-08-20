// File: pim-frontend/src/app/dashboard/dictionaries/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { createDictionary, createRootForType } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DictionariesHub() {
  const supabase = createServerComponentClient({ cookies });

  const { data: types } = await supabase
    .from('group_types')
    .select('id, code, label')
    .order('label');

  const list = (types ?? []).map((t) => ({ id: t.id as string, code: t.code as string, label: (t.label as string) || t.code as string }));

  return (
    <div>
      <h1 className="text-3xl font-bold">KeyFeatures</h1>
      <p className="mt-2 text-gray-500">Довідники та BOM-структури вашої організації</p>

      {/* Create new dictionary */}
      <div className="mt-6 rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Створити новий довідник</h2>
        <form action={createDictionary} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-sm text-gray-600">Назва</label>
            <input name="label" required className="mt-1 w-full rounded border px-3 py-2" placeholder="Напр.: Характеристики" />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm text-gray-600">Код (необов&apos;язково)</label>
            <input name="code" className="mt-1 w-full rounded border px-3 py-2" placeholder="auto з назви" />
          </div>
          <div className="sm:col-span-1 flex items-end justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="create_root" defaultChecked className="h-4 w-4" />
              Створити кореневий вузол
            </label>
            <button className="rounded bg-zinc-800 px-4 py-2 text-sm text-white">Створити</button>
          </div>
        </form>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {list.length === 0 && (
          <div className="rounded border bg-white p-4 text-gray-500">Немає типів довідників</div>
        )}
        {list.map((t) => (
          <div key={t.id} className="rounded-lg border bg-white p-4 shadow">
            <div className="text-sm text-gray-500">Код: {t.code}</div>
            <div className="text-lg font-semibold">{t.label}</div>
            <div className="mt-3 flex items-center gap-2">
              <Link href={`/dashboard/dictionaries/groups/list?type=${encodeURIComponent(t.id)}`} className="rounded border px-3 py-1 text-xs">Відкрити</Link>
              <form action={createRootForType}>
                <input type="hidden" name="type_id" value={t.id} />
                <input type="hidden" name="label" value={t.label} />
                <button className="rounded border px-3 py-1 text-xs">Створити корінь</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
