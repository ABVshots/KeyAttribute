import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import KeysManager from '../KeysManager';
import KeysVirtualizedList from '../KeysVirtualizedList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function KeysPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
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

  // cursor pagination
  const ns = (sp.ns || '').trim();
  const keysPageSize = Math.min(200, Math.max(20, Number(sp.keysPageSize || '100') || 100));
  const keysCursor = (sp.keysCursor || '').trim();

  let q = supabase.from('ui_keys').select('id, namespace, key');
  if (ns) q = q.eq('namespace', ns);
  q = q.order('namespace', { ascending: true }).order('key', { ascending: true });
  if (keysCursor) q = q.gt('key', keysCursor);
  const { data: itemsRaw } = await q.limit(keysPageSize + 1);
  const items = (itemsRaw || []);
  const hasMore = items.length > keysPageSize;
  const pageItems = hasMore ? items.slice(0, keysPageSize) : items;
  const nextCursor = hasMore ? String(pageItems[pageItems.length - 1].key) : '';

  const useVirtual = pageItems.length >= 50;

  function urlWithCursor(cur?: string) {
    const params = new URLSearchParams();
    Object.entries(sp).forEach(([k,v]) => {
      if (k==='keysCursor') return;
      if (v) params.set(k, String(v));
    });
    params.set('keysPageSize', String(keysPageSize));
    if (cur) params.set('keysCursor', cur);
    return `/dashboard/settings/i18n/keys?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Каталог ключів (глобально)</div>
        {useVirtual ? (
          <>
            <KeysVirtualizedList items={pageItems as any} />
            <div className="mt-2 flex items-center justify-end gap-2 text-xs text-gray-600">
              <a href={urlWithCursor()} className={`rounded border px-2 py-1 ${keysCursor ? '' : 'pointer-events-none opacity-50'}`}>Reset</a>
              <a href={urlWithCursor(nextCursor)} className={`rounded border px-2 py-1 ${hasMore ? '' : 'pointer-events-none opacity-50'}`}>Load more</a>
            </div>
          </>
        ) : (
          <KeysManager />
        )}
      </div>
    </div>
  );
}
