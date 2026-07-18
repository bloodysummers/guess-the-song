-- Guess the Song — Row Level Security baseline
-- Source of truth: docs/data-model.md §5 (visibility / anti-cheat rules)
--
-- Posture for the MVP (anonymous play, no auth accounts):
--   * Authoritative writes (sealing buzz timestamps, judging, mutating session
--     state) happen server-side through the SERVICE ROLE, which bypasses RLS.
--   * The public `anon` role may READ gameplay rows (needed for Realtime) but may
--     NOT write them directly. This makes the server the sole authority.
--   * `tracks` holds the answers, so it is NOT readable by `anon` at all — the
--     answer never reaches a player's client. Only the service role reads it.
--
-- Finer-grained per-session / host-vs-player policies are layered in later phases
-- once identity (per-session tokens) exists.

-- ---- playlists: public read (players pick/see the playlist) ----------------
alter table playlists enable row level security;

create policy "playlists are readable by anyone"
  on playlists for select
  to anon, authenticated
  using (true);

-- ---- tracks: locked down (answers live here) -------------------------------
alter table tracks enable row level security;
-- No anon/authenticated policy: only the service role (server) can read/write.

-- ---- sessions: read-only for clients ---------------------------------------
alter table sessions enable row level security;

create policy "sessions are readable by anyone"
  on sessions for select
  to anon, authenticated
  using (true);

-- ---- players: read-only for clients ----------------------------------------
alter table players enable row level security;

create policy "players are readable by anyone"
  on players for select
  to anon, authenticated
  using (true);

-- ---- rounds: read-only for clients -----------------------------------------
-- Safe to expose: rounds reference track_id, but `tracks` itself is not
-- readable by anon, so the answer stays hidden.
alter table rounds enable row level security;

create policy "rounds are readable by anyone"
  on rounds for select
  to anon, authenticated
  using (true);

-- ---- buzzes: read-only for clients -----------------------------------------
alter table buzzes enable row level security;

create policy "buzzes are readable by anyone"
  on buzzes for select
  to anon, authenticated
  using (true);

-- ---- judgements: read-only for clients; writes are host-only ---------------
-- With RLS enabled and no INSERT/UPDATE/DELETE policy for anon/authenticated,
-- a non-host (any client) is rejected when writing a judgement. Judgements are
-- created server-side with the service role after verifying the caller is the
-- session host (sessions.host_player_id).
alter table judgements enable row level security;

create policy "judgements are readable by anyone"
  on judgements for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Table-level privileges (GRANTs)
--
-- RLS alone is not enough: a role must ALSO hold the underlying table privilege.
-- Posture:
--   * anon/authenticated get SELECT on the readable gameplay tables (for Realtime
--     and UI reads), and SELECT on playlists. They get NO write privileges and NO
--     access to `tracks` (which holds the answers).
--   * All writes (creating sessions/players, sealing buzzes, judging) go through
--     the service role server-side, which already holds full privileges.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on
  playlists,
  sessions,
  players,
  rounds,
  buzzes,
  judgements
to anon, authenticated;

-- `tracks` stays locked to the public roles (answers must never reach a player).
revoke all on tracks from anon, authenticated;

-- Service role: full access for authoritative server-side writes.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
