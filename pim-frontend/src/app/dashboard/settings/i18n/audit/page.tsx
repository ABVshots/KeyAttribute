import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AuditPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
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

  const pageSize = Math.min(200, Math.max(20, Number(sp.auditPageSize || '100') || 100));
  const cursor = (sp.auditCursor || '').trim();

  let q = supabase
    .from('i18n_audit_log')
    .select('ts, scope, org_id, key_id, locale, action, old_value, new_value')
    .order('ts', { ascending: false })
    .order('key_id', { ascending: true });
  if (cursor) q = q.lt('ts', cursor);
  const { data: rows } = await q.limit(pageSize + 1);
  const hasMore = (rows?.length || 0) > pageSize;
  const pageRows = hasMore ? rows!.slice(0, pageSize) : (rows || []);

  const nextCursor = hasMore ? String(pageRows[pageRows.length - 1].ts) : '';

  // Resolve keys
  const keyIds = Array.from(new Set(pageRows.map((r:any)=> r.key_id).filter(Boolean)));
  const { data: keys } = keyIds.length
    ? await supabase.from('ui_keys').select('id, namespace, key').in('id', keyIds)
    : { data: [] as any[] };
  const keyMap = new Map<string, { namespace: string; key: string }>();
  (keys||[]).forEach((k:any)=> keyMap.set(k.id as string, { namespace: k.namespace as string, key: k.key as string }));

  function urlWithCursor(cur?: string) {
    const params = new URLSearchParams();
    Object.entries(sp).forEach(([k,v]) => {
      if (k==='auditCursor') return;
      if (v) params.set(k, String(v));
    });
    params.set('auditPageSize', String(pageSize));
    if (cur) params.set('auditCursor', cur);
    return `/dashboard/settings/i18n/audit?${params.toString()}`;
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-2 text-sm font-semibold">Audit</div>
      <div className="max-h-[32rem] overflow-auto rounded border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="p-2">Time</th>
              <th className="p-2">Scope</th>
              <th className="p-2">Namespace</th>
              <th className="p-2">Key</th>
              <th className="p-2">Locale</th>
              <th className="p-2">Action</th>
              <th className="p-2">Old</th>
              <th className="p-2">New</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={8} className="p-3 text-center text-gray-500">Порожньо</td></tr>
            ) : pageRows.map((r:any, i:number)=>{
              const kk = keyMap.get(r.key_id as string);
              return (
                <tr key={i} className="border-t align-top">
                  <td className="p-2 text-gray-500">{new Date(r.ts).toLocaleString()}</td>
                  <td className="p-2">{r.scope}{r.org_id ? ` (${r.org_id})` : ''}</td>
                  <td className="p-2">{kk?.namespace || ''}</td>
                  <td className="p-2 font-mono">{kk?.key || ''}</td>
                  <td className="p-2">{r.locale}</td>
                  <td className="p-2">{r.action}</td>
                  <td className="p-2 max-w-[20rem] break-words">{r.old_value}</td>
                  <td className="p-2 max-w-[20rem] break-words">{r.new_value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-xs text-gray-600">
        <a href={urlWithCursor()} className={`rounded border px-2 py-1 ${cursor ? '' : 'pointer-events-none opacity-50'}`}>Reset</a>
        <a href={urlWithCursor(nextCursor)} className={`rounded border px-2 py-1 ${hasMore ? '' : 'pointer-events-none opacity-50'}`}>Load more</a>
      </div>
    </div>
  );
}
