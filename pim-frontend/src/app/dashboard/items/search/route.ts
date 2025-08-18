// File: pim-frontend/src/app/dashboard/items/search/route.ts
import { NextResponse } from 'next/server';
import { searchItems } from '../actions';

// Забороняємо кешування
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '' && !Number.isNaN(Number(val))) return Number(val);
  return undefined;
}

function clampThreshold(t?: number) {
  if (t === undefined) return 0.7;
  return Math.min(0.99, Math.max(0.0, t));
}

function clampLimit(l?: number) {
  if (l === undefined) return 10;
  return Math.min(50, Math.max(1, Math.floor(l)));
}

function noStoreJson(body: any, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get('q') ?? url.searchParams.get('query') ?? '';
    const query = raw.trim();

    const thr = parseNumber(url.searchParams.get('threshold'));
    const lim = parseNumber(url.searchParams.get('limit'));
    const threshold = clampThreshold(thr);
    const limit = clampLimit(lim);

    if (!query) return noStoreJson({ data: [] });

    const result = await searchItems(query, { threshold, limit });
    if (result.error) {
      const status = /upstream|openai|embedding/i.test(result.error) ? 502 : 500;
      return noStoreJson({ error: result.error }, { status });
    }
    return noStoreJson({ data: result.data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return noStoreJson({ error: message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: 'Invalid JSON' }, { status: 400 });
    }

    const raw = body?.query;
    if (typeof raw !== 'string') {
      return noStoreJson({ error: 'Invalid query' }, { status: 400 });
    }

    const thr = parseNumber(body?.threshold);
    const lim = parseNumber(body?.limit);
    const threshold = clampThreshold(thr);
    const limit = clampLimit(lim);

    const query = raw.trim();
    if (!query) {
      return noStoreJson({ data: [] });
    }

    const result = await searchItems(query, { threshold, limit });

    if (result.error) {
      const status = /upstream|openai|embedding/i.test(result.error) ? 502 : 500;
      return noStoreJson({ error: result.error }, { status });
    }

    return noStoreJson({ data: result.data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return noStoreJson({ error: message || 'Unknown error' }, { status: 500 });
  }
}