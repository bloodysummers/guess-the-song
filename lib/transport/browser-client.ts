/**
 * Browser Supabase client using the public anon key. Used for Realtime
 * subscriptions and presence, and for reads the anon role is allowed to perform
 * (playlists, gameplay rows). It never performs authoritative writes — those go
 * through server Route Handlers.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
    );
  }

  client = createClient(url, anonKey);
  return client;
}
