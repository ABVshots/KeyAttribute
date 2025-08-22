import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // get organizations where user is a member
  const { data: mems } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id);
  const ids = (mems||[]).map((m:any)=> m.organization_id as string);
  if (ids.length === 0) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  // Try select id and name if exists
  let orgs: any[] = [];
  const q = await supabase.from('organizations').select('*').in('id', ids);
  if (!q.error) orgs = q.data||[]; else orgs = ids.map((id)=>({ id, name: id }));

  const items = orgs.map((o:any)=> ({ id: o.id, name: o.name || o.slug || o.id }));
  return new Response(JSON.stringify({ items }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
