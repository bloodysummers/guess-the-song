## ADDED Requirements

### Requirement: Host starts a round with a random unplayed track

The system SHALL let the host start a round, selecting a track at random from the session
playlist that has not been used in an earlier round of the same session. The round SHALL
record the audio window from the session config.

#### Scenario: Round uses an unplayed track

- **WHEN** the host starts a round
- **THEN** a round is created referencing a track not used in earlier rounds of that
  session, stamped with the session's audio window

#### Scenario: Playlist exhausted

- **WHEN** the host starts a round but every track in the playlist has already been used
- **THEN** starting the round is rejected with a clear "playlist exhausted" signal

### Requirement: Players receive round start without the answer

When a round starts, players SHALL be notified that a round began — with the round number
and audio window — and SHALL NOT receive any track reference or answer.

#### Scenario: Player round-start omits sensitive data

- **WHEN** a round starts
- **THEN** each player receives a `round_started` event with the round number and audio
  window but no track reference and no answer

### Requirement: Host receives the track and answer privately

When a round starts, the host SHALL receive the playable track reference and the answer, and
no other participant SHALL receive them.

#### Scenario: Host gets the private payload

- **WHEN** a round starts
- **THEN** the host receives the track reference (provider, id, start offset) and the answer

#### Scenario: Players never get the private payload

- **WHEN** a round starts
- **THEN** no player receives the track reference or the answer

### Requirement: Host advances to the next round

The host SHALL be able to start the next round; the current round is resolved (marked
`skipped` until judging exists) and a new round begins with a different track.

#### Scenario: Advancing resolves the current round

- **WHEN** the host advances to the next round
- **THEN** the current round is marked resolved and a new round with a different track starts

### Requirement: Audio window ends on timeout

If no buzz occurs, the audio SHALL stop when the window elapses, and the round SHALL remain
awaiting the host to advance.

#### Scenario: No buzz within the window

- **WHEN** the audio window elapses with no buzz
- **THEN** playback has stopped and the host can start the next round
