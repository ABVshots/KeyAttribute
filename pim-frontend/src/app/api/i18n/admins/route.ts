import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getSupabase() {
  return createRouteHandlerClient({ cookies });
}

export async function GET() {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });
    const { data, error } = await supabase.from('platform_admins').select('user_id');
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const admins = (data ?? []).map((r: any) => r.user_id as string);
    const isAdmin = admins.includes(user.id);
    return new Response(JSON.stringify({ admins, isAdmin }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'internal_error', message: String(e?.message||e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function POST() {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });
    const { error } = await supabase.from('platform_admins').upsert({ user_id: user.id });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    return new Response('ok');
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'internal_error', message: String(e?.message||e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function DELETE() {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });
    const { error } = await supabase.from('platform_admins').delete().eq('user_id', user.id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    return new Response('ok');
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'internal_error', message: String(e?.message||e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
