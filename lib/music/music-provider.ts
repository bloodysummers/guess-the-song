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

/** A track that cannot be played at all, as reported by the provider. */
export interface PlaybackError {
  /** Provider-specific code, kept for logging. */
  code: number;
  /** Human-readable cause, e.g. "embedding disabled by the owner". */
  reason: string;
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

  /**
   * Cover art for a track, or null if this provider cannot derive one.
   *
   * HOST-ONLY: the artwork gives the answer away, so it must never be rendered on
   * a player's screen while a round is running.
   */
  artworkUrl(track: PlayableTrackRef): string | null;

  /**
   * Registers the handler called when the provider cannot play the current track
   * (region block, embedding disabled, dead video…). Replaces any previous handler.
   *
   * Only HARD failures reach this. A track that plays but happens to be silent
   * raises nothing — no provider can tell silence from music.
   */
  onPlaybackError(handler: (error: PlaybackError) => void): void;

  /** Searches the provider catalog (used later for host-imported playlists). */
  search(query: string): Promise<MusicSearchResult[]>;
}
