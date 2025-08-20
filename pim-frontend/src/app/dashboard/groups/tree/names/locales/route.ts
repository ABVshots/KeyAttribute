// File: pim-frontend/src/app/dashboard/groups/tree/names/locales/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const group_id = searchParams.get('group_id');
  if (!group_id) return new Response('bad request', { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Resolve group and org
  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id, name')
    .eq('id', group_id)
    .maybeSingle();
  if (!group) return new Response('Not found', { status: 404 });

  // Membership
  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', group.organization_id as string)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) return new Response('Forbidden', { status: 403 });

  // Org locales
  const { data: locales } = await supabase
    .from('organization_languages')
    .select('locale, is_default, languages(label)')
    .eq('organization_id', group.organization_id as string)
    .order('is_default', { ascending: false });

  let orgLocales = (locales ?? []).map(l => ({
    locale: l.locale as string,
    label: (l as any).languages?.label as string ?? l.locale,
    is_default: l.is_default as boolean,
  }));

  // Fallback: if organization has no locales configured, use global languages
  if (!orgLocales || orgLocales.length === 0) {
    const { data: langs } = await supabase.from('languages').select('code, label').order('code');
    const all = (langs ?? []).map((x) => ({ locale: x.code as string, label: (x.label as string) || (x.code as string), is_default: (x.code as string).toLowerCase() === 'en' }));
    orgLocales = all.length > 0 ? all : [{ locale: 'en', label: 'English', is_default: true }];
  }

  // Current translations
  const { data: tr } = await supabase
    .from('translations')
    .select('locale, value')
    .eq('organization_id', group.organization_id as string)
    .eq('entity_type', 'group')
    .eq('entity_id', group.id)
    .eq('key', 'name');
  const map = new Map<string, string>((tr ?? []).map(t => [t.locale as string, t.value as string]));

  const result = orgLocales.map(l => ({
    locale: l.locale,
    label: l.label + (l.is_default ? ' • default' : ''),
    value: map.get(l.locale) ?? (l.is_default ? (group.name as string) : ''),
  }));

  return new Response(JSON.stringify({ locales: result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const group_id = body?.group_id as string | undefined;
  const entries = body?.entries as Array<{ locale: string; name: string }> | undefined;
  if (!group_id || !Array.isArray(entries)) return new Response('bad request', { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', group_id)
    .maybeSingle();
  if (!group) return new Response('Not found', { status: 404 });

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', group.organization_id as string)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) return new Response('Forbidden', { status: 403 });

  const { data: def } = await supabase
    .from('organization_languages')
    .select('locale')
    .eq('organization_id', group.organization_id as string)
    .eq('is_default', true)
    .maybeSingle();
  const defaultLocale = (def?.locale as string) ?? 'en';

  const rows = entries
    .map(e => ({
      organization_id: group.organization_id,
      entity_type: 'group',
      entity_id: group.id,
      locale: e.locale,
      key: 'name',
      value: String(e.name ?? '').trim(),
    }))
    .filter(r => r.value.length > 0);

  if (rows.length > 0) {
    const { error } = await supabase
      .from('translations')
      .upsert(rows, { onConflict: 'organization_id,entity_type,entity_id,locale,key' });
    if (error) return new Response(error.message, { status: 400 });
  }

  const defName = entries.find(e => e.locale === defaultLocale)?.name?.trim();
  if (defName) {
    await supabase.from('groups').update({ name: defName }).eq('id', group.id);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
