-- Guess the Song — split Session (persistent hub) from Game (a configured playthrough).
-- DESTRUCTIVE: restructures sessions/players and moves game state into new tables.
-- Sessions are ephemeral, so no data is preserved.

-- ---------------------------------------------------------------------------
-- Session becomes a hub: drop game config, add status.
-- (Dropping current_round_id also drops its FK; dropping playlist_id drops its FK.)
-- ---------------------------------------------------------------------------
-- Replace the old game-oriented status (session_status enum: lobby/active/finished)
-- with a hub status (open/closed).
alter table sessions drop column status;
alter table sessions add column status text not null default 'open';
alter table sessions drop column current_round_id;
alter table sessions drop column config;
alter table sessions drop column rounds_total;
alter table sessions drop column playlist_id;

-- Score moves to per-game scoreboards.
alter table players drop column score;

-- ---------------------------------------------------------------------------
-- Games: a configured playthrough inside a session.
-- ---------------------------------------------------------------------------
create table games (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references sessions (id) on delete cascade,
  game_type        text not null default 'guess-the-song',
  playlist_id      uuid not null references playlists (id),
  config           jsonb not null,
  rounds_total     integer not null default 10,
  status           text not null default 'active', -- active | finished
  current_round_id uuid,
  created_at       timestamptz not null default now(),
  ended_at         timestamptz
);

create index games_session_id_idx on games (session_id);

-- Per-game scoreboard.
create table game_scores (
  id        uuid primary key default gen_random_uuid(),
  game_id   uuid not null references games (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  score     integer not null default 0,
  unique (game_id, player_id)
);

create index game_scores_game_id_idx on game_scores (game_id);

-- ---------------------------------------------------------------------------
-- Round / buzz / judgement now belong to a game. session_id is kept for the
-- Realtime filter (a stable key), game_id scopes the data to a game.
-- ---------------------------------------------------------------------------
alter table rounds add column game_id uuid references games (id) on delete cascade;
alter table buzzes add column game_id uuid references games (id) on delete cascade;
alter table judgements add column game_id uuid references games (id) on delete cascade;

create index rounds_game_id_idx on rounds (game_id);
create index buzzes_game_id_idx on buzzes (game_id);
create index judgements_game_id_idx on judgements (game_id);

-- round_number is now unique per game (it restarts each game), not per session.
alter table rounds drop constraint rounds_session_id_round_number_key;
alter table rounds add constraint rounds_game_id_round_number_key unique (game_id, round_number);

-- games.current_round_id -> rounds (added after rounds.game_id to break the cycle).
alter table games
  add constraint games_current_round_id_fkey
  foreign key (current_round_id) references rounds (id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS + grants (same posture: clients read, server writes) and Realtime.
-- ---------------------------------------------------------------------------
alter table games enable row level security;
create policy "games are readable by anyone"
  on games for select to anon, authenticated using (true);

alter table game_scores enable row level security;
create policy "game_scores are readable by anyone"
  on game_scores for select to anon, authenticated using (true);

grant select on games, game_scores to anon, authenticated;
grant all on all tables in schema public to service_role;

alter publication supabase_realtime add table games;
alter publication supabase_realtime add table game_scores;
