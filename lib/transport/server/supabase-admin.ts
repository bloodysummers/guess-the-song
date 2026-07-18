/**
 * Server-only Supabase client using the service role key. It bypasses RLS and is
 * used exclusively by Route Handlers for authoritative writes (creating sessions
 * and players, and later sealing buzzes / judging).
 *
 * NEVER import this from a client component. The service role key must never reach
 * the browser.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
