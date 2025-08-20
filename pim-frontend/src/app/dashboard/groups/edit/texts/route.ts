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

// Mutations are handled via Server Actions (upsertGroupTextsAction, reorderGroupTextsAction, deleteGroupTextAction).
