'use client';

import { useEffect, useState } from 'react';

export default function AdminToggle() {
  const [isAdmin, setIsAdmin] = useState(false);

  async function load() {
    const res = await fetch('/api/i18n/admins', { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setIsAdmin(!!d.isAdmin); }
  }
  useEffect(() => { void load(); }, []);

  async function setAdmin(v: boolean) {
    if (v) await fetch('/api/i18n/admins', { method: 'POST' });
    else await fetch('/api/i18n/admins', { method: 'DELETE' });
    await load();
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xs text-gray-500">Platform admin:</span>
      <button onClick={()=>setAdmin(!isAdmin)} className={`rounded px-3 py-1 ${isAdmin ? 'bg-green-600 text-white' : 'border'}`}>{isAdmin ? 'ON' : 'OFF'}</button>
    </div>
  );
}
