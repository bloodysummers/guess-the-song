/**
 * Transport barrel. Game logic imports the GameTransport interface and the
 * factory from here — never a concrete provider SDK.
 */

export type * from "@/lib/transport/game-transport";
export { HOST_ONLY_EVENTS, TransportError } from "@/lib/transport/game-transport";

import type { GameTransport } from "@/lib/transport/game-transport";
import { SupabaseTransport } from "@/lib/transport/supabase-transport";

/** Returns the active transport implementation, typed as the interface. */
export function createGameTransport(): GameTransport {
  return new SupabaseTransport();
}
