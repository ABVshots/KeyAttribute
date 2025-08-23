// File: pim-frontend/src/app/dashboard/dictionaries/groups/tree/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import TreeClient from '../../../groups/tree/TreeClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function tS(k: string, _p?: Record<string, any>, o?: { fallback?: string }) { return o?.fallback || k; }

export default async function DictTreePage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const supabase = createServerComponentClient({ cookies });
  const sp = (await searchParams) || {};
  let typeId = sp.type || '';

  if (!typeId) {
    const { data: types } = await supabase.from('group_types').select('id').order('label').limit(1);
    if (types && types[0]?.id) {
      redirect(`/dashboard/dictionaries/groups/tree?type=${encodeURIComponent(types[0].id as string)}`);
    }
  }

  if (!typeId) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{tS('dictionaries.tree.title', undefined, { fallback: 'Tree' })}</h1>
          <Link href="/dashboard/dictionaries" className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">{tS('dictionaries.back', undefined, { fallback: 'До довідників' })}</Link>
        </div>
        <p className="text-gray-500">{tS('dictionaries.tree.noType', undefined, { fallback: 'Не вказано type.' })}</p>
      </div>
    );
  }

  const { data: type } = await supabase.from('group_types').select('id, label').eq('id', typeId).maybeSingle();

  const { data: allOfType } = await supabase.from('groups').select('id').eq('type_id', typeId);
  const typeIds = (allOfType ?? []).map((g: any) => g.id as string);

  let roots: Array<{ id: string; name: string }> = [];
  if (typeIds.length > 0) {
    const { data: childrenLinks } = await supabase
      .from('group_links')
      .select('child_id')
      .eq('type_id', typeId)
      .in('child_id', typeIds);
    const childSet = new Set<string>((childrenLinks ?? []).map((l: any) => l.child_id as string));

    const candidates = typeIds.filter((id) => !childSet.has(id));
    if (candidates.length > 0) {
      const { data: rootRows } = await supabase.from('groups').select('id, name').in('id', candidates).order('name');
      roots = (rootRows ?? []) as Array<{ id: string; name: string }>;
    }
  }
  if (roots.length === 0) {
    const { data: legacy } = await supabase.from('groups').select('id, name').eq('type_id', typeId).is('parent_id', null).order('name');
    roots = (legacy ?? []) as Array<{ id: string; name: string }>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{type?.label ? `${tS('dictionaries.tree.title', undefined, { fallback: 'Tree' })} — ${type.label}` : tS('dictionaries.tree.title', undefined, { fallback: 'Tree' })}</h1>
        <Link href="/dashboard/dictionaries" className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">{tS('dictionaries.back', undefined, { fallback: 'До довідників' })}</Link>
      </div>
      {roots.length === 0 ? (
        <p className="text-gray-500">{tS('dictionaries.tree.noRoots', undefined, { fallback: 'Кореневих елементів не знайдено.' })}</p>
      ) : (
        <TreeClient roots={roots} />
      )}
    </div>
  );
}
