// File: pim-frontend/src/app/api/i18n/ui/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id') || '0');
  if (!id) return new Response(JSON.stringify({ row: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { data: row } = await supabase.from('ui_translations').select('id, namespace, key, locale, value, organization_id').eq('id', id).maybeSingle();
  return new Response(JSON.stringify({ row }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
