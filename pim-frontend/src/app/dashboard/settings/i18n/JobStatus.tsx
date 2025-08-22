"use client";

import { useEffect, useState } from 'react';

type Job = { id: string; status: string; created_at?: string; finished_at?: string; stats?: any; progress?: number; total?: number; cancelled?: boolean };

export default function JobStatus({ id, initial }: { id: string; initial?: Partial<Job> }) {
  const [job, setJob] = useState<Job | null>(initial ? ({ id, status: initial.status || 'running', stats: initial.stats, progress: initial.progress as number, total: initial.total as number, cancelled: initial.cancelled as boolean } as Job) : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch(`/api/i18n/import/jobs?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        if (j?.job) setJob(j.job);
        if (!stopped && j?.job?.status && j.job.status !== 'done' && j.job.status !== 'failed') {
          timer = setTimeout(poll, 1000);
        }
      } catch (e: any) {
        setError(e.message || 'error');
        timer = setTimeout(poll, 2000);
      }
    }
    poll();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [id]);

  const progress = Math.min(100, Math.max(0, job && job.total ? Math.floor(((job.progress||0) / job.total) * 100) : 0));
  const statusLabel = job?.cancelled && job?.status === 'running' ? 'cancelling…' : (job?.status || 'loading');

  return (
    <div className="rounded border p-2 text-xs">
      <div className="mb-1">Job: <span className="font-mono">{id}</span></div>
      {error && <div className="mb-1 text-red-600">{error}</div>}
      <div className="flex items-center gap-2">
        <span className="rounded bg-gray-100 px-2 py-0.5">{statusLabel}</span>
        {job?.stats && (
          <span className="text-gray-600">created: {job.stats.created||0}, updated: {job.stats.updated||0}, total: {job.stats.total||job?.total||0}</span>
        )}
      </div>
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between">
          <span>Progress</span>
          <span>{progress}%{job?.total ? ` · ${job.progress||0}/${job.total}` : ''}</span>
        </div>
        <div className="h-2 w-full rounded bg-gray-200">
          <div className="h-2 rounded bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
