// File: pim-frontend/src/app/dashboard/items/[id]/edit/AIAnalyzeComponent.tsx
'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Attribute = {
  label: string;
  value: string;
};

const MAX_INPUT_CHARS = 6000;

export default function AIAnalyzeComponent({ initialText = '' }: { initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Attribute[] | null>(null);
  const supabase = createClientComponentClient();

  const handleAnalyze = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Введіть текст для аналізу.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!baseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL не налаштовано');

      const response = await fetch(`${baseUrl}/functions/v1/ai-analyze-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text: trimmed }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Невідома помилка');

      const attrs = data?.attributes;
      if (!Array.isArray(attrs)) {
        throw new Error('Неправильний формат відповіді від AI');
      }
      // базова нормалізація
      const normalized: Attribute[] = attrs
        .filter((a: any) => a && typeof a.label === 'string' && typeof a.value === 'string')
        .map((a: any) => ({ label: a.label.trim(), value: a.value.toString().trim() }));

      setResults(normalized);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 rounded-lg border bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold">AI Аналіз Тексту</h2>
      <p className="mt-1 text-sm text-gray-500">
        Вставте опис товару, і AI спробує автоматично витягти атрибути.
      </p>

      <div className="mt-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_INPUT_CHARS))}
          rows={8}
          maxLength={MAX_INPUT_CHARS}
          className="w-full rounded-md border-gray-300 font-mono text-sm shadow-sm"
          placeholder="Наприклад: Футболка синього кольору, виготовлена зі 100% бавовни..."
          disabled={loading}
        />
        <div className="mt-1 text-right text-xs text-gray-500">
          {text.length}/{MAX_INPUT_CHARS}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          onClick={handleAnalyze}
          disabled={loading || text.trim().length === 0}
          aria-busy={loading}
          className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Аналіз...' : 'Аналізувати'}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">Помилка: {error}</p>}

      {results && (
        <div className="mt-6">
          <h3 className="font-semibold">Знайдені атрибути:</h3>
          {results.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {results.map((attr, index) => (
                <li key={index}>
                  <strong>{attr.label}:</strong> {attr.value}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Атрибути не знайдено.</p>
          )}
        </div>
      )}
    </div>
  );
}