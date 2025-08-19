// File: pim-frontend/src/app/dashboard/integrations/actions.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export type ActionState = { ok?: string; error?: string; jobId?: string };

export async function saveCartumIntegration(formData: FormData): Promise<ActionState> {
  const supabase = createServerActionClient({ cookies });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Неавторизовано' };

  const { data: orgData } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!orgData?.organization_id) return { error: 'Організацію не знайдено' };

  const domain = String(formData.get('domain') ?? '').trim().replace(/\/$/, '');
  const secretName = String(formData.get('secretName') ?? '').trim();
  if (!domain || !secretName) return { error: 'Заповніть домен і назву секрету.' };

  const { error: dbError } = await supabase.from('integrations').upsert({
    organization_id: orgData.organization_id,
    platform: 'cartum',
    credentials_vault_ref: secretName,
    settings: { domain },
    status: 'active',
  }, { onConflict: 'organization_id, platform' });

  if (dbError) return { error: `Помилка збереження інтеграції: ${dbError.message}` };
  revalidatePath('/dashboard/integrations');
  return { ok: 'saved' };
}

export async function testCartumConnection(formData: FormData): Promise<ActionState> {
  const supabase = createServerActionClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Неавторизовано' };

  const integrationId = String(formData.get('integration_id') ?? '');
  if (!integrationId) return { error: 'Інтеграцію не знайдено' };

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return { error: 'NEXT_PUBLIC_SUPABASE_URL не налаштовано' };

  try {
    const resp = await fetch(`${baseUrl}/functions/v1/cartum-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ integration_id: integrationId }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { error: (data as any)?.error || 'Помилка перевірки підключення' };
    return { ok: 'auth' };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function queueSyncCategories(formData: FormData): Promise<ActionState> {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Неавторизовано' };

  const integrationId = String(formData.get('integration_id') ?? '');
  const orgId = String(formData.get('organization_id') ?? '');
  if (!integrationId || !orgId) return { error: 'Інтеграцію не знайдено' };

  const { data, error } = await supabase.from('jobs').insert({
    organization_id: orgId,
    kind: 'cartum_sync_categories',
    payload: { integration_id: integrationId },
    priority: 5,
  }).select('id').single();
  if (error) return { error: error.message };
  revalidatePath('/dashboard/integrations');
  return { ok: 'sync_categories', jobId: data?.id };
}

export async function queuePullProducts(formData: FormData): Promise<ActionState> {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Неавторизовано' };

  const integrationId = String(formData.get('integration_id') ?? '');
  const orgId = String(formData.get('organization_id') ?? '');
  if (!integrationId || !orgId) return { error: 'Інтеграцію не знайдено' };

  const { data, error } = await supabase.from('jobs').insert({
    organization_id: orgId,
    kind: 'cartum_pull_products',
    payload: { integration_id: integrationId },
    priority: 5,
  }).select('id').single();
  if (error) return { error: error.message };
  revalidatePath('/dashboard/integrations');
  return { ok: 'pull_products', jobId: data?.id };
}

// Wrappers for useFormState
export async function saveCartumIntegrationAction(prev: ActionState, formData: FormData) { return saveCartumIntegration(formData); }
export async function testCartumConnectionAction(prev: ActionState, formData: FormData) { return testCartumConnection(formData); }
export async function queueSyncCategoriesAction(prev: ActionState, formData: FormData) { return queueSyncCategories(formData); }
export async function queuePullProductsAction(prev: ActionState, formData: FormData) { return queuePullProducts(formData); }