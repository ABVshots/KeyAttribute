import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import OverridesEditor from '../OverridesEditor';
import OverridesVirtualizedList, { OverrideItem } from '../OverridesVirtualizedList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OverridesPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
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

  const { data: nsRows } = await supabase.from('ui_namespaces').select('name').order('name');
  const namespaces = (nsRows ?? []).map((r: any) => r.name as string);
  const ns = (sp.ns || namespaces[0] || '').trim();
  const { data: sysLocs } = await supabase.from('system_locales').select('code, enabled').order('sort');
  const locales = (sysLocs ?? []).filter((l: any) => (l.enabled as boolean)).map((l: any) => l.code as string);
  const curLocale = (sp.locale || locales[0] || 'en');

  const overridesPageSize = Math.min(200, Math.max(20, Number(sp.overridesPageSize || '100') || 100));
  const overridesCursor = (sp.overridesCursor || '').trim();

  let keyQuery = supabase.from('ui_keys').select('id, key').eq('namespace', ns).order('key');
  if (overridesCursor) keyQuery = keyQuery.gt('key', overridesCursor);
  const { data: keyRows } = await keyQuery.limit(overridesPageSize + 1);
  const hasMore = (keyRows?.length || 0) > overridesPageSize;
  const pageKeys = hasMore ? keyRows!.slice(0, overridesPageSize) : (keyRows || []);
  const keyIds = pageKeys.map((k:any)=>k.id as string);

  let items: OverrideItem[] = [];
  if (ns && curLocale) {
    const { data: over } = await supabase.from('ui_messages_overrides').select('key_id, value').in('key_id', keyIds).eq('locale', curLocale).limit(overridesPageSize);
    const map = new Map<string, string>();
    (over||[]).forEach((it:any)=>map.set(it.key_id, String(it.value||'')));
    items = (pageKeys||[]).map((k:any)=> ({ keyId: k.id, key: k.key, value: map.get(k.id)||'' }));
  }

  const nextCursor = hasMore ? String(pageKeys[pageKeys.length-1].key) : '';
  const useVirtual = items.length >= 50;

  function urlWithCursor(cur?: string) {
    const params = new URLSearchParams();
    Object.entries(sp).forEach(([k,v]) => {
      if (k==='overridesCursor') return;
      if (v) params.set(k, String(v));
    });
    params.set('overridesPageSize', String(overridesPageSize));
    if (cur) params.set('overridesCursor', cur);
    return `/dashboard/settings/i18n/overrides?${params.toString()}`;
  }

  return (
    <div className="rounded-lg border bg-white p-4 cv-auto-800">
      <div className="mb-2 text-sm font-semibold">Повідомлення (Org overrides)</div>
      {useVirtual ? (
        <OverridesVirtualizedList items={items} />
      ) : (
        <OverridesEditor />
      )}
    </div>
  );
}
