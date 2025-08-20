// File: pim-frontend/src/app/dashboard/groups/actions/links.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { UUID_RE } from '@/lib/validation';
import { ensureMembership } from '@/lib/org';
import { revalidatePath } from 'next/cache';

export type LinkActionState = { ok?: string; error?: string };

export async function linkGroupsToParentAction(prev: LinkActionState, formData: FormData): Promise<LinkActionState> {
  try {
    const parent_id = String(formData.get('parent_id') ?? '').trim();
    const raw = String(formData.get('ids') ?? '[]');
    if (!UUID_RE.test(parent_id)) return { error: 'bad_parent' };
    const ids = JSON.parse(raw) as string[];
    if (!Array.isArray(ids) || ids.length === 0) return { error: 'empty' };

    const supabase = createServerActionClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'unauthorized' };

    const { data: parent } = await supabase
      .from('groups')
      .select('id, organization_id, type_id')
      .eq('id', parent_id)
      .maybeSingle();
    if (!parent) return { error: 'no_parent' };

    const allowed = await ensureMembership(supabase as any, parent.organization_id as string, user.id);
    if (!allowed) return { error: 'forbidden' };

    for (const id of ids) {
      if (!UUID_RE.test(id)) continue;
      const { data: child } = await supabase
        .from('groups')
        .select('id, organization_id, type_id')
        .eq('id', id)
        .maybeSingle();
      if (!child) continue;
      if (child.organization_id !== parent.organization_id || child.type_id !== parent.type_id) continue;
      await supabase.from('group_links').upsert({
        organization_id: parent.organization_id as string,
        type_id: parent.type_id as string,
        parent_id: parent.id as string,
        child_id: child.id as string,
      });
    }

    revalidatePath(`/dashboard/groups?type=${parent.type_id as string}`);
    return { ok: 'linked' };
  } catch {
    return { error: 'failed' };
  }
}
