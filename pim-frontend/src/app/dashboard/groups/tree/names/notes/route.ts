// File: pim-frontend/src/app/dashboard/groups/tree/names/notes/route.ts
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

  const { data: notes } = await supabase
    .from('entity_notes')
    .select('id, locale, kind, content, created_at, sort_order')
    .eq('organization_id', group.organization_id as string)
    .eq('entity_type', 'group')
    .eq('entity_id', group.id)
    .order('sort_order');

  return new Response(JSON.stringify({ notes: notes ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const group_id = body?.group_id as string | undefined;
  const content = body?.content as string | undefined;
  if (!group_id || !content) return new Response('bad request', { status: 400 });

  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', group_id)
    .maybeSingle();
  if (!group) return new Response('Not found', { status: 404 });

  const { error } = await supabase
    .from('entity_notes')
    .insert({ organization_id: group.organization_id, entity_type: 'group', entity_id: group.id, content, kind: 'note' });
  if (error) return new Response(error.message, { status: 400 });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return new Response('bad request', { status: 400 });
  const { error } = await supabase.from('entity_notes').delete().eq('id', id);
  if (error) return new Response(error.message, { status: 400 });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function PUT(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const id = body?.id as string | undefined;
  const content = body?.content as string | undefined;
  if (!id || typeof content !== 'string') return new Response('bad request', { status: 400 });
  const { error } = await supabase.from('entity_notes').update({ content }).eq('id', id);
  if (error) return new Response(error.message, { status: 400 });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function PATCH(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const group_id = body?.group_id as string | undefined;
  const order = body?.order as Array<{ id: string; sort_order: number }> | undefined;
  if (!group_id || !Array.isArray(order)) return new Response('bad request', { status: 400 });

  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', group_id)
    .maybeSingle();
  if (!group) return new Response('Not found', { status: 404 });

  for (const o of order) {
    await supabase.from('entity_notes').update({ sort_order: o.sort_order }).eq('id', o.id);
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
