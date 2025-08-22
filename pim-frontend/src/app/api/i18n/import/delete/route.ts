import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const body = await req.json().catch(()=>({}));
  const id = String(body.id||'').trim();
  if (!id) return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  // Ensure job exists and is owned by user
  const { data: job, error: jErr } = await supabase
    .from('i18n_import_jobs')
    .select('id, requested_by, status')
    .eq('id', id)
    .maybeSingle();
  if (jErr) return new Response(JSON.stringify({ error: jErr.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  if (!job) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  if (job.requested_by !== user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  if (job.status === 'running' || job.status === 'queued') {
    return new Response(JSON.stringify({ error: 'not_deletable' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Delete job (policies ensure only owner)
  const { error } = await supabase.from('i18n_import_jobs').delete().eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
