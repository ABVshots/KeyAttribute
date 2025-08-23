import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import UserLocaleSelector from '../UserLocaleSelector';
import { LanguagesManager } from '../Languages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LanguagesPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
  const supabase = createServerComponentClient({ cookies });
  const sp = (await searchParams) || {};
  const { data: { user } } = await supabase.auth.getUser();
  const bypassEnv = process.env.E2E_BYPASS_AUTH === '1';
  const bypassQuery = process.env.NODE_ENV !== 'production' && ((sp.e2e||'')==='1' || (sp.bypass||'')==='1');
  const bypass = bypassEnv || bypassQuery;
  if (!user && !bypass) redirect('/login');

  if (bypass) {
    return (
      <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
        Режим bypass: UI мов недоступний без автентифікації
      </div>
    );
  }

  // Determine platform admin on server to control blocks visibility
  const { data: admins } = await supabase.from('platform_admins').select('user_id');
  const isAdmin = !!admins?.some((r:any) => r.user_id === user!.id);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Мова інтерфейсу (користувач)</div>
        <UserLocaleSelector />
      </div>
      {isAdmin && (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-2 text-sm font-semibold">UI Мови (перемикач у налаштуваннях)</div>
          <LanguagesManager />
        </div>
      )}
    </div>
  );
}
