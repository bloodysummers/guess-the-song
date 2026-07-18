-- Guess the Song — lobby support
-- Adds reconnect tokens, per-session unique player names, and enables Realtime
-- on the tables the lobby subscribes to.

-- Reconnect token: returned to the client on create/join, verified on reconnect.
alter table players
  add column reconnect_token text not null default gen_random_uuid()::text;

-- Unique player name within a session (case-insensitive, trimmed). The host name
-- counts. Enforced in the DB so simultaneous joins cannot race past validation.
create unique index players_session_name_unique
  on players (session_id, (lower(trim(display_name))));

-- Enable Realtime (postgres_changes) for the lobby roster and session status.
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table sessions;

-- REPLICA IDENTITY FULL so DELETE events carry the full old row (needed to filter
-- player_left events by session_id, since the default only ships the primary key).
alter table players replica identity full;
