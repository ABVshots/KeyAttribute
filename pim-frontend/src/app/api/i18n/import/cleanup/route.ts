import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const body = await req.json().catch(()=>({}));
  const days = Math.max(1, Math.min(365, Number(body.days||7) || 7));
  const cutoff = new Date(Date.now() - days*24*60*60*1000).toISOString();
  const statuses = Array.isArray(body.statuses) ? body.statuses : ['done','failed'];

  const { error } = await supabase
    .from('i18n_import_jobs')
    .delete()
    .eq('requested_by', user.id)
    .lt('created_at', cutoff)
    .in('status', statuses as any);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
