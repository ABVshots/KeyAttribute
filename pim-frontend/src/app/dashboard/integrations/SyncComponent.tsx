// File: pim-frontend/src/app/dashboard/integrations/SyncComponent.tsx
'use client';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function SyncComponent({ integrationId }: { integrationId: string }) {
  const [loading, setLoading] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [queued, setQueued] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const callFunction = async (functionName: string, body: Record<string, unknown>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!baseUrl) throw new Error('Base URL is not configured');
      const resp = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Upstream error');
      return data as { success?: boolean; message?: string; queued?: number; job_id?: string };
    } catch (e: unknown) {
      throw new Error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSyncCategories = async () => {
    setLoading('categories');
    setMessage('Запускаємо синхронізацію категорій…');
    setQueued(null);
    setJobId(null);
    try {
      const res = await callFunction('cartum-sync-categories', { integration_id: integrationId });
      const queuedVal = (res as any)?.queued;
      const job = (res as any)?.job_id;
      setMessage((res as any)?.message || 'Синхронізацію запущено');
      if (typeof queuedVal === 'number') setQueued(queuedVal);
      if (typeof job === 'string') setJobId(job);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(`Помилка: ${msg}`);
    } finally {
      setLoading('');
    }
  };

  const handleTestConnection = async () => {
    setLoading('test');
    setMessage('Перевіряємо з’єднання…');
    setQueued(null);
    setJobId(null);
    try {
      const res = await callFunction('cartum-auth', { integration_id: integrationId });
      const expiresAt = (res as any)?.expires_at;
      let suffix = '';
      if (typeof expiresAt === 'number') {
        const sec = Math.max(0, Math.floor(expiresAt - Date.now() / 1000));
        suffix = ` (дійсний ~${sec}s)`;
      }
      setMessage(`З’єднання успішне${suffix}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(`Помилка: ${msg}`);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Синхронізація</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <h3 className="font-medium">Перевірити підключення</h3>
            <p className="text-sm text-gray-500">Перевірка авторизації до Cartum (auth token).</p>
          </div>
          <button onClick={handleTestConnection} disabled={!!loading} className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
            {loading === 'test' ? 'Перевірка…' : 'Перевірити'}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <h3 className="font-medium">Синхронізація Категорій</h3>
            <p className="text-sm text-gray-500">Завантажити структуру категорій з Cartum.</p>
          </div>
          <button onClick={handleSyncCategories} disabled={!!loading} className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
            {loading === 'categories' ? 'Запуск…' : 'Запустити'}
          </button>
        </div>
      </div>
      {message && (
        <p className="mt-4 text-sm">
          {message}
          {queued !== null ? ` (записів: ${queued})` : ''}
          {jobId ? (
            <>
              {`, job: `}
              <a href={`/dashboard/import/${jobId}`} className="text-zinc-800 underline">перейти до завдання</a>
            </>
          ) : ''}
        </p>
      )}
    </div>
  );
}