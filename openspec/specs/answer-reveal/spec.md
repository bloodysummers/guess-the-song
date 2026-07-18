# answer-reveal Specification

## Purpose
TBD - created by archiving change add-judging-scoring. Update Purpose after archive.
## Requirements
### Requirement: Answer revealed only at round end

The correct answer SHALL be revealed to players only when the round ends (resolved as
`correct` or `exhausted`), never during play.

#### Scenario: Reveal on round end

- **WHEN** a round ends
- **THEN** players receive a `round_ended` event containing the revealed answer
  (title, artist, year)

#### Scenario: No reveal during the round

- **WHEN** a round is in the `playing` or `answering` phase
- **THEN** no player has received the answer

### Requirement: Reveal does not leak the track reference

The reveal SHALL include the answer text but not the playable track reference.

#### Scenario: Reveal omits the track reference

- **WHEN** a round ends and the answer is revealed
- **THEN** the reveal contains title, artist, and year but no provider track reference

