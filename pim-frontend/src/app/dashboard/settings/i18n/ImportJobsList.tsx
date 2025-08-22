import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import JobStatus from './JobStatus';
import RetryJobButton from './RetryJobButton';
import DeleteJobButton from './DeleteJobButton';

async function JobLogs({ jobId }: { jobId: string }) {
  const supabase = createServerComponentClient({ cookies });
  const { data: rows } = await supabase
    .from('i18n_import_job_logs')
    .select('ts, level, message')
    .eq('job_id', jobId)
    .order('ts', { ascending: true })
    .limit(100);
  if (!rows || rows.length === 0) return <div className="text-xs text-gray-400">Логи відсутні</div>;
  return (
    <ul className="text-xs">
      {rows.map((r:any, i:number) => (
        <li key={i}><span className="text-gray-400">{new Date(r.ts).toLocaleTimeString()}</span> [{r.level}] {r.message}</li>
      ))}
    </ul>
  );
}

export default async function ImportJobsList({ page = 1, pageSize = 10, searchParams = {} as Record<string, any> }: { page?: number; pageSize?: number; searchParams?: Record<string, any> }) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const status = (searchParams.jobStatus || '').trim();
  const scope = (searchParams.jobScope || '').trim();
  const q = (searchParams.q || '').trim();
  const days = Math.max(0, Number(searchParams.days || '0') || 0); // 0 = no filter

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('i18n_import_jobs')
    .select('id, status, scope, org_id, created_at, finished_at, stats, progress, total', { count: 'exact' })
    .eq('requested_by', user.id);
  if (status) query = query.eq('status', status);
  if (scope) query = query.eq('scope', scope);
  if (q) query = query.like('id', `%${q}%`);
  if (days > 0) {
    const sinceIso = new Date(Date.now() - days*24*60*60*1000).toISOString();
    query = query.gte('created_at', sinceIso);
  }
  const { data: jobs, count } = await query.order('created_at', { ascending: false }).range(from, to);

  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const now = Date.now();

  function canRetry(j: any) {
    if (j.status === 'failed') return true;
    if (j.status === 'queued') return false;
    if (j.status === 'running') {
      if (!j.finished_at) {
        const started = new Date(j.created_at).getTime();
        return (now - started) > 10 * 60 * 1000; // stuck > 10 min
      }
      return false;
    }
    return false;
  }

  function urlFor(p: number) {
    const params = new URLSearchParams();
    const sp = (searchParams || {}) as Record<string, any>;
    for (const [k, v] of Object.entries(sp)) {
      if (v == null) continue;
      if (typeof v === 'string') params.set(k, v);
      else if (Array.isArray(v)) {
        const first = v.find((x) => typeof x === 'string');
        if (first) params.set(k, first as string);
      } // skip non-string values (e.g., Symbols)
    }
    params.set('jobsPage', String(p));
    params.set('jobsPageSize', String(pageSize));
    return `/dashboard/settings/i18n?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <form method="get" action="/dashboard/settings/i18n" className="flex flex-wrap items-end gap-2 text-xs">
        <input type="hidden" name="jobsPage" value="1" />
        <input type="hidden" name="jobsPageSize" value={String(pageSize)} />
        <div className="flex flex-col">
          <label className="mb-1">Status</label>
          <select name="jobStatus" defaultValue={status} className="rounded border px-2 py-1">
            <option value="">All</option>
            <option value="queued">queued</option>
            <option value="running">running</option>
            <option value="done">done</option>
            <option value="failed">failed</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="mb-1">Scope</label>
          <select name="jobScope" defaultValue={scope} className="rounded border px-2 py-1">
            <option value="">All</option>
            <option value="global">global</option>
            <option value="org">org</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="mb-1">Search (ID)</label>
          <input name="q" defaultValue={q} placeholder="uuid…" className="w-48 rounded border px-2 py-1" />
        </div>
        <div className="flex flex-col">
          <label className="mb-1">Days</label>
          <input name="days" type="number" min={0} max={365} defaultValue={days || ''} placeholder="0" className="w-20 rounded border px-2 py-1" />
        </div>
        <button className="rounded border px-3 py-1">Apply</button>
        <Link href="/dashboard/settings/i18n" className="rounded border px-3 py-1">Clear</Link>
      </form>

      <div className="max-h-96 overflow-auto pr-1">
        <div className="space-y-2">
          {(jobs||[]).length === 0 ? (
            <div className="text-sm text-gray-500">Немає джобів</div>
          ) : (
            jobs!.map((j: any) => (
              <div key={j.id} className="rounded border p-2">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <div>{new Date(j.created_at).toLocaleString()}</div>
                    <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] uppercase">{j.scope}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/settings/i18n/jobs/${j.id}`} className="rounded border px-2 py-0.5">Деталі</Link>
                    <RetryJobButton id={j.id} disabled={!canRetry(j)} />
                    <DeleteJobButton id={j.id} disabled={j.status==='running' || j.status==='queued'} />
                  </div>
                </div>
                <JobStatus id={j.id} initial={{ status: j.status, stats: j.stats, progress: j.progress, total: j.total }} />
                <div className="mt-2 rounded bg-gray-50 p-2">
                  <JobLogs jobId={j.id} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
        <div>Сторінка {page} з {totalPages} · Всього {total}</div>
        <div className="flex items-center gap-2">
          <Link href={urlFor(Math.max(1, page - 1))} className={`rounded border px-2 py-1 ${page<=1 ? 'pointer-events-none opacity-50' : ''}`}>Назад</Link>
          <Link href={urlFor(Math.min(totalPages, page + 1))} className={`rounded border px-2 py-1 ${page>=totalPages ? 'pointer-events-none opacity-50' : ''}`}>Далі</Link>
        </div>
      </div>
    </div>
  );
}
