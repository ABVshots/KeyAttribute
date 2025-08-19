// File: pim-frontend/src/app/dashboard/import/[job_id]/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-700';
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{status}</span>;
}

export default async function ImportJobPage({ params }: { params: Promise<{ job_id: string }> }) {
  const { job_id } = await params;
  const supabase = createServerComponentClient({ cookies });

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', job_id)
    .maybeSingle();

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Імпорт: завдання</h1>
        <Link href="/dashboard/integrations" className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">Повернутись</Link>
      </div>

      {!job && (
        <div className="rounded-md border bg-white p-6">
          {error ? (
            <p className="text-red-600">Помилка: {error.message}</p>
          ) : (
            <p>Завдання не знайдено.</p>
          )}
        </div>
      )}

      {job && (
        <div className="space-y-6">
          <div className="rounded-md border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ID завдання</p>
                <p className="font-mono text-sm">{job.id}</p>
              </div>
              <Badge status={job.status} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Створено</p>
                <p className="text-sm">{job.created_at ? new Date(job.created_at).toLocaleString() : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Почато</p>
                <p className="text-sm">{job.started_at ? new Date(job.started_at).toLocaleString() : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Завершено</p>
                <p className="text-sm">{job.finished_at ? new Date(job.finished_at).toLocaleString() : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Пріоритет</p>
                <p className="text-sm">{job.priority ?? 0}</p>
              </div>
            </div>

            {job.error && (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {job.error}
              </div>
            )}
          </div>

          <div className="rounded-md border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700">Параметри</h2>
            <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-800">{JSON.stringify(job.payload ?? {}, null, 2)}</pre>
          </div>

          {job.result && (
            <div className="rounded-md border bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700">Результат</h2>
              <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-800">{JSON.stringify(job.result ?? {}, null, 2)}</pre>
            </div>
          )}

          <div className="flex justify-end">
            <Link href={`/dashboard/import/${job_id}`} className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">Оновити</Link>
          </div>
        </div>
      )}
    </div>
  );
}
