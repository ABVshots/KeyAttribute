// Placeholder module for group create actions
// TODO: Move createGroup and createChildGroup here and update imports incrementally.
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID_RE } from '@/lib/validation';
import { getDefaultLocale, ensureMembership } from '@/lib/org';

export async function createGroup(formData: FormData) {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orgData, error: orgErr } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (orgErr || !orgData?.organization_id) redirect('/dashboard/groups/new?error=org');

  const name = String(formData.get('name') ?? '').trim();
  const type_id = String(formData.get('type_id') ?? '').trim();
  const rawParent = String(formData.get('parent_id') ?? '').trim();
  const parent_id = rawParent === '' ? null : rawParent;

  if (!name || !type_id) redirect('/dashboard/groups/new?error=validation');
  if (!UUID_RE.test(type_id)) redirect('/dashboard/groups/new?error=type');
  if (parent_id && !UUID_RE.test(parent_id)) redirect('/dashboard/groups/new?error=parent');

  const { data: inserted, error } = await supabase
    .from('groups')
    .insert({ organization_id: orgData!.organization_id, name, type_id, parent_id })
    .select('id, organization_id')
    .maybeSingle();
  if (error || !inserted?.id) redirect(`/dashboard/groups/new?error=insert&message=${encodeURIComponent(error?.message ?? 'insert_failed')}`);

  try {
    const defaultLocale = await getDefaultLocale(supabase as any, inserted.organization_id as string);
    await supabase.from('translations').upsert({
      organization_id: inserted.organization_id as string,
      entity_type: 'group',
      entity_id: inserted.id as string,
      locale: defaultLocale,
      key: 'name',
      value: name,
    }, { onConflict: 'organization_id,entity_type,entity_id,locale,key' });
  } catch {}

  revalidatePath('/dashboard/groups');
  redirect('/dashboard/groups');
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

  const allowed = await ensureMembership(supabase as any, parent.organization_id as string, user.id);
  if (!allowed) redirect(`/dashboard/groups/${parent_id}/edit?error=forbidden`);

  const { data: child, error } = await supabase
    .from('groups')
    .insert({ organization_id: parent.organization_id, name, type_id: parent.type_id as string, parent_id: parent.id as string })
    .select('id')
    .maybeSingle();
  if (error || !child?.id) redirect(`/dashboard/groups/${parent_id}/edit?error=insert`);

  try {
    const defaultLocale = await getDefaultLocale(supabase as any, parent.organization_id as string);
    await supabase.from('translations').upsert({
      organization_id: parent.organization_id as string,
      entity_type: 'group',
      entity_id: child.id as string,
      locale: defaultLocale,
      key: 'name',
      value: name,
    }, { onConflict: 'organization_id,entity_type,entity_id,locale,key' });
  } catch {}

  revalidatePath(`/dashboard/groups/${parent_id}/edit`);
  redirect(`/dashboard/groups/${child.id}/edit`);
}
