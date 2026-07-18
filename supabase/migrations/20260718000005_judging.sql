-- Guess the Song — judging, scoring & reveal
-- Reveal columns on rounds (null until the round resolves, so the answer never leaks
-- to players before then), and Realtime on judgements.

alter table rounds
  add column revealed_title text,
  add column revealed_artist text,
  add column revealed_year integer;

-- Denormalize session_id onto judgements so clients can filter judgement events by
-- session (postgres_changes filters are single column; judgements only had round_id).
alter table judgements
  add column session_id uuid references sessions (id) on delete cascade;

create index judgements_session_id_idx on judgements (session_id);

alter publication supabase_realtime add table judgements;
