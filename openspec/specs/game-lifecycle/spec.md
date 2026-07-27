# game-lifecycle Specification

## Purpose
TBD - created by archiving change add-session-game-split. Update Purpose after archive.
## Requirements
### Requirement: A session is a persistent hub

A session SHALL be a persistent hub that holds the join code, the host, and the players,
independent of any game. It SHALL outlive individual games until the host closes it.

#### Scenario: Session persists without a game

- **WHEN** a host creates a session
- **THEN** the session exists as a hub with the host and no active game

#### Scenario: Session survives a game ending

- **WHEN** a game in the session ends
- **THEN** the session and its players remain, ready for another game

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

### Requirement: Players remain in the session across games

Players SHALL stay in the session across games without re-entering the code or scanning the
QR again.

#### Scenario: Same players in a new game

- **WHEN** the host starts a new game after a previous one ended
- **THEN** the existing players are part of the new game without rejoining

### Requirement: Per-game and cumulative scoreboards

Each game SHALL keep its own scoreboard starting at zero. The session SHALL also expose a
cumulative total per player across all of its games.

#### Scenario: Per-game score resets

- **WHEN** a new game starts
- **THEN** every player's game score begins at zero

#### Scenario: Cumulative total accumulates

- **WHEN** points are awarded across multiple games in a session
- **THEN** the session cumulative total per player reflects the sum of their game scores

### Requirement: Ending a game returns to the hub

Ending a game (by finishing or by the host) SHALL return the session to the hub state with
the game preserved as history; it SHALL NOT close the session.

#### Scenario: Game end keeps the session open

- **WHEN** a game ends
- **THEN** the session stays open and the host can start another game

### Requirement: Closing a session ends everything

The host SHALL be able to close the session, which ends the session for all participants.

#### Scenario: Host closes the session

- **WHEN** the host closes the session
- **THEN** the session is marked closed and participants are removed from it

### Requirement: Games carry a type for future game modes

Each game SHALL carry a `game_type` (default `guess-the-song`) so a session can support
different kinds of games over time.

#### Scenario: Default game type

- **WHEN** a game is created without specifying a type
- **THEN** it is recorded as `guess-the-song`

