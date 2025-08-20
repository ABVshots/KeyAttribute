// File: pim-frontend/src/app/dashboard/dictionaries/groups/focus/[id]/page.tsx
import EditorPage from '../../../../groups/[id]/edit/page';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FocusPageWrapper({ params, searchParams }: { params: Promise<{ id?: string }>, searchParams?: Promise<Record<string,string>> }) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const type = sp.type || '';
  if (!id || id === 'undefined' || id === '') {
    // find first item by type and redirect
    if (type) {
      const supabase = createServerComponentClient({ cookies });
      const { data: first } = await supabase.from('groups').select('id').eq('type_id', type).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (first?.id) redirect(`/dashboard/dictionaries/groups/focus/${first.id}?type=${encodeURIComponent(type)}`);
    }
    redirect('/dashboard/dictionaries');
  }
  // Delegate to existing editor page
  // @ts-ignore - editor is a server component default export
  return <EditorPage params={Promise.resolve({ id })} />;
}
