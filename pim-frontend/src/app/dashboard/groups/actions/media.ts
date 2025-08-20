// File: pim-frontend/src/app/dashboard/groups/actions/media.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID_RE } from '@/lib/validation';
import { ensureMembership } from '@/lib/org';

export type MediaActionState = { ok?: string; error?: string };

export async function setGroupCoverUrlAction(prev: MediaActionState, formData: FormData): Promise<MediaActionState> {
  try {
    const group_id = String(formData.get('group_id') ?? '').trim();
    const url = String(formData.get('url') ?? '').trim();
    if (!UUID_RE.test(group_id) || !/^https?:\/\//i.test(url)) return { error: 'bad_payload' };

    const supabase = createServerActionClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'unauthorized' };

    const { data: group } = await supabase
      .from('groups')
      .select('id, organization_id')
      .eq('id', group_id)
      .maybeSingle();
    if (!group) return { error: 'not_found' };

    const allowed = await ensureMembership(supabase as any, group.organization_id as string, user.id);
    if (!allowed) return { error: 'forbidden' };

    const { data: media, error: mErr } = await supabase
      .from('media')
      .upsert({ organization_id: group.organization_id, url, kind: 'image' }, { onConflict: 'url' })
      .select('id')
      .single();
    if (mErr) return { error: 'media_upsert_failed' };

    await supabase
      .from('entity_media')
      .upsert({ organization_id: group.organization_id, entity_type: 'group', entity_id: group.id, media_id: (media as any).id, role: 'cover' });

    revalidatePath(`/dashboard/groups/${group_id}/edit`);
    return { ok: 'saved' };
  } catch { return { error: 'save_failed' }; }
}
