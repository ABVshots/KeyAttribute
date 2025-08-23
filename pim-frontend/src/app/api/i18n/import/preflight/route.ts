import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Item = { namespace: string; key: string; locale: string; value: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* ignore */ }
      else { cur += ch; }
    }
  }
  row.push(cur);
  rows.push(row);
  // trim trailing empty rows
  return rows.filter(r => r.some(c => String(c).trim().length > 0));
}

function parseItems(format: 'json'|'csv', payload: string): Item[] {
  const items: Item[] = [];
  try {
    if (format === 'json') {
      const data = JSON.parse(payload);
      if (Array.isArray(data)) {
        for (const x of data) {
          const ns = String(x?.namespace||'').trim();
          const k = String(x?.key||'').trim();
          const loc = String(x?.locale||'').trim();
          const val = String(x?.value||'').trim();
          if (ns && k && loc && val) items.push({ namespace: ns, key: k, locale: loc, value: val });
        }
      } else if (data && typeof data === 'object') {
        for (const [ns, keys] of Object.entries<any>(data)) {
          if (!keys || typeof keys !== 'object') continue;
          for (const [k, locs] of Object.entries<any>(keys)) {
            if (!locs || typeof locs !== 'object') continue;
            for (const [loc, val] of Object.entries<any>(locs)) {
              const v = String(val ?? '').trim();
              if (!v) continue;
              items.push({ namespace: String(ns), key: String(k), locale: String(loc), value: v });
            }
          }
        }
      }
    } else {
      const rows = parseCsv(payload);
      if (rows.length > 1) {
        const header = rows[0].map(h => String(h||'').trim());
        const idxNs = header.findIndex(h => h.toLowerCase()==='namespace');
        const idxKey = header.findIndex(h => h.toLowerCase()==='key');
        const idxLocale = header.findIndex(h => h.toLowerCase()==='locale');
        const idxValue = header.findIndex(h => h.toLowerCase()==='value');
        if (idxNs>=0 && idxKey>=0 && idxLocale>=0 && idxValue>=0) {
          // long format
          for (const r of rows.slice(1)) {
            const ns = String(r[idxNs]||'').trim();
            const k = String(r[idxKey]||'').trim();
            const loc = String(r[idxLocale]||'').trim();
            const val = String(r[idxValue]||'').trim();
            if (ns && k && loc && val) items.push({ namespace: ns, key: k, locale: loc, value: val });
          }
        } else if (idxNs>=0 && idxKey>=0) {
          // wide format: remaining headers are locales
          const localeCols = header.map((h,i)=>({h,i})).filter(x => x.i!==idxNs && x.i!==idxKey);
          for (const r of rows.slice(1)) {
            const ns = String(r[idxNs]||'').trim();
            const k = String(r[idxKey]||'').trim();
            if (!ns || !k) continue;
            for (const {h,i} of localeCols) {
              const val = String(r[i]||'').trim();
              if (!val) continue;
              items.push({ namespace: ns, key: k, locale: String(h).trim(), value: val });
            }
          }
        }
      }
    }
  } catch {
    // ignore, return what we have
  }
  return items;
}

function extractPlaceholders(msg: string): Set<string> {
  const set = new Set<string>();
  const re = /\{\s*([\w.]+)\s*(?:,[^}]*)?}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(msg)) !== null) {
    if (m[1]) set.add(m[1]);
  }
  return set;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => Promise.resolve(cookieStore) });
  const body = await req.json().catch(()=>({}));
  const format = (String(body.format||'json').toLowerCase() as 'json'|'csv');
  const payload = String(body.payload||'');
  if (!payload || (format!=='json' && format!=='csv')) {
    return new Response(JSON.stringify({ ok:false, error:'bad_request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  // 2MB limit for preflight
  if (payload.length > 2_000_000) {
    return new Response(JSON.stringify({ ok:false, error:'payload_too_large', maxBytes: 2_000_000 }), { status: 413, headers: { 'Content-Type': 'application/json' } });
  }

  const items = parseItems(format, payload);
  if (items.length === 0) {
    return new Response(JSON.stringify({ ok:false, error:'no_items' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Validate locales against enabled system_locales
  const { data: locs } = await supabase.from('system_locales').select('code, enabled');
  const allowed = new Set<string>((locs||[]).filter((l:any)=> l.enabled !== false).map((l:any)=> String(l.code)));
  const invalidLocaleSamples: Array<{ namespace: string; key: string; locale: string }> = [];
  let invalidLocaleCount = 0;
  for (const it of items) {
    if (!allowed.has(it.locale)) {
      invalidLocaleCount++;
      if (invalidLocaleSamples.length < 50) invalidLocaleSamples.push({ namespace: it.namespace, key: it.key, locale: it.locale });
    }
  }

  // Placeholder validation
  const groups = new Map<string, Map<string, Set<string>>>();
  for (const it of items) {
    const key = `${it.namespace}::${it.key}`;
    if (!groups.has(key)) groups.set(key, new Map());
    groups.get(key)!.set(it.locale, extractPlaceholders(it.value));
  }
  const warnings: Array<any> = [];
  for (const [key, locMap] of groups.entries()) {
    if (locMap.size <= 1) continue;
    const [namespace, k] = key.split('::');
    const locales = Array.from(locMap.keys());
    const baseLocale = locales.includes('en') ? 'en' : locales[0];
    const base = locMap.get(baseLocale)!;
    for (const loc of locales) {
      if (loc === baseLocale) continue;
      const cur = locMap.get(loc)!;
      const missing = [...base].filter(p => !cur.has(p));
      const extra = [...cur].filter(p => !base.has(p));
      if (missing.length || extra.length) warnings.push({ namespace, key: k, baseLocale, locale: loc, missing, extra });
    }
  }

  const namespaces = new Set(items.map(i=>i.namespace));
  const keys = new Set(items.map(i=>`${i.namespace}::${i.key}`));

  const MAX_ITEMS = 10000;
  if (items.length > MAX_ITEMS) {
    return new Response(JSON.stringify({ ok:false, error:'too_many_items', max: MAX_ITEMS }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok:true, total: items.length, namespaces: namespaces.size, keys: keys.size, placeholder_warnings: warnings.length, warnings: warnings.slice(0, 50), invalid_locales: invalidLocaleCount, invalid_locale_samples: invalidLocaleSamples }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
