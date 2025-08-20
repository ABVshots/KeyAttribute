// File: pim-frontend/src/app/dashboard/groups/edit/descriptions/route.ts
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

  // Load org locales or fallback to global languages
  const { data: orgLocales } = await supabase
    .from('organization_languages')
    .select('locale, is_default, languages(label)')
    .eq('organization_id', group.organization_id as string)
    .order('is_default', { ascending: false });

  let locales = (orgLocales ?? []).map((l) => ({
    locale: l.locale as string,
    label: (l as any).languages?.label as string ?? (l.locale as string),
    is_default: l.is_default as boolean,
  }));

  if (!locales || locales.length === 0) {
    const { data: langs } = await supabase.from('languages').select('code, label').order('code');
    locales = (langs ?? []).map((x) => ({ locale: x.code as string, label: (x.label as string) || (x.code as string), is_default: (x.code as string).toLowerCase() === 'en' }));
    if (locales.length === 0) locales = [{ locale: 'en', label: 'English', is_default: true }];
  }

  // Load existing descriptions
  const { data: tr } = await supabase
    .from('translations')
    .select('locale, value')
    .eq('organization_id', group.organization_id as string)
    .eq('entity_type', 'group')
    .eq('entity_id', group.id)
    .eq('key', 'description');
  const map = new Map<string, string>((tr ?? []).map((t) => [t.locale as string, t.value as string]));

  return new Response(
    JSON.stringify({ locales: locales.map((l) => ({ locale: l.locale, label: l.label + (l.is_default ? ' • default' : ''), value: map.get(l.locale) ?? '' })) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const group_id = body?.group_id as string | undefined;
  const entries = body?.entries as Array<{ locale: string; value: string }> | undefined;
  if (!group_id || !Array.isArray(entries)) return new Response('bad request', { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', group_id)
    .maybeSingle();
  if (!group) return new Response('Not found', { status: 404 });

  const rows = entries
    .map((e) => ({
      organization_id: group.organization_id,
      entity_type: 'group',
      entity_id: group.id,
      locale: e.locale,
      key: 'description',
      value: String(e.value ?? '').trim(),
    }))
    .filter((r) => r.value.length > 0);

  if (rows.length > 0) {
    const { error } = await supabase
      .from('translations')
      .upsert(rows, { onConflict: 'organization_id,entity_type,entity_id,locale,key' });
    if (error) return new Response(error.message, { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
