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
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  destroy(): void;
}

interface YTPlayerEvent {
  target: YTPlayer;
}

interface YTPlayerOptions {
  height: string;
  width: string;
  playerVars: Record<string, number>;
  events: { onReady: (e: YTPlayerEvent) => void };
}

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

  private async ensurePlayer(): Promise<YTPlayer> {
    const YT = await loadApi();
    if (this.player) return this.player;
    ensureContainer();
    this.player = await new Promise<YTPlayer>((resolve) => {
      const player = new YT.Player(CONTAINER_ID, {
        height: "0",
        width: "0",
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1 },
        events: { onReady: () => resolve(player) },
      });
    });
    return this.player;
  }

  async play(track: PlayableTrackRef, startMs: number, durationMs: number): Promise<void> {
    const player = await this.ensurePlayer();
    this.clearTimer();
    player.loadVideoById({ videoId: track.providerRef, startSeconds: startMs / 1000 });
    player.playVideo();
    this.stopTimer = setTimeout(() => {
      void this.stop();
    }, durationMs);
  }

  async stop(): Promise<void> {
    this.clearTimer();
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

  private clearTimer(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }
}
