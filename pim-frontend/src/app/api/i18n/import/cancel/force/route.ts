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

  // Ensure owner and get state
  const { data: job } = await supabase.from('i18n_import_jobs').select('id, requested_by, status, cancelled, created_at').eq('id', id).maybeSingle();
  if (!job || job.requested_by !== user.id) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  if (job.status === 'done' || job.status === 'failed') return new Response(JSON.stringify({ error: 'not_running' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const GRACE_SECONDS = 60;
  const ageSec = Math.floor((Date.now() - new Date(job.created_at as string).getTime())/1000);
  if (!job.cancelled && ageSec < GRACE_SECONDS) {
    return new Response(JSON.stringify({ error: 'grace_period', waitSeconds: GRACE_SECONDS - ageSec }), { status: 425, headers: { 'Content-Type': 'application/json' } });
  }

  // Force cancel policy: if still running/queued after grace period, mark failed immediately
  await supabase.from('i18n_import_jobs').update({ cancelled: true, status: 'failed', finished_at: new Date().toISOString(), stats: { error: 'force_cancelled' } }).eq('id', id);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
