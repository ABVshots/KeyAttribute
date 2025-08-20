// File: pim-frontend/src/app/dashboard/groups/tree/children/route.ts
import { NextResponse } from 'next/server';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ nodes: [] }, { headers: { 'Cache-Control': 'no-store' } });

  const supabase = createServerActionClient({ cookies });
  const { data: nodes } = await supabase
    .from('groups')
    .select('id, name')
    .eq('parent_id', id)
    .order('name');

  return NextResponse.json({ nodes: nodes ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
