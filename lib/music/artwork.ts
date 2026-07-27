/**
 * Cover art URLs derived from a provider reference.
 *
 * Pure and dependency-free on purpose: the SERVER uses it while materializing
 * `game_tracks`, and the CLIENT uses it in the host panel. Keeping it out of the
 * provider classes avoids importing browser-only code (YouTube IFrame API) on the
 * server just to build a URL.
 */

import type { MusicProviderKind } from "@/lib/game/types";

/**
 * Every YouTube video exposes its thumbnail at a predictable path, so the cover
 * costs no API call. `hqdefault` always exists; `maxresdefault` does not, for
 * older uploads.
 */
export function youtubeArtworkUrl(videoId: string): string | null {
  if (!videoId) return null;
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

/**
 * Cover art for a provider reference, or null when the provider cannot derive one
 * from the reference alone. Providers whose artwork lives behind an API (Spotify)
 * return null here and carry the URL they fetched at materialization time instead.
 */
export function artworkUrlFor(provider: MusicProviderKind | string, providerRef: string): string | null {
  return provider === "youtube" ? youtubeArtworkUrl(providerRef) : null;
}
