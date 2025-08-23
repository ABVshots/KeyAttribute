'use client';

import { useEffect, useState } from 'react';

export default function AdminToggle() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/i18n/admins', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setIsAdmin(!!d.isAdmin);
      setError(null);
    } catch (e: any) {
      setError('Failed to load admin status');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function setAdmin(v: boolean) {
    try {
      const res = await fetch('/api/i18n/admins', {
        method: v ? 'POST' : 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
      window.location.reload();
    } catch (e: any) {
      setError('Failed to update admin status');
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xs text-gray-500">Platform admin:</span>
      <button
        onClick={() => setAdmin(!isAdmin)}
        className={`rounded px-3 py-1 ${
          isAdmin ? 'bg-green-600 text-white' : 'border'
        }`}
      >
        {isAdmin ? 'ON' : 'OFF'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
