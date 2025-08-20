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

// Mutation is handled via Server Action (setGroupCoverUrlAction).
