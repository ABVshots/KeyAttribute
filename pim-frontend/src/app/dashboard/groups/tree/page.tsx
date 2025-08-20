// File: pim-frontend/src/app/dashboard/groups/tree/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import TreeClient from './TreeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server loader for top-level categories of type cartum_category
async function loadRoot() {
  const supabase = createServerComponentClient({ cookies });
  const { data: type } = await supabase
    .from('group_types')
    .select('id')
    .eq('code', 'cartum_category')
    .maybeSingle();

  if (!type) return { nodes: [] as any[] };

  const { data: nodes } = await supabase
    .from('groups')
    .select('id, name')
    .eq('type_id', type.id)
    .is('parent_id', null)
    .order('name');
  return { nodes: nodes ?? [] };
}

export default async function TreePage() {
  const { nodes } = await loadRoot();
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Структура сторінок (Cartum)</h1>
        <Link href="/dashboard/integrations" className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">Назад до інтеграцій</Link>
      </div>

      {nodes.length === 0 ? (
        <p className="text-gray-500">Кореневих сторінок не знайдено.</p>
      ) : (
        <TreeClient roots={nodes as Array<{ id: string; name: string }>} />
      )}
    </div>
  );
}
