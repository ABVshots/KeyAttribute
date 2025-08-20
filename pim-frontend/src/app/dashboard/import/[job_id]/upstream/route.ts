// File: pim-frontend/src/app/dashboard/import/[job_id]/upstream/route.ts
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, ctx: { params: { job_id: string } }) {
  const { job_id } = ctx.params;
  const url = new URL(req.url);
  const wantMeta = url.searchParams.get('meta') === '1';
  const wantDownload = url.searchParams.get('download') === '1';

  // User-scoped client for auth & membership checks
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: job } = await supabase
    .from('jobs')
    .select('id, organization_id, payload')
    .eq('id', job_id)
    .maybeSingle();
  if (!job) return new Response('Not found', { status: 404 });

  // Check membership
  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', job.organization_id as string)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) return new Response('Forbidden', { status: 403 });

  const payload = job.payload as any;
  const upstream_snapshot = payload?.upstream_snapshot;
  const upstream_log_path = payload?.upstream_log_path as string | undefined;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  if (wantMeta) {
    let stagingCount = 0;
    if (admin) {
      try {
        const { count } = await admin
          .schema('staging')
          .from('import_staging_data')
          .select('row_num', { count: 'exact', head: true })
          .eq('job_id', job_id);
        stagingCount = count ?? 0;
      } catch (_) {
        const { count } = await admin
          .from('import_staging_data')
          .select('row_num', { count: 'exact', head: true })
          .eq('job_id', job_id);
        stagingCount = count ?? 0;
      }
    }
    return new Response(JSON.stringify({
      has_snapshot: Boolean(upstream_snapshot),
      has_storage: Boolean(upstream_log_path),
      staging_count: stagingCount,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // If inline snapshot exists, return it directly (optionally as download)
  if (upstream_snapshot) {
    return new Response(JSON.stringify(upstream_snapshot), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...(wantDownload ? { 'Content-Disposition': `attachment; filename="cartum-pages-${job_id}.json"` } : {}),
      },
    });
  }

  // Else if storage path exists, generate a signed URL and redirect
  if (upstream_log_path) {
    if (!admin) return new Response('Server not configured', { status: 500 });
    const { data, error } = await admin.storage
      .from('debug-logs')
      .createSignedUrl(upstream_log_path, 60 * 15);
    if (error || !data?.signedUrl) return new Response('Unable to fetch file', { status: 500 });
    return Response.redirect(data.signedUrl, 302);
  }

  // Fallback: reconstruct from staging rows
  if (!admin) return new Response('No upstream data found', { status: 404 });
  try {
    // Try staging schema first
    let rows: Array<{ row_num: number; raw_data: unknown }> = [];
    try {
      const { data } = await admin
        .schema('staging')
        .from('import_staging_data')
        .select('row_num, raw_data')
        .eq('job_id', job_id)
        .order('row_num');
      rows = data ?? [];
    } catch (_) {
      // ignore
    }

    if (!rows || rows.length === 0) {
      const { data } = await admin
        .from('import_staging_data')
        .select('row_num, raw_data')
        .eq('job_id', job_id)
        .order('row_num');
      rows = data ?? [];
    }

    if (rows && rows.length > 0) {
      const pages = rows.sort((a, b) => a.row_num - b.row_num).map((r) => r.raw_data);
      const reconstructed = { status: 'OK', response: { pages } };
      return new Response(JSON.stringify(reconstructed), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...(wantDownload ? { 'Content-Disposition': `attachment; filename="cartum-pages-${job_id}.json"` } : {}),
        },
      });
    }
  } catch (_) {
    // ignore
  }

  return new Response('No upstream data found', { status: 404 });
}
