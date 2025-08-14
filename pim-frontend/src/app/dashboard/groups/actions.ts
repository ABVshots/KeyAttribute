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