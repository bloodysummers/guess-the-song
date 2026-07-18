# session-presence Specification

## Purpose
TBD - created by archiving change add-lobby. Update Purpose after archive.
## Requirements
### Requirement: Live connection status of participants

The system SHALL track which participants of a session are currently connected and expose
the set of online participants to the session in real time.

#### Scenario: Online set is available

- **WHEN** participants are connected to a session
- **THEN** each participant can obtain the set of currently-online participant ids

#### Scenario: Connect and disconnect propagate

- **WHEN** a participant connects or disconnects
- **THEN** a `presence_updated` event reflects the change to the rest of the session

### Requirement: Presence reflects reconnection

Presence SHALL update when a participant drops the connection and again when they reconnect.

#### Scenario: Drop shows offline

- **WHEN** a participant loses connection
- **THEN** they are shown as offline within a short interval

#### Scenario: Reconnect shows online

- **WHEN** the participant reconnects (for example after a reload)
- **THEN** they are shown as online again without creating a duplicate participant

