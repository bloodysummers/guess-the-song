/**
 * YouTubeMusicProvider — concrete MusicProvider backed by the YouTube IFrame API.
 *
 * The ONLY module that references the YouTube API. Plays audio only through a hidden,
 * zero-size player. Client-side only (uses window/document).
 */

import type { MusicProvider, MusicSearchResult, PlayableTrackRef } from "@/lib/music/music-provider";
import type { MusicProviderKind } from "@/lib/game/types";

interface YTPlayer {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getDuration(): number;
  mute(): void;
  unMute(): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  destroy(): void;
}

interface YTPlayerReadyEvent {
  target: YTPlayer;
}

interface YTStateChangeEvent {
  data: number;
}

interface YTPlayerOptions {
  height: string;
  width: string;
  playerVars: Record<string, number>;
  events: {
    onReady: (e: YTPlayerReadyEvent) => void;
    onStateChange: (e: YTStateChangeEvent) => void;
    onError: (e: YTStateChangeEvent) => void;
  };
}

/** YouTube IFrame error codes → why a video won't play in our hidden player. */
const YT_ERROR_REASONS: Record<number, string> = {
  2: "invalid video id",
  5: "HTML5 player error",
  100: "video removed or private",
  101: "embedding disabled by the owner",
  150: "embedding disabled by the owner",
};

interface YTNamespace {
  Player: new (el: string | HTMLElement, opts: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const CONTAINER_ID = "gts-yt-hidden-player";
const API_SRC = "https://www.youtube.com/iframe_api";

const PLAYING_STATE = 1; // YT.PlayerState.PLAYING
const FLOOR_MS = 5000; // skip the first seconds (intros / silence)
const TAIL_MS = 2000; // leave a small tail so the window fits
const FALLBACK_START_MS = 20000; // used when the duration can't be read
const WINDOW_FALLBACK_MS = 1200; // start the window even if no PLAYING event arrives

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = API_SRC;
    document.head.appendChild(tag);
  });
  return apiPromise;
}

function ensureContainer(): HTMLElement {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = CONTAINER_ID;
    el.style.position = "absolute";
    el.style.width = "0";
    el.style.height = "0";
    el.style.overflow = "hidden";
    el.style.left = "-9999px";
    document.body.appendChild(el);
  }
  return el;
}

export class YouTubeMusicProvider implements MusicProvider {
  readonly kind: MusicProviderKind = "youtube";

  private player: YTPlayer | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  /** Window (ms) to start once audio is actually playing. Null = not armed. */
  private pendingWindowMs: number | null = null;

  private async ensurePlayer(): Promise<YTPlayer> {
    const YT = await loadApi();
    if (this.player) return this.player;
    ensureContainer();
    this.player = await new Promise<YTPlayer>((resolve) => {
      const player = new YT.Player(CONTAINER_ID, {
        height: "0",
        width: "0",
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1 },
        events: {
          onReady: () => resolve(player),
          onStateChange: (e) => this.handleStateChange(e.data),
          onError: (e) => this.handleError(e.data),
        },
      });
    });
    return this.player;
  }

  private handleStateChange(state: number): void {
    if (state === PLAYING_STATE && this.pendingWindowMs != null) {
      this.startWindowNow();
    }
  }

  private handleError(code: number): void {
    const reason = YT_ERROR_REASONS[code] ?? `error ${code}`;
    // The track can't play in our embedded player (e.g. embedding disabled). Surfacing
    // this in the console for now; the host can skip to the next round.
    console.warn(`[YouTubeMusicProvider] playback error ${code}: ${reason}`);
    this.clearTimers();
    this.pendingWindowMs = null;
  }

  /**
   * Plays a window of audio. We load MUTED via loadVideoById (muted autoplay is always
   * allowed and reliable), seek to the target offset while still muted, then unmute — so
   * playback reliably starts and the intro never leaks. The cut-off window is armed only
   * after we're positioned, and starts on the next PLAYING state (with a fallback).
   */
  async play(track: PlayableTrackRef, startMs: number | null, durationMs: number): Promise<number> {
    const player = await this.ensurePlayer();
    this.clearTimers();
    this.pendingWindowMs = null;

    const exact = startMs != null;
    player.mute();
    player.loadVideoById({
      videoId: track.providerRef,
      startSeconds: (exact ? startMs : 0) / 1000,
    });

    let start = startMs ?? 0;
    if (!exact) {
      const totalMs = await this.waitForDuration(player);
      start = this.pickRandomStart(totalMs, durationMs);
      player.seekTo(start / 1000, true);
    }

    player.unMute();
    player.playVideo();

    // Arm the window now that we're positioned; it starts on the next PLAYING state.
    this.pendingWindowMs = durationMs;
    this.fallbackTimer = setTimeout(() => this.startWindowNow(), WINDOW_FALLBACK_MS);
    return start;
  }

  private startWindowNow(): void {
    if (this.pendingWindowMs == null) return;
    const windowMs = this.pendingWindowMs;
    this.pendingWindowMs = null;
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => void this.stop(), windowMs);
  }

  async stop(): Promise<void> {
    this.clearTimers();
    this.pendingWindowMs = null;
    if (this.player) {
      try {
        this.player.pauseVideo();
      } catch {
        /* player may not be ready; ignore */
      }
    }
  }

  async search(_query: string): Promise<MusicSearchResult[]> {
    // Not needed until host-imported playlists; curated playlists carry provider refs.
    return [];
  }

  private clearTimers(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  /** Polls getDuration() until it's known (or gives up after ~2s). */
  private waitForDuration(player: YTPlayer): Promise<number | null> {
    return new Promise((resolve) => {
      let tries = 0;
      const poll = () => {
        const seconds = player.getDuration();
        if (seconds && seconds > 0) {
          resolve(Math.round(seconds * 1000));
          return;
        }
        if (tries >= 20) {
          resolve(null);
          return;
        }
        tries += 1;
        setTimeout(poll, 100);
      };
      poll();
    });
  }

  /** A random start so the full window fits inside the track. */
  private pickRandomStart(totalMs: number | null, windowMs: number): number {
    if (!totalMs) return FALLBACK_START_MS;
    if (totalMs <= windowMs + TAIL_MS) return 0;

    const min = totalMs > windowMs + FLOOR_MS + TAIL_MS ? FLOOR_MS : 0;
    const max = totalMs - windowMs - TAIL_MS;
    if (max <= min) return Math.max(0, Math.floor((totalMs - windowMs) / 2));
    return min + Math.floor(Math.random() * (max - min));
  }
}
