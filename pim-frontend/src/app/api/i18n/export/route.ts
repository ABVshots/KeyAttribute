import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function HEAD(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const ns = searchParams.get('ns') || '';
  const locale = searchParams.get('locale') || '';
  const format = (searchParams.get('format') || 'json').toLowerCase();
  const includeOverridesParam = (searchParams.get('includeOverrides') || '').toLowerCase();
  const includeOverrides = includeOverridesParam === '1' || includeOverridesParam === 'true';
  const overridesOnly = ((searchParams.get('overridesOnly') || '').toLowerCase() === '1' || (searchParams.get('overridesOnly') || '').toLowerCase() === 'true');
  if (!ns) return new Response(null, { status: 400 });

  const { data: ver } = await supabase
    .from('i18n_catalog_versions')
    .select('version')
    .eq('scope', 'global')
    .is('org_id', null)
    .maybeSingle();
  let version = String(ver?.version ?? 1);

  let orgId: string | null = null; let orgVersion: string | null = null;
  if (includeOverrides || overridesOnly) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: org } = await supabase
        .from('organization_members')
        .select('organization_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      orgId = (org?.organization_id as string) || null;
      if (orgId) {
        const { data: overVer } = await supabase
          .from('i18n_catalog_versions')
          .select('version')
          .eq('scope', 'org')
          .eq('org_id', orgId)
          .maybeSingle();
        orgVersion = String(overVer?.version ?? 1);
      }
    }
  }
  const etag = `i18n:${ns}:${locale || 'all'}:${format}:v${version}${(includeOverrides || overridesOnly) && orgId ? `:ovr:${orgId}:v${orgVersion}${overridesOnly?':onlyovr':''}` : ''}`;
  return new Response(null, { status: 200, headers: { 'ETag': etag, 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' } });
}

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const ns = searchParams.get('ns') || '';
  const locale = searchParams.get('locale') || '';
  const format = (searchParams.get('format') || 'json').toLowerCase();
  const includeOverridesParam = (searchParams.get('includeOverrides') || '').toLowerCase();
  const includeOverrides = includeOverridesParam === '1' || includeOverridesParam === 'true';
  const overridesOnly = ((searchParams.get('overridesOnly') || '').toLowerCase() === '1' || (searchParams.get('overridesOnly') || '').toLowerCase() === 'true');
  if (!ns) return new Response('bad', { status: 400 });

  const { data: ver } = await supabase
    .from('i18n_catalog_versions')
    .select('version')
    .eq('scope', 'global')
    .is('org_id', null)
    .maybeSingle();
  let version = String(ver?.version ?? 1);

  let orgId: string | null = null; let orgVersion: string | null = null;
  if (includeOverrides || overridesOnly) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: org } = await supabase
        .from('organization_members')
        .select('organization_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      orgId = (org?.organization_id as string) || null;
      if (orgId) {
        const { data: overVer } = await supabase
          .from('i18n_catalog_versions')
          .select('version')
          .eq('scope', 'org')
          .eq('org_id', orgId)
          .maybeSingle();
        orgVersion = String(overVer?.version ?? 1);
      }
    }
  }

  const etag = `i18n:${ns}:${locale || 'all'}:${format}:v${version}${(includeOverrides || overridesOnly) && orgId ? `:ovr:${orgId}:v${orgVersion}${overridesOnly?':onlyovr':''}` : ''}`;
  const ifNone = req.headers.get('if-none-match');
  if (ifNone && ifNone === etag) {
    return new Response(null, { status: 304 });
  }

  const { data: keys } = await supabase.from('ui_keys').select('id, key').eq('namespace', ns).order('key');
  const ids = (keys ?? []).map((k: any) => k.id as string);
  const keyMap = new Map<string, string>((keys ?? []).map((k: any) => [k.id as string, k.key as string]));

  // Preload overrides map if requested
  const overrideMap = new Map<string, Map<string, string>>(); // key_id -> (locale -> value)
  if ((includeOverrides || overridesOnly) && orgId && ids.length) {
    if (locale) {
      const { data: ovr } = await supabase
        .from('ui_messages_overrides')
        .select('key_id, locale, value')
        .eq('org_id', orgId)
        .in('key_id', ids)
        .eq('locale', locale);
      (ovr ?? []).forEach((r: any) => {
        const kid = r.key_id as string; const loc = r.locale as string; const val = r.value as string;
        if (!overrideMap.has(kid)) overrideMap.set(kid, new Map());
        overrideMap.get(kid)!.set(loc, val);
      });
    } else {
      const { data: ovr } = await supabase
        .from('ui_messages_overrides')
        .select('key_id, locale, value')
        .eq('org_id', orgId)
        .in('key_id', ids);
      (ovr ?? []).forEach((r: any) => {
        const kid = r.key_id as string; const loc = r.locale as string; const val = r.value as string;
        if (!overrideMap.has(kid)) overrideMap.set(kid, new Map());
        overrideMap.get(kid)!.set(loc, val);
      });
    }
  }

  const commonHeaders: Record<string, string> = {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
    'ETag': etag,
  };

  if (format === 'csv') {
    if (locale) {
      // CSV, one locale
      const rows: Array<[string, string]> = [];
      if (ids.length) {
        if (overridesOnly) {
          overrideMap.forEach((locMap, kid) => {
            const kname = keyMap.get(kid); if (!kname) return;
            const ov = locMap.get(locale);
            if (ov !== undefined) rows.push([kname, ov]);
          });
        } else {
          const { data } = await supabase.from('ui_messages_global').select('key_id, value').in('key_id', ids).eq('locale', locale);
          const map = new Map<string, string>();
          (data ?? []).forEach((r: any) => { map.set(r.key_id as string, r.value as string); });
          for (const kid of ids) {
            const kname = keyMap.get(kid);
            if (!kname) continue;
            const ov = overrideMap.get(kid)?.get(locale);
            const base = map.get(kid) || '';
            const val = (ov ?? base) || '';
            rows.push([kname, val]);
          }
        }
      }
      const header = ['key', locale];
      const csv = [header, ...rows].map(cols => cols.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
      return new Response(csv, { status: 200, headers: { ...commonHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="i18n-${ns}-${locale}${overridesOnly?'-overrides-only':(includeOverrides && orgId ? '-overrides' : '')}.csv"` } });
    } else {
      // CSV, all locales
      const map: Record<string, Record<string, string>> = {};
      let localesSet = new Set<string>();
      if (ids.length) {
        if (overridesOnly) {
          overrideMap.forEach((locMap, kid) => {
            const k = keyMap.get(kid); if (!k) return;
            if (!map[k]) map[k] = {};
            locMap.forEach((val, loc) => { map[k][loc] = val; localesSet.add(loc); });
          });
        } else {
          const { data } = await supabase.from('ui_messages_global').select('key_id, locale, value').in('key_id', ids);
          (data ?? []).forEach((r: any) => {
            const k = keyMap.get(r.key_id as string); if (!k) return;
            const loc = r.locale as string; const val = r.value as string;
            if (!map[k]) map[k] = {};
            map[k][loc] = val; localesSet.add(loc);
          });
          if (includeOverrides && orgId) {
            overrideMap.forEach((locMap, kid) => {
              const k = keyMap.get(kid); if (!k) return;
              if (!map[k]) map[k] = {};
              locMap.forEach((val, loc) => { map[k][loc] = val; localesSet.add(loc); });
            });
          }
        }
      }
      const locales = Array.from(localesSet).sort();
      const header = ['key', ...locales];
      const rows = (keys ?? []).map((k: any) => {
        const kk = String(k.key);
        return [kk, ...locales.map((l: string) => (map[kk]?.[l] ?? ''))];
      });
      const csv = [header, ...rows].map(cols => cols.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
      return new Response(csv, { status: 200, headers: { ...commonHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="i18n-${ns}-all${overridesOnly?'-overrides-only':(includeOverrides && orgId ? '-overrides' : '')}.csv"` } });
    }
  }

  if (locale) {
    const map: Record<string, string> = {};
    if (ids.length) {
      if (overridesOnly) {
        overrideMap.forEach((locMap, kid) => {
          const k = keyMap.get(kid); if (!k) return;
          const ov = locMap.get(locale);
          if (ov !== undefined) map[k] = ov;
        });
      } else {
        const { data } = await supabase.from('ui_messages_global').select('key_id, value').in('key_id', ids).eq('locale', locale);
        (data ?? []).forEach((r: any) => { const k = keyMap.get(r.key_id as string); if (k) map[k] = r.value as string; });
        if (includeOverrides && orgId) {
          overrideMap.forEach((locMap, kid) => {
            const k = keyMap.get(kid); if (!k) return;
            const ov = locMap.get(locale);
            if (ov !== undefined) map[k] = ov;
          });
        }
      }
    }
    return new Response(JSON.stringify({ namespace: ns, locale, messages: map, overridesOnly: !!overridesOnly }), { status: 200, headers: { ...commonHeaders, 'Content-Type': 'application/json' } });
  }

  const out: Record<string, Record<string, string>> = {};
  if (ids.length) {
    if (overridesOnly) {
      overrideMap.forEach((locMap, kid) => {
        const k = keyMap.get(kid); if (!k) return;
        locMap.forEach((val, loc) => {
          if (!out[loc]) out[loc] = {};
          out[loc][k] = val;
        });
      });
    } else {
      const { data } = await supabase.from('ui_messages_global').select('key_id, locale, value').in('key_id', ids);
      (data ?? []).forEach((r: any) => {
        const k = keyMap.get(r.key_id as string); if (!k) return;
        const loc = r.locale as string; const val = r.value as string;
        if (!out[loc]) out[loc] = {};
        out[loc][k] = val;
      });
      if (includeOverrides && orgId) {
        overrideMap.forEach((locMap, kid) => {
          const k = keyMap.get(kid); if (!k) return;
          locMap.forEach((val, loc) => {
            if (!out[loc]) out[loc] = {};
            out[loc][k] = val;
          });
        });
      }
    }
  }
  return new Response(JSON.stringify({ namespace: ns, messages: out, overridesOnly: !!overridesOnly, includeOverrides: !!(includeOverrides && orgId) }), { status: 200, headers: { ...commonHeaders, 'Content-Type': 'application/json' } });
}
