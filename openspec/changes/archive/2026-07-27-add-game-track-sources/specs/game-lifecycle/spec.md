## MODIFIED Requirements

### Requirement: The host starts a game within a session

The host SHALL start a game within a session by choosing a **source** (a curated playlist from
the catalog, or a public YouTube / YouTube Music playlist URL) and a configuration (scoring
mode, difficulty, rounds). On creation the game SHALL materialize its own track set
(`game_tracks`) from that source, and SHALL carry its own state and scoreboard.

#### Scenario: Starting a game from a source

- **WHEN** the host starts a game with a valid source and config
- **THEN** a new active game is created with its own track set materialized and its own
  scoreboard at zero

#### Scenario: Only the host starts a game

- **WHEN** a non-host attempts to start a game
- **THEN** it is rejected
