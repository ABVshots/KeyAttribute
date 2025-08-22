import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { data } = await supabase.from('platform_admins').select('user_id');
  const admins = (data ?? []).map((r: any) => r.user_id as string);
  const isAdmin = admins.includes(user.id);
  return new Response(JSON.stringify({ admins, isAdmin }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  await supabase.from('platform_admins').upsert({ user_id: user.id });
  return new Response('ok');
}

export async function DELETE() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  await supabase.from('platform_admins').delete().eq('user_id', user.id);
  return new Response('ok');
}
