/** Server-side identity verification for authoritative actions. */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface VerifiedPlayer {
  isHost: boolean;
}

/**
 * Verifies that (playerId, reconnectToken) belongs to the session. Returns the
 * player's role, or null if the identity is invalid.
 */
export async function verifyIdentity(
  admin: SupabaseClient,
  sessionId: string,
  playerId: string,
  reconnectToken: string,
): Promise<VerifiedPlayer | null> {
  const { data } = await admin
    .from("players")
    .select("is_host, reconnect_token, session_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!data || data.session_id !== sessionId || data.reconnect_token !== reconnectToken) {
    return null;
  }
  return { isHost: data.is_host };
}
