// Placeholder module for names/translation actions
export {};

'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type NamesPayload = { id: string; entries: Array<{ locale: string; name: string }> };
export type NamesActionState = { ok?: string; error?: string };

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

  const { data: def } = await supabase
    .from('organization_languages')
    .select('locale')
    .eq('organization_id', group.organization_id as string)
    .eq('is_default', true)
    .maybeSingle();
  const defaultLocale = def?.locale ?? 'en';

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
    const { error } = await supabase.from('translations').upsert(rows, { onConflict: 'organization_id,entity_type,entity_id,locale,key' });
    if (error) redirect(`/dashboard/groups?error=translations&message=${encodeURIComponent(error.message)}`);
  }

  const defName = form.entries.find(e => e.locale === defaultLocale)?.name?.trim();
  if (defName) {
    await supabase.from('groups').update({ name: defName }).eq('id', group.id);
  }

  revalidatePath('/dashboard/groups/tree');
}

export async function updateGroupNamesAllLocalesAction(prev: NamesActionState, formData: FormData): Promise<NamesActionState> {
  try {
    const id = String(formData.get('group_id') ?? '').trim();
    const raw = String(formData.get('entries') ?? '[]');
    const entries = JSON.parse(raw) as Array<{ locale: string; name: string }>;
    if (!id || !Array.isArray(entries)) return { error: 'bad_payload' };
    await updateGroupNamesAllLocales({ id, entries });
    return { ok: 'saved' };
  } catch (e) {
    return { error: 'save_failed' };
  }
}
