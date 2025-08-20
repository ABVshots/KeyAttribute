import { SupabaseClient } from '@supabase/supabase-js';

export async function preventCycle(supabase: SupabaseClient, child_id: string, new_parent_id: string): Promise<boolean> {
  let cursor: string | null = new_parent_id;
  for (let i = 0; i < 64 && cursor; i++) {
    if (cursor === child_id) return false;
    const res = await (supabase as any)
      .from('groups')
      .select('parent_id')
      .eq('id', cursor)
      .maybeSingle();
    const gp = (res.data as { parent_id: string | null } | null);
    cursor = gp?.parent_id ?? null;
  }
  return true;
}
