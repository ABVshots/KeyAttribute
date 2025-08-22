import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import RetryJobButton from '../../RetryJobButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createServerComponentClient({ cookies });
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-4 text-sm">Unauthorized</div>;

  const { data: job } = await supabase
    .from('i18n_import_jobs')
    .select('id, status, format, scope, org_id, requested_by, attempts, stats, created_at, finished_at')
    .eq('id', id)
    .maybeSingle();
  if (!job || job.requested_by !== user.id) return <div className="p-4 text-sm">Not found</div>;

  const { data: payloadRow } = await supabase
    .from('i18n_import_job_payloads')
    .select('payload')
    .eq('job_id', id)
    .maybeSingle();
  const payload = String(payloadRow?.payload || '');

  const { data: logs } = await supabase
    .from('i18n_import_job_logs')
    .select('ts, level, message, data')
    .eq('job_id', id)
    .order('ts', { ascending: true })
    .limit(1000);

  const canRetry = job.status === 'failed' || (job.status === 'running' && !job.finished_at && (Date.now() - new Date(job.created_at).getTime()) > 10*60*1000);

  const payloadDownload = `/api/i18n/import/jobs/${encodeURIComponent(id)}/payload?download=1`;
  const logsJsonDownload = `/api/i18n/import/jobs/${encodeURIComponent(id)}/logs?download=1`;
  const logsCsvDownload = `/api/i18n/import/jobs/${encodeURIComponent(id)}/logs?format=csv&download=1`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Import Job: <span className="font-mono">{id}</span></h1>
        <div className="flex items-center gap-2">
          <RetryJobButton id={id} disabled={!canRetry} />
          <Link href="/dashboard/settings/i18n" className="rounded border px-3 py-1 text-sm">Назад</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded border bg-white p-3">
          <div className="mb-2 text-sm font-semibold">Статус</div>
          <div className="text-sm">
            <div>status: <span className="rounded bg-gray-100 px-2 py-0.5">{job.status}</span></div>
            <div>format: {job.format}</div>
            <div>attempts: {job.attempts ?? 0}</div>
            <div>created: {new Date(job.created_at).toLocaleString()}</div>
            <div>finished: {job.finished_at ? new Date(job.finished_at).toLocaleString() : '-'}</div>
            <div className="mt-2">
              <div className="mb-1 font-medium">Stats</div>
              <pre className="max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(job.stats||{}, null, 2)}</pre>
            </div>
          </div>
        </div>
        <div className="rounded border bg-white p-3 md:col-span-2">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <div>Payload</div>
            <a href={payloadDownload} className="rounded border px-2 py-1 text-xs">Download</a>
          </div>
          <pre className="max-h-80 overflow-auto rounded bg-gray-50 p-2 text-xs whitespace-pre-wrap break-all">{payload}</pre>
        </div>
      </div>

      <div className="rounded border bg-white p-3">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <div>Логи</div>
          <div className="flex items-center gap-2">
            <a href={logsJsonDownload} className="rounded border px-2 py-1 text-xs">Export JSON</a>
            <a href={logsCsvDownload} className="rounded border px-2 py-1 text-xs">Export CSV</a>
          </div>
        </div>
        {(!logs || logs.length===0) ? (
          <div className="text-xs text-gray-500">Порожньо</div>
        ) : (
          <ul className="max-h-96 overflow-auto text-xs">
            {logs!.map((l:any, i:number)=> (
              <li key={i} className="border-t p-1"><span className="text-gray-400">{new Date(l.ts).toLocaleString()}</span> [
                <span className={l.level==='error'?'text-red-600':l.level==='warn'?'text-yellow-600':'text-gray-700'}>{l.level}</span>
              ] {l.message}{l.data ? ` · ${JSON.stringify(l.data)}` : ''}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
