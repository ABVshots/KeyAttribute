// File: pim-frontend/src/app/dashboard/features/actions.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export async function createFeatureAttribute(formData: FormData) {
  const supabase = createServerActionClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Визначаємо поточну організацію детерміновано
  const { data: orgData, error: orgErr } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgErr || !orgData?.organization_id) {
    redirect('/dashboard/features/new?error=org');
  }

  // Валідація вхідних даних
  const rawLabel = String(formData.get('label') ?? '');
  const rawCode = String(formData.get('code') ?? '');
  const rawRoot = String(formData.get('root_feature_id') ?? '');

  const label = rawLabel.trim();
  const code = rawCode.trim().toUpperCase().replace(/\s+/g, '_');
  const root_feature_id = rawRoot.trim() === '' ? null : rawRoot.trim();

  if (!label || !code) {
    redirect('/dashboard/features/new?error=validation');
  }
  if (!/^[A-Z0-9._-]{1,64}$/.test(code)) {
    redirect('/dashboard/features/new?error=code');
  }

  // Перевірка root_feature_id (UUID та належність до організації)
  if (root_feature_id) {
    if (!UUID_RE.test(root_feature_id)) {
      redirect('/dashboard/features/new?error=root_format');
    }
    const { data: rootFeature } = await supabase
      .from('features')
      .select('id')
      .eq('id', root_feature_id)
      .eq('organization_id', orgData!.organization_id)
      .maybeSingle();
    if (!rootFeature) {
      redirect('/dashboard/features/new?error=root_missing');
    }
  }

  const { error } = await supabase.from('feature_attributes').insert({
    organization_id: orgData!.organization_id,
    label,
    code,
    root_feature_id,
  });

  if (error) {
    const msg = encodeURIComponent(error.message);
    redirect(`/dashboard/features/new?error=insert&message=${msg}`);
  }

  revalidatePath('/dashboard/features');
  redirect('/dashboard/features');
}