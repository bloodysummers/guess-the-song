/**
 * SERVER-ONLY. Resolves a game source into the rows that become the game's own
 * track snapshot (`game_tracks`).
 *
 * This is the single place that knows how a source is read. A game is created
 * from a source exactly once; from then on the game plays from its snapshot, so
 * nothing downstream (rounds, judging) needs to know which provider it came from.
 */

import type { GameSource } from "@/lib/game/types";
import { artworkUrlFor } from "@/lib/music/artwork";
import {
  fetchPlaylist,
  parsePlaylistId,
  YouTubePlaylistError,
} from "@/lib/music/sources/youtube-playlist";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A `game_tracks` row, minus the `game_id` assigned at insert time. */
export interface GameTrackRow {
  provider: string;
  provider_ref: string;
  answer_title: string;
  answer_artist: string;
  answer_aliases: string[];
  year: number | null;
  album: string | null;
  artwork_url: string | null;
  default_start_ms: number;
  position: number;
}

export interface ResolvedSource {
  /** Human-readable origin, stored on the game and shown to the host. */
  label: string;
  tracks: GameTrackRow[];
}

/** Stable slugs; the UI maps them to a message. */
export class GameSourceError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "GameSourceError";
    this.code = code;
  }
}

interface CuratedTrack {
  provider: string;
  provider_ref: string;
  answer_title: string;
  answer_artist: string;
  answer_aliases: string[] | null;
  year: number | null;
  album: string | null;
  default_start_ms: number | null;
}

async function resolveCurated(
  admin: SupabaseClient,
  playlistId: string,
): Promise<ResolvedSource> {
  const { data: playlist } = await admin
    .from("playlists")
    .select("name")
    .eq("id", playlistId)
    .maybeSingle();
  if (!playlist) throw new GameSourceError("playlist_not_found");

  const { data, error } = await admin
    .from("tracks")
    .select(
      "provider, provider_ref, answer_title, answer_artist, answer_aliases, year, album, default_start_ms",
    )
    .eq("playlist_id", playlistId);
  if (error) throw new GameSourceError("source_read_failed", error.message);

  const tracks = (data as CuratedTrack[] | null) ?? [];
  if (tracks.length === 0) throw new GameSourceError("playlist_empty");

  return {
    label: playlist.name as string,
    tracks: tracks.map((t, i) => ({
      provider: t.provider,
      provider_ref: t.provider_ref,
      answer_title: t.answer_title,
      answer_artist: t.answer_artist,
      answer_aliases: t.answer_aliases ?? [],
      year: t.year,
      album: t.album,
      artwork_url: artworkUrlFor(t.provider, t.provider_ref),
      default_start_ms: t.default_start_ms ?? 0,
      position: i,
    })),
  };
}

async function resolveYouTube(url: string): Promise<ResolvedSource> {
  const playlistId = parsePlaylistId(url);
  if (!playlistId) throw new GameSourceError("invalid_youtube_url");

  try {
    const { title, tracks } = await fetchPlaylist(playlistId);
    return {
      label: title,
      tracks: tracks.map((t) => ({
        provider: t.provider,
        provider_ref: t.providerRef,
        answer_title: t.answerTitle,
        answer_artist: t.answerArtist,
        answer_aliases: [],
        year: null,
        album: null,
        artwork_url: artworkUrlFor(t.provider, t.providerRef),
        // Imported tracks have no curated fragment; playback randomizes the offset.
        default_start_ms: 0,
        position: t.position,
      })),
    };
  } catch (err) {
    if (err instanceof YouTubePlaylistError) throw new GameSourceError(err.code, err.message);
    throw err;
  }
}

/**
 * Reads `source` and returns the tracks to materialize.
 * @throws GameSourceError with a stable `code` when the source is unusable.
 */
export async function resolveGameSource(
  admin: SupabaseClient,
  source: GameSource,
): Promise<ResolvedSource> {
  switch (source.type) {
    case "curated":
      if (!source.playlistId) throw new GameSourceError("invalid_source");
      return resolveCurated(admin, source.playlistId);
    case "youtube":
      if (!source.url) throw new GameSourceError("invalid_source");
      return resolveYouTube(source.url);
    default:
      throw new GameSourceError("invalid_source");
  }
}
