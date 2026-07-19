/**
 * MusicProvider — abstraction over the music playback source (YouTube, Spotify).
 *
 * Game logic and UI control playback only through this interface. Provider SDKs
 * (YouTube IFrame API, Spotify Web Playback SDK) MUST NOT be referenced outside a
 * concrete implementation. No concrete provider exists yet at the foundations stage
 * (YouTube arrives in the Round/Buzzer phase).
 *
 * Source of truth: docs/data-model.md and docs/base-spec.md §8.
 */

import type { MusicProviderKind } from "@/lib/game/types";

export interface PlayableTrackRef {
  provider: MusicProviderKind;
  providerRef: string;
}

export interface MusicSearchResult {
  provider: MusicProviderKind;
  providerRef: string;
  title: string;
  artist: string | null;
  durationMs: number | null;
}

export interface MusicProvider {
  /** The provider this implementation plays from. */
  readonly kind: MusicProviderKind;

  /**
   * Plays `track` for `durationMs`, then stops. Audio only — any video surface must
   * stay hidden. The window is measured from when audio actually starts (not from the
   * request), so buffering does not shorten it.
   *
   * `startMs`: a number plays exactly from that offset (used for replay); `null`
   * randomizes the offset within the track. Returns the offset (ms) actually used, so
   * the caller can replay the same fragment.
   */
  play(track: PlayableTrackRef, startMs: number | null, durationMs: number): Promise<number>;

  /** Stops playback immediately (e.g. when the first buzz lands). */
  stop(): Promise<void>;

  /** Searches the provider catalog (used later for host-imported playlists). */
  search(query: string): Promise<MusicSearchResult[]>;
}
