import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // platform_admin only to create keys
  const { data: isAdmin } = await supabase.rpc('is_platform_admin');
  if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

  const body = await req.json().catch(()=>({}));
  const ids = Array.isArray(body.ids) ? body.ids.map((x:any)=> Number(x)).filter((n:number)=> Number.isFinite(n) && n>0) : [];
  if (ids.length === 0) return new Response(JSON.stringify({ error: 'no_ids' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  // Load missing rows
  const { data: rows } = await supabase
    .from('i18n_missing_runtime')
    .select('id, namespace, key')
    .in('id', ids);
  const list = rows || [];

  // ensure namespaces and keys
  let createdNs = 0, createdKeys = 0;
  for (const r of list) {
    const ns = String(r.namespace||'').trim();
    const k = String(r.key||'').trim();
    if (!ns || !k) continue;
    await supabase.from('ui_namespaces').upsert({ name: ns }, { onConflict: 'name' });
    // check key
    const { data: keyRow } = await supabase.from('ui_keys').select('id').eq('namespace', ns).eq('key', k).maybeSingle();
    if (!keyRow?.id) {
      await supabase.from('ui_keys').insert({ namespace: ns, key: k });
      createdKeys++;
    }
  }

  return new Response(JSON.stringify({ ok: true, createdKeys, processed: list.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
