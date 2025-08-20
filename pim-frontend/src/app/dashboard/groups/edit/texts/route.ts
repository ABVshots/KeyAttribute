// File: pim-frontend/src/app/dashboard/groups/edit/texts/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const group_id = searchParams.get('group_id');
  const key = searchParams.get('key') || 'description';
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
    .from('entity_texts')
    .select('id, locale, key, content, sort_order')
    .eq('organization_id', group.organization_id as string)
    .eq('entity_type', 'group')
    .eq('entity_id', group.id)
    .eq('key', key)
    .order('sort_order');

  return new Response(JSON.stringify({ items: items ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const group_id = body?.group_id as string | undefined;
  const key = (body?.key as string | undefined) ?? 'description';
  const items = body?.items as Array<{ id?: string; locale: string | null; content: string; sort_order?: number }> | undefined;
  if (!group_id || !Array.isArray(items)) return new Response('bad request', { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', group_id)
    .maybeSingle();
  if (!group) return new Response('Not found', { status: 404 });

  const rows = items.map((it, idx) => ({
    id: it.id,
    organization_id: group.organization_id,
    entity_type: 'group',
    entity_id: group.id,
    locale: it.locale,
    key,
    content: String(it.content ?? '').trim(),
    sort_order: typeof it.sort_order === 'number' ? it.sort_order : idx,
  }));

  // Upsert by id when present else insert new
  // Separate new vs existing
  const toInsert = rows.filter(r => !r.id);
  const toUpdate = rows.filter(r => r.id);

  if (toInsert.length > 0) {
    const { error } = await supabase.from('entity_texts').insert(toInsert.map(({ id, ...rest }) => rest));
    if (error) return new Response(error.message, { status: 400 });
  }
  if (toUpdate.length > 0) {
    for (const r of toUpdate) {
      const { id, ...rest } = r as any;
      const { error } = await supabase.from('entity_texts').update(rest).eq('id', id);
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

  const { error } = await supabase.from('entity_texts').delete().eq('id', id);
  if (error) return new Response(error.message, { status: 400 });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function PATCH(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const order = body?.order as Array<{ id: string; sort_order: number }> | undefined;
  if (!Array.isArray(order)) return new Response('bad request', { status: 400 });

  for (const o of order) {
    const { error } = await supabase.from('entity_texts').update({ sort_order: o.sort_order }).eq('id', o.id);
    if (error) return new Response(error.message, { status: 400 });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
