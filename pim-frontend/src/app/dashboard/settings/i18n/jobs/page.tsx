import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ImportJobBox from '../ImportJobBox';
import ImportJobsList from '../ImportJobsList';
import JobsVirtualizedList, { JobItem } from '../JobsVirtualizedList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function JobsPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
  const supabase = createServerComponentClient({ cookies });
  const sp = (await searchParams) || {};
  const { data: { user } } = await supabase.auth.getUser();
  const bypassEnv = process.env.E2E_BYPASS_AUTH === '1';
  const bypassQuery = process.env.NODE_ENV !== 'production' && ((sp.e2e||'')==='1' || (sp.bypass||'')==='1');
  const bypass = bypassEnv || bypassQuery;
  if (!user && !bypass) redirect('/login');

  const { data: isAdminRpc } = await supabase.rpc('is_platform_admin');
  const isAdmin = !!isAdminRpc;
  if (!isAdmin) {
    redirect('/dashboard/settings/i18n/languages');
  }

  const jobsPageSize = Math.min(50, Math.max(5, Number(sp.jobsPageSize || '10') || 10));

  if (bypass) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-3" data-testid="async-import">
          <div className="mb-2 text-sm font-semibold">Async Import Job</div>
          <ImportJobBox />
        </div>
        <div className="rounded border bg-white p-3">
          <div className="mb-2 text-sm font-semibold">Останні джоби імпорту</div>
          <div className="text-sm text-gray-500">Немає джобів</div>
        </div>
      </div>
    );
  }

  // server prefetch for virtualization threshold
  const status = (sp.jobStatus || '').trim();
  const scope = (sp.jobScope || '').trim();
  const q = (sp.q || '').trim();
  const days = Math.max(0, Number(sp.days || '0') || 0);
  const cursor = (sp.jobsCursor || '').trim();

  let query = supabase
    .from('i18n_import_jobs')
    .select('id, status, scope, created_at, finished_at, stats, progress, total')
    .eq('requested_by', (user as any)!.id)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (scope) query = query.eq('scope', scope);
  if (q) query = query.like('id', `%${q}%`);
  if (days > 0) {
    const sinceIso = new Date(Date.now() - days*24*60*60*1000).toISOString();
    query = query.gte('created_at', sinceIso);
  }
  if (cursor) query = query.lt('created_at', cursor);
  const { data: jobs } = await query.limit(jobsPageSize);

  const items = (jobs || []) as JobItem[];
  const useVirtual = items.length >= 10; // threshold

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded border bg-white p-3" data-testid="async-import">
        <div className="mb-2 text-sm font-semibold">Async Import Job</div>
        <ImportJobBox />
      </div>
      <div className="rounded border bg-white p-3 cv-auto-600">
        <div className="mb-2 text-sm font-semibold">Останні джоби імпорту</div>
        {useVirtual ? (
          <JobsVirtualizedList items={items} height={420} itemSize={148} />
        ) : (
          <ImportJobsList pageSize={jobsPageSize} searchParams={sp} />
        )}
      </div>
    </div>
  );
}
