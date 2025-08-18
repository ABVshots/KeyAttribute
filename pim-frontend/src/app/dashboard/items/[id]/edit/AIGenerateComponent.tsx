// File: pim-frontend/src/app/dashboard/items/[id]/edit/AIGenerateComponent.tsx
'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Asset = {
  id: string;
  storage_path: string;
};

type AIGenerateComponentProps = {
  itemId: string;
  assets: Asset[];
};

export default function AIGenerateComponent({ itemId, assets }: AIGenerateComponentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Порожній рядок означає, що нічого не вибрано
  const [selectedAssetId, setSelectedAssetId] = useState<string>(assets[0]?.id ?? '');
  const supabase = createClientComponentClient();

  const handleGenerate = async () => {
    if (!selectedAssetId) {
      setError('Будь ласка, оберіть зображення для аналізу.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!baseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL не налаштовано');

      const response = await fetch(
        `${baseUrl}/functions/v1/ai-generate-multimodal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ itemId, assetId: selectedAssetId }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Невідома помилка');

      setSuccess('Описи успішно згенеровано та збережено як чернетку!');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 rounded-lg border bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold">AI Генерація Описів</h2>
      <p className="mt-1 text-sm text-gray-500">
        Оберіть зображення, і AI згенерує повний набір SEO-текстів для товару.
      </p>

      <div className="mt-6">
        <label htmlFor="asset-select" className="block text-sm font-medium text-gray-700">
          Оберіть зображення для аналізу
        </label>
        <select
          id="asset-select"
          value={selectedAssetId}
          onChange={(e) => setSelectedAssetId(e.target.value)}
          disabled={loading || assets.length === 0}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="" disabled>
            {assets.length === 0 ? 'Спочатку завантажте зображення' : '— Оберіть зображення —'}
          </option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.storage_path.split('/').pop()}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          onClick={handleGenerate}
          disabled={loading || !selectedAssetId}
          aria-busy={loading}
          className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Генерація...' : 'Згенерувати'}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">Помилка: {error}</p>}
      {success && <p className="mt-4 text-sm text-green-600">{success}</p>}
    </div>
  );
}