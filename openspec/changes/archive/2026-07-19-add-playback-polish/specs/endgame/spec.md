## ADDED Requirements

### Requirement: The advance control reflects the final round

When the current round is the last configured round, the host's advance control SHALL
indicate that advancing ends the game rather than starting another round.

#### Scenario: Final round shows an end control

- **WHEN** the current round number equals the configured total
- **THEN** the host's advance control indicates finishing the game (not "next round")
