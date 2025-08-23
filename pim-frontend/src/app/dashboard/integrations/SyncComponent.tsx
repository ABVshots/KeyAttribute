// File: pim-frontend/src/app/dashboard/integrations/SyncComponent.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useT } from '@/app/i18n/I18nProvider';

type CartumAuthResponse = { token?: string; expires_at?: number; error?: string };
type SyncCategoriesResponse = { success?: boolean; message?: string; queued?: number; job_id?: string; error?: string };
type WorkerResponse = { success?: boolean; job_id?: string; error?: string };

export default function SyncComponent({ integrationId }: { integrationId: string }) {
  const [loading, setLoading] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [queued, setQueued] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const supabase = createClientComponentClient();
  const t = useT();

  async function callFunction<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error(t('integrations.sync.notAuth', undefined, { fallback: 'Not authenticated' }));
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) throw new Error(t('integrations.sync.noBaseUrl', undefined, { fallback: 'Base URL is not configured' }));
    const resp = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    const data = (await resp.json().catch(() => ({}))) as T & { error?: string };
    if (!resp.ok) throw new Error(data?.error || t('integrations.sync.upstreamError', undefined, { fallback: 'Upstream error' }));
    return data;
  }

  const handleSyncCategories = async () => {
    setLoading('categories');
    setMessage(t('integrations.sync.startingCategories', undefined, { fallback: 'Запускаємо синхронізацію категорій…' }));
    setQueued(null);
    setJobId(null);
    try {
      const res = await callFunction<SyncCategoriesResponse>('cartum-sync-categories', { integration_id: integrationId });
      setMessage(res.message || t('integrations.sync.categoriesQueued', undefined, { fallback: 'Синхронізацію запущено' }));
      if (typeof res.queued === 'number') setQueued(res.queued);
      if (typeof res.job_id === 'string') setJobId(res.job_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(t('integrations.sync.error', { msg }, { fallback: `Помилка: ${msg}` }));
    } finally {
      setLoading('');
    }
  };

  const handleTestConnection = async () => {
    setLoading('test');
    setMessage(t('integrations.sync.testing', undefined, { fallback: 'Перевіряємо з’єднання…' }));
    setQueued(null);
    setJobId(null);
    try {
      const res = await callFunction<CartumAuthResponse>('cartum-auth', { integration_id: integrationId });
      let suffix = '';
      if (typeof res.expires_at === 'number') {
        const sec = Math.max(0, Math.floor(res.expires_at - Date.now() / 1000));
        suffix = t('integrations.sync.tokenValid', { sec }, { fallback: ` (дійсний ~${sec}s)` });
      }
      setMessage(t('integrations.sync.testOk', undefined, { fallback: 'З’єднання успішне' }) + suffix);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(t('integrations.sync.error', { msg }, { fallback: `Помилка: ${msg}` }));
    } finally {
      setLoading('');
    }
  };

  const handleRunWorker = async () => {
    setLoading('worker');
    setMessage(t('integrations.sync.startWorker', undefined, { fallback: 'Запускаємо обробник…' }));
    setQueued(null);
    setJobId(null);
    try {
      const res = await callFunction<WorkerResponse>('process-staged-data', {});
      setMessage(t('integrations.sync.workerOk', undefined, { fallback: 'Обробник запущено' }));
      if (typeof res.job_id === 'string') setJobId(res.job_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(t('integrations.sync.error', { msg }, { fallback: `Помилка: ${msg}` }));
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{t('integrations.sync.title', undefined, { fallback: 'Синхронізація' })}</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <h3 className="font-medium">{t('integrations.sync.testTitle', undefined, { fallback: 'Перевірити підключення' })}</h3>
            <p className="text-sm text-gray-500">{t('integrations.sync.testDesc', undefined, { fallback: 'Перевірка авторизації до Cartum (auth token).' })}</p>
          </div>
          <button onClick={handleTestConnection} disabled={!!loading} className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
            {loading === 'test' ? t('integrations.common.running', undefined, { fallback: 'Перевірка…' }) : t('integrations.sync.testAction', undefined, { fallback: 'Перевірити' })}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <h3 className="font-medium">{t('integrations.sync.categoriesTitle', undefined, { fallback: 'Синхронізація Категорій' })}</h3>
            <p className="text-sm text-gray-500">{t('integrations.sync.categoriesDesc', undefined, { fallback: 'Завантажити структуру категорій з Cartum.' })}</p>
          </div>
          <button onClick={handleSyncCategories} disabled={!!loading} className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
            {loading === 'categories' ? t('integrations.common.running', undefined, { fallback: 'Запуск…' }) : t('integrations.sync.categoriesAction', undefined, { fallback: 'Запустити' })}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <h3 className="font-medium">{t('integrations.sync.workerTitle', undefined, { fallback: 'Запустити обробник' })}</h3>
            <p className="text-sm text-gray-500">{t('integrations.sync.workerDesc', undefined, { fallback: 'Обробка даних у staging та оновлення довідників.' })}</p>
          </div>
          <button onClick={handleRunWorker} disabled={!!loading} className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
            {loading === 'worker' ? t('integrations.common.running', undefined, { fallback: 'Запуск…' }) : t('integrations.sync.workerAction', undefined, { fallback: 'Запустити' })}
          </button>
        </div>
      </div>
      {message && (
        <p className="mt-4 text-sm">
          {message}
          {queued !== null ? t('integrations.sync.queued', { n: queued }, { fallback: ` (записів: ${queued})` }) : ''}
          {jobId ? (
            <>
              {t('integrations.sync.jobLabel', undefined, { fallback: ', job: ' })}
              <Link href={`/dashboard/import/${jobId}`} className="text-zinc-800 underline">{t('integrations.sync.openJob', undefined, { fallback: 'перейти до завдання' })}</Link>
            </>
          ) : ''}
        </p>
      )}
    </div>
  );
}