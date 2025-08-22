import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, context: any) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const id = context?.params?.id as string;
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') || 'json').toLowerCase();
  const dl = (searchParams.get('download') || '').toLowerCase();

  const { data: job } = await supabase
    .from('i18n_import_jobs')
    .select('id, requested_by')
    .eq('id', id)
    .maybeSingle();
  if (!job || job.requested_by !== user.id) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const { data: logs } = await supabase
    .from('i18n_import_job_logs')
    .select('ts, level, message, data')
    .eq('job_id', id)
    .order('ts', { ascending: true })
    .limit(5000);
  const rows = logs || [];

  if (format === 'csv') {
    const header = ['ts','level','message','data'];
    const dataRows = rows.map(r => [r.ts, r.level, r.message, r.data ? JSON.stringify(r.data) : '']);
    const csv = [header, ...dataRows].map(cols => cols.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    const headers: Record<string,string> = { 'Content-Type': 'text/csv; charset=utf-8' };
    if (dl === '1' || dl === 'true') headers['Content-Disposition'] = `attachment; filename="job-${id}-logs.csv"`;
    return new Response(csv, { status: 200, headers });
  }

  const body = JSON.stringify({ items: rows }, null, 2);
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (dl === '1' || dl === 'true') headers['Content-Disposition'] = `attachment; filename="job-${id}-logs.json"`;
  return new Response(body, { status: 200, headers });
}
