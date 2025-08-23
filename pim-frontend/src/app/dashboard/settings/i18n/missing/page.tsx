import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MissingReport from '../MissingReport';
import MissingActions from '../MissingActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MissingPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
  const supabase = createServerComponentClient({ cookies });
  const sp = (await searchParams) || {};
  const { data: { user } } = await supabase.auth.getUser();
  const bypassEnv = process.env.E2E_BYPASS_AUTH === '1';
  const bypassQuery = process.env.NODE_ENV !== 'production' && ((sp.e2e||'')==='1' || (sp.bypass||'')==='1');
  const bypass = bypassEnv || bypassQuery;
  if (!user && !bypass) redirect('/login');

  if (!bypass) {
    const { data: isAdminRpc } = await supabase.rpc('is_platform_admin');
    const isAdmin = !!isAdminRpc;
    if (!isAdmin) redirect('/dashboard/settings/i18n/languages');
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Missing translations</div>
        <MissingReport />
      </div>
      <div className="rounded-lg border bg-white p-4">
        <MissingActions />
      </div>
    </div>
  );
}
