'use client';

import { useEffect, useState } from 'react';

export default function JobLogsClient({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<Array<{ ts: string; level: string; message: string; data?: any }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/i18n/import/jobs/${encodeURIComponent(jobId)}/logs`, { cache: 'no-store' });
        const j = res.ok ? await res.json() : { items: [] };
        if (active) setItems(j.items || []);
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [jobId]);

  if (loading) return <div className="h-10 animate-pulse rounded bg-gray-100" />;
  if (!items.length) return <div className="text-xs text-gray-400">Логи відсутні</div>;

  return (
    <ul className="text-xs">
      {items.map((r, i) => (
        <li key={i}><span className="text-gray-400">{new Date(r.ts).toLocaleTimeString()}</span> [{r.level}] {r.message}</li>
      ))}
    </ul>
  );
}
