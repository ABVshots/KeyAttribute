// File: pim-frontend/src/app/dashboard/integrations/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { SettingsForm } from './ClientPanels';
import SyncComponent from './SyncComponent';
import { pruneOldJobsServer, deleteJobServer } from './actions';

export const dynamic = 'force-dynamic';

function tS(k: string, _p?: Record<string, any>, o?: { fallback?: string }) { return o?.fallback || k; }

type IntegrationRow = {
  id: string;
  organization_id: string;
  status: string | null;
  credentials_vault_ref: string | null;
  settings: { domain?: string } | null;
};

type JobRow = { id: string; kind: string; status: string; created_at: string | null; finished_at: string | null; priority: number | null };

export default async function IntegrationsPage() {
  const supabase = createServerComponentClient({ cookies });

  const { data: integration } = await supabase
    .from('integrations')
    .select('id, organization_id, settings, status, credentials_vault_ref')
    .eq('platform', 'cartum')
    .maybeSingle<IntegrationRow>();

  const domain = integration?.settings?.domain ?? '';
  const secretName = integration?.credentials_vault_ref ?? '';

  // Recent jobs (persisted history in DB)
  let jobs: JobRow[] = [];
  if (integration) {
    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id, kind, status, created_at, finished_at, priority')
      .eq('organization_id', integration.organization_id)
      .in('kind', ['cartum_sync_categories', 'process_staged_categories', 'cartum_pull_products', 'process_staged_products'])
      .order('created_at', { ascending: false })
      .limit(10);
    jobs = (jobRows ?? []) as JobRow[];
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">{tS('integrations.cartum.title', undefined, { fallback: 'Інтеграція з Cartum' })}</h1>
      <p className="mt-2 text-gray-500">{tS('integrations.cartum.subtitle', undefined, { fallback: 'Підключіть ваш магазин на платформі Cartum для синхронізації.' })}</p>

      <SettingsForm
        defaults={{
          domain,
          secretName,
        }}
      />

      {integration && (
        <SyncComponent integrationId={integration.id} />
      )}

      {integration?.status === 'active' && (
        <p className="mt-4 text-sm text-green-600">{tS('integrations.cartum.status.active', undefined, { fallback: 'Статус: активна' })}</p>
      )}

      {/* Quick access to the Groups Tree UI */}
      <div className="mt-6">
        <Link href="/dashboard/groups/tree" className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">{tS('integrations.cartum.openTree', undefined, { fallback: 'Відкрити дерево сторінок (Cartum)' })}</Link>
      </div>

      {jobs.length > 0 && (
        <div className="mt-8 max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{tS('integrations.cartum.recentJobs', undefined, { fallback: 'Останні завдання' })}</h2>
          <ul className="mt-3 divide-y">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{j.kind}</p>
                  <p className="text-xs text-gray-500">{tS('integrations.cartum.jobStatus', { status: j.status, created: j.created_at ? new Date(j.created_at).toLocaleString() : '-' }, { fallback: `Статус: ${j.status} · Створено: ${j.created_at ? new Date(j.created_at).toLocaleString() : '-'}` })}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/dashboard/import/${j.id}`} className="text-sm text-zinc-800 underline">{tS('integrations.cartum.open', undefined, { fallback: 'Відкрити' })}</Link>
                  <form action={deleteJobServer}>
                    <input type="hidden" name="job_id" value={j.id} />
                    <input type="hidden" name="organization_id" value={integration!.organization_id} />
                    <button className="text-sm text-red-600 hover:underline" title={tS('integrations.cartum.delete', undefined, { fallback: 'Видалити' })}>{tS('integrations.cartum.delete', undefined, { fallback: 'Видалити' })}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          <form action={pruneOldJobsServer} className="mt-4 flex justify-end">
            <input type="hidden" name="organization_id" value={integration!.organization_id} />
            <button className="rounded-lg border bg:white px-4 py-2 text-sm hover:bg-gray-50">{tS('integrations.cartum.prune', undefined, { fallback: 'Очистити історію (залишити 3)' })}</button>
          </form>
        </div>
      )}
    </div>
  );
}