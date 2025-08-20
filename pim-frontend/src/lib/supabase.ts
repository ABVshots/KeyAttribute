// Shared server-side Supabase clients (preferred name)
import { createServerActionClient, createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export function supabaseAction() {
  return createServerActionClient({ cookies });
}
export function supabaseComponent() {
  return createServerComponentClient({ cookies });
}
export function supabaseRoute() {
  return createRouteHandlerClient({ cookies });
}
