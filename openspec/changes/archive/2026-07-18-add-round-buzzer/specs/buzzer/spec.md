## ADDED Requirements

### Requirement: Buzz order is sealed by the server

A player's buzz time SHALL be recorded by the server with its own authoritative timestamp,
never supplied by the client, and the queue order SHALL be derived from those server
timestamps.

#### Scenario: Server stamps the buzz

- **WHEN** a player buzzes
- **THEN** the server records the buzz with its own timestamp and ignores any client-provided
  time

#### Scenario: Queue ordered by server time

- **WHEN** multiple players buzz
- **THEN** the queue is ordered by server timestamp, earliest first

### Requirement: One buzz per player per round

Each player SHALL be able to buzz at most once per round.

#### Scenario: Duplicate buzz rejected

- **WHEN** a player who already buzzed buzzes again in the same round
- **THEN** the second buzz is rejected and does not change their position

### Requirement: Only players can buzz

The host SHALL NOT be able to buzz; only non-host participants can.

#### Scenario: Host buzz rejected

- **WHEN** the host attempts to buzz
- **THEN** it is rejected

### Requirement: First buzz pauses the music

When the first buzz of a round is registered, the music SHALL stop and the round SHALL enter
the `answering` phase with the fastest buzzer as the current answerer.

#### Scenario: Music stops on first buzz

- **WHEN** the first buzz of a round is registered
- **THEN** the music stops on the host

#### Scenario: Round enters answering

- **WHEN** the first buzz of a round is registered
- **THEN** the round phase becomes `answering` and the fastest player is the current answerer

### Requirement: The buzz queue is broadcast

Participants SHALL see the buzz queue update as buzzes are registered.

#### Scenario: Queue update delivered

- **WHEN** a buzz is registered
- **THEN** participants receive a `buzz_queue_updated` event with the ordered queue and the
  current answerer
