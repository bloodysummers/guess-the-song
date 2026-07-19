-- Guess the Song — replay support
-- Tracks how many times a round's audio was replayed, to apply a scoring penalty.

alter table rounds
  add column replay_count integer not null default 0;
