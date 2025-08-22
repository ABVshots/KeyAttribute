import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const ns = searchParams.get('ns') || '';
  let q = supabase.from('ui_keys').select('id, namespace, key');
  if (ns) q = q.eq('namespace', ns);
  const { data } = await q.order('namespace').order('key');
  return new Response(JSON.stringify({ items: data ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
