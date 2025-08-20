// File: pim-frontend/src/app/dashboard/groups/[id]/edit/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import EditorTabs from './EditorTabs';
import DeleteGroupForm from './DeleteGroupForm';
import ChildrenPanel from './ChildrenPanel';
import PathPanel from './PathPanel';
import { createChildGroup } from '../../actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getGroupChain(supabase: any, id: string) {
  const chain: Array<{ id: string; name: string }> = [];
  let cursor: string | null = id;
  const maxDepth = 20;
  for (let i = 0; i < maxDepth && cursor; i++) {
    const { data: g } = await supabase.from('groups').select('id, name, parent_id').eq('id', cursor).maybeSingle();
    if (!g) break;
    chain.unshift({ id: g.id as string, name: (g.name as string) || '—' });
    cursor = (g as any).parent_id as string | null;
  }
  return chain;
}

export default async function GroupEditorPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies });
  const groupId = params.id;

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, parent_id, organization_id')
    .eq('id', groupId)
    .maybeSingle();

  if (!group) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Редактор групи</h1>
          <Link href="/dashboard/groups/tree" className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">До дерева</Link>
        </div>
        <p className="text-gray-500">Групу не знайдено.</p>
      </div>
    );
  }

  const [chain, childrenRes, siblingsRes] = await Promise.all([
    getGroupChain(supabase, groupId),
    supabase.from('groups').select('id, name').eq('parent_id', group.id as string).order('name'),
    (group as any).parent_id ? supabase.from('groups').select('id, name').eq('parent_id', (group as any).parent_id as string).order('name') : Promise.resolve({ data: [] as any }),
  ]);

  const children = (childrenRes.data ?? []) as Array<{ id: string; name: string }>;
  const siblings = (siblingsRes as any).data as Array<{ id: string; name: string }>;

  return (
    <div className="flex min-h-[70vh] gap-4">
      {/* Left panel: breadcrumbs + siblings with DnD */}
      <PathPanel groupId={groupId} parentId={(group as any).parent_id as string | null} chain={chain} siblings={siblings} />
      
      {/* Center panel: tabs */}
      <main className="flex-1 rounded-lg border bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{(group.name as string) || 'Без назви'}</h1>
          <Link href="/dashboard/groups/tree" className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">До дерева</Link>
        </div>
        <EditorTabs groupId={groupId} />

        {/* Delete control at the very bottom, simplified visuals */}
        <div className="mt-10 max-w-xs">
          <DeleteGroupForm id={group.id as string} disabled={children.length > 0} hint={children.length > 0 ? 'Спочатку видаліть або перемістіть дочірні вузли' : undefined} />
          <p className="mt-1 text-[11px] text-gray-500">Можна видалити лише якщо немає дочірніх вузлів.</p>
        </div>
      </main>

      {/* Right panel: children with DnD */}
      <aside className="w-64 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">Вкладення</h2>
        <ChildrenPanel groupId={group.id as string} parentId={(group as any).parent_id as string | null} children={children} />

        {/* Quick add child */}
        <div className="mt-4 rounded border p-2">
          <form action={createChildGroup} className="space-y-2">
            <input type="hidden" name="parent_id" value={group.id as string} />
            <input name="name" required className="w-full rounded border px-2 py-1 text-sm" placeholder="Назва дочірнього вузла" />
            <button className="w-full rounded bg-zinc-800 px-3 py-1 text-xs text-white">+ Додати</button>
          </form>
        </div>
      </aside>
    </div>
  );
}
