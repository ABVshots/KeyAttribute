import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  const body = await req.json();
  const namespace = String(body.namespace || '').trim();
  const key = String(body.key || '').trim();
  const locale = String(body.locale || '').trim() || 'en';
  const path = String(body.path || '').trim();
  if (!namespace || !key) return new Response('bad', { status: 400 });
  // upsert-like: increment count or insert
  const { data: exist } = await supabase.from('i18n_missing_runtime').select('id, count').eq('namespace', namespace).eq('key', key).eq('locale', locale).maybeSingle();
  if (exist?.id) {
    await supabase.from('i18n_missing_runtime').update({ count: (exist.count as number) + 1, last_seen: new Date().toISOString(), path }).eq('id', exist.id as number);
  } else {
    await supabase.from('i18n_missing_runtime').insert({ namespace, key, locale, path, count: 1 });
  }
  return new Response('ok');
}

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase.from('i18n_missing_runtime').select('id, namespace, key, locale, count, last_seen, path').order('last_seen', { ascending: false }).limit(500);
  return new Response(JSON.stringify({ items: data ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id') || '0');
  if (id) await supabase.from('i18n_missing_runtime').delete().eq('id', id);
  else await supabase.from('i18n_missing_runtime').delete().gte('id', 0);
  return new Response('ok');
}
