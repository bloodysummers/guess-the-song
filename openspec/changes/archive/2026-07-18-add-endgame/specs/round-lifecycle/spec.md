## MODIFIED Requirements

### Requirement: Host starts a round with a random unplayed track

The system SHALL let the host start a round, selecting a track at random from the session
playlist that has not been used in an earlier round of the same session. The round SHALL
record the audio window from the session config. When no unplayed track remains, starting a
round SHALL end the game (see the `endgame` capability) rather than raise an error.

#### Scenario: Round uses an unplayed track

- **WHEN** the host starts a round
- **THEN** a round is created referencing a track not used in earlier rounds of that
  session, stamped with the session's audio window

#### Scenario: Playlist exhausted ends the game

- **WHEN** the host starts a round but every track in the playlist has already been used
- **THEN** the game ends (session `finished`) instead of returning an error
