import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  // platform_admin only
  const { data: isAdminRpc } = await supabase.rpc('is_platform_admin');
  const isAdmin = !!isAdminRpc;
  if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  if (!id) return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  // Load job and payload
  const { data: job } = await supabase
    .from('i18n_import_jobs')
    .select('id, requested_by, scope, org_id, format')
    .eq('id', id)
    .maybeSingle();
  if (!job) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const { data: payloadRow } = await supabase
    .from('i18n_import_job_payloads')
    .select('payload')
    .eq('job_id', id)
    .maybeSingle();
  const payload = String(payloadRow?.payload || '');
  if (!payload) return new Response(JSON.stringify({ error: 'no_payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  // Create new job as clone
  const { data: newJob, error: jobErr } = await supabase
    .from('i18n_import_jobs')
    .insert({ scope: job.scope, org_id: job.org_id, requested_by: user.id, format: job.format, status: 'queued', stats: {} })
    .select('id')
    .maybeSingle();
  if (jobErr || !newJob?.id) return new Response(JSON.stringify({ error: jobErr?.message || 'job_create_failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const { error: pErr } = await supabase
    .from('i18n_import_job_payloads')
    .insert({ job_id: newJob.id as string, payload, created_by: user.id });
  if (pErr) return new Response(JSON.stringify({ error: pErr.message || 'payload_store_failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  // Invoke worker
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    await fetch(`${url}/functions/v1/i18n-import-worker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
      body: JSON.stringify({ jobId: newJob.id })
    }).catch(()=>{});
  } catch {}

  return new Response(JSON.stringify({ ok: true, id: newJob.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
