import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST(req: NextRequest) {
  const { locale } = await req.json();
  if (typeof locale !== 'string' || !locale.trim()) return new Response('bad', { status: 400 });
  (await cookies()).set('ui_locale', locale, { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60*60*24*365 });
  return new Response('ok');
}

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  let loc = (await cookies()).get('ui_locale')?.value || '';
  if (user) {
    const { data } = await supabase.from('user_ui_prefs').select('ui_locale').eq('user_id', user.id).maybeSingle();
    loc = (data?.ui_locale as string) || loc || 'en';
  }
  return new Response(JSON.stringify({ locale: loc || 'en' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
