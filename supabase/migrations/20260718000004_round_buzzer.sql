-- Guess the Song — round & buzzer support
-- Enables Realtime on rounds and buzzes, and denormalizes session_id onto buzzes
-- so clients can filter buzz events by session (postgres_changes filters are single
-- column, and buzzes only had round_id).

alter table buzzes
  add column session_id uuid references sessions (id) on delete cascade;

create index buzzes_session_id_idx on buzzes (session_id);

alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table buzzes;
