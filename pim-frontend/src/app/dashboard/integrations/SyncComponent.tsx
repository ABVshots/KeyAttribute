// File: pim-frontend/src/app/dashboard/integrations/SyncComponent.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type CartumAuthResponse = { token?: string; expires_at?: number; error?: string };
type SyncCategoriesResponse = { success?: boolean; message?: string; queued?: number; job_id?: string; error?: string };
type WorkerResponse = { success?: boolean; job_id?: string; error?: string };

export default function SyncComponent({ integrationId }: { integrationId: string }) {
  const [loading, setLoading] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [queued, setQueued] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  async function callFunction<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) throw new Error('Base URL is not configured');
    const resp = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    const data = (await resp.json().catch(() => ({}))) as T & { error?: string };
    if (!resp.ok) throw new Error(data?.error || 'Upstream error');
    return data;
  }

  const handleSyncCategories = async () => {
    setLoading('categories');
    setMessage('Запускаємо синхронізацію категорій…');
    setQueued(null);
    setJobId(null);
    try {
      const res = await callFunction<SyncCategoriesResponse>('cartum-sync-categories', { integration_id: integrationId });
      setMessage(res.message || 'Синхронізацію запущено');
      if (typeof res.queued === 'number') setQueued(res.queued);
      if (typeof res.job_id === 'string') setJobId(res.job_id);
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
      const res = await callFunction<CartumAuthResponse>('cartum-auth', { integration_id: integrationId });
      let suffix = '';
      if (typeof res.expires_at === 'number') {
        const sec = Math.max(0, Math.floor(res.expires_at - Date.now() / 1000));
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

  const handleRunWorker = async () => {
    setLoading('worker');
    setMessage('Запускаємо обробник…');
    setQueued(null);
    setJobId(null);
    try {
      const res = await callFunction<WorkerResponse>('process-staged-data', {});
      setMessage('Обробник запущено');
      if (typeof res.job_id === 'string') setJobId(res.job_id);
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
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <h3 className="font-medium">Перевірити підключення</h3>
            <p className="text-sm text-gray-500">Перевірка авторизації до Cartum (auth token).
            </p>
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

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <h3 className="font-medium">Запустити обробник</h3>
            <p className="text-sm text-gray-500">Обробка даних у staging та оновлення довідників.</p>
          </div>
          <button onClick={handleRunWorker} disabled={!!loading} className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
            {loading === 'worker' ? 'Запуск…' : 'Запустити'}
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
              <Link href={`/dashboard/import/${jobId}`} className="text-zinc-800 underline">перейти до завдання</Link>
            </>
          ) : ''}
        </p>
      )}
    </div>
  );
}