## MODIFIED Requirements

### Requirement: Plays an audio-only window from YouTube

The system SHALL play a track from YouTube for a given duration, with no visible video (audio
only), through the `MusicProvider` interface. The window duration SHALL be measured from the
moment audio actually begins playing (after any buffering), not from when playback is
requested, so the configured duration is heard in full even for very short windows.

#### Scenario: Window measured from actual playback start

- **WHEN** the host starts a round and audio begins after some buffering
- **THEN** the full configured duration plays before playback stops

#### Scenario: Very short windows still play

- **WHEN** the audio window is very short (for example 1 second)
- **THEN** the audio is heard for the full window (buffering does not consume it)

## ADDED Requirements

### Requirement: The start offset is randomized per play and stable within a round

When a round starts, the start offset SHALL be chosen at random within the track so that the
whole audio window fits inside the track. Different appearances of the same track SHALL use
different fragments. A replay of the current round SHALL use the exact same fragment as that
round's original play.

#### Scenario: A new round randomizes the fragment

- **WHEN** a round starts
- **THEN** the start offset is chosen at random within the track's bounds, with the full
  window inside the track

#### Scenario: Replay uses the same fragment

- **WHEN** the host replays the current round
- **THEN** the same start offset (fragment) is used as the round's original play
