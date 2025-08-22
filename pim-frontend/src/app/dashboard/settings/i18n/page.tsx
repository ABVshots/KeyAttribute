// File: pim-frontend/src/app/dashboard/settings/i18n/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ImportBox from './ImportBox';
import { LanguagesManager } from './Languages';
import UserLocaleSelector from './UserLocaleSelector';
import KeysManager from './KeysManager';
import MessagesEditor from './MessagesEditor';
import MissingReport from './MissingReport';
import OverridesEditor from './OverridesEditor';
import AdminToggle from './AdminToggle';
import ImportJobBox from './ImportJobBox';
import ImportJobsList from './ImportJobsList';
import MissingActions from './MissingActions';
import AuditLog from './AuditLog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function I18nSettingsPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
  const supabase = createServerComponentClient({ cookies });
  const sp = (await searchParams) || {};
  const ns = sp.ns || '';
  const locale = sp.locale || '';

  const { data: { user } } = await supabase.auth.getUser();
  const bypassEnv = process.env.E2E_BYPASS_AUTH === '1';
  const bypassQuery = process.env.NODE_ENV !== 'production' && ((sp.e2e||'')==='1' || (sp.bypass||'')==='1');
  const bypass = bypassEnv || bypassQuery;
  if (!user && !bypass) redirect('/login');

  if (bypass) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">UI Translations</h1>
          <div className="flex items-center gap-2">
            <AdminToggle />
            <Link href="/dashboard" className="rounded border px-3 py-1 text-sm">Назад</Link>
          </div>
        </div>
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border bg-white p-3" data-testid="async-import">
            <div className="mb-2 text-sm font-semibold">Async Import Job</div>
            <ImportJobBox />
          </div>
          <div className="rounded border bg-white p-3">
            <div className="mb-2 text-sm font-semibold">Останні джоби імпорту</div>
            {/* Render empty list placeholder to avoid DB */}
            <div className="text-sm text-gray-500">Немає джобів</div>
          </div>
        </div>
      </div>
    );
  }

  // Global catalogs do not require org; keep org for UI languages block
  let orgId: string | undefined = undefined;
  if (user) {
    const { data: org } = await supabase
      .from('organization_members')
      .select('organization_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    orgId = org?.organization_id as string | undefined;
  }

  // Namespaces
  const { data: nsRows } = await supabase.from('ui_namespaces').select('name').order('name');
  const namespaces = (nsRows ?? []).map((r: any) => r.name as string);

  // Locales (enabled system locales)
  const { data: sysLocs } = await supabase.from('system_locales').select('code, enabled').order('sort');
  const allLocales = (sysLocs ?? []).filter((l: any) => (l.enabled as boolean)).map((l: any) => l.code as string);

  // Keys by namespace filter (optional)
  let keysQ = supabase.from('ui_keys').select('id, namespace, key');
  if (ns) keysQ = keysQ.eq('namespace', ns);
  const { data: keyRows } = await keysQ.order('namespace').order('key');
  const keys = (keyRows ?? []) as Array<{ id: string; namespace: string; key: string }>;
  const keyIds = keys.map(k => k.id);

  // Messages (optionally by locale)
  let msgsMap = new Map<string, Map<string, string>>(); // key_id -> locale -> value
  if (keyIds.length > 0) {
    const { data: msgs } = locale
      ? await supabase.from('ui_messages_global').select('key_id, locale, value').in('key_id', keyIds).eq('locale', locale)
      : await supabase.from('ui_messages_global').select('key_id, locale, value').in('key_id', keyIds);
    msgsMap = new Map<string, Map<string, string>>();
    (msgs ?? []).forEach((m: any) => {
      const kid = m.key_id as string; const loc = m.locale as string; const val = m.value as string;
      if (!msgsMap.has(kid)) msgsMap.set(kid, new Map());
      msgsMap.get(kid)!.set(loc, val);
    });
  }

  // Build export with scaffolding for enabled locales
  const exportArr: Array<any> = [];
  for (const k of keys) {
    const obj: any = { namespace: k.namespace, key: k.key };
    allLocales.forEach((loc) => { obj[loc] = msgsMap.get(k.id)?.get(loc) ?? ''; });
    exportArr.push(obj);
  }
  const exportJson = JSON.stringify(exportArr, null, 2);

  // Auto-select first namespace/locale for export buttons if none provided
  const selectedNs = ns || (namespaces[0] || '');
  const selectedLocale = locale || (allLocales[0] || '');
  const includeOverrides = (sp.includeOverrides || '').toLowerCase() === '1' || (sp.includeOverrides || '').toLowerCase() === 'true';
  const jobsPage = Math.max(1, Number(sp.jobsPage || '1') || 1);
  const jobsPageSize = Math.min(50, Math.max(5, Number(sp.jobsPageSize || '10') || 10));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">UI Translations</h1>
        <div className="flex items-center gap-2">
          <AdminToggle />
          <Link href="/dashboard" className="rounded border px-3 py-1 text-sm">Назад</Link>
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Мова інтерфейсу (користувач)</div>
        <UserLocaleSelector />
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">UI Мови (перемикач у налаштуваннях)</div>
        <LanguagesManager />
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Каталог ключів (глобально)</div>
        <KeysManager />
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Повідомлення (глобально)</div>
        <MessagesEditor />
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Повідомлення (Org overrides)</div>
        <OverridesEditor />
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Missing translations</div>
        <MissingReport />
        <div className="mt-3">
          <MissingActions />
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Audit</div>
        <AuditLog />
      </div>

      <form className="mb-3 flex items-center gap-2 text-sm">
        <select name="ns" defaultValue={ns} className="rounded border px-2 py-1">
          <option value="">Усі namespaces</option>
          {namespaces.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select name="locale" defaultValue={locale} className="rounded border px-2 py-1">
          <option value="">Усі мови</option>
          {allLocales.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="includeOverrides" value="1" defaultChecked={includeOverrides} /> include overrides
        </label>
        <button className="rounded border px-3 py-1">Фільтр</button>
        <Link href="/dashboard/settings/i18n/new" className="rounded bg-zinc-800 px-3 py-1 text-white">+ Додати</Link>
        {/* Export buttons: always visible; disabled if namespace is unavailable */}
        {selectedNs ? (
          <>
            {selectedLocale ? (
              <a
                href={`/api/i18n/export?ns=${encodeURIComponent(selectedNs)}&locale=${encodeURIComponent(selectedLocale)}${includeOverrides ? '&includeOverrides=1' : ''}`}
                download={`i18n-${selectedNs}-${selectedLocale}${includeOverrides ? '-overrides' : ''}.json`}
                className="rounded border px-3 py-1"
              >Експорт (локаль)</a>
            ) : (
              <span className="rounded border px-3 py-1 opacity-50">Експорт (локаль)</span>
            )}
            <a
              href={`/api/i18n/export?ns=${encodeURIComponent(selectedNs)}${includeOverrides ? '&includeOverrides=1' : ''}`}
              download={`i18n-${selectedNs}-all${includeOverrides ? '-overrides' : ''}.json`}
              className="rounded border px-3 py-1"
            >Експорт (всі локалі)</a>
            {selectedLocale ? (
              <a
                href={`/api/i18n/export?ns=${encodeURIComponent(selectedNs)}&locale=${encodeURIComponent(selectedLocale)}&format=csv${includeOverrides ? '&includeOverrides=1' : ''}`}
                download={`i18n-${selectedNs}-${selectedLocale}${includeOverrides ? '-overrides' : ''}.csv`}
                className="rounded border px-3 py-1"
              >CSV (локаль)</a>
            ) : (
              <span className="rounded border px-3 py-1 opacity-50">CSV (локаль)</span>
            )}
            <a
              href={`/api/i18n/export?ns=${encodeURIComponent(selectedNs)}&format=csv${includeOverrides ? '&includeOverrides=1' : ''}`}
              download={`i18n-${selectedNs}-all${includeOverrides ? '-overrides' : ''}.csv`}
              className="rounded border px-3 py-1"
            >CSV (всі локалі)</a>
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

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <div>Експорт (JSON)</div>
            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson)}`}
              download={`ui-translations-${ns||'all'}-${locale||'all'}.json`}
              className="rounded border px-2 py-1 text-xs"
            >Завантажити</a>
          </div>
          <textarea readOnly className="h-40 w-full rounded border p-2 font-mono text-xs" value={exportJson} />
        </div>
        <div className="rounded border bg-white p-3">
          <div className="mb-2 text-sm font-semibold">Імпорт (JSON)</div>
          <ImportBox />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-3" data-testid="async-import">
          <div className="mb-2 text-sm font-semibold">Async Import Job</div>
          <ImportJobBox />
        </div>
        <div className="rounded border bg-white p-3">
          <div className="mb-2 text-sm font-semibold">Останні джоби імпорту</div>
          <ImportJobsList page={jobsPage} pageSize={jobsPageSize} searchParams={sp} />
        </div>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-2">Namespace</th>
              <th className="p-2">Key</th>
              {locale ? (<th className="p-2">{locale}</th>) : (<th className="p-2">Локалей</th>)}
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr><td colSpan={3} className="p-4 text-gray-500">Немає ключів</td></tr>
            ) : keys.map((k) => {
              const m = msgsMap.get(k.id);
              return (
                <tr key={k.id} className="border-t">
                  <td className="p-2">{k.namespace}</td>
                  <td className="p-2">{k.key}</td>
                  {locale ? (
                    <td className="p-2">{m?.get(locale) ?? ''}</td>
                  ) : (
                    <td className="p-2">{m ? m.size : 0}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
