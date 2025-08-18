// File: pim-frontend/src/app/dashboard/SearchComponent.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type SearchResult = {
  id: string;
  sku: string;
  title: string;
  similarity: number;
};

const THRESHOLD_KEY = 'ka.search.threshold';
const LIMIT_KEY = 'ka.search.limit';
const REMEMBER_KEY = 'ka.search.remember';
const SETTINGS_COOKIE = 'ka.search.settings';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days = 30) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; samesite=lax`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; samesite=lax`;
}

export default function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [threshold, setThreshold] = useState<number>(0.7);
  const [limit, setLimit] = useState<number>(10);
  const [remember, setRemember] = useState<boolean>(true);

  // Завантаження збережених налаштувань: спершу cookie, далі localStorage
  useEffect(() => {
    try {
      // cookie має пріоритет (міжсторінкове/міжвкладкове збереження)
      const cookieStr = readCookie(SETTINGS_COOKIE);
      if (cookieStr) {
        const parsed = JSON.parse(cookieStr) as { threshold?: number; limit?: number; remember?: boolean };
        if (typeof parsed.remember === 'boolean') setRemember(parsed.remember);
        if (Number.isFinite(parsed.threshold)) setThreshold(Math.min(0.99, Math.max(0.0, Number(parsed.threshold))));
        if (Number.isFinite(parsed.limit)) setLimit(Math.min(50, Math.max(1, Math.floor(Number(parsed.limit)))));
        return; // якщо cookie знайдено — не звертаємось до localStorage
      }

      // fallback: localStorage
      const rem = localStorage.getItem(REMEMBER_KEY);
      const shouldRemember = rem === null ? true : rem === '1';
      setRemember(shouldRemember);
      if (shouldRemember) {
        const tRaw = localStorage.getItem(THRESHOLD_KEY);
        const lRaw = localStorage.getItem(LIMIT_KEY);
        const tNum = tRaw !== null ? Number(tRaw) : NaN;
        const lNum = lRaw !== null ? Number(lRaw) : NaN;
        if (Number.isFinite(tNum)) setThreshold(Math.min(0.99, Math.max(0.0, tNum)));
        if (Number.isFinite(lNum)) setLimit(Math.min(50, Math.max(1, Math.floor(lNum))));
      }
    } catch { /* ignore */ }
  }, []);

  // Збереження налаштувань: cookie + localStorage (для сумісності)
  useEffect(() => {
    try {
      const payload = JSON.stringify({ threshold, limit, remember });
      if (remember) {
        writeCookie(SETTINGS_COOKIE, payload, 60); // 60 днів
        localStorage.setItem(REMEMBER_KEY, '1');
        localStorage.setItem(THRESHOLD_KEY, String(threshold));
        localStorage.setItem(LIMIT_KEY, String(limit));
      } else {
        deleteCookie(SETTINGS_COOKIE);
        localStorage.setItem(REMEMBER_KEY, '0');
        localStorage.removeItem(THRESHOLD_KEY);
        localStorage.removeItem(LIMIT_KEY);
      }
    } catch { /* ignore */ }
  }, [remember, threshold, limit]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setResults([]);
      setHasSearched(true);
      return;
    }

    // локальне обмеження значень
    const thr = Math.min(0.99, Math.max(0.0, Number.isFinite(threshold) ? threshold : 0.7));
    const lim = Math.min(50, Math.max(1, Math.floor(Number.isFinite(limit as number) ? (limit as number) : 10)));

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const resp = await fetch('/dashboard/items/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, threshold: thr, limit: lim }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || 'Помилка пошуку');
      }
      setResults(Array.isArray(json?.data) ? json.data : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setThreshold(0.7);
    setLimit(10);
  };

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Семантичний Пошук</h2>
      <form onSubmit={handleSearch} className="mt-4 space-y-4">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Наприклад, тепла зимова куртка синього кольору"
            className="flex-grow rounded-md border-gray-300 shadow-sm"
            disabled={loading}
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Пошук...' : 'Знайти'}
          </button>
        </div>

        {/* Розширені налаштування */}
        <details>
          <summary className="cursor-pointer text-sm text-gray-500">Розширені налаштування</summary>
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-md border bg-gray-50 p-4 sm:grid-cols-2">
            <div>
              <label htmlFor="threshold" className="block text-sm font-medium text-gray-700">
                Поріг схожості: {threshold.toFixed(2)}
              </label>
              <input
                id="threshold"
                type="range"
                min={0}
                max={0.99}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
                disabled={loading}
                aria-valuemin={0}
                aria-valuemax={0.99}
                aria-valuenow={Number.isFinite(threshold) ? threshold : 0.7}
              />
            </div>
            <div>
              <label htmlFor="limit" className="block text-sm font-medium text-gray-700">
                Кількість результатів
              </label>
              <input
                id="limit"
                type="number"
                min={1}
                max={50}
                value={limit}
                onChange={(e) => setLimit(Number.isNaN(parseInt(e.target.value, 10)) ? 10 : parseInt(e.target.value, 10))}
                className="w-full rounded-md border-gray-300 shadow-sm"
                disabled={loading}
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={loading}
                />
                Запам'ятовувати ці налаштування
              </label>
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-zinc-700 hover:underline"
                disabled={loading}
              >
                Скинути до типових
              </button>
            </div>
          </div>
        </details>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">Помилка: {error}</p>}

      <div className="mt-6">
        {results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((item) => (
              <li key={item.id} className="rounded border p-0 text-sm">
                <Link
                  href={`/dashboard/items/${item.id}`}
                  className="block rounded p-3 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="text-gray-500">
                    SKU: {item.sku} (Схожість: {Math.round(item.similarity * 100)}%)
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : hasSearched && !loading && !error ? (
          <p className="text-sm text-gray-500">Нічого не знайдено. Спробуйте знизити поріг схожості.</p>
        ) : null}
      </div>
    </div>
  );
}