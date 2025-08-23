import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const ns = searchParams.get('ns') || '';

  // Build an ETag from global catalog version and namespace
  const { data: ver } = await supabase
    .from('i18n_catalog_versions')
    .select('version')
    .eq('scope', 'global')
    .is('org_id', null)
    .maybeSingle();
  const version = ver?.version ?? 0;
  const etag = `W/"keys-v${version}-ns:${ns||'*'}"`;
  const inm = req.headers.get('if-none-match') || req.headers.get('If-None-Match');
  if (inm && inm === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  let q = supabase.from('ui_keys').select('id, namespace, key');
  if (ns) q = q.eq('namespace', ns);
  const { data } = await q.order('namespace').order('key');
  return new Response(JSON.stringify({ items: data ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json', ETag: etag } });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const { data: isAdminRpc } = await supabase.rpc('is_platform_admin');
  const isAdmin = !!isAdminRpc;
  if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

  const body = await req.json().catch(()=>({}));
  const namespace = String(body.namespace || '').trim();
  const key = String(body.key || '').trim();
  const description = body.description ? String(body.description) : null;
  if (!namespace || !key) return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  await supabase.from('ui_namespaces').upsert({ name: namespace }, { onConflict: 'name' });
  const { error } = await supabase.from('ui_keys').upsert({ namespace, key, description }, { onConflict: 'namespace,key' });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  // bump global catalog version so clients revalidate keys/messages exports
  const { data: ver } = await supabase
    .from('i18n_catalog_versions')
    .select('id, version')
    .eq('scope', 'global')
    .is('org_id', null)
    .maybeSingle();
  if (ver?.id) await supabase.from('i18n_catalog_versions').update({ version: (ver.version as number) + 1, updated_at: new Date().toISOString() }).eq('id', ver.id as number);
  else await supabase.from('i18n_catalog_versions').insert({ scope: 'global', org_id: null, version: 1 });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
