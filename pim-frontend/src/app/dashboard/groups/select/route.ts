// File: pim-frontend/src/app/dashboard/groups/select/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const group_id = searchParams.get('group_id') || '';
  const q = searchParams.get('q') || '';

  const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  if (!UUID_RE.test(group_id)) return new Response('bad request', { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const { data: ctx } = await supabase.from('groups').select('id, organization_id, type_id').eq('id', group_id).maybeSingle();
  if (!ctx) return new Response('not_found', { status: 404 });

  let qb = supabase
    .from('groups')
    .select('id, name, parent_id')
    .eq('organization_id', (ctx as any).organization_id)
    .eq('type_id', (ctx as any).type_id)
    .neq('id', group_id)
    .neq('parent_id', group_id)
    .order('name')
    .limit(50);

  if (q) qb = qb.ilike('name', `%${q}%`);

  const { data, error } = await qb;
  if (error) return new Response(error.message, { status: 400 });

  return new Response(JSON.stringify({ items: data ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
