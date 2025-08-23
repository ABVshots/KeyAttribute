import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MessagesEditor from '../MessagesEditor';
import MessagesVirtualizedList, { MessageItem } from '../MessagesVirtualizedList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MessagesPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
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
  const baseLocale = locales.includes('en') ? 'en' : (locales[0] || 'en');
  const curLocale = (sp.locale || baseLocale);

  const messagesPageSize = Math.min(200, Math.max(20, Number(sp.messagesPageSize || '100') || 100));
  const messagesCursor = (sp.messagesCursor || '').trim();

  let keyQuery = supabase.from('ui_keys').select('id, key').eq('namespace', ns).order('key');
  if (messagesCursor) keyQuery = keyQuery.gt('key', messagesCursor);
  const { data: keyRows } = await keyQuery.limit(messagesPageSize + 1);
  const hasMore = (keyRows?.length || 0) > messagesPageSize;
  const pageKeys = hasMore ? keyRows!.slice(0, messagesPageSize) : (keyRows || []);
  const keyIds = pageKeys.map((k:any)=>k.id as string);

  let items: MessageItem[] = [];
  if (ns && curLocale) {
    const [curRes, baseRes] = await Promise.all([
      supabase.from('ui_messages_global').select('key_id, value').in('key_id', keyIds).eq('locale', curLocale),
      supabase.from('ui_messages_global').select('key_id, value').in('key_id', keyIds).eq('locale', baseLocale)
    ]);
    const curMap = new Map<string, string>();
    (curRes.data||[]).forEach((it:any)=>curMap.set(it.key_id, String(it.value||'')));
    const baseMap = new Map<string, string>();
    (baseRes.data||[]).forEach((it:any)=>baseMap.set(it.key_id, String(it.value||'')));
    items = (pageKeys||[]).map((k:any)=> ({ keyId: k.id, key: k.key, value: curMap.get(k.id)||'', baseValue: baseMap.get(k.id)||'' }));
  }

  const nextCursor = hasMore ? String(pageKeys[pageKeys.length-1].key) : '';
  const useVirtual = items.length >= 50;

  function urlWithCursor(cur?: string) {
    const params = new URLSearchParams();
    Object.entries(sp).forEach(([k,v]) => {
      if (k==='messagesCursor') return;
      if (v) params.set(k, String(v));
    });
    params.set('messagesPageSize', String(messagesPageSize));
    if (cur) params.set('messagesCursor', cur);
    return `/dashboard/settings/i18n/messages?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 cv-auto-800">
        <div className="mb-2 text-sm font-semibold">Повідомлення (глобально)</div>
        {useVirtual ? (
          <>
            <MessagesVirtualizedList items={items} />
            <div className="mt-2 flex items-center justify-end gap-2 text-xs text-gray-600">
              <a href={urlWithCursor()} className={`rounded border px-2 py-1 ${messagesCursor ? '' : 'pointer-events-none opacity-50'}`}>Reset</a>
              <a href={urlWithCursor(nextCursor)} className={`rounded border px-2 py-1 ${hasMore ? '' : 'pointer-events-none opacity-50'}`}>Load more</a>
            </div>
          </>
        ) : (
          <MessagesEditor />
        )}
      </div>
    </div>
  );
}
