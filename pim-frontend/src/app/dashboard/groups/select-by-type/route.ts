// File: pim-frontend/src/app/dashboard/groups/select-by-type/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const type_id = searchParams.get('type_id') || '';
  const q = searchParams.get('q') || '';
  if (!type_id) return new Response('bad request', { status: 400 });

  const { data: rows } = await supabase
    .from('groups')
    .select('id, name')
    .eq('type_id', type_id)
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(50);

  return new Response(JSON.stringify({ items: rows ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
