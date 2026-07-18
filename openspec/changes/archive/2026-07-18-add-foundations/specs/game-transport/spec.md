## ADDED Requirements

### Requirement: Backend communication goes through a transport abstraction

The game logic and UI SHALL communicate with the backend only through the `GameTransport`
interface. Provider SDKs (e.g. `@supabase/*`) SHALL NOT be imported by React components or
game-state logic; they MUST live only inside a transport implementation.

#### Scenario: Game logic depends on the interface, not the SDK

- **WHEN** a component or game-state module needs backend communication
- **THEN** it depends on the `GameTransport` interface and not on `@supabase/*`

#### Scenario: SDK is encapsulated

- **WHEN** the codebase is searched outside the transport implementation directory
- **THEN** no import of `@supabase/*` exists outside `SupabaseTransport`

### Requirement: Transport exposes the session and round action surface

The `GameTransport` interface SHALL expose the actions `create_session`, `join_session`,
`start_round`, `buzz`, `judge`, `next_round`, `end_game`, and `leave`, each with the
payload and return type defined in the data model.

#### Scenario: Actions are available and typed

- **WHEN** a caller uses the transport
- **THEN** each defined action is available with a typed payload and return type

#### Scenario: Foundations ships a compiling stub

- **WHEN** the foundations change is delivered
- **THEN** `SupabaseTransport` provides a stub implementation of every action that compiles

### Requirement: Transport defines event subscription with recipient scoping

The `GameTransport` SHALL provide `on`/`off` subscription for the defined game events and
SHALL designate which events are host-only versus delivered to all participants.

#### Scenario: Events are enumerated

- **WHEN** a caller subscribes to events
- **THEN** the interface enumerates `session_updated`, `player_joined`, `player_left`,
  `presence_updated`, `round_started`, `round_host_payload`, `music_control`,
  `buzz_registered`, `buzz_queue_updated`, `answer_judged`, `round_ended`,
  `score_updated`, and `game_ended`

#### Scenario: Sensitive events are host-only by contract

- **WHEN** an event carries a track reference or the answer
- **THEN** it is designated host-only (`round_host_payload`, `music_control`) in the contract

### Requirement: Player-facing round data excludes the answer

Round data delivered to players SHALL exclude the track reference and the answer. The
track reference and answer SHALL be carried only by the host-only channel.

#### Scenario: Player round-start type has no answer

- **WHEN** the `round_started` (player) payload type is defined
- **THEN** it contains no track `providerRef` and no answer fields

#### Scenario: Host payload carries the sensitive data

- **WHEN** the `round_host_payload` type is defined
- **THEN** it carries the track reference and the answer (title, artist, aliases, year)
