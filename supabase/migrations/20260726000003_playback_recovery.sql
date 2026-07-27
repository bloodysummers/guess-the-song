-- Guess the Song — recovering from a track that won't play.
--
-- Some tracks pass import validation and still fail at playback time: region
-- blocks, embedding disabled, or a video that died between import and play. The
-- host's player reports these, and the round swaps to another track — but the bad
-- one must not be drawn again later in the same game, hence this flag.
--
-- Silence is NOT covered here: a quiet fragment raises no error, so it is handled
-- by the host re-rolling the fragment (no schema needed for that).

alter table game_tracks add column unplayable boolean not null default false;
