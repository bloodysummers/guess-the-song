-- Guess the Song — cover art for the playing track.
--
-- The artwork is stored on the game's own snapshot (resolved once, at
-- materialization, so each provider can supply it its own way), and denormalized
-- onto the round when the answer is revealed.
--
-- The denormalization matters for anti-cheat: `game_tracks` is unreadable by anon,
-- so a player can only ever see the cover through `rounds.revealed_artwork_url`,
-- which — exactly like `revealed_title` — stays NULL until the round resolves.

alter table game_tracks add column artwork_url text;

alter table rounds add column revealed_artwork_url text;
