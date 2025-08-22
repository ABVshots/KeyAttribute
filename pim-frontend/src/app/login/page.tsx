'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [usePassword, setUsePassword] = useState(true);
  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleMagic = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setErrorMsg('Введіть email'); return; }

    setLoading(true);
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')) ?? window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: `${baseUrl}/auth/callback` },
      });
      if (error) setErrorMsg(error.message); else { setEmail(normalizedEmail); setSubmitted(true); }
    } catch (e: unknown) { setErrorMsg(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  async function handleSignin() {
    setErrorMsg(null); setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) { setErrorMsg(error.message); return; }
      if (data.session) router.replace('/dashboard');
    } catch (e:any) { setErrorMsg(e.message||'Помилка входу'); } finally { setLoading(false); }
  }

  async function handleSignup() {
    setErrorMsg(null); setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
      if (error) { setErrorMsg(error.message); return; }
      // якщо Confirm email OFF — одразу буде сесія
      if (data.session) router.replace('/dashboard'); else setSubmitted(true);
    } catch (e:any) { setErrorMsg(e.message||'Помилка реєстрації'); } finally { setLoading(false); }
  }

  if (submitted && !usePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold">Перевірте вашу пошту</h1>
          <p className="mt-2 text-gray-600">Ми відправили посилання для входу на <strong>{email}</strong>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="mb-3 text-center text-sm text-gray-600">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={usePassword} onChange={(e)=>setUsePassword(e.target.checked)} />
            Використовувати парольний вхід
          </label>
        </div>
        {!usePassword ? (
          <form className="rounded-lg border bg-white p-8 shadow-sm" onSubmit={handleMagic}>
            <h1 className="mb-4 text-center text-2xl font-bold">Вхід / Реєстрація (Magic Link)</h1>
            <div className="mb-4">
              <input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email@example.com" required disabled={loading} className="w-full rounded-md border-gray-200 p-3 shadow-sm disabled:opacity-60" />
            </div>
            {errorMsg && <div className="mb-4 text-sm text-red-600" role="alert">{errorMsg}</div>}
            <button type="submit" className="block w-full rounded-lg bg-zinc-800 px-5 py-3 text-sm font-medium text-white">{loading ? 'Надсилаємо…' : 'Отримати посилання'}</button>
          </form>
        ) : (
          <div className="rounded-lg border bg-white p-8 shadow-sm">
            <h1 className="mb-4 text-center text-2xl font-bold">Вхід / Реєстрація (Пароль)</h1>
            <div className="mb-3">
              <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email@example.com" className="w-full rounded-md border-gray-200 p-3 shadow-sm" />
            </div>
            <div className="mb-4">
              <input type="password" autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Пароль" className="w-full rounded-md border-gray-200 p-3 shadow-sm" />
            </div>
            {errorMsg && <div className="mb-4 text-sm text-red-600" role="alert">{errorMsg}</div>}
            <div className="flex items-center gap-2">
              <button data-testid="pw-signin" onClick={handleSignin} className="flex-1 rounded-lg bg-zinc-800 px-5 py-3 text-sm font-medium text-white">{loading ? 'Вхід…' : 'Увійти'}</button>
              <button data-testid="pw-signup" onClick={handleSignup} className="flex-1 rounded-lg border px-5 py-3 text-sm">Реєстрація</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}