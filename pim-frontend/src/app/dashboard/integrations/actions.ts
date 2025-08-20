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

    const raw: unknown = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      let msg = 'Помилка перевірки підключення';
      if (typeof raw === 'object' && raw !== null) {
        const rec = raw as Record<string, unknown>;
        const err = rec['error'];
        if (typeof err === 'string') msg = err;
      }
      return { error: msg };
    }
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

export async function deleteJob(formData: FormData): Promise<ActionState> {
  const supabase = createServerActionClient({ cookies });
  const jobId = String(formData.get('job_id') ?? '');
  const orgId = String(formData.get('organization_id') ?? '');
  if (!jobId || !orgId) return { error: 'Невірні параметри' };
  const { error } = await supabase.from('jobs').delete().eq('id', jobId).eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/dashboard/integrations');
  return { ok: 'deleted' };
}

export async function pruneOldJobs(formData: FormData): Promise<ActionState> {
  const supabase = createServerActionClient({ cookies });
  const orgId = String(formData.get('organization_id') ?? '');
  if (!orgId) return { error: 'Організацію не знайдено' };
  const kinds = ['cartum_sync_categories', 'process_staged_categories', 'cartum_pull_products', 'process_staged_products'];
  const { data: rows, error } = await supabase
    .from('jobs')
    .select('id, created_at')
    .eq('organization_id', orgId)
    .in('kind', kinds)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  const ids = (rows ?? []).slice(3).map((r) => r.id as string);
  if (ids.length === 0) return { ok: 'nothing' };
  const { error: delErr } = await supabase.from('jobs').delete().in('id', ids).eq('organization_id', orgId);
  if (delErr) return { error: delErr.message };
  revalidatePath('/dashboard/integrations');
  return { ok: `pruned_${ids.length}` };
}

// Wrappers for useFormState
export async function saveCartumIntegrationAction(prev: ActionState, formData: FormData) { return saveCartumIntegration(formData); }
export async function testCartumConnectionAction(prev: ActionState, formData: FormData) { return testCartumConnection(formData); }
export async function queueSyncCategoriesAction(prev: ActionState, formData: FormData) { return queueSyncCategories(formData); }
export async function queuePullProductsAction(prev: ActionState, formData: FormData) { return queuePullProducts(formData); }
export async function deleteJobAction(prev: ActionState, formData: FormData) { return deleteJob(formData); }
export async function pruneOldJobsAction(prev: ActionState, formData: FormData) { return pruneOldJobs(formData); }

// Server-friendly wrappers
export async function deleteJobServer(formData: FormData): Promise<void> {
  await deleteJob(formData);
}

export async function pruneOldJobsServer(formData: FormData): Promise<void> {
  await pruneOldJobs(formData);
}