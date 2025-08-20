// Placeholder module for group update actions
export {};

// File: pim-frontend/src/app/dashboard/groups/actions/update.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID_RE } from '@/lib/validation';
import { ensureMembership } from '@/lib/org';

export type GroupActionState = { ok?: string; error?: string };

export async function updateGroupName(formData: FormData): Promise<GroupActionState> {
  const supabase = createServerActionClient({ cookies });
  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!UUID_RE.test(id)) return { error: 'Невірний ідентифікатор' };
  if (!name) return { error: 'Порожня назва' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Неавторизовано' };

  const { data: group } = await supabase
    .from('groups')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle();
  if (!group) return { error: 'Групу не знайдено' };

  const allowed = await ensureMembership(supabase as any, group.organization_id as string, user.id);
  if (!allowed) return { error: 'Немає доступу' };

  const { error } = await supabase.from('groups').update({ name }).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/groups/tree');
  return { ok: 'updated' };
}

export async function updateGroupNameAction(prev: GroupActionState, formData: FormData) {
  return updateGroupName(formData);
}

export async function updateGroupDetails(formData: FormData) {
  const supabase = createServerActionClient({ cookies });

  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const type_id = String(formData.get('type_id') ?? '').trim();
  const rawParent = String(formData.get('parent_id') ?? '').trim();
  const parent_id = rawParent === '' ? null : rawParent;

  if (!UUID_RE.test(id)) redirect(`/dashboard/groups?error=bad_id`);
  if (!name) redirect(`/dashboard/groups/${id}/edit?error=name`);
  if (!UUID_RE.test(type_id)) redirect(`/dashboard/groups/${id}/edit?error=type`);
  if (parent_id && !UUID_RE.test(parent_id)) redirect(`/dashboard/groups/${id}/edit?error=parent`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: group, error: groupErr } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', id)
    .maybeSingle();
  if (groupErr || !group) redirect('/dashboard/groups?error=not_found');

  const allowed = await ensureMembership(supabase as any, group.organization_id as string, user.id);
  if (!allowed) redirect('/dashboard/groups?error=forbidden');

  if (parent_id) {
    if (parent_id === id) redirect(`/dashboard/groups/${id}/edit?error=parent_self`);
    const { data: parent } = await supabase
      .from('groups')
      .select('id, organization_id')
      .eq('id', parent_id)
      .maybeSingle();
    if (!parent || parent.organization_id !== group.organization_id) redirect(`/dashboard/groups/${id}/edit?error=parent_org`);
  }

  const { error } = await supabase.from('groups').update({ name, type_id, parent_id }).eq('id', id);
  if (error) redirect(`/dashboard/groups/${id}/edit?error=update&message=${encodeURIComponent(error.message)}`);

  revalidatePath('/dashboard/groups');
  revalidatePath('/dashboard/groups/tree');
  redirect('/dashboard/groups');
}
