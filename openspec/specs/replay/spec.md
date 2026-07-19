# replay Specification

## Purpose
TBD - created by archiving change add-replay. Update Purpose after archive.
## Requirements
### Requirement: The host can replay the audio before any buzz

While a round is in the `playing` phase and no player has buzzed, the host SHALL be able to
replay the audio window. Replaying SHALL be rejected once a buzz has been registered or the
round has resolved.

#### Scenario: Replay before a buzz

- **WHEN** the host replays a round that is in `playing` with no buzzes
- **THEN** the round's replay count increases and the audio window plays again

#### Scenario: Replay after a buzz is rejected

- **WHEN** the host attempts to replay after a buzz has been registered
- **THEN** the replay is rejected

#### Scenario: Only the host can replay

- **WHEN** a non-host attempts to replay
- **THEN** it is rejected

### Requirement: A replayed round penalizes the award

If a round has been replayed at least once, a correct answer SHALL apply a penalty modifier
to the award (default 0.5), in any scoring mode. A round never replayed SHALL award full
points.

#### Scenario: Correct answer after a replay is penalized

- **WHEN** a player is judged correct in a round that was replayed
- **THEN** the awarded points are reduced by the penalty modifier

#### Scenario: No replay means full points

- **WHEN** a player is judged correct in a round that was never replayed
- **THEN** the awarded points are not penalized

### Requirement: Replay is visible to participants

When a round is replayed, participants SHALL be able to see that the round was replayed (and
therefore carries a penalty).

#### Scenario: Replay indicator delivered

- **WHEN** the host replays a round
- **THEN** participants receive a `round_replayed` update reflecting the new replay count

