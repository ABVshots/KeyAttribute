// File: pim-frontend/src/app/dashboard/dictionaries/groups/list/page.tsx
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import GroupsPage from '../../../groups/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DictListPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
  const sp = (await searchParams) || {};

  // Render the existing GroupsPage inside to keep functionality consistent
  return (
    <div>
      <GroupsPage searchParams={Promise.resolve(sp)} />
    </div>
  );
}
