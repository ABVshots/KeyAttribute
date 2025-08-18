// File: pim-frontend/src/app/dashboard/prompts/actions.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createPrompt(formData: FormData) {
  const supabase = createServerActionClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Визначаємо організацію детерміновано
  const { data: orgData, error: orgErr } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgErr || !orgData?.organization_id) {
    redirect('/dashboard/prompts/new?error=org');
  }

  // Валідація
  const name = String(formData.get('name') ?? '').trim();
  const template = String(formData.get('template') ?? '').trim();
  const rawTarget = String(formData.get('target_field') ?? '').trim();
  const target_field = rawTarget === '' ? null : rawTarget;

  if (!name || !template) {
    redirect('/dashboard/prompts/new?error=validation');
  }
  if (name.length > 120) {
    redirect('/dashboard/prompts/new?error=name_length');
  }

  const { error } = await supabase.from('ai_prompts').insert({
    organization_id: orgData!.organization_id,
    name,
    template,
    target_field,
    created_by: user.id,
  });

  if (error) {
    const msg = encodeURIComponent(error.message);
    redirect(`/dashboard/prompts/new?error=insert&message=${msg}`);
  }

  revalidatePath('/dashboard/prompts');
  redirect('/dashboard/prompts');
}