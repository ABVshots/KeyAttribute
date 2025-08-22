import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || '';
  if (!id) return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  const { data } = await supabase.from('i18n_import_jobs').select('*').eq('id', id).maybeSingle();
  return new Response(JSON.stringify({ job: data || null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const body = await req.json().catch(() => ({}));
  const format = (String(body.format || 'json').toLowerCase());
  const payload = String(body.payload || '');
  const scope = (String(body.scope || 'global').toLowerCase());
  const bodyOrgId = (body.orgId ? String(body.orgId).trim() : '') || null;
  const idem = (body.idempotencyKey ? String(body.idempotencyKey).trim() : '') || null;
  if (!payload || (format !== 'json' && format !== 'csv') || (scope !== 'global' && scope !== 'org')) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // If idempotency key provided, return existing job
  if (idem) {
    const { data: existing } = await supabase
      .from('i18n_import_jobs')
      .select('id, status')
      .eq('requested_by', user.id)
      .eq('idempotency_key', idem)
      .maybeSingle();
    if (existing?.id) {
      return new Response(JSON.stringify({ id: existing.id, existing: true, status: existing.status }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // authorize by scope
  let orgId: string | null = null;
  if (scope === 'global') {
    const { data: isAdminRpc } = await supabase.rpc('is_platform_admin');
    const isAdmin = !!isAdminRpc;
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  } else if (scope === 'org') {
    if (bodyOrgId) {
      // validate membership for provided orgId
      const { count } = await supabase
        .from('organization_members')
        .select('organization_id', { count: 'exact', head: true })
        .eq('organization_id', bodyOrgId)
        .eq('user_id', user.id);
      if (!count) return new Response(JSON.stringify({ error: 'no_org_membership' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      orgId = bodyOrgId;
    } else {
      // fallback to first org membership
      const { data: org } = await supabase
        .from('organization_members')
        .select('organization_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      orgId = (org?.organization_id as string) || null;
      if (!orgId) return new Response(JSON.stringify({ error: 'no_org' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // throttle: limit queued/running jobs per user
  const MAX_ACTIVE = 2;
  const { count: activeCount } = await supabase
    .from('i18n_import_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('requested_by', user.id)
    .in('status', ['queued','running']);
  if ((activeCount || 0) >= MAX_ACTIVE) {
    return new Response(JSON.stringify({ error: 'too_many_jobs', limit: MAX_ACTIVE }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } });
  }

  // rate-limit per user per window
  const WINDOW_MIN = 10; const MAX_PER_WINDOW = 5;
  const sinceIso = new Date(Date.now() - WINDOW_MIN*60*1000).toISOString();
  const { count: recent } = await supabase
    .from('i18n_import_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('requested_by', user.id)
    .gte('created_at', sinceIso);
  if ((recent || 0) >= MAX_PER_WINDOW) {
    return new Response(JSON.stringify({ error: 'rate_limited', windowMinutes: WINDOW_MIN, limit: MAX_PER_WINDOW }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(WINDOW_MIN*60) } });
  }

  // payload size limit (1MB)
  const MAX_BYTES = 1_000_000;
  if (payload.length > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'payload_too_large', maxBytes: MAX_BYTES }), { status: 413, headers: { 'Content-Type': 'application/json' } });
  }

  // Create job queued
  const { data: job, error: jobErr } = await supabase
    .from('i18n_import_jobs')
    .insert({ scope, org_id: orgId, requested_by: user.id, format, status: 'queued', stats: {}, idempotency_key: idem })
    .select('*')
    .maybeSingle();
  if (jobErr || !job?.id) return new Response(JSON.stringify({ error: jobErr?.message || 'job_create_failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  // Store payload separately
  const { error: pErr } = await supabase
    .from('i18n_import_job_payloads')
    .insert({ job_id: job.id as string, payload, created_by: user.id });
  if (pErr) return new Response(JSON.stringify({ error: pErr.message || 'payload_store_failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  // Invoke Edge Function worker (fire-and-forget)
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const fn = 'i18n-import-worker';
    await fetch(`${url}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ jobId: job.id })
    }).catch(()=>{});
  } catch {}

  return new Response(JSON.stringify({ id: job.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
