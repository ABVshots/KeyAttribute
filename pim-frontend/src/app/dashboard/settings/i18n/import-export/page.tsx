import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ImportJobBox from '../ImportJobBox';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadNamespaces(supabase: any): Promise<string[]> {
  const { data } = await supabase.from('ui_namespaces').select('name').order('name');
  return (data||[]).map((r:any)=>r.name as string);
}
async function loadLocales(supabase: any): Promise<string[]> {
  const { data } = await supabase.from('system_locales').select('code, enabled').order('sort');
  return (data||[]).filter((l:any)=>!!l.enabled).map((l:any)=>l.code as string);
}

export default async function ImportExportPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
  const supabase = createServerComponentClient({ cookies });
  const sp = (await searchParams) || {};
  const { data: { user } } = await supabase.auth.getUser();
  const bypassEnv = process.env.E2E_BYPASS_AUTH === '1';
  const bypassQuery = process.env.NODE_ENV !== 'production' && ((sp.e2e||'')==='1' || (sp.bypass||'')==='1');
  const bypass = bypassEnv || bypassQuery;
  if (!user && !bypass) redirect('/login');

  const { data: isAdminRpc } = await supabase.rpc('is_platform_admin');
  const isAdmin = !!isAdminRpc;

  // Resolve org for non-admins (for overridesOnly export)
  let orgId: string | null = null;
  if (!isAdmin) {
    const { data: org } = await supabase
      .from('organization_members')
      .select('organization_id, created_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    orgId = (org?.organization_id as string) || null;
  }

  const namespaces = await loadNamespaces(supabase);
  const locales = await loadLocales(supabase);
  const selectedNs = (sp.ns || namespaces[0] || '').trim();
  const selectedLocale = (sp.locale || locales[0] || '').trim();

  const overridesOnly = !isAdmin; // Non-admins see only org overrides
  const includeOverrides = isAdmin ? ((sp.includeOverrides || '').toLowerCase() === '1' || (sp.includeOverrides || '').toLowerCase() === 'true') : false;

  const exportJson = '[]';

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <div>Export</div>
          {!isAdmin && <span className="text-xs text-gray-500">Scope: org overrides only</span>}
        </div>
        <form className="mb-3 flex flex-wrap items-end gap-2 text-sm" method="get">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500">Namespace</label>
            <select name="ns" defaultValue={selectedNs} className="rounded border px-2 py-1 min-w-40">
              {namespaces.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500">Locale</label>
            <select name="locale" defaultValue={selectedLocale} className="rounded border px-2 py-1 min-w-32">
              {locales.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {isAdmin && (
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="includeOverrides" value="1" defaultChecked={includeOverrides} /> include overrides
            </label>
          )}
          <button className="rounded border px-3 py-1">Фільтр</button>
          <a href="/dashboard/settings/i18n/new" className="rounded bg-zinc-800 px-3 py-1 text-white">+ Додати</a>
          {selectedNs ? (
            <>
              <a href={`/api/i18n/export?ns=${encodeURIComponent(selectedNs)}&locale=${encodeURIComponent(selectedLocale)}${overridesOnly? '&overridesOnly=1' : (includeOverrides ? '&includeOverrides=1' : '')}`} download={`i18n-${selectedNs}-${selectedLocale}${overridesOnly?'-overrides-only':(includeOverrides ? '-overrides' : '')}.json`} className="rounded border px-3 py-1">Експорт (локаль)</a>
              <a href={`/api/i18n/export?ns=${encodeURIComponent(selectedNs)}${overridesOnly? '&overridesOnly=1' : (includeOverrides ? '&includeOverrides=1' : '')}`} download={`i18n-${selectedNs}-all${overridesOnly?'-overrides-only':(includeOverrides ? '-overrides' : '')}.json`} className="rounded border px-3 py-1">Експорт (всі локалі)</a>
              <a href={`/api/i18n/export?ns=${encodeURIComponent(selectedNs)}&locale=${encodeURIComponent(selectedLocale)}&format=csv${overridesOnly? '&overridesOnly=1' : (includeOverrides ? '&includeOverrides=1' : '')}`} download={`i18n-${selectedNs}-${selectedLocale}${overridesOnly?'-overrides-only':(includeOverrides ? '-overrides' : '')}.csv`} className="rounded border px-3 py-1">CSV (локаль)</a>
              <a href={`/api/i18n/export?ns=${encodeURIComponent(selectedNs)}&format=csv${overridesOnly? '&overridesOnly=1' : (includeOverrides ? '&includeOverrides=1' : '')}`} download={`i18n-${selectedNs}-all${overridesOnly?'-overrides-only':(includeOverrides ? '-overrides' : '')}.csv`} className="rounded border px-3 py-1">CSV (всі локалі)</a>
            </>
          ) : (
            <>
              <span className="rounded border px-3 py-1 opacity-50">Експорт (локаль)</span>
              <span className="rounded border px-3 py-1 opacity-50">Експорт (всі локалі)</span>
              <span className="rounded border px-3 py-1 opacity-50">CSV (локаль)</span>
              <span className="rounded border px-3 py-1 opacity-50">CSV (всі локалі)</span>
            </>
          )}
        </form>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border bg-white p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">
              <div>Експорт (JSON)</div>
              <a href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson)}`} download={`ui-translations-${selectedNs||'all'}-${selectedLocale||'all'}.json`} className="rounded border px-2 py-1 text-xs">Завантажити</a>
            </div>
            <textarea readOnly className="h-40 w-full rounded border p-2 font-mono text-xs" defaultValue={exportJson} />
          </div>
          <div className="rounded border bg-white p-3">
            <div className="mb-2 text-sm font-semibold">Імпорт (Async)</div>
            <ImportJobBox />
          </div>
        </div>
      </div>
    </div>
  );
}
