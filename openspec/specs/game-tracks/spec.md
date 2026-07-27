# game-tracks Specification

## Purpose
TBD - created by archiving change add-game-track-sources. Update Purpose after archive.
## Requirements
### Requirement: A game materializes its own track set from a source

When a game is created, the system SHALL materialize the game's own set of tracks
(`game_tracks`) from a source: a curated playlist from the catalog, or a public YouTube /
YouTube Music playlist URL. Each track SHALL carry its provider, provider reference, and a
normalized answer title/artist.

#### Scenario: Curated source

- **WHEN** a game is created from a curated playlist
- **THEN** the game's tracks are copied from that playlist's catalog tracks

#### Scenario: YouTube source

- **WHEN** a game is created from a public YouTube (or YouTube Music) playlist URL
- **THEN** the playlist is read via the YouTube Data API and the game's tracks are created with
  normalized answer title/artist

#### Scenario: Invalid or unreadable YouTube URL

- **WHEN** the URL is not a readable public playlist
- **THEN** game creation is rejected with a clear error and no game is created

### Requirement: The game track set is ephemeral and per-game

The materialized track set SHALL belong to a single game and SHALL be removed when the game (or
its session) is removed. It SHALL NOT persist in a global catalog nor be visible to other
sessions.

#### Scenario: Removed with the session

- **WHEN** a session is deleted
- **THEN** the game tracks of its games are deleted too

### Requirement: Rounds and reveals use the game's track set

Round selection (random, no repeat) and the answer reveal SHALL operate on the game's
`game_tracks`, not on the global catalog.

#### Scenario: No-repeat within the game

- **WHEN** the host advances rounds in a game
- **THEN** each round uses a game track not used in an earlier round of that game

#### Scenario: Provider-agnostic playback

- **WHEN** a round plays
- **THEN** the host receives the game track's provider + reference to play it, regardless of
  which provider the game was sourced from

### Requirement: Game track answers stay hidden from players

`game_tracks` SHALL follow the same visibility rules as the curated catalog: their answer data
SHALL NOT be readable by players.

#### Scenario: Players cannot read game track answers

- **WHEN** a player's client queries game tracks
- **THEN** no answer data is returned (locked, like curated tracks)

### Requirement: Unplayable entries are skipped

Deleted, private, or otherwise unavailable playlist entries SHALL be skipped during
materialization.

#### Scenario: Deleted entries excluded

- **WHEN** a source playlist contains deleted or private videos
- **THEN** those entries do not become game tracks

