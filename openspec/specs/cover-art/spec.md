# cover-art Specification

## Purpose
TBD - created by archiving change add-cover-art. Update Purpose after archive.
## Requirements
### Requirement: A game track carries cover art resolved from its provider

When a game materializes its track set, each track SHALL carry a cover art URL when its provider
can supply one. The resolution SHALL happen once, at materialization, so each provider supplies
artwork its own way.

#### Scenario: YouTube-sourced track

- **WHEN** a track is materialized from a YouTube (or curated YouTube) source
- **THEN** its cover art URL is derived from the video reference, with no extra API call

#### Scenario: Provider without derivable artwork

- **WHEN** a provider cannot supply cover art
- **THEN** the track has no cover art and everything else works unchanged

### Requirement: The host sees the cover art of the playing track

The host SHALL see the cover art of the current track for the duration of the round, alongside
the answer the host is judging against.

#### Scenario: Cover shown while the round runs

- **WHEN** a round starts
- **THEN** the host panel shows that track's cover art

#### Scenario: Cover cleared between rounds

- **WHEN** the host advances to the next round
- **THEN** the previous track's cover art is no longer shown

### Requirement: Players see the cover art only once the answer is revealed

Cover art SHALL follow the same visibility rule as the revealed answer: it SHALL NOT be readable
by a player before the round resolves, and SHALL be shown to everyone once it does.

#### Scenario: Hidden while the round is unresolved

- **WHEN** a round is playing or being answered
- **THEN** no cover art for that round is readable by a player

#### Scenario: Revealed with the answer

- **WHEN** the round resolves
- **THEN** the cover art is delivered with the revealed answer and shown on the player's screen

### Requirement: Missing artwork never breaks the round

A cover art URL that fails to load SHALL be hidden without affecting the round panel.

#### Scenario: Artwork fails to load

- **WHEN** the image cannot be fetched
- **THEN** it is hidden and the round continues normally

