// File: pim-frontend/src/app/dashboard/items/[id]/edit/EmbeddingComponent.tsx
'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function EmbeddingComponent({ itemId }: { itemId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!itemId) throw new Error('itemId відсутній');

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!baseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL не налаштовано');

      const response = await fetch(
        `${baseUrl}/functions/v1/generate-embedding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ itemId }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Невідома помилка');

      setSuccess('Ембединг успішно створено/оновлено!');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 rounded-lg border bg-white p-8 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Семантичний Пошук</h2>
          <p className="mt-1 text-sm text-gray-500">
            Створіть векторний &quot;відбиток&quot; товару для &quot;розумного&quot; пошуку.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          aria-busy={loading}
          className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Створення...' : 'Створити / Оновити Ембединг'}
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-red-600">Помилка: {error}</p>}
      {success && <p className="mt-4 text-sm text-green-600">{success}</p>}
    </div>
  );
}