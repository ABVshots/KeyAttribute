// File: pim-frontend/src/app/dashboard/groups/tree/names/media/route.ts
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

  const { data } = await supabase
    .from('entity_media')
    .select('media_id, role, media(url)')
    .eq('organization_id', group.organization_id as string)
    .eq('entity_type', 'group')
    .eq('entity_id', group.id)
    .eq('role', 'cover')
    .maybeSingle();

  const url = (data as any)?.media?.url as string | undefined;
  return new Response(JSON.stringify({ cover_url: url ?? null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const group_id = body?.group_id as string | undefined;
  const url = body?.url as string | undefined;
  if (!group_id || !url) return new Response('bad request', { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', group_id)
    .maybeSingle();
  if (!group) return new Response('Not found', { status: 404 });

  // Upsert media and link
  const { data: media, error: mErr } = await supabase
    .from('media')
    .upsert({ organization_id: group.organization_id, url, kind: 'image' }, { onConflict: 'url' })
    .select('id')
    .single();
  if (mErr) return new Response(mErr.message, { status: 400 });

  await supabase
    .from('entity_media')
    .upsert({ organization_id: group.organization_id, entity_type: 'group', entity_id: group.id, media_id: (media as any).id, role: 'cover' });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
