"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RetryJobButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForce, setShowForce] = useState(false);
  const router = useRouter();

  async function postJson(url: string, body: any) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let j: any = null;
    try { j = await res.json(); } catch {}
    if (!res.ok) {
      const code = j?.error || 'error';
      const extra = (typeof j?.waitSeconds === 'number') ? `:${j.waitSeconds}` : '';
      throw new Error(`${code}${extra}`);
    }
    return j;
  }

  async function onRetry() {
    if (loading || disabled) return;
    setLoading(true); setMsg(null);
    try {
      await postJson('/api/i18n/import/retry', { id });
      setMsg('Job retried');
      router.refresh();
    } catch (e:any) { setMsg(e.message||'Failed'); } finally { setLoading(false); setTimeout(()=>setMsg(null), 2500); }
  }

  async function onCancel() {
    if (loading) return;
    setLoading(true); setMsg(null); setShowForce(false);
    try {
      await postJson('/api/i18n/import/cancel', { id });
      setMsg('Cancelling…');
      // if still not finished in a while, show Force Cancel
      setTimeout(()=> setShowForce(true), 5000);
      router.refresh();
    } catch (e:any) { setMsg(e.message||'Failed'); } finally { setLoading(false); setTimeout(()=>setMsg(null), 2500); }
  }

  async function onForceCancel() {
    if (loading) return;
    setLoading(true); setMsg(null);
    try {
      await postJson('/api/i18n/import/cancel/force', { id });
      setMsg('Force cancelled');
      router.refresh();
    } catch (e:any) {
      const m = String(e.message||'');
      if (m.startsWith('grace_period')) {
        const parts = m.split(':');
        const wait = parts[1] ? Number(parts[1]) : 0;
        setMsg(wait ? `Зачекайте ${wait}с і спробуйте знову` : 'Зачекайте та спробуйте знову');
      } else if (m === 'unauthorized') {
        setMsg('Увійдіть в систему');
      } else if (m === 'forbidden') {
        setMsg('Немає прав');
      } else {
        setMsg(m || 'Failed');
      }
    } finally { setLoading(false); setTimeout(()=>setMsg(null), 3000); }
  }

  useEffect(()=>{ setShowForce(false); }, [id]);

  return (
    <div className="flex items-center gap-2">
      <button onClick={onRetry} disabled={disabled || loading} className="rounded border px-2 py-1 text-xs disabled:opacity-50">{loading ? 'Retry…' : 'Retry'}</button>
      <button onClick={onCancel} disabled={loading} className="rounded border px-2 py-1 text-xs">Cancel</button>
      {showForce && (
        <button onClick={onForceCancel} disabled={loading} className="rounded border px-2 py-1 text-xs text-red-700">Force</button>
      )}
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}
