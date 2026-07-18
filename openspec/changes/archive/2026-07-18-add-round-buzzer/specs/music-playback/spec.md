## ADDED Requirements

### Requirement: Plays an audio-only window from YouTube

The system SHALL play a track from YouTube starting at a given offset for a given duration,
with no visible video (audio only), through the `MusicProvider` interface.

#### Scenario: Audio window plays from the offset

- **WHEN** the host starts a round
- **THEN** the configured audio window plays from the track's start offset with the video
  surface hidden

#### Scenario: Window stops automatically

- **WHEN** the audio window duration elapses
- **THEN** playback stops automatically

### Requirement: Playback can be stopped immediately

The provider SHALL stop playback immediately on request, such as when the first buzz lands.

#### Scenario: Stop halts audio

- **WHEN** `stop()` is called during playback
- **THEN** audio ceases immediately

### Requirement: Music provider SDK stays encapsulated

The YouTube IFrame API SHALL be referenced only within the music provider implementation.

#### Scenario: No YouTube reference leaks

- **WHEN** the codebase is searched outside the music provider implementation
- **THEN** no YouTube API reference exists in game logic or UI
