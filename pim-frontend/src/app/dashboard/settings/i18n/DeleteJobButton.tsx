"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteJobButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function onClick() {
    if (loading || disabled) return;
    if (!confirm('Видалити задачу?')) return;
    setLoading(true); setMsg(null);
    try {
      const res = await fetch('/api/i18n/import/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const j = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(j?.error || 'error');
      setMsg('Deleted');
      router.refresh();
    } catch (e:any) {
      setMsg(e.message || 'Failed');
    } finally {
      setLoading(false);
      setTimeout(()=>setMsg(null), 2000);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={onClick} disabled={disabled || loading} className="rounded border px-2 py-0.5 text-xs disabled:opacity-50" title="Видалити">
        {loading ? 'Deleting…' : 'Delete'}
      </button>
      {msg && <span className="text-[10px] text-gray-500">{msg}</span>}
    </div>
  );
}
