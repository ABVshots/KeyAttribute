// File: pim-frontend/src/app/dashboard/groups/edit/properties/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const group_id = searchParams.get('group_id');
  if (!group_id) return new Response('bad request', { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', group_id)
    .maybeSingle();
  if (!group) return new Response('Not found', { status: 404 });

  const { data: items } = await supabase
    .from('entity_properties')
    .select('id, key, value_text')
    .eq('organization_id', group.organization_id as string)
    .eq('entity_type', 'group')
    .eq('entity_id', group.id)
    .order('created_at');

  return new Response(JSON.stringify({ items: items ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const group_id = body?.group_id as string | undefined;
  const items = body?.items as Array<{ id?: string; key: string; value_text?: string }> | undefined;
  if (!group_id || !Array.isArray(items)) return new Response('bad request', { status: 400 });

  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', group_id)
    .maybeSingle();
  if (!group) return new Response('Not found', { status: 404 });

  const rows = items.map((it) => ({
    id: it.id,
    organization_id: group.organization_id,
    entity_type: 'group',
    entity_id: group.id,
    key: String(it.key ?? '').trim(),
    value_text: typeof it.value_text === 'string' ? it.value_text : null,
  })).filter(r => r.key.length > 0);

  const toInsert = rows.filter(r => !r.id).map(({ id, ...rest }) => rest);
  const toUpdate = rows.filter(r => r.id) as any[];

  if (toInsert.length > 0) {
    const { error } = await supabase.from('entity_properties').insert(toInsert);
    if (error) return new Response(error.message, { status: 400 });
  }
  if (toUpdate.length > 0) {
    for (const r of toUpdate) {
      const { id, ...rest } = r;
      const { error } = await supabase.from('entity_properties').update(rest).eq('id', id);
      if (error) return new Response(error.message, { status: 400 });
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return new Response('bad request', { status: 400 });

  const { error } = await supabase.from('entity_properties').delete().eq('id', id);
  if (error) return new Response(error.message, { status: 400 });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
