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

  const { data: job } = await supabase.from('i18n_import_jobs').select('id, requested_by, status').eq('id', id).maybeSingle();
  if (!job || job.requested_by !== user.id) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  // Only cancel queued/running
  if (job.status !== 'queued' && job.status !== 'running') {
    return new Response(JSON.stringify({ error: 'not_cancellable' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  await supabase.from('i18n_import_jobs').update({ cancelled: true }).eq('id', id);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
