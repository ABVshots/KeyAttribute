// File: pim-frontend/src/app/dashboard/groups/children/export/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const parent_id = searchParams.get('parent_id');
  if (!parent_id) return new Response('bad request', { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: parent } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', parent_id)
    .maybeSingle();
  if (!parent) return new Response('Not found', { status: 404 });

  // Children
  const { data: children } = await supabase
    .from('groups')
    .select('id, name')
    .eq('parent_id', parent_id)
    .order('name');
  const ids = (children ?? []).map(c => c.id as string);

  // Load translations for these children
  let translations: Array<{ entity_id: string; locale: string; value: string }> = [];
  if (ids.length > 0) {
    const { data: tr } = await supabase
      .from('translations')
      .select('entity_id, locale, value')
      .eq('organization_id', parent.organization_id as string)
      .eq('entity_type', 'group')
      .in('entity_id', ids)
      .eq('key', 'name');
    translations = (tr ?? []) as any;
  }

  // Build locales: prefer organization_languages; else derive from translations; else fallback to ['en']
  const { data: orgLoc } = await supabase
    .from('organization_languages')
    .select('locale, is_default, languages(label)')
    .eq('organization_id', parent.organization_id as string)
    .order('is_default', { ascending: false });
  let locales = (orgLoc ?? []).map(l => ({
    locale: l.locale as string,
    label: (l as any).languages?.label as string ?? (l.locale as string),
    is_default: l.is_default as boolean,
  }));

  if (!locales || locales.length === 0) {
    const set = new Set<string>();
    for (const t of translations) set.add((t.locale as string).toLowerCase());
    let list = Array.from(set);
    if (list.length === 0) list = ['en'];
    // Try fetch labels from global languages
    const { data: langs } = await supabase.from('languages').select('code, label').in('code', list);
    const labelMap = new Map((langs ?? []).map(l => [String(l.code).toLowerCase(), l.label as string]));
    locales = list.map((code, idx) => ({ locale: code, label: labelMap.get(code) ?? code, is_default: idx === 0 }));
  }

  const def = locales.find(l => l.is_default)?.locale ?? 'en';

  const items = (children ?? []).map((c) => {
    const row: any = { id: c.id as string, names: {} as Record<string, string> };
    for (const loc of locales) {
      const found = translations.find(t => (t.entity_id as any) === (c.id as any) && (t.locale as any) === loc.locale);
      if (found?.value) row.names[loc.locale] = found.value as string;
    }
    if (!row.names[def] && c.name) row.names[def] = c.name as string;
    return row;
  });

  return new Response(JSON.stringify({ locales, items }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
