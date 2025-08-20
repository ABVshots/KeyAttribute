// Placeholder module for properties actions
export {};

// File: pim-frontend/src/app/dashboard/groups/actions/properties.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID_RE } from '@/lib/validation';
import { ensureMembership } from '@/lib/org';

export type GroupPropertyItem = { id?: string; key: string; value_text?: string };

export async function upsertGroupProperties(payload: { group_id: string; items: GroupPropertyItem[] }) {
  const supabase = createServerActionClient({ cookies });
  const { group_id, items } = payload;
  if (!UUID_RE.test(group_id) || !Array.isArray(items)) redirect('/dashboard/groups?error=props_payload');

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

  const rows = items.map(it => ({
    id: it.id,
    organization_id: group.organization_id as string,
    entity_type: 'group' as const,
    entity_id: group.id as string,
    key: String(it.key ?? '').trim(),
    value_text: typeof it.value_text === 'string' ? it.value_text : null,
  })).filter(r => r.key.length > 0);

  const toInsert = rows.filter(r => !r.id).map(({ id, ...rest }) => rest);
  const toUpdate = rows.filter(r => r.id) as Array<typeof rows[number]>;

  if (toInsert.length > 0) {
    const { error } = await supabase.from('entity_properties').insert(toInsert);
    if (error) redirect(`/dashboard/groups/${group_id}/edit?error=props_insert`);
  }
  for (const r of toUpdate) {
    const { id, ...rest } = r as any;
    const { error } = await supabase.from('entity_properties').update(rest).eq('id', id);
    if (error) redirect(`/dashboard/groups/${group_id}/edit?error=props_update`);
  }

  revalidatePath(`/dashboard/groups/${group_id}/edit`);
}

export async function deleteGroupProperty(payload: { group_id: string; id: string }) {
  const supabase = createServerActionClient({ cookies });
  const { group_id, id } = payload;
  if (!UUID_RE.test(group_id) || !UUID_RE.test(id)) redirect('/dashboard/groups?error=props_delete');

  await supabase.from('entity_properties').delete().eq('id', id);
  revalidatePath(`/dashboard/groups/${group_id}/edit`);
}

export type PropertiesActionState = { ok?: string; error?: string };

export async function upsertGroupPropertiesAction(prev: PropertiesActionState, formData: FormData): Promise<PropertiesActionState> {
  try {
    const group_id = String(formData.get('group_id') ?? '').trim();
    const items = JSON.parse(String(formData.get('items') ?? '[]')) as GroupPropertyItem[];
    if (!group_id || !Array.isArray(items)) return { error: 'bad_payload' };
    await upsertGroupProperties({ group_id, items });
    return { ok: 'saved' };
  } catch {
    return { error: 'save_failed' };
  }
}

export async function deleteGroupPropertyAction(prev: PropertiesActionState, formData: FormData): Promise<PropertiesActionState> {
  try {
    const group_id = String(formData.get('group_id') ?? '').trim();
    const id = String(formData.get('id') ?? '').trim();
    if (!group_id || !id) return { error: 'bad_payload' };
    await deleteGroupProperty({ group_id, id });
    return { ok: 'deleted' };
  } catch {
    return { error: 'delete_failed' };
  }
}
