// File: pim-frontend/src/app/dashboard/groups/actions/notes.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID_RE } from '@/lib/validation';
import { ensureMembership } from '@/lib/org';

export type NoteItem = { id: string; content: string; created_at: string; sort_order?: number };
export type NotesActionState = { ok?: string; error?: string };

export async function listGroupNotes(group_id: string) {
  const supabase = createServerActionClient({ cookies });
  if (!UUID_RE.test(group_id)) return [] as NoteItem[];
  const { data: notes } = await supabase
    .from('entity_notes')
    .select('id, content, created_at, sort_order')
    .eq('entity_type', 'group')
    .eq('entity_id', group_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (notes ?? []) as any;
}

export async function addGroupNoteAction(prev: NotesActionState, formData: FormData): Promise<NotesActionState> {
  try {
    const group_id = String(formData.get('group_id') ?? '').trim();
    const content = String(formData.get('content') ?? '').trim();
    if (!UUID_RE.test(group_id) || !content) return { error: 'bad_payload' };

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

    await supabase.from('entity_notes').insert({
      organization_id: group.organization_id as string,
      entity_type: 'group',
      entity_id: group_id,
      content,
    });
    revalidatePath(`/dashboard/groups/${group_id}/edit`);
    return { ok: 'added' };
  } catch { return { error: 'add_failed' }; }
}

export async function deleteGroupNoteAction(prev: NotesActionState, formData: FormData): Promise<NotesActionState> {
  try {
    const group_id = String(formData.get('group_id') ?? '').trim();
    const id = String(formData.get('id') ?? '').trim();
    if (!UUID_RE.test(group_id) || !UUID_RE.test(id)) return { error: 'bad_payload' };
    const supabase = createServerActionClient({ cookies });
    await supabase.from('entity_notes').delete().eq('id', id);
    revalidatePath(`/dashboard/groups/${group_id}/edit`);
    return { ok: 'deleted' };
  } catch { return { error: 'delete_failed' }; }
}

export async function updateGroupNoteAction(prev: NotesActionState, formData: FormData): Promise<NotesActionState> {
  try {
    const group_id = String(formData.get('group_id') ?? '').trim();
    const id = String(formData.get('id') ?? '').trim();
    const content = String(formData.get('content') ?? '').trim();
    if (!UUID_RE.test(group_id) || !UUID_RE.test(id)) return { error: 'bad_payload' };
    const supabase = createServerActionClient({ cookies });
    await supabase.from('entity_notes').update({ content }).eq('id', id);
    revalidatePath(`/dashboard/groups/${group_id}/edit`);
    return { ok: 'saved' };
  } catch { return { error: 'save_failed' }; }
}

export async function reorderGroupNotesAction(prev: NotesActionState, formData: FormData): Promise<NotesActionState> {
  try {
    const group_id = String(formData.get('group_id') ?? '').trim();
    const order = JSON.parse(String(formData.get('order') ?? '[]')) as Array<{ id: string; sort_order: number }>;
    if (!UUID_RE.test(group_id) || !Array.isArray(order)) return { error: 'bad_payload' };
    const supabase = createServerActionClient({ cookies });
    for (const o of order) { await supabase.from('entity_notes').update({ sort_order: o.sort_order }).eq('id', o.id); }
    revalidatePath(`/dashboard/groups/${group_id}/edit`);
    return { ok: 'reordered' };
  } catch { return { error: 'reorder_failed' }; }
}
