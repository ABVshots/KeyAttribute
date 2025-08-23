const mem: Map<string, { etag?: string; data?: any; ts: number }> = new Map();

export async function etagFetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const cached = mem.get(url);
  const headers: Record<string, string> = { ...(init?.headers as any) };
  if (cached?.etag) headers['If-None-Match'] = cached.etag;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 304 && cached?.data) return cached.data as T;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const etag = res.headers.get('etag') || res.headers.get('ETag') || undefined;
  const data = await res.json();
  mem.set(url, { etag, data, ts: Date.now() });
  return data as T;
}

export function clearEtagCache(prefix?: string) {
  if (!prefix) { mem.clear(); return; }
  for (const k of Array.from(mem.keys())) { if (k.startsWith(prefix)) mem.delete(k); }
}
