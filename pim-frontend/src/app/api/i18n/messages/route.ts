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

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const ns = searchParams.get('ns') || '';
  const locale = searchParams.get('locale') || '';
  if (!ns || !locale) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  // ETag based on global catalog version
  const { data: ver } = await supabase
    .from('i18n_catalog_versions')
    .select('version')
    .eq('scope', 'global')
    .is('org_id', null)
    .maybeSingle();
  const version = ver?.version ?? 0;
  const etag = `W/"global-v${version}-ns:${ns}-loc:${locale}"`;
  const inm = req.headers.get('if-none-match') || req.headers.get('If-None-Match');
  if (inm && inm === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const { data: keys } = await supabase.from('ui_keys').select('id, key').eq('namespace', ns).order('key');
  const ids = (keys ?? []).map((k: any) => k.id as string);
  let values: any[] = [];
  if (ids.length) {
    const { data } = await supabase.from('ui_messages_global').select('key_id, value').in('key_id', ids).eq('locale', locale);
    values = data ?? [];
  }
  const valMap = new Map<string, string>();
  values.forEach((v: any) => valMap.set(v.key_id as string, v.value as string));
  const items = (keys ?? []).map((k: any) => ({ keyId: k.id as string, key: k.key as string, value: valMap.get(k.id as string) ?? '' }));
  return new Response(JSON.stringify({ items }), { status: 200, headers: { 'Content-Type': 'application/json', ETag: etag } });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
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

  // ICU placeholders validation against base locale (en) if not editing en
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

  const { error } = await supabase.from('ui_messages_global').upsert({ key_id: keyId, locale, value }, { onConflict: 'key_id,locale' });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  // bump global version
  const { data: ver2 } = await supabase
    .from('i18n_catalog_versions')
    .select('id, version')
    .eq('scope', 'global')
    .is('org_id', null)
    .maybeSingle();
  if (ver2?.id) await supabase.from('i18n_catalog_versions').update({ version: (ver2.version as number) + 1, updated_at: new Date().toISOString() }).eq('id', ver2.id as number);
  else await supabase.from('i18n_catalog_versions').insert({ scope: 'global', org_id: null, version: 1 });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
