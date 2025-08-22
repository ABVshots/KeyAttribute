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

  const { data: job } = await supabase
    .from('i18n_import_jobs')
    .select('id, requested_by')
    .eq('id', id)
    .maybeSingle();
  if (!job || job.requested_by !== user.id) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const { data: payloadRow } = await supabase
    .from('i18n_import_job_payloads')
    .select('payload')
    .eq('job_id', id)
    .maybeSingle();
  const payload = String(payloadRow?.payload || '');
  const { searchParams } = new URL(req.url);
  const dl = (searchParams.get('download') || '').toLowerCase();
  const headers: Record<string,string> = { 'Content-Type': 'application/json; charset=utf-8' };
  if (dl === '1' || dl === 'true') headers['Content-Disposition'] = `attachment; filename="job-${id}-payload.json"`;
  return new Response(payload || '[]', { status: 200, headers });
}
