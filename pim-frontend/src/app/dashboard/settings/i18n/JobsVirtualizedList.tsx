'use client';

import Link from 'next/link';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import RetryJobButton from './RetryJobButton';
import DeleteJobButton from './DeleteJobButton';
import JobStatus from './JobStatus';
import JobLogsClient from './JobLogsClient';

export type JobItem = { id: string; status: string; scope: string; created_at: string; finished_at?: string; stats?: any; progress?: number; total?: number };

function canRetry(j: JobItem & { finished_at?: string }) {
  if (j.status === 'failed') return true;
  if (j.status === 'queued') return false;
  if (j.status === 'running') {
    if (!j.finished_at) {
      const started = new Date(j.created_at).getTime();
      return (Date.now() - started) > 10 * 60 * 1000; // stuck > 10 min
    }
    return false;
  }
  return false;
}

function Row({ index, style, data }: ListChildComponentProps) {
  const j = (data.items as JobItem[])[index];
  return (
    <div style={style} className="px-1">
      <div className="rounded border p-2 h-[128px] overflow-hidden">
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
        <div className="mt-2 rounded bg-gray-50 p-2 h-[40px] overflow-auto">
          <JobLogsClient jobId={j.id} />
        </div>
      </div>
    </div>
  );
}

export default function JobsVirtualizedList({ items, height = 400, itemSize = 140 }: { items: JobItem[]; height?: number; itemSize?: number }) {
  return (
    <List height={height} width={"100%"} itemSize={itemSize} itemCount={items.length} itemData={{ items }}>
      {Row}
    </List>
  );
}
