## MODIFIED Requirements

### Requirement: Host creates a session

The system SHALL let a host create a session as a hub, WITHOUT choosing a playlist or game
configuration. The session SHALL start `open` with the creator recorded as a non-scoring
host participant. Game configuration happens later, when the host starts a game (see
`game-lifecycle`).

#### Scenario: Session is created open

- **WHEN** a host creates a session
- **THEN** a new session is created with status `open` and a host player with `is_host = true`,
  and no game exists yet

#### Scenario: Create returns identifiers

- **WHEN** a host creates a session
- **THEN** the response includes a session id, a join code, and the host player id
