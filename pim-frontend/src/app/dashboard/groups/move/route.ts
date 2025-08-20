// File: pim-frontend/src/app/dashboard/groups/move/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const child_id = String(body?.child_id ?? '');
  const new_parent_id = String(body?.new_parent_id ?? '');
  // context_id reserved for revalidation context; not used here
  if (!child_id || !new_parent_id) return new Response('bad request', { status: 400 });

  // Reuse server action logic indirectly by calling RPC-like path here
  // Validate basics
  const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  if (!UUID_RE.test(child_id) || !UUID_RE.test(new_parent_id)) return new Response('bad request', { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  // Fetch child and parent
  const { data: child } = await supabase.from('groups').select('id, organization_id, type_id').eq('id', child_id).maybeSingle();
  const { data: parent } = await supabase.from('groups').select('id, organization_id, type_id').eq('id', new_parent_id).maybeSingle();
  if (!child || !parent) return new Response('not_found', { status: 404 });
  if (child.organization_id !== parent.organization_id) return new Response('org_mismatch', { status: 400 });
  if (child.type_id !== parent.type_id) return new Response('type_mismatch', { status: 400 });

  // Prevent cycles
  let cursor: string | null = new_parent_id;
  for (let i = 0; i < 64 && cursor; i++) {
    if (cursor === child_id) return new Response('cycle', { status: 400 });
    const res = await supabase
      .from('groups')
      .select('parent_id')
      .eq('id', cursor)
      .maybeSingle();
    const gp = (res.data as { parent_id: string | null } | null);
    cursor = (gp?.parent_id ?? null);
  }

  // Apply update
  const { error } = await supabase.from('groups').update({ parent_id: new_parent_id }).eq('id', child_id);
  if (error) return new Response(error.message, { status: 400 });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
