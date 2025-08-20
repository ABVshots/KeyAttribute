// File: pim-frontend/src/app/dashboard/groups/actions.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export async function createGroup(formData: FormData) {
  const supabase = createServerActionClient({ cookies });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Визначаємо поточну організацію (детерміновано)
  const { data: orgData, error: orgErr } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgErr || !orgData?.organization_id) {
    redirect('/dashboard/groups/new?error=org');
  }

  // Валідація вхідних даних
  const name = String(formData.get('name') ?? '').trim();
  const type_id = String(formData.get('type_id') ?? '').trim();
  const rawParent = String(formData.get('parent_id') ?? '').trim();
  const parent_id = rawParent === '' ? null : rawParent;

  if (!name || !type_id) {
    redirect('/dashboard/groups/new?error=validation');
  }
  if (!UUID_RE.test(type_id)) {
    redirect('/dashboard/groups/new?error=type');
  }
  if (parent_id && !UUID_RE.test(parent_id)) {
    redirect('/dashboard/groups/new?error=parent');
  }

  const { error } = await supabase.from('groups').insert({
    organization_id: orgData!.organization_id,
    name,
    type_id,
    parent_id,
  });

  if (error) {
    const msg = encodeURIComponent(error.message);
    redirect(`/dashboard/groups/new?error=insert&message=${msg}`);
  }

  revalidatePath('/dashboard/groups');
  redirect('/dashboard/groups');
}

export type GroupActionState = { ok?: string; error?: string };

export async function updateGroupName(formData: FormData): Promise<GroupActionState> {
  const supabase = createServerActionClient({ cookies });
  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!UUID_RE.test(id)) return { error: 'Невірний ідентифікатор' };
  if (!name) return { error: 'Порожня назва' };

  // Ensure user is authenticated and a member of the org owning the group
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Неавторизовано' };

  const { data: group } = await supabase
    .from('groups')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle();
  if (!group) return { error: 'Групу не знайдено' };

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', group.organization_id as string)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) return { error: 'Немає доступу' };

  const { error } = await supabase
    .from('groups')
    .update({ name })
    .eq('id', id);
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

  if (!UUID_RE.test(id)) {
    redirect(`/dashboard/groups?error=bad_id`);
  }
  if (!name) {
    redirect(`/dashboard/groups/${id}/edit?error=name`);
  }
  if (!UUID_RE.test(type_id)) {
    redirect(`/dashboard/groups/${id}/edit?error=type`);
  }
  if (parent_id && !UUID_RE.test(parent_id)) {
    redirect(`/dashboard/groups/${id}/edit?error=parent`);
  }

  // Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Load group and org
  const { data: group, error: groupErr } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', id)
    .maybeSingle();
  if (groupErr || !group) redirect('/dashboard/groups?error=not_found');

  // Membership check
  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', group.organization_id as string)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) redirect('/dashboard/groups?error=forbidden');

  // Ensure parent belongs to same org (if provided) and not equal to self
  if (parent_id) {
    if (parent_id === id) redirect(`/dashboard/groups/${id}/edit?error=parent_self`);
    const { data: parent } = await supabase
      .from('groups')
      .select('id, organization_id')
      .eq('id', parent_id)
      .maybeSingle();
    if (!parent || parent.organization_id !== group.organization_id) {
      redirect(`/dashboard/groups/${id}/edit?error=parent_org`);
    }
  }

  const { error } = await supabase
    .from('groups')
    .update({ name, type_id, parent_id })
    .eq('id', id);

  if (error) {
    const msg = encodeURIComponent(error.message);
    redirect(`/dashboard/groups/${id}/edit?error=update&message=${msg}`);
  }

  revalidatePath('/dashboard/groups');
  revalidatePath('/dashboard/groups/tree');
  redirect('/dashboard/groups');
}

export type NamesPayload = { id: string; entries: Array<{ locale: string; name: string }> };

export async function updateGroupNamesAllLocales(form: NamesPayload) {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: group } = await supabase
    .from('groups')
    .select('id, organization_id')
    .eq('id', form.id)
    .maybeSingle();
  if (!group) redirect('/dashboard/groups?error=not_found');

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', group.organization_id as string)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) redirect('/dashboard/groups?error=forbidden');

  // Fetch default locale
  const { data: def } = await supabase
    .from('organization_languages')
    .select('locale')
    .eq('organization_id', group.organization_id as string)
    .eq('is_default', true)
    .maybeSingle();
  const defaultLocale = def?.locale ?? 'en';

  // Upsert translations for all provided locales
  const rows = form.entries
    .map(e => ({
      organization_id: group.organization_id,
      entity_type: 'group',
      entity_id: group.id,
      locale: e.locale,
      key: 'name',
      value: e.name.trim(),
    }))
    .filter(r => r.value.length > 0);

  if (rows.length > 0) {
    const { error } = await supabase.from('translations')
      .upsert(rows, { onConflict: 'organization_id,entity_type,entity_id,locale,key' });
    if (error) redirect(`/dashboard/groups?error=translations&message=${encodeURIComponent(error.message)}`);
  }

  // Update groups.name to default locale if provided
  const defName = form.entries.find(e => e.locale === defaultLocale)?.name?.trim();
  if (defName) {
    await supabase.from('groups').update({ name: defName }).eq('id', group.id);
  }

  revalidatePath('/dashboard/groups/tree');
}

export async function createChildGroup(formData: FormData) {
  const supabase = createServerActionClient({ cookies });
  const parent_id = String(formData.get('parent_id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!UUID_RE.test(parent_id) || !name) redirect(`/dashboard/groups/${parent_id}/edit?error=child`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: parent } = await supabase
    .from('groups')
    .select('id, organization_id, type_id')
    .eq('id', parent_id)
    .maybeSingle();
  if (!parent) redirect('/dashboard/dictionaries?error=parent');

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', parent.organization_id as string)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) redirect(`/dashboard/groups/${parent_id}/edit?error=forbidden`);

  const { data: child, error } = await supabase
    .from('groups')
    .insert({ organization_id: parent.organization_id, name, type_id: parent.type_id as string, parent_id: parent.id as string })
    .select('id')
    .maybeSingle();
  if (error || !child?.id) redirect(`/dashboard/groups/${parent_id}/edit?error=insert`);

  revalidatePath(`/dashboard/groups/${parent_id}/edit`);
  redirect(`/dashboard/groups/${child.id}/edit`);
}

export async function deleteGroup(formData: FormData) {
  const supabase = createServerActionClient({ cookies });
  const id = String(formData.get('id') ?? '').trim();
  if (!UUID_RE.test(id)) redirect('/dashboard/dictionaries?error=id');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: g } = await supabase
    .from('groups')
    .select('id, organization_id, parent_id, type_id')
    .eq('id', id)
    .maybeSingle();
  if (!g) redirect('/dashboard/dictionaries?error=not_found');

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', g.organization_id as string)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) redirect(`/dashboard/groups/${id}/edit?error=forbidden`);

  // Block delete if has children
  const { count } = await supabase
    .from('groups')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', id);
  if ((count ?? 0) > 0) redirect(`/dashboard/groups/${id}/edit?error=has_children`);

  // Collect media_ids linked to this group before deleting links
  const { data: linkedMedia } = await supabase
    .from('entity_media')
    .select('media_id')
    .eq('organization_id', g.organization_id as string)
    .eq('entity_type', 'group')
    .eq('entity_id', id);
  const mediaIds = Array.from(new Set((linkedMedia ?? []).map((m) => m.media_id as string)));

  // Cleanup related rows
  await supabase.from('translations').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('entity_id', id);
  await supabase.from('entity_media').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('entity_id', id);
  await supabase.from('entity_notes').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('entity_id', id);
  await supabase.from('entity_properties').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('entity_id', id);
  await supabase.from('entity_texts').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('entity_id', id);
  await supabase.from('external_mappings').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('local_id', id);

  // Delete group
  await supabase.from('groups').delete().eq('id', id);

  // GC orphaned media: remove media rows that have no more links
  for (const mid of mediaIds) {
    const { count: refs } = await supabase
      .from('entity_media')
      .select('*', { count: 'exact', head: true })
      .eq('media_id', mid);
    if ((refs ?? 0) === 0) {
      await supabase.from('media').delete().eq('id', mid);
    }
  }

  // If no groups remain for this type, remove dictionary (group_type) so it disappears from the hub
  if ((g as any).type_id) {
    const { count: left } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', g.organization_id as string)
      .eq('type_id', (g as any).type_id as string);
    if ((left ?? 0) === 0) {
      await supabase.from('group_types').delete().eq('organization_id', g.organization_id as string).eq('id', (g as any).type_id as string);
    }
  }

  const redirectTo = g.parent_id ? `/dashboard/groups/${g.parent_id as string}/edit` : '/dashboard/dictionaries';
  revalidatePath(redirectTo);
  redirect(redirectTo);
}

export type MoveResult = { ok?: string; error?: string };

export async function moveGroupParent(formData: FormData): Promise<MoveResult> {
  const supabase = createServerActionClient({ cookies });
  const child_id = String(formData.get('child_id') ?? '').trim();
  const new_parent_id = String(formData.get('new_parent_id') ?? '').trim();
  const context_id = String(formData.get('context_id') ?? '').trim();

  if (!UUID_RE.test(child_id) || !UUID_RE.test(new_parent_id)) return { error: 'bad_ids' };
  if (child_id === new_parent_id) return { error: 'same_ids' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: child } = await supabase
    .from('groups')
    .select('id, organization_id, type_id, parent_id')
    .eq('id', child_id)
    .maybeSingle();
  const { data: parent } = await supabase
    .from('groups')
    .select('id, organization_id, type_id, parent_id')
    .eq('id', new_parent_id)
    .maybeSingle();
  if (!child || !parent) return { error: 'not_found' };
  if (child.organization_id !== parent.organization_id) return { error: 'org_mismatch' };
  if (child.type_id !== parent.type_id) return { error: 'type_mismatch' };

  // Membership check
  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', child.organization_id as string)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) return { error: 'forbidden' };

  // Prevent cycles: ensure new_parent is not a descendant of child
  let cursor: string | null = new_parent_id;
  for (let i = 0; i < 64 && cursor; i++) {
    if (cursor === child_id) return { error: 'cycle' };
    const { data: gp } = await supabase
      .from('groups')
      .select('parent_id')
      .eq('id', cursor)
      .maybeSingle();
    cursor = (gp?.parent_id as string | null) ?? null;
  }

  // Apply update
  const { error } = await supabase
    .from('groups')
    .update({ parent_id: new_parent_id })
    .eq('id', child_id);
  if (error) return { error: error.message };

  // Revalidate affected pages
  if (context_id && UUID_RE.test(context_id)) revalidatePath(`/dashboard/groups/${context_id}/edit`);
  revalidatePath(`/dashboard/groups/${new_parent_id}/edit`);
  revalidatePath(`/dashboard/groups/${child_id}/edit`);

  return { ok: 'moved' };
}