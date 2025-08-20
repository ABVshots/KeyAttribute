// File: pim-frontend/src/app/dashboard/groups/tree/children/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ nodes: [] }, { headers: { 'Cache-Control': 'no-store' } });

  const supabase = createRouteHandlerClient({ cookies });

  // Resolve org/type for this node
  const { data: g } = await supabase
    .from('groups')
    .select('id, organization_id, type_id')
    .eq('id', id)
    .maybeSingle();
  if (!g) return NextResponse.json({ nodes: [] }, { headers: { 'Cache-Control': 'no-store' } });

  // Read children via group_links
  const { data: links } = await supabase
    .from('group_links')
    .select('child:groups!group_links_child_id_fkey(id, name)')
    .eq('organization_id', g.organization_id as string)
    .eq('type_id', g.type_id as string)
    .eq('parent_id', g.id as string)
    .order('name', { foreignTable: 'child' });

  let nodes = (links ?? []).map((r: any) => ({ id: r.child?.id as string, name: (r.child?.name as string) || '' })).filter((n: any) => n.id);

  // Fallback to legacy parent_id linkage if no N:N links yet
  if (!nodes || nodes.length === 0) {
    const { data: legacy } = await supabase
      .from('groups')
      .select('id, name')
      .eq('parent_id', g.id as string)
      .order('name');
    nodes = (legacy ?? []) as any;
  }

  return NextResponse.json({ nodes }, { headers: { 'Cache-Control': 'no-store' } });
}
