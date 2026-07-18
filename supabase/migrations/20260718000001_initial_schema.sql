-- Guess the Song — initial schema
-- Source of truth: docs/data-model.md §2
--
-- Note on circular references: sessions <-> players and sessions <-> rounds
-- reference each other. Tables are created first, then the cross FKs are added
-- with ALTER TABLE at the end.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type session_status as enum ('lobby', 'active', 'finished');
create type round_phase as enum ('playing', 'answering', 'resolved');
create type round_resolution as enum ('correct', 'exhausted', 'timeout', 'skipped');
create type verdict as enum ('correct', 'incorrect');
create type music_provider as enum ('youtube', 'spotify');

-- ---------------------------------------------------------------------------
-- Content: playlists & tracks
-- ---------------------------------------------------------------------------
create table playlists (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  theme         text,
  cover_url     text,
  is_predefined boolean not null default true,
  created_at    timestamptz not null default now()
);

create table tracks (
  id               uuid primary key default gen_random_uuid(),
  playlist_id      uuid not null references playlists (id) on delete cascade,
  provider         music_provider not null default 'youtube',
  provider_ref     text not null,
  answer_title     text not null,
  answer_artist    text not null,
  answer_aliases   text[] not null default '{}',
  year             integer,
  album            text,
  default_start_ms integer not null default 0
);

create index tracks_playlist_id_idx on tracks (playlist_id);

-- ---------------------------------------------------------------------------
-- Sessions (host_player_id / current_round_id FKs added after players & rounds)
-- ---------------------------------------------------------------------------
create table sessions (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  playlist_id      uuid not null references playlists (id),
  host_player_id   uuid,
  current_round_id uuid,
  status           session_status not null default 'lobby',
  config           jsonb not null default
    '{"audioWindowMs":5000,"allowSteal":true,"wrongBuzzPenalty":0,"extraPoints":{"artist":false,"album":false,"year":false}}'::jsonb,
  rounds_total     integer not null default 10,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------------------
create table players (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions (id) on delete cascade,
  display_name text not null,
  is_host      boolean not null default false,
  score        integer not null default 0,
  joined_at    timestamptz not null default now()
);

create index players_session_id_idx on players (session_id);

-- ---------------------------------------------------------------------------
-- Rounds
-- ---------------------------------------------------------------------------
create table rounds (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references sessions (id) on delete cascade,
  round_number        integer not null,
  track_id            uuid not null references tracks (id),
  audio_window_ms     integer not null,
  phase               round_phase not null default 'playing',
  current_answerer_id uuid references players (id) on delete set null,
  resolution          round_resolution,
  winner_player_id    uuid references players (id) on delete set null,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  unique (session_id, round_number)
);

create index rounds_session_id_idx on rounds (session_id);

-- ---------------------------------------------------------------------------
-- Buzzes (server_ts is server-sealed; the client never sets it)
-- ---------------------------------------------------------------------------
create table buzzes (
  id        uuid primary key default gen_random_uuid(),
  round_id  uuid not null references rounds (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  server_ts timestamptz not null default now(),
  rank      integer,
  unique (round_id, player_id)
);

create index buzzes_round_id_idx on buzzes (round_id);

-- ---------------------------------------------------------------------------
-- Judgements (source of truth for scoring; players.score is denormalized cache)
-- ---------------------------------------------------------------------------
create table judgements (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references rounds (id) on delete cascade,
  player_id      uuid not null references players (id) on delete cascade,
  verdict        verdict not null,
  awarded_points integer not null default 0,
  bonus_flags    jsonb not null default '{}'::jsonb,
  judged_at      timestamptz not null default now()
);

create index judgements_round_id_idx on judgements (round_id);

-- ---------------------------------------------------------------------------
-- Cross references (added last to break the cycle)
-- ---------------------------------------------------------------------------
alter table sessions
  add constraint sessions_host_player_id_fkey
  foreign key (host_player_id) references players (id) on delete set null;

alter table sessions
  add constraint sessions_current_round_id_fkey
  foreign key (current_round_id) references rounds (id) on delete set null;
