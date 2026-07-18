## ADDED Requirements

### Requirement: Persistence schema for sessions and gameplay

The system SHALL persist the entities `playlists`, `tracks`, `sessions`, `players`,
`rounds`, `buzzes`, and `judgements` with the relationships defined in the data model.

#### Scenario: Migrations create all tables

- **WHEN** the migrations are applied to a fresh database
- **THEN** all seven tables exist with their primary keys and foreign keys

#### Scenario: Relationships are enforced

- **WHEN** a round is created
- **THEN** it references an existing session and an existing track, and a track references
  an existing playlist

### Requirement: A player is a session participant that may be host

Each `players` row SHALL belong to a session and carry an `is_host` flag. The host of a
session SHALL be identified by `sessions.host_player_id`.

#### Scenario: Session has exactly one host

- **WHEN** a session is created
- **THEN** it references exactly one host player via `host_player_id`

#### Scenario: Host is excluded from scoring

- **WHEN** a player row has `is_host = true`
- **THEN** it represents the presenter/judge and is not eligible for buzzing or scoring

### Requirement: Row Level Security baseline

RLS SHALL be enabled on the gameplay tables, and write access to `judgements` SHALL be
restricted to the session host.

#### Scenario: RLS is enabled

- **WHEN** the schema is provisioned
- **THEN** RLS is enabled on `sessions`, `players`, `rounds`, `buzzes`, and `judgements`

#### Scenario: Only the host can write judgements

- **WHEN** a non-host attempts to insert a row in `judgements`
- **THEN** the RLS policy rejects the write

### Requirement: Seed data for testing

The system SHALL provide at least one curated playlist with multiple tracks as seed data.

#### Scenario: Seed produces a playable playlist

- **WHEN** the seed is run against the database
- **THEN** at least one playlist exists with 10 or more tracks, each having
  `answer_title` and `answer_artist`
