# session-lobby Specification

## Purpose
TBD - created by archiving change add-lobby. Update Purpose after archive.
## Requirements
### Requirement: Host creates a session

The system SHALL let a host create a session by choosing a playlist and a difficulty
configuration. The session SHALL start in `lobby` status with the creator recorded as a
non-scoring host participant.

#### Scenario: Session is created in lobby

- **WHEN** a host creates a session with a valid playlist and config
- **THEN** a new session is created in `lobby` status and a host player is created with
  `is_host = true`

#### Scenario: Create returns identifiers

- **WHEN** a host creates a session
- **THEN** the response includes a session id, a join code, and the host player id

### Requirement: Join code is unique and shareable

Each session SHALL have a short join code that is unique among non-finished sessions. The
host view SHALL present the code as text and as a scannable QR that encodes the join URL.

#### Scenario: Unique code assigned

- **WHEN** a session is created
- **THEN** it receives a short code that no other non-finished session currently holds

#### Scenario: Code shown as text and QR

- **WHEN** the host views the lobby
- **THEN** the join code is shown as text and as a QR encoding the join URL

### Requirement: Player joins by code with a display name

A player SHALL join a session by entering its code and a display name, without creating an
account.

#### Scenario: Successful join

- **WHEN** a player submits a valid code for a session in `lobby` and a display name
- **THEN** they are added as a non-host participant and receive a player id

#### Scenario: Others are notified

- **WHEN** a player joins
- **THEN** existing participants receive a `player_joined` event and the new player sees the
  current participant list

#### Scenario: Manual join without a QR

- **WHEN** a player opens the join path directly without a code in the URL
- **THEN** a form lets them type the join code and a display name manually, with no QR
  required

### Requirement: Player names are unique within a session

Within a single session, each participant's display name SHALL be unique, compared
case-insensitively and with surrounding whitespace trimmed. The host participant's name
counts. A join whose name is already taken in that session SHALL be rejected and SHALL NOT
create a player.

#### Scenario: Duplicate name is rejected

- **WHEN** a player submits a display name already used by another participant in the same
  session
- **THEN** the join is rejected with a clear "name already taken" error and no player is
  created

#### Scenario: Case and whitespace do not bypass uniqueness

- **WHEN** a player submits a name that differs from an existing participant's name only by
  letter case or surrounding whitespace
- **THEN** it is treated as the same name and the join is rejected

### Requirement: Invalid or non-joinable codes are rejected

The system SHALL reject joins for unknown codes and for sessions that are not in `lobby`
status.

#### Scenario: Unknown code

- **WHEN** a player submits a code that matches no session
- **THEN** the join is rejected with a clear error and no player is created

#### Scenario: Session already started or finished

- **WHEN** a player submits a code for a session whose status is not `lobby`
- **THEN** the join is rejected because the game already started or finished

### Requirement: Reconnectable player identity

On creating or joining, the client SHALL receive a player identity token persisted locally
so the same player can reconnect to the session without losing their place.

#### Scenario: Identity persisted

- **WHEN** a player joins a session
- **THEN** the client stores a player identity token locally

#### Scenario: Reconnect as the same player

- **WHEN** a player reloads or reconnects with a stored token for an active session
- **THEN** they rejoin as the same player id, not as a duplicate participant

### Requirement: Host does not compete

The host participant SHALL be excluded from the roster of players eligible to buzz or score.

#### Scenario: Host shown as presenter

- **WHEN** the participant roster is presented for gameplay
- **THEN** the host is shown as presenter and is not counted among the scoring players

### Requirement: Player can leave the lobby

A participant SHALL be able to leave a session, and the remaining participants SHALL be
notified.

#### Scenario: Leave notifies others

- **WHEN** a participant leaves the session
- **THEN** a `player_left` event is delivered to the others and the participant is removed
  from the roster

