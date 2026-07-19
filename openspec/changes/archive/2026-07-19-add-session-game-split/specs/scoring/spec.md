## MODIFIED Requirements

### Requirement: Scoreboard reflects totals

Scores SHALL be kept per game (a game's scoreboard, separate from `players`). Participants
SHALL see the current game's scoreboard update after points are awarded, and SHALL also be
able to see the session's cumulative total per player across all of its games.

#### Scenario: Game score update broadcast

- **WHEN** points are awarded for a correct answer in a game
- **THEN** a `score_updated` event reflects the current game's scores

#### Scenario: Cumulative session total available

- **WHEN** points are awarded across the games of a session
- **THEN** the cumulative total per player (the sum of their game scores in the session) is
  available to participants
