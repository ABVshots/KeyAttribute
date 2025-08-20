import { SupabaseClient } from '@supabase/supabase-js';

export async function ensureMembership(supabase: SupabaseClient, organization_id: string, user_id: string) {
  const { data: member } = await (supabase as any)
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', organization_id)
    .eq('user_id', user_id)
    .maybeSingle();
  return !!member;
}

export async function getDefaultLocale(supabase: SupabaseClient, organization_id: string) {
  const { data: def } = await (supabase as any)
    .from('organization_languages')
    .select('locale')
    .eq('organization_id', organization_id)
    .eq('is_default', true)
    .maybeSingle();
  return (def?.locale as string) ?? 'en';
}
