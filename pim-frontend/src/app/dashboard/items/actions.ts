// File: pim-frontend/src/app/dashboard/items/actions.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createItem(formData: FormData) {
  const supabase = createServerActionClient({ cookies });

  // Визначаємо поточну організацію детерміновано
  const { data: orgData, error: orgErr } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgErr || !orgData?.organization_id) {
    redirect('/dashboard/items/new?error=org');
  }

  // Валідація вхідних даних
  const rawSku = String(formData.get('sku') ?? '');
  const rawTitle = String(formData.get('title') ?? '');

  const sku = rawSku.trim().toUpperCase();
  const title = rawTitle.trim();

  if (!sku || !title) {
    redirect('/dashboard/items/new?error=validation');
  }

  // Створення товару (RLS гарантує доступ тільки в межах організації)
  const { error } = await supabase.from('items').insert({
    organization_id: orgData!.organization_id,
    sku,
    title,
  });

  if (error) {
    // Можлива помилка унікальності SKU або RLS
    const msg = encodeURIComponent(error.message);
    redirect(`/dashboard/items/new?error=insert&message=${msg}`);
  }

  // Оновлюємо кеш і повертаємо на список
  revalidatePath('/dashboard/items');
  redirect('/dashboard/items');
}