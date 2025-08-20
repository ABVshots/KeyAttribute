// File: pim-frontend/src/app/dashboard/dictionaries/actions.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export async function createDictionary(formData: FormData) {
  const supabase = createServerActionClient({ cookies });
  const label = String(formData.get('label') ?? '').trim();
  let code = String(formData.get('code') ?? '').trim();
  const createRoot = String(formData.get('create_root') ?? 'on') === 'on';

  if (!label) redirect('/dashboard/dictionaries?error=label');
  if (!code) code = slugify(label);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Resolve org (first membership)
  const { data: org } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!org?.organization_id) redirect('/dashboard/dictionaries?error=org');

  // Insert group_type (ensure uniqueness by appending suffix on conflict)
  let finalCode = code;
  let typeId: string | null = null;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase
      .from('group_types')
      .insert({ organization_id: org.organization_id, code: finalCode, label })
      .select('id')
      .maybeSingle();
    if (!error && data?.id) { typeId = data.id; break; }
    finalCode = `${code}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  if (!typeId) redirect('/dashboard/dictionaries?error=type');

  let rootId: string | null = null;
  if (createRoot) {
    const { data: root } = await supabase
      .from('groups')
      .insert({ organization_id: org.organization_id, name: label, type_id: typeId, parent_id: null })
      .select('id')
      .maybeSingle();
    rootId = root?.id ?? null;
  }

  revalidatePath('/dashboard/dictionaries');
  if (rootId) redirect(`/dashboard/groups/${rootId}/edit`);
  redirect('/dashboard/dictionaries');
}

export async function createRootForType(formData: FormData) {
  const supabase = createServerActionClient({ cookies });
  const type_id = String(formData.get('type_id') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim() || 'Root';
  if (!type_id) redirect('/dashboard/dictionaries?error=type');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: org } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!org?.organization_id) redirect('/dashboard/dictionaries?error=org');

  const { data: root } = await supabase
    .from('groups')
    .insert({ organization_id: org.organization_id, name: label, type_id, parent_id: null })
    .select('id')
    .maybeSingle();

  revalidatePath('/dashboard/dictionaries');
  if (root?.id) redirect(`/dashboard/groups/${root.id}/edit`);
  redirect('/dashboard/dictionaries');
}
