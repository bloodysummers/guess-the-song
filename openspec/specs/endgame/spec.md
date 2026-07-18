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

The host SHALL be able to start a new game with the same players. Scores reset to zero and
prior rounds are cleared, returning the session to the `lobby`.

#### Scenario: Play again resets scores and returns to lobby

- **WHEN** the host chooses to play again
- **THEN** every player's score resets to zero and the session returns to `lobby` with the
  same players

#### Scenario: Prior rounds do not affect the new game

- **WHEN** play again is chosen
- **THEN** prior rounds, buzzes, and judgements no longer affect the new game

