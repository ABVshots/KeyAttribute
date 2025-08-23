'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CbInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const code = sp.get('code');
      const next = sp.get('next');
      const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

      try {
        if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
          const access_token = params.get('access_token') || '';
          const refresh_token = params.get('refresh_token') || '';
          if (access_token && refresh_token) {
            await fetch('/auth/callback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ access_token, refresh_token }) });
            router.replace(safe);
            return;
          }
        }
        if (code) {
          const u = new URL('/auth/callback', location.origin);
          u.searchParams.set('code', code);
          if (next) u.searchParams.set('next', next);
          location.replace(u.toString());
          return;
        }
      } catch {}
      router.replace(safe);
    };
    run();
  }, [router, sp]);

  return null;
}

export default function AuthCbPage() {
  return (
    <Suspense>
      <CbInner />
    </Suspense>
  );
}
