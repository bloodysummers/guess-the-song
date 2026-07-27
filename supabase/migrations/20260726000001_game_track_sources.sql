-- Guess the Song — per-game track snapshot from pluggable sources.
--
-- A game no longer points at a global curated playlist. Instead, on creation it
-- MATERIALIZES its own set of tracks (`game_tracks`) from a source: a curated
-- playlist from the catalog, or a public YouTube / YouTube Music playlist URL.
-- The snapshot is ephemeral (cascades with the game, which cascades with the
-- session), so imported playlists never accumulate in the global catalog nor
-- leak between sessions.
--
-- `playlists` / `tracks` remain, now purely as the CURATED CATALOG (one source).
--
-- DESTRUCTIVE: rounds are discarded so `rounds.game_track_id` can be NOT NULL.
-- Sessions are ephemeral, so no data is preserved.

-- ---------------------------------------------------------------------------
-- game_tracks: the game's own track set (provider-agnostic).
-- ---------------------------------------------------------------------------
create table game_tracks (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references games (id) on delete cascade,
  provider         music_provider not null default 'youtube',
  provider_ref     text not null,
  answer_title     text not null,
  answer_artist    text not null,
  answer_aliases   text[] not null default '{}',
  year             integer,
  -- Curated tracks carry these; imported ones leave them null/0.
  album            text,
  default_start_ms integer not null default 0,
  -- Order within the source playlist (kept for reference; rounds pick at random).
  position         integer not null default 0
);

create index game_tracks_game_id_idx on game_tracks (game_id);

-- ---------------------------------------------------------------------------
-- Rounds reference the game's snapshot, not the global catalog.
-- ---------------------------------------------------------------------------
delete from rounds;

alter table rounds drop column track_id;
alter table rounds add column game_track_id uuid not null
  references game_tracks (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Games carry a source label instead of a catalog playlist reference.
-- ---------------------------------------------------------------------------
alter table games drop column playlist_id;
alter table games add column source_label text not null default '';

-- ---------------------------------------------------------------------------
-- RLS + grants: `game_tracks` holds the answers, so it follows the same posture
-- as `tracks` — locked to the public roles, readable only by the service role.
-- Not added to the Realtime publication: it is never broadcast.
-- ---------------------------------------------------------------------------
alter table game_tracks enable row level security;
-- No anon/authenticated policy: only the service role (server) can read/write.

revoke all on game_tracks from anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
