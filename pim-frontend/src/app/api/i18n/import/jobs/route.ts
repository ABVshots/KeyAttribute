import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Item = { namespace: string; key: string; locale: string; value: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = ''; let row: string[] = []; let inQuotes = false;
  for (let i=0;i<text.length;i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch==='"') { if (text[i+1]==='"') { cur+='"'; i++; } else { inQuotes=false; } }
      else cur += ch;
    } else {
      if (ch==='"') inQuotes=true;
      else if (ch===',') { row.push(cur); cur=''; }
      else if (ch==='\n') { row.push(cur); rows.push(row); row=[]; cur=''; }
      else if (ch==='\r') {/* ignore */}
      else cur += ch;
    }
  }
  row.push(cur); rows.push(row);
  return rows.filter(r=>r.some(c=>String(c).trim().length>0));
}

function parseItems(format: 'json'|'csv', payload: string): Item[] {
  const items: Item[] = [];
  try {
    if (format==='json') {
      const data = JSON.parse(payload);
      if (Array.isArray(data)) {
        for (const x of data) {
          if (!x || typeof x !== 'object') continue;
          const ns = String((x as any)?.namespace||'').trim();
          const k = String((x as any)?.key||'').trim();
          const loc = String((x as any)?.locale||'').trim();
          const val = String((x as any)?.value||'').trim();
          if (ns && k && loc && val) items.push({ namespace: ns, key: k, locale: loc, value: val });
        }
      } else if (data && typeof data === 'object') {
        for (const [ns, keys] of Object.entries<any>(data)) {
          if (!keys || typeof keys !== 'object') continue;
          for (const [k, locs] of Object.entries<any>(keys)) {
            if (!locs || typeof locs !== 'object') continue;
            for (const [loc, val] of Object.entries<any>(locs)) {
              const v = String(val ?? '').trim(); if (!v) continue;
              items.push({ namespace: String(ns), key: String(k), locale: String(loc), value: v });
            }
          }
        }
      }
    } else {
      const rows = parseCsv(payload);
      if (rows.length>1) {
        const header = rows[0].map(h=>String(h||'').trim());
        const idxNs = header.findIndex(h=>h.toLowerCase()==='namespace');
        const idxKey = header.findIndex(h=>h.toLowerCase()==='key');
        const idxLocale = header.findIndex(h=>h.toLowerCase()==='locale');
        const idxValue = header.findIndex(h=>h.toLowerCase()==='value');
        if (idxNs>=0 && idxKey>=0 && idxLocale>=0 && idxValue>=0) {
          for (const r of rows.slice(1)) {
            const ns = String(r[idxNs]||'').trim();
            const k = String(r[idxKey]||'').trim();
            const loc = String(r[idxLocale]||'').trim();
            const val = String(r[idxValue]||'').trim();
            if (ns && k && loc && val) items.push({ namespace: ns, key: k, locale: loc, value: val });
          }
        } else if (idxNs>=0 && idxKey>=0) {
          const localeCols = header.map((h,i)=>({h,i})).filter(x=>x.i!==idxNs && x.i!==idxKey);
          for (const r of rows.slice(1)) {
            const ns = String(r[idxNs]||'').trim();
            const k = String(r[idxKey]||'').trim();
            if (!ns || !k) continue;
            for (const {h,i} of localeCols) {
              const val = String(r[i]||'').trim(); if (!val) continue;
              items.push({ namespace: ns, key: k, locale: String(h).trim(), value: val });
            }
          }
        }
      }
    }
  } catch {/* ignore */}
  return items;
}

async function addLog(supabase: any, jobId: string, level: 'info'|'debug'|'warn'|'error', message: string, data?: any) {
  try {
    await supabase.from('i18n_import_job_logs').insert({ job_id: jobId, level, message, data });
  } catch {}
}

async function processInline(supabase: any, params: { jobId: string; scope: 'global'|'org'; orgId: string|null; format: 'json'|'csv'; payload: string }) {
  const { jobId, scope, orgId, format, payload } = params;
  await supabase.from('i18n_import_jobs').update({ status: 'running' }).eq('id', jobId);
  await addLog(supabase, jobId, 'info', 'Inline importer started');

  const items = parseItems(format, payload);
  const total = items.length;
  await supabase.from('i18n_import_jobs').update({ total, progress: 0 }).eq('id', jobId);
  await addLog(supabase, jobId, 'debug', `Parsed items`, { count: total });
  if (total === 0) {
    await supabase.from('i18n_import_jobs').update({ status: 'failed', stats: { error: 'no_items' } }).eq('id', jobId);
    return;
  }

  // Ensure namespaces
  const namespaces = Array.from(new Set(items.map(i=>i.namespace)));
  if (namespaces.length) {
    await supabase.from('ui_namespaces').upsert(namespaces.map(n=>({ name: n })), { onConflict: 'name' }).throwOnError();
  }
  await addLog(supabase, jobId, 'debug', 'Namespaces ensured', { count: namespaces.length });

  // Ensure keys
  const pairs = Array.from(new Set(items.map(i=>`${i.namespace}::${i.key}`)));
  if (pairs.length) {
    const rows = pairs.map(p=>({ namespace: p.split('::')[0]!, key: p.split('::')[1]! }));
    await supabase.from('ui_keys').upsert(rows, { onConflict: 'namespace,key' }).throwOnError();
  }
  await addLog(supabase, jobId, 'debug', 'Keys ensured', { count: pairs.length });

  // Fetch key ids map
  const { data: keysRows } = await supabase.from('ui_keys').select('id, namespace, key').in('namespace', namespaces);
  const keyMap = new Map<string, string>((keysRows||[]).map((r:any)=>[`${r.namespace}::${r.key}`, r.id]));

  // Upsert messages
  let created = 0; let updated = 0; let processed = 0;
  for (const it of items) {
    const id = keyMap.get(`${it.namespace}::${it.key}`);
    if (!id) continue;
    if (scope==='global') {
      const { data, error } = await supabase.from('ui_messages_global').upsert({ key_id: id, locale: it.locale, value: it.value, status: 'approved' }, { onConflict: 'key_id,locale' }).select('key_id');
      if (!error) { if ((data||[]).length===1) updated++; else created++; }
    } else {
      if (!orgId) continue;
      const { data, error } = await supabase.from('ui_messages_overrides').upsert({ org_id: orgId, key_id: id, locale: it.locale, value: it.value, status: 'approved' }, { onConflict: 'org_id,key_id,locale' }).select('key_id');
      if (!error) { if ((data||[]).length===1) updated++; else created++; }
    }
    processed++;
    if (processed % 50 === 0) {
      await supabase.from('i18n_import_jobs').update({ progress: processed }).eq('id', jobId);
    }
  }

  await supabase.from('i18n_import_jobs').update({ status: 'done', progress: processed, stats: { total, created, updated } }).eq('id', jobId);
  await addLog(supabase, jobId, 'info', 'Inline importer finished', { total, created, updated });
}

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

  // Inline fallback importer (dev-safe). Set IMPORT_INLINE=1 to force inline.
  const useInline = process.env.IMPORT_INLINE === '1' || process.env.NODE_ENV !== 'production';
  if (useInline) {
    try {
      await processInline(supabase, { jobId: job.id as string, scope, orgId, format, payload });
    } catch (e: any) {
      await supabase.from('i18n_import_jobs').update({ status: 'failed', stats: { error: String(e?.message||e) } }).eq('id', job.id as string);
    }
    return new Response(JSON.stringify({ id: job.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Invoke Edge Function worker (fire-and-forget)
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const fn = 'i18n-import-worker';
    await fetch(`${url}/functions/v1/${fn}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` }, body: JSON.stringify({ jobId: job.id })
    }).catch(()=>{});
  } catch {}

  return new Response(JSON.stringify({ id: job.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
