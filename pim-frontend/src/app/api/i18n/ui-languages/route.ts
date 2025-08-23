import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getSupabase() {
  return createRouteHandlerClient({ cookies });
}

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { data: org } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = org?.organization_id as string | undefined;
  if (!orgId) return new Response(JSON.stringify({ locales: [], def: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const { data } = await supabase.from('ui_org_locales').select('locale, is_default, enabled').eq('org_id', orgId);
  const locales = (data ?? []).map((r: any) => r.locale as string);
  const def = (data ?? []).find((r: any) => r.is_default)?.locale ?? null;
  return new Response(JSON.stringify({ locales, def }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { locale } = await req.json();
  if (!locale || typeof locale !== 'string') return new Response('bad', { status: 400 });
  const { data: org } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = org?.organization_id as string | undefined;
  if (!orgId) return new Response('ok');
  await supabase.from('ui_org_locales').upsert({ org_id: orgId, locale, enabled: true });
  return new Response('ok');
}

export async function PATCH(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { locale } = await req.json();
  if (!locale || typeof locale !== 'string') return new Response('bad', { status: 400 });
  const { data: org } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = org?.organization_id as string | undefined;
  if (!orgId) return new Response('ok');
  // Reset defaults
  await supabase.from('ui_org_locales').update({ is_default: false }).eq('org_id', orgId);
  await supabase.from('ui_org_locales').upsert({ org_id: orgId, locale, enabled: true, is_default: true });
  return new Response('ok');
}

export async function DELETE(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get('locale') || '';
  const { data: org } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = org?.organization_id as string | undefined;
  if (!orgId || !locale) return new Response('ok');
  await supabase.from('ui_org_locales').delete().eq('org_id', orgId).eq('locale', locale);
  return new Response('ok');
}
