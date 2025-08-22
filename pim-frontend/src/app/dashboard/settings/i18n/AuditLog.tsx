import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export default async function AuditLog({ limit = 200 }: { limit?: number }) {
  const supabase = createServerComponentClient({ cookies });

  // Load latest audit rows
  const { data: rows } = await supabase
    .from('i18n_audit_log')
    .select('ts, scope, org_id, key_id, locale, action, old_value, new_value')
    .order('ts', { ascending: false })
    .limit(limit);
  const list = rows || [];

  // Map key_ids to keys/namespaces
  const keyIds = Array.from(new Set(list.map((r:any)=> r.key_id).filter(Boolean)));
  let keyMap = new Map<string, { namespace: string; key: string }>();
  if (keyIds.length) {
    const { data: keys } = await supabase
      .from('ui_keys')
      .select('id, namespace, key')
      .in('id', keyIds as string[]);
    (keys||[]).forEach((k:any)=> keyMap.set(k.id as string, { namespace: k.namespace as string, key: k.key as string }));
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="text-sm font-semibold">Audit log (останні {limit})</div>
      <div className="max-h-96 overflow-auto rounded border">
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
            {list.length === 0 ? (
              <tr><td colSpan={8} className="p-3 text-center text-gray-500">Порожньо</td></tr>
            ) : list.map((r:any, i:number)=>{
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
    </div>
  );
}
