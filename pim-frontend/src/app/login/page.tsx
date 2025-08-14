'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMsg('Введіть email');
      return;
    }

    setLoading(true);
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')) ?? window.location.origin;

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${baseUrl}/auth/callback`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setEmail(normalizedEmail);
        setSubmitted(true);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setErrorMsg(message || 'Невідома помилка');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold">Перевірте вашу пошту</h1>
          <p className="mt-2 text-gray-600">
            Ми відправили посилання для входу на <strong>{email}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <form
          className="rounded-lg border bg-white p-8 shadow-sm"
          onSubmit={handleLogin}
        >
          <h1 className="mb-4 text-center text-2xl font-bold">Вхід / Реєстрація</h1>
          <p className="mb-6 text-center text-sm text-gray-500">
            Введіть ваш email, щоб отримати посилання для входу.
          </p>
          <div className="mb-4">
            <label htmlFor="email" className="sr-only">Email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              disabled={loading}
              className="w-full rounded-md border-gray-200 p-3 shadow-sm disabled:opacity-60"
            />
          </div>

          {errorMsg && (
            <div className="mb-4 text-sm text-red-600" role="alert">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            aria-busy={loading}
            className="block w-full rounded-lg bg-zinc-800 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Надсилаємо…' : 'Отримати посилання'}
          </button>
        </form>
      </div>
    </div>
  );
}