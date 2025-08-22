// File: pim-frontend/src/app/dashboard/layout.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SidebarNav from './SidebarNav';
import { I18nProvider } from '../i18n/I18nProvider';
import { deepMerge } from '@/lib/i18n';
import { getDefaultLocale } from '@/lib/org';
import fs from 'node:fs/promises';
import path from 'node:path';

async function readJson(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {} as Record<string, any>;
  }
}

async function getUiBundleServer(supabase: any, orgId: string | null, locale: string) {
  const pub = path.join(process.cwd(), 'public', 'i18n');
  const enFile = await readJson(path.join(pub, 'en.json'));

  // detect parent_code for fallback chain
  const { data: locRow } = await supabase
    .from('system_locales')
    .select('parent_code')
    .eq('code', locale)
    .maybeSingle();
  const parent = (locRow?.parent_code as string) || '';

  const parentFile = parent ? await readJson(path.join(pub, `${parent}.json`)) : {};
  const curFile = await readJson(path.join(pub, `${locale}.json`));

  // Load global DB messages for requested and parent locales
  const { data: rowsCur } = await supabase
    .from('ui_messages_global')
    .select('key_id, locale, value, ui_keys!inner(namespace, key)')
    .eq('locale', locale);
  const { data: rowsPar } = parent
    ? await supabase
        .from('ui_messages_global')
        .select('key_id, locale, value, ui_keys!inner(namespace, key)')
        .eq('locale', parent)
    : { data: [] as any[] } as any;

  const mapRows = (rows: any[]) => {
    const out: Record<string, any> = {};
    (rows || []).forEach((r: any) => {
      const ns = (r.ui_keys?.namespace as string) || 'common';
      const k = (r.ui_keys?.key as string) || '';
      if (!k) return;
      if (!out[ns]) out[ns] = {};
      out[ns][k] = r.value as string;
    });
    return out;
  };

  const globalDbParent = mapRows(rowsPar || []);
  const globalDbCur = mapRows(rowsCur || []);

  // Load organization overrides for requested locale only (fallback зазвичай не потрібен)
  let overrides: Record<string, any> = {};
  if (orgId) {
    const { data: ov } = await supabase
      .from('ui_messages_overrides')
      .select('key_id, locale, value, ui_keys!inner(namespace, key)')
      .eq('locale', locale)
      .eq('org_id', orgId);
    const dict: Record<string, any> = {};
    (ov ?? []).forEach((r: any) => {
      const ns = (r.ui_keys?.namespace as string) || 'common';
      const k = (r.ui_keys?.key as string) || '';
      if (!k) return;
      if (!dict[ns]) dict[ns] = {};
      dict[ns][k] = r.value as string;
    });
    overrides = dict;
  }

  // Merge chain: en → parent → current → DB(parent) → DB(current) → overrides
  const mergedFiles = deepMerge(deepMerge(enFile, parentFile), curFile);
  const mergedDb = deepMerge(globalDbParent, globalDbCur);
  const merged = deepMerge(mergedFiles, deepMerge(mergedDb, overrides));

  const { data: ver } = await supabase
    .from('i18n_catalog_versions')
    .select('version')
    .eq('scope', 'global')
    .is('org_id', null)
    .maybeSingle();
  return { locale, dict: merged, version: Number(ver?.version ?? 1) };
}

// Забороняємо кешування цього сегмента (автентифікація не має кешуватись)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });

  const bypass = process.env.E2E_BYPASS_AUTH === '1';

  // Перевіряємо саме користувача та обробляємо можливу помилку
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!bypass && error) {
    redirect('/login?error=auth');
  }
  if (!bypass && !user) {
    redirect('/login');
  }

  // Resolve orgId (first membership) and UI locale
  const { data: org } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', user?.id || '')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = org?.organization_id as string | undefined;
  const cookieLocale = (await cookies()).get('ui_locale')?.value;
  let locale = cookieLocale || (orgId ? await getDefaultLocale(supabase as any, orgId) : 'en');
  if (!locale) locale = 'en';

  const { data: langs } = orgId ? await supabase
    .from('ui_org_locales')
    .select('locale')
    .eq('org_id', orgId) : { data: [] as any[] } as any;
  const localesRaw = (langs ?? []).map((l: any) => l.locale as string);
  const locales = localesRaw.length ? localesRaw : ['en','uk'];

  const bundle = await getUiBundleServer(supabase, orgId ?? null, locale);
  // Compute display version (global[.org])
  let displayVersion = String(bundle.version);
  if (orgId) {
    const { data: overVer } = await supabase
      .from('i18n_catalog_versions')
      .select('version')
      .eq('scope', 'org')
      .eq('org_id', orgId)
      .maybeSingle();
    const orgVersion = Number(overVer?.version ?? 0);
    if (orgVersion) displayVersion = `${bundle.version}.${orgVersion}`;
  }

  return (
    <I18nProvider bundle={bundle}>
      <div className="flex min-h-screen">
        <aside className="shrink-0 bg-zinc-800 p-6 text-white transition-[width] duration-200" style={{ width: 'var(--sidebar-w, 16rem)' }}>
          <h1 className="mb-4 text-xl font-bold">PIM Dashboard</h1>
          <div className="mb-2 text-xs text-zinc-300">UI: {locale}{bundle.version ? ` · v${displayVersion}` : ''}</div>
           <SidebarNav />
        </aside>
        <main className="flex-1 bg-gray-50 p-8">{children}</main>
      </div>
    </I18nProvider>
  );
}