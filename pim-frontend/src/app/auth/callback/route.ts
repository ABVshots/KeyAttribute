// File: pim-frontend/src/app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Забороняємо кешування цього маршруту
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const providerError = url.searchParams.get('error') || url.searchParams.get('error_description');
  const rawNext = url.searchParams.get('next') ?? '/dashboard';
  const safePath = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  // Якщо провайдер повернув помилку, перенаправляємо на login з повідомленням
  if (providerError && !code) {
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('error', 'auth');
    loginUrl.searchParams.set('message', providerError.slice(0, 200)); // обмежуємо довжину
    loginUrl.searchParams.set('next', safePath);
    return NextResponse.redirect(loginUrl);
  }

  // Якщо коду немає — просто повертаємо на безпечний шлях
  if (!code) {
    return NextResponse.redirect(new URL(safePath, url.origin));
  }

  // Обмінюємо код на сесію
  const supabase = createRouteHandlerClient({ cookies });
  try {
    await supabase.auth.exchangeCodeForSession(code);
  } catch {
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('error', 'auth');
    loginUrl.searchParams.set('next', safePath);
    return NextResponse.redirect(loginUrl);
  }

  // Повертаємо користувача до безпечного локального шляху (за замовчуванням /dashboard)
  return NextResponse.redirect(new URL(safePath, url.origin));
}