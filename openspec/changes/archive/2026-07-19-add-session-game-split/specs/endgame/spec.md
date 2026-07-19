## MODIFIED Requirements

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
