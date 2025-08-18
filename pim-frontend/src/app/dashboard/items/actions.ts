// File: pim-frontend/src/app/dashboard/items/actions.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createItem(formData: FormData) {
  const supabase = createServerActionClient({ cookies });

  // Визначаємо поточну організацію детерміновано
  const { data: orgData, error: orgErr } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgErr || !orgData?.organization_id) {
    redirect('/dashboard/items/new?error=org');
  }

  // Валідація вхідних даних
  const rawSku = String(formData.get('sku') ?? '');
  const rawTitle = String(formData.get('title') ?? '');

  const sku = rawSku.trim().toUpperCase();
  const title = rawTitle.trim();

  if (!sku || !title) {
    redirect('/dashboard/items/new?error=validation');
  }

  // Створення товару (RLS гарантує доступ тільки в межах організації)
  const { error } = await supabase.from('items').insert({
    organization_id: orgData!.organization_id,
    sku,
    title,
  });

  if (error) {
    // Можлива помилка унікальності SKU або RLS
    const msg = encodeURIComponent(error.message);
    redirect(`/dashboard/items/new?error=insert&message=${msg}`);
  }

  // Оновлюємо кеш і повертаємо на список
  revalidatePath('/dashboard/items');
  redirect('/dashboard/items');
}

export async function updateItem(itemId: string, formData: FormData) {
  const supabase = createServerActionClient({ cookies });

  const title = String(formData.get('title') ?? '').trim();
  const priceRaw = formData.get('price');
  const qtyRaw = formData.get('quantity');

  const price = priceRaw === null || priceRaw === '' ? null : Number(priceRaw);
  const quantity = qtyRaw === null || qtyRaw === '' ? null : Number(qtyRaw);

  if (!title) {
    redirect(`/dashboard/items/${itemId}/edit?error=validation`);
  }
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    redirect(`/dashboard/items/${itemId}/edit?error=price`);
  }
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) {
    redirect(`/dashboard/items/${itemId}/edit?error=quantity`);
  }

  // 1. Оновлюємо базові поля товару
  const { error: itemError } = await supabase
    .from('items')
    .update({ title, price, quantity })
    .eq('id', itemId);

  if (itemError) {
    const msg = encodeURIComponent(itemError.message);
    redirect(`/dashboard/items/${itemId}/edit?error=item&message=${msg}`);
  }

  // 2. Оновлюємо атрибути (видаляємо старі й вставляємо нові)
  const { error: deleteError } = await supabase
    .from('item_features')
    .delete()
    .eq('item_id', itemId);

  if (deleteError) {
    const msg = encodeURIComponent(deleteError.message);
    redirect(`/dashboard/items/${itemId}/edit?error=features_delete&message=${msg}`);
  }

  const featureInserts: Array<{ item_id: string; feature_attribute_id: string; feature_id: string }> = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('feature_') && typeof value === 'string' && value) {
      featureInserts.push({
        item_id: itemId,
        feature_attribute_id: key.replace('feature_', ''),
        feature_id: value,
      });
    }
  }

  if (featureInserts.length > 0) {
    const { error: insertError } = await supabase
      .from('item_features')
      .insert(featureInserts);
    if (insertError) {
      const msg = encodeURIComponent(insertError.message);
      redirect(`/dashboard/items/${itemId}/edit?error=features_insert&message=${msg}`);
    }
  }

  revalidatePath(`/dashboard/items/${itemId}/edit`);
  revalidatePath('/dashboard/items');
  redirect('/dashboard/items');
}

/** Тип результату пошуку */
export type SearchResult = {
  id: string;
  sku: string;
  title: string;
  similarity: number;
};

/** Відповідь OpenAI Embeddings */
type EmbeddingsResponse = {
  data: Array<{ embedding: number[] }>;
};

function isEmbeddingsResponse(x: unknown): x is EmbeddingsResponse {
  if (typeof x !== 'object' || x === null) return false;
  const obj = x as Record<string, unknown>;
  const data = obj['data'];
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0] as unknown;
  if (typeof first !== 'object' || first === null) return false;
  const emb = (first as Record<string, unknown>)['embedding'];
  return Array.isArray(emb) && emb.every((n) => typeof n === 'number');
}

type SearchItemsResult = { data: SearchResult[] | null; error: string | null };

/**
 * Пошук товарів за семантичною схожістю через pgvector RPC `search_items`.
 * Використовує OpenAI Embeddings для побудови вектору запиту.
 */
export async function searchItems(
  query: string,
  opts?: { threshold?: number; limit?: number }
): Promise<SearchItemsResult> {
  const q = (query ?? '').trim();
  if (!q) return { data: [], error: null };

  const supabase = createServerActionClient({ cookies });

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  if (!openaiApiKey) {
    return { data: null, error: 'OpenAI API key is not configured.' };
  }

  const threshold = opts?.threshold ?? 0.7;
  const limit = opts?.limit ?? 10;

  try {
    // Лімітуємо довжину запиту
    const input = q.slice(0, 6000);

    // Таймаут на випадок зависання зовнішнього API
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 20000);

    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({ input, model: embeddingModel }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!resp.ok) {
      let details = 'Upstream error';
      try {
        const err = (await resp.json()) as unknown;
        if (typeof err === 'object' && err && 'error' in err) {
          const e = (err as Record<string, unknown>)['error'];
          if (typeof e === 'object' && e && 'message' in (e as Record<string, unknown>)) {
            const m = (e as Record<string, unknown>)['message'];
            if (typeof m === 'string') details = m;
          }
        }
      } catch {
        try { details = await resp.text(); } catch { /* noop */ }
      }
      return { data: null, error: details };
    }

    const embUnknown: unknown = await resp.json();
    if (!isEmbeddingsResponse(embUnknown)) {
      return { data: null, error: 'Invalid embedding response' };
    }

    const queryEmbedding = embUnknown.data[0].embedding;

    // 2. Викликаємо RPC у БД (RLS застосовується завдяки cookies)
    const { data, error } = await supabase.rpc('search_items', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      return { data: null, error: error.message };
    }
    return { data: (data ?? []) as SearchResult[], error: null };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const errorText = message === 'timeout' ? 'Embedding request timed out' : message;
    return { data: null, error: errorText };
  }
}