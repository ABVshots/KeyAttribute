// File: pim-frontend/src/app/dashboard/groups/actions/move.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { UUID_RE } from '@/lib/validation';
import { preventCycle } from '@/lib/groups';
import { ensureMembership } from '@/lib/org';

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

  // Membership check via helper
  const allowed = await ensureMembership(supabase as any, child.organization_id as string, user.id);
  if (!allowed) return { error: 'forbidden' };

  // Prevent cycles using shared util
  const ok = await preventCycle(supabase as any, child_id, new_parent_id);
  if (!ok) return { error: 'cycle' };

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
