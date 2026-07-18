## ADDED Requirements

### Requirement: Music playback goes through a provider abstraction

Game logic and UI SHALL control playback only through the `MusicProvider` interface.
Provider SDKs (YouTube IFrame API, Spotify Web Playback SDK) SHALL NOT be referenced by
game logic or UI outside a concrete provider implementation.

#### Scenario: Game logic uses the interface

- **WHEN** game logic needs to play or stop audio
- **THEN** it calls `MusicProvider` methods and not a provider SDK directly

#### Scenario: Provider SDK is encapsulated

- **WHEN** the codebase is searched outside provider implementation directories
- **THEN** no YouTube or Spotify SDK import exists in game logic or UI

### Requirement: Provider interface defines the playback control surface

The `MusicProvider` interface SHALL define `play(trackRef, startMs, durationMs)`,
`stop()`, and `search(query)` with typed signatures.

#### Scenario: Interface exists in foundations

- **WHEN** the foundations change is delivered
- **THEN** the `MusicProvider` interface exists with `play`, `stop`, and `search`

#### Scenario: No concrete provider required yet

- **WHEN** no real provider is implemented in foundations
- **THEN** the interface compiles without requiring a concrete implementation
