# endgame Specification

## Purpose
TBD - created by archiving change add-endgame. Update Purpose after archive.
## Requirements
### Requirement: The game ends after the configured number of rounds

When the configured number of rounds (`roundsTotal`) has been played, the game SHALL end
and the session SHALL be marked `finished`; no further round starts.

#### Scenario: Advancing past the last round ends the game

- **WHEN** the host advances after `roundsTotal` rounds have already been played
- **THEN** the game ends and no new round starts

#### Scenario: Ended session is marked finished

- **WHEN** the game ends
- **THEN** the session status becomes `finished`

### Requirement: The game ends when the playlist is exhausted

When no unplayed track remains, the game SHALL end (session `finished`) rather than raising
an error.

#### Scenario: Running out of tracks ends the game gracefully

- **WHEN** the host advances but every track in the playlist has been played
- **THEN** the game ends and the session is `finished`, not an error

### Requirement: A podium is shown at game end

When the game ends, all participants SHALL see a podium ranking players by accumulated
score, highest first. The host SHALL NOT be listed as a competitor.

#### Scenario: Podium delivered on game end

- **WHEN** the game ends
- **THEN** each participant receives a `game_ended` event with players ranked by score,
  highest first

#### Scenario: Host is not on the podium

- **WHEN** the podium is shown
- **THEN** the host (presenter) is not listed among the ranked players

### Requirement: Round progress is visible

During play, participants SHALL be able to see the current round number relative to the
configured total.

#### Scenario: Progress shown during a round

- **WHEN** a round is active
- **THEN** participants can see the current round number and the configured total
  (for example, "round X of N")

### Requirement: The host can restart the game with the same players

After a game ends, the host SHALL be able to start a new game with the same players (see
`game-lifecycle`). The new game is a fresh game in the same session — its own scoreboard
starts at zero and it has its own configuration — while the players stay in the session
without rejoining.

#### Scenario: New game keeps the players

- **WHEN** the host starts a new game after the previous one ended
- **THEN** the same players are in the new game (no rejoin), with a fresh scoreboard at zero

#### Scenario: Prior game does not affect the new game

- **WHEN** a new game starts
- **THEN** the prior game's rounds, buzzes, and judgements do not affect the new game

### Requirement: The advance control reflects the final round

When the current round is the last configured round, the host's advance control SHALL
indicate that advancing ends the game rather than starting another round.

#### Scenario: Final round shows an end control

- **WHEN** the current round number equals the configured total
- **THEN** the host's advance control indicates finishing the game (not "next round")

