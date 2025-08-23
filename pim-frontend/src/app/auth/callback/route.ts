// File: pim-frontend/src/app/auth/callback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const rawNext = url.searchParams.get('next') ?? '/dashboard';
  const safePath = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL(safePath, url.origin));
  }

  try {
    await supabase.auth.exchangeCodeForSession(code);
  } catch {
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('error', 'auth');
    loginUrl.searchParams.set('next', safePath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(safePath, url.origin));
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  try {
    const { access_token, refresh_token } = await req.json();
    if (!access_token || !refresh_token) return NextResponse.json({ ok: false }, { status: 400 });
    await supabase.auth.setSession({ access_token, refresh_token });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}