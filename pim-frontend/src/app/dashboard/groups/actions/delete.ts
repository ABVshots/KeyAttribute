// File: pim-frontend/src/app/dashboard/groups/actions/delete.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID_RE } from '@/lib/validation';

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

  const { count } = await supabase
    .from('groups')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', id);
  if ((count ?? 0) > 0) redirect(`/dashboard/groups/${id}/edit?error=has_children`);

  const { data: linkedMedia } = await supabase
    .from('entity_media')
    .select('media_id')
    .eq('organization_id', g.organization_id as string)
    .eq('entity_type', 'group')
    .eq('entity_id', id);
  const mediaIds = Array.from(new Set((linkedMedia ?? []).map((m) => m.media_id as string)));

  await supabase.from('translations').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('entity_id', id);
  await supabase.from('entity_media').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('entity_id', id);
  await supabase.from('entity_notes').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('entity_id', id);
  await supabase.from('entity_properties').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('entity_id', id);
  await supabase.from('entity_texts').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('entity_id', id);
  await supabase.from('external_mappings').delete().eq('organization_id', g.organization_id as string).eq('entity_type', 'group').eq('local_id', id);

  await supabase.from('groups').delete().eq('id', id);

  for (const mid of mediaIds) {
    const { count: refs } = await supabase
      .from('entity_media')
      .select('*', { count: 'exact', head: true })
      .eq('media_id', mid);
    if ((refs ?? 0) === 0) {
      await supabase.from('media').delete().eq('id', mid);
    }
  }

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
