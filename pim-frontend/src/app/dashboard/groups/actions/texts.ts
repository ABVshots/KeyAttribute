// Placeholder module for entity_texts actions
export {};

// File: pim-frontend/src/app/dashboard/groups/actions/texts.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID_RE } from '@/lib/validation';
import { ensureMembership } from '@/lib/org';

export type GroupTextItem = { id?: string; locale: string | null; key: string; content: string; sort_order?: number };

export async function upsertGroupTexts(payload: { group_id: string; key: string; items: GroupTextItem[] }) {
  const supabase = createServerActionClient({ cookies });
  const { group_id, key, items } = payload;
  if (!UUID_RE.test(group_id) || !Array.isArray(items)) redirect('/dashboard/groups?error=texts_payload');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', group_id)
    .maybeSingle();
  if (!group) redirect('/dashboard/groups?error=not_found');

  const allowed = await ensureMembership(supabase as any, group.organization_id as string, user.id);
  if (!allowed) redirect('/dashboard/groups?error=forbidden');

  const rows = items.map((it) => ({
    id: it.id,
    organization_id: group.organization_id as string,
    entity_type: 'group' as const,
    entity_id: group.id as string,
    key,
    locale: it.locale ?? null,
    content: it.content,
    sort_order: typeof it.sort_order === 'number' ? it.sort_order : null,
  }));

  const toInsert = rows.filter(r => !r.id).map(({ id, ...rest }) => rest);
  const toUpdate = rows.filter(r => r.id) as Array<typeof rows[number]>;

  if (toInsert.length > 0) {
    const { error } = await supabase.from('entity_texts').insert(toInsert);
    if (error) redirect(`/dashboard/groups/${group_id}/edit?error=texts_insert`);
  }
  for (const r of toUpdate) {
    const { id, ...rest } = r as any;
    const { error } = await supabase.from('entity_texts').update(rest).eq('id', id);
    if (error) redirect(`/dashboard/groups/${group_id}/edit?error=texts_update`);
  }

  revalidatePath(`/dashboard/groups/${group_id}/edit`);
}

export async function reorderGroupTexts(payload: { group_id: string; order: Array<{ id: string; sort_order: number }> }) {
  const supabase = createServerActionClient({ cookies });
  const { group_id, order } = payload;
  if (!UUID_RE.test(group_id) || !Array.isArray(order)) redirect('/dashboard/groups?error=texts_order');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Bulk update one by one (can be optimized with RPC)
  for (const o of order) {
    await supabase.from('entity_texts').update({ sort_order: o.sort_order }).eq('id', o.id);
  }

  revalidatePath(`/dashboard/groups/${group_id}/edit`);
}

export async function deleteGroupText(payload: { group_id: string; id: string }) {
  const supabase = createServerActionClient({ cookies });
  const { group_id, id } = payload;
  if (!UUID_RE.test(group_id) || !UUID_RE.test(id)) redirect('/dashboard/groups?error=texts_delete');

  await supabase.from('entity_texts').delete().eq('id', id);
  revalidatePath(`/dashboard/groups/${group_id}/edit`);
}

export type TextsActionState = { ok?: string; error?: string };

export async function upsertGroupTextsAction(prev: TextsActionState, formData: FormData): Promise<TextsActionState> {
  try {
    const group_id = String(formData.get('group_id') ?? '').trim();
    const key = String(formData.get('key') ?? '').trim();
    const items = JSON.parse(String(formData.get('items') ?? '[]')) as GroupTextItem[];
    if (!group_id || !key || !Array.isArray(items)) return { error: 'bad_payload' };
    await upsertGroupTexts({ group_id, key, items });
    return { ok: 'saved' };
  } catch {
    return { error: 'save_failed' };
  }
}

export async function reorderGroupTextsAction(prev: TextsActionState, formData: FormData): Promise<TextsActionState> {
  try {
    const group_id = String(formData.get('group_id') ?? '').trim();
    const order = JSON.parse(String(formData.get('order') ?? '[]')) as Array<{ id: string; sort_order: number }>;
    if (!group_id || !Array.isArray(order)) return { error: 'bad_payload' };
    await reorderGroupTexts({ group_id, order });
    return { ok: 'reordered' };
  } catch {
    return { error: 'reorder_failed' };
  }
}

export async function deleteGroupTextAction(prev: TextsActionState, formData: FormData): Promise<TextsActionState> {
  try {
    const group_id = String(formData.get('group_id') ?? '').trim();
    const id = String(formData.get('id') ?? '').trim();
    if (!group_id || !id) return { error: 'bad_payload' };
    await deleteGroupText({ group_id, id });
    return { ok: 'deleted' };
  } catch {
    return { error: 'delete_failed' };
  }
}
