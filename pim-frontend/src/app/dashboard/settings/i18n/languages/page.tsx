import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import UserLocaleSelector from '../UserLocaleSelector';
import { LanguagesManager } from '../Languages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function ExtractorOnly({ k, fallback }: { k: string; fallback: string }) {
  // This component exists to surface keys for extract; renders fallback text
  return <span data-i18n-key={k}>{fallback}</span>;
}

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
        <ExtractorOnly k="settings.languages.bypass" fallback="Режим bypass: UI мов недоступний без автентифікації" />
      </div>
    );
  }

  // Determine platform admin on server to control blocks visibility
  const { data: admins } = await supabase.from('platform_admins').select('user_id');
  const isAdmin = !!admins?.some((r:any) => r.user_id === user!.id);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">
          <ExtractorOnly k="settings.languages.userTitle" fallback="Мова інтерфейсу (користувач)" />
        </div>
        <UserLocaleSelector />
      </div>
      {isAdmin && (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-2 text-sm font-semibold">
            <ExtractorOnly k="settings.languages.adminTitle" fallback="UI Мови (перемикач у налаштуваннях)" />
          </div>
          <LanguagesManager />
        </div>
      )}
    </div>
  );
}
