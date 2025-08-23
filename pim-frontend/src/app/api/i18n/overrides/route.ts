import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function extractPlaceholders(msg: string): Set<string> {
  const set = new Set<string>();
  const re = /\{\s*([\w.]+)\s*(?:,[^}]*)?}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(msg)) !== null) {
    if (m[1]) set.add(m[1]);
  }
  return set;
}

async function bumpOrgVersion(supabase: any, orgId: string) {
  const { data } = await supabase
    .from('i18n_catalog_versions')
    .select('id, version')
    .eq('scope', 'org')
    .eq('org_id', orgId)
    .maybeSingle();
  if (data?.id) {
    await supabase.from('i18n_catalog_versions').update({ version: (data.version as number)+1, updated_at: new Date().toISOString() }).eq('id', data.id as number);
  } else {
    await supabase.from('i18n_catalog_versions').insert({ scope: 'org', org_id: orgId, version: 1 });
  }
}

async function getOrgId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.organization_id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const { searchParams } = new URL(req.url);
  const ns = searchParams.get('ns') || '';
  const locale = searchParams.get('locale') || '';
  if (!ns || !locale) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  // ETag based on org catalog version
  const { data: ver } = await supabase
    .from('i18n_catalog_versions')
    .select('version')
    .eq('scope', 'org')
    .eq('org_id', orgId)
    .maybeSingle();
  const version = ver?.version ?? 0;
  const etag = `W/"org:${orgId}-v${version}-ns:${ns}-loc:${locale}"`;
  const inm = req.headers.get('if-none-match') || req.headers.get('If-None-Match');
  if (inm && inm === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const { data: keys } = await supabase.from('ui_keys').select('id, key').eq('namespace', ns).order('key');
  const ids = (keys ?? []).map((k: any) => k.id as string);
  let values: any[] = [];
  if (ids.length) {
    const { data } = await supabase.from('ui_messages_overrides').select('key_id, value').in('key_id', ids).eq('locale', locale).eq('org_id', orgId);
    values = data ?? [];
  }
  const valMap = new Map<string, string>();
  values.forEach((v: any) => valMap.set(v.key_id as string, v.value as string));
  const items = (keys ?? []).map((k: any) => ({ keyId: k.id as string, key: k.key as string, value: valMap.get(k.id as string) ?? '' }));
  return new Response(JSON.stringify({ items }), { status: 200, headers: { 'Content-Type': 'application/json', ETag: etag } });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return new Response(JSON.stringify({ error: 'no_org' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const body = await req.json().catch(()=>({}));
  const keyId = String(body.keyId || '').trim();
  const locale = String(body.locale || '').trim();
  const value = String(body.value || '').trim();
  const allowMismatch = String(body.allowMismatch || '').toLowerCase() === '1' || body.allowMismatch === true;
  if (!keyId || !locale) return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  if (value.length === 0) return new Response(JSON.stringify({ error: 'empty_value' }), { status: 422, headers: { 'Content-Type': 'application/json' } });
  if (value.length > 2000) return new Response(JSON.stringify({ error: 'too_long', max: 2000 }), { status: 413, headers: { 'Content-Type': 'application/json' } });
  // locale must exist and be enabled
  const { data: loc } = await supabase.from('system_locales').select('code, enabled').eq('code', locale).maybeSingle();
  if (!loc || loc.enabled === false) return new Response(JSON.stringify({ error: 'invalid_locale' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  // Validate ICU placeholders against global 'en' for this key, if exists
  if (locale !== 'en') {
    const { data: base } = await supabase.from('ui_messages_global').select('value').eq('key_id', keyId).eq('locale', 'en').maybeSingle();
    if (base?.value) {
      const basePH = Array.from(extractPlaceholders(String(base.value||'')));
      const curPH = Array.from(extractPlaceholders(value));
      const missing = basePH.filter(p => !curPH.includes(p));
      const extra = curPH.filter(p => !basePH.includes(p));
      if ((missing.length || extra.length) && !allowMismatch) {
        return new Response(JSON.stringify({ error: 'icu_mismatch', baseLocale: 'en', missing, extra }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }
  }

  const { error } = await supabase.from('ui_messages_overrides').upsert({ org_id: orgId, key_id: keyId, locale, value }, { onConflict: 'org_id,key_id,locale' });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  await bumpOrgVersion(supabase, orgId);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
