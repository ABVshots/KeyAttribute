// File: pim-frontend/src/app/dashboard/groups/export/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return new Response('bad request', { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: rows } = await supabase.from('groups').select('id, organization_id, name').in('id', ids);
  if (!rows || rows.length === 0) return new Response(JSON.stringify({ locales: [], items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const org = rows[0].organization_id as string;

  // Locales
  const { data: locs } = await supabase
    .from('organization_languages')
    .select('locale, is_default, languages(label)')
    .eq('organization_id', org)
    .order('is_default', { ascending: false });
  const locales = (locs ?? []).map(l => ({
    locale: l.locale as string,
    label: (l as any).languages?.label as string ?? (l.locale as string),
    is_default: l.is_default as boolean,
  }));
  const def = locales.find(l => l.is_default)?.locale || 'en';

  // Translations
  const { data: tr } = await supabase
    .from('translations')
    .select('entity_id, locale, value')
    .eq('organization_id', org)
    .eq('entity_type', 'group')
    .in('entity_id', ids)
    .eq('key', 'name');
  const items = rows.map((g) => {
    const names: Record<string, string> = {};
    (tr ?? []).forEach(t => {
      if ((t.entity_id as any) === (g.id as any) && (t.value as any)) names[t.locale as string] = t.value as string;
    });
    if (!names[def] && g.name) names[def] = g.name as string;
    return { id: g.id as string, names };
  });

  return new Response(JSON.stringify({ locales, items }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
