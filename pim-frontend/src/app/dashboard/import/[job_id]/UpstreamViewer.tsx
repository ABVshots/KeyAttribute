'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FixedSizeList as List } from 'react-window';

function useMeta(jobId: string) {
  const [meta, setMeta] = useState<{ has_snapshot: boolean; has_storage: boolean; staging_count: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/dashboard/import/${encodeURIComponent(jobId)}/upstream?meta=1`);
        if (!cancelled && res.ok) setMeta(await res.json());
      } catch { /* ignore */ }
    }
    void load();
    return () => { cancelled = true; };
  }, [jobId]);
  return meta;
}

export default function UpstreamViewer({ jobId }: { jobId: string }) {
  const [json, setJson] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const meta = useMeta(jobId);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/dashboard/import/${encodeURIComponent(jobId)}/upstream`, {
          method: 'GET', headers: { Accept: 'application/json' },
        });
        const ct = res.headers.get('Content-Type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (!cancelled) setJson(data);
        } else {
          const text = await res.text();
          if (!cancelled) setError(text || 'Не вдалося отримати JSON');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [jobId]);

  const text = useMemo(() => JSON.stringify(json ?? {}, null, 2), [json]);

  // Line-based limiting + virtualization
  const { lines, shownLines, totalLines } = useMemo(() => {
    const all = text.split('\n');
    const total = all.length;
    const cap = expanded ? total : 1000;
    const slice = all.slice(0, cap);
    return { lines: slice, shownLines: slice.length, totalLines: total };
  }, [text, expanded]);

  const highlighted = useMemo(() => {
    if (!query.trim()) return lines;
    try {
      const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      return lines.map((l) => l.replace(re, (m) => `<<<${m}>>>`));
    } catch {
      return lines;
    }
  }, [lines, query]);

  async function copyToClipboard() {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }

  const downloadHref = `/dashboard/import/${encodeURIComponent(jobId)}/upstream?download=1`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span className="rounded bg-gray-100 px-2 py-1">snapshot: {meta?.has_snapshot ? 'yes' : 'no'}</span>
        <span className="rounded bg-gray-100 px-2 py-1">storage: {meta?.has_storage ? 'yes' : 'no'}</span>
        <span className="rounded bg-gray-100 px-2 py-1">staging rows: {meta?.staging_count ?? 0}</span>
        <span className="rounded bg-gray-100 px-2 py-1">lines: {shownLines} / {totalLines}</span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          placeholder="Пошук по JSON..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-64 rounded border px-2 py-1 text-sm"
        />
        <button onClick={copyToClipboard} className="rounded border px-3 py-1 text-xs">Скопіювати</button>
        <a href={downloadHref} className="rounded border px-3 py-1 text-xs">Завантажити .json</a>
        <button onClick={() => setExpanded((v) => !v)} className="rounded border px-3 py-1 text-xs">
          {expanded ? 'Показати менше' : 'Показати все'}
        </button>
      </div>

      {loading && <p className="text-xs text-gray-500">Завантаження JSON…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="mt-2 max-h-[70vh] overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-800">
          <List height={Math.min(600, window.innerHeight * 0.6)} itemCount={highlighted.length} itemSize={18} width={'100%'}>
            {({ index, style }: { index: number; style: CSSProperties }) => (
              <div style={style} className="whitespace-pre-wrap break-words">
                {highlighted[index]}
              </div>
            )}
          </List>
          {!expanded && totalLines > shownLines && (
            <p className="mt-2 text-xs text-gray-600">... [Truncated — {totalLines - shownLines} more lines]</p>
          )}
        </div>
      )}
    </div>
  );
}
