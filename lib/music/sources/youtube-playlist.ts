/**
 * SERVER-ONLY. Reads a public YouTube / YouTube Music playlist through the
 * YouTube Data API v3, so a host can start a game from their own playlist.
 *
 * YouTube Music playlists ARE YouTube playlists: same ids, same API, same IFrame
 * player. There is no separate provider — only two accepted hostnames.
 *
 * Requires YOUTUBE_API_KEY (no NEXT_PUBLIC_ prefix — the key must never reach the
 * browser). Never import this from a client component.
 */

import { normalizeAnswer } from "@/lib/music/sources/normalize";

const API_BASE = "https://www.googleapis.com/youtube/v3";

/** Upper bound on materialized tracks — keeps quota and game size sane. */
export const MAX_TRACKS = 100;

const PAGE_SIZE = 50;

const ACCEPTED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

/** Titles YouTube substitutes for entries that can no longer be played. */
const UNAVAILABLE_TITLES = new Set(["deleted video", "private video", "unavailable video"]);

/** Stable error slugs surfaced to the client (mapped to a message in the UI). */
export type YouTubePlaylistErrorCode =
  | "youtube_not_configured"
  | "invalid_youtube_url"
  | "playlist_not_found"
  | "playlist_empty"
  | "youtube_api_error";

export class YouTubePlaylistError extends Error {
  readonly code: YouTubePlaylistErrorCode;

  constructor(code: YouTubePlaylistErrorCode, message?: string) {
    super(message ?? code);
    this.name = "YouTubePlaylistError";
    this.code = code;
  }
}

/**
 * Extracts the playlist id from a YouTube / YouTube Music URL.
 * Returns null when the input is not a YouTube URL carrying a `list=` parameter.
 */
export function parsePlaylistId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Tolerate a pasted URL without a scheme ("youtube.com/playlist?list=...").
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (!ACCEPTED_HOSTS.has(url.hostname.toLowerCase())) return null;

  const list = url.searchParams.get("list");
  if (!list) return null;

  // Playlist ids are URL-safe tokens; anything else is a malformed paste.
  return /^[A-Za-z0-9_-]+$/.test(list) ? list : null;
}

export interface SourcedTrack {
  provider: "youtube";
  providerRef: string;
  answerTitle: string;
  answerArtist: string;
  position: number;
}

export interface SourcedPlaylist {
  /** The playlist's own title, used as the game's source label. */
  title: string;
  tracks: SourcedTrack[];
}

interface PlaylistItemsResponse {
  nextPageToken?: string;
  items?: {
    snippet?: {
      title?: string;
      videoOwnerChannelTitle?: string;
      resourceId?: { videoId?: string };
    };
    status?: { privacyStatus?: string };
  }[];
}

interface PlaylistsResponse {
  items?: { snippet?: { title?: string } }[];
}

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubePlaylistError("youtube_not_configured");
  return key;
}

async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (err) {
    throw new YouTubePlaylistError("youtube_api_error", (err as Error).message);
  }

  if (res.status === 404) throw new YouTubePlaylistError("playlist_not_found");
  if (!res.ok) {
    // 403 covers both a bad/blocked key and exhausted quota; the detail carries which.
    throw new YouTubePlaylistError("youtube_api_error", `${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** True for entries that cannot be played (deleted, private, or missing a video id). */
function isUnavailable(item: NonNullable<PlaylistItemsResponse["items"]>[number]): boolean {
  const videoId = item.snippet?.resourceId?.videoId;
  if (!videoId) return true;

  const title = (item.snippet?.title ?? "").trim().toLowerCase();
  if (UNAVAILABLE_TITLES.has(title)) return true;

  // "privacyStatusUnspecified" is what the API reports for a video that is gone.
  const privacy = item.status?.privacyStatus?.toLowerCase();
  return privacy === "private" || privacy === "privacystatusunspecified";
}

/**
 * Reads a public playlist and returns its title plus normalized, playable tracks.
 * Unavailable entries are skipped; the result is capped at MAX_TRACKS.
 *
 * @throws YouTubePlaylistError with a stable `code`.
 */
export async function fetchPlaylist(playlistId: string): Promise<SourcedPlaylist> {
  const key = apiKey();

  const meta = await getJson<PlaylistsResponse>("playlists", {
    part: "snippet",
    id: playlistId,
    key,
  });
  const title = meta.items?.[0]?.snippet?.title;
  // An id that is private or nonexistent comes back as an empty item list, not a 404.
  if (!title) throw new YouTubePlaylistError("playlist_not_found");

  const tracks: SourcedTrack[] = [];
  let pageToken: string | undefined;

  do {
    const page = await getJson<PlaylistItemsResponse>("playlistItems", {
      part: "snippet,status",
      playlistId,
      maxResults: String(PAGE_SIZE),
      key,
      ...(pageToken ? { pageToken } : {}),
    });

    for (const item of page.items ?? []) {
      if (tracks.length >= MAX_TRACKS) break;
      if (isUnavailable(item)) continue;

      const { answerTitle, answerArtist } = normalizeAnswer(
        item.snippet?.title ?? "",
        item.snippet?.videoOwnerChannelTitle,
      );
      if (!answerTitle) continue;

      tracks.push({
        provider: "youtube",
        providerRef: item.snippet!.resourceId!.videoId!,
        answerTitle,
        answerArtist,
        position: tracks.length,
      });
    }

    pageToken = page.nextPageToken;
  } while (pageToken && tracks.length < MAX_TRACKS);

  if (tracks.length === 0) throw new YouTubePlaylistError("playlist_empty");

  return { title, tracks };
}
