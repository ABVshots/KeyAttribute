import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import JobStatus from './JobStatus';
import RetryJobButton from './RetryJobButton';
import DeleteJobButton from './DeleteJobButton';

// Minimal server-friendly i18n to surface keys for extractor
function tS(k: string, _p?: Record<string, any>, o?: { fallback?: string }) {
  return o?.fallback || k;
}

async function JobLogs({ jobId }: { jobId: string }) {
  const supabase = createServerComponentClient({ cookies });
  const { data: rows } = await supabase
    .from('i18n_import_job_logs')
    .select('ts, level, message')
    .eq('job_id', jobId)
    .order('ts', { ascending: true })
    .limit(100);
  if (!rows || rows.length === 0) return <div className="text-xs text-gray-400">{tS('settings.jobs.logs.empty', undefined, { fallback: 'Логи відсутні' })}</div>;
  return (
    <ul className="text-xs">
      {rows.map((r:any, i:number) => (
        <li key={i}><span className="text-gray-400">{new Date(r.ts).toLocaleTimeString()}</span> [{r.level}] {r.message}</li>
      ))}
    </ul>
  );
}

export default async function ImportJobsList({ pageSize = 10, searchParams = {} as Record<string, any> }: { pageSize?: number; searchParams?: Record<string, any> }) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const status = (searchParams.jobStatus || '').trim();
  const scope = (searchParams.jobScope || '').trim();
  const q = (searchParams.q || '').trim();
  const days = Math.max(0, Number(searchParams.days || '0') || 0);
  const cursor = (searchParams.jobsCursor || '').trim();

  let query = supabase
    .from('i18n_import_jobs')
    .select('id, status, scope, org_id, created_at, finished_at, stats, progress, total')
    .eq('requested_by', user.id)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (scope) query = query.eq('scope', scope);
  if (q) query = query.like('id', `%${q}%`);
  if (days > 0) {
    const sinceIso = new Date(Date.now() - days*24*60*60*1000).toISOString();
    query = query.gte('created_at', sinceIso);
  }
  if (cursor) query = query.lt('created_at', cursor);

  const { data: jobsRaw } = await query.limit(pageSize + 1);
  const jobs = (jobsRaw || []);
  const hasMore = jobs.length > pageSize;
  const items = hasMore ? jobs.slice(0, pageSize) : jobs;
  const nextCursor = hasMore ? String(items[items.length - 1].created_at) : '';

  const now = Date.now();

  function canRetry(j: any) {
    if (j.status === 'failed') return true;
    if (j.status === 'queued') return false;
    if (j.status === 'running') {
      if (!j.finished_at) {
        const started = new Date(j.created_at).getTime();
        return (now - started) > 10 * 60 * 1000;
      }
      return false;
    }
    return false;
  }

  function urlWithCursor(cur?: string) {
    const params = new URLSearchParams();
    const sp = (searchParams || {}) as Record<string, any>;
    for (const [k, v] of Object.entries(sp)) {
      if (k === 'jobsPage' || k === 'jobsPageSize') continue;
      if (k === 'jobsCursor') continue;
      if (v == null) continue;
      if (typeof v === 'string') params.set(k, v);
      else if (Array.isArray(v)) {
        const first = v.find((x) => typeof x === 'string');
        if (first) params.set(k, first as string);
      }
    }
    params.set('jobsPageSize', String(pageSize));
    if (cur) params.set('jobsCursor', cur);
    return `/dashboard/settings/i18n/jobs?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-0 z-10 -mx-3 -mt-3 bg-white/90 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <form method="get" action="/dashboard/settings/i18n/jobs" className="flex flex-wrap items-end gap-2 text-xs">
          <input type="hidden" name="jobsCursor" value="" />
          <input type="hidden" name="jobsPageSize" value={String(pageSize)} />
          <div className="flex flex-col">
            <label className="mb-1">{tS('settings.jobs.filters.status', undefined, { fallback: 'Status' })}</label>
            <select name="jobStatus" defaultValue={status} className="rounded border px-2 py-1">
              <option value="">{tS('settings.jobs.filters.all', undefined, { fallback: 'All' })}</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="done">done</option>
              <option value="failed">failed</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1">{tS('settings.jobs.filters.scope', undefined, { fallback: 'Scope' })}</label>
            <select name="jobScope" defaultValue={scope} className="rounded border px-2 py-1">
              <option value="">{tS('settings.jobs.filters.all', undefined, { fallback: 'All' })}</option>
              <option value="global">global</option>
              <option value="org">org</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1">{tS('settings.jobs.filters.search', undefined, { fallback: 'Search (ID)' })}</label>
            <input name="q" defaultValue={q} placeholder="uuid…" className="w-48 rounded border px-2 py-1" />
          </div>
          <div className="flex flex-col">
            <label className="mb-1">{tS('settings.jobs.filters.days', undefined, { fallback: 'Days' })}</label>
            <input name="days" type="number" min={0} max={365} defaultValue={days || ''} placeholder="0" className="w-20 rounded border px-2 py-1" />
          </div>
          <button className="rounded border px-3 py-1">{tS('settings.jobs.filters.apply', undefined, { fallback: 'Apply' })}</button>
          <Link href="/dashboard/settings/i18n/jobs" className="rounded border px-3 py-1">{tS('settings.jobs.filters.clear', undefined, { fallback: 'Clear' })}</Link>
        </form>
      </div>

      <div className="max-h-96 overflow-auto pr-1">
        <div className="space-y-2">
          {(items||[]).length === 0 ? (
            <div className="text-sm text-gray-500">{tS('settings.jobs.empty', undefined, { fallback: 'Немає джобів' })}</div>
          ) : (
            items!.map((j: any) => (
              <div key={j.id} className="rounded border p-2">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <div>{new Date(j.created_at).toLocaleString()}</div>
                    <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] uppercase">{j.scope}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/settings/i18n/jobs/${j.id}`} className="rounded border px-2 py-0.5">{tS('settings.jobs.details', undefined, { fallback: 'Деталі' })}</Link>
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
        <div>{cursor ? tS('settings.jobs.shownNewer', { time: new Date(cursor).toLocaleString() }, { fallback: `Показано новіші за ${new Date(cursor).toLocaleString()}` }) : tS('settings.jobs.shownLatest', undefined, { fallback: 'Показано найновіші' })}</div>
        <div className="flex items-center gap-2">
          <Link href={urlWithCursor()} className={`rounded border px-2 py-1 ${cursor ? '' : 'pointer-events-none opacity-50'}`}>{tS('settings.jobs.reset', undefined, { fallback: 'Reset' })}</Link>
          <Link href={urlWithCursor(nextCursor)} className={`rounded border px-2 py-1 ${hasMore ? '' : 'pointer-events-none opacity-50'}`}>{tS('settings.jobs.loadOlder', undefined, { fallback: 'Load older' })}</Link>
        </div>
      </div>
    </div>
  );
}
