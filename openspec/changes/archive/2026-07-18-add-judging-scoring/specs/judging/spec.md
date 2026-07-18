## ADDED Requirements

### Requirement: Only the host judges

Judging a round SHALL be restricted to the session host.

#### Scenario: Non-host judge rejected

- **WHEN** a non-host participant attempts to judge
- **THEN** the action is rejected

### Requirement: Judge applies to the current answerer only

The host SHALL be able to judge only the player who currently holds the turn
(`current_answerer`) in a round that is in the `answering` phase.

#### Scenario: Judging a non-current player is rejected

- **WHEN** the host judges a player who is not the current answerer
- **THEN** the action is rejected

#### Scenario: Judging outside the answering phase is rejected

- **WHEN** the host judges while the round is not in the `answering` phase
- **THEN** the action is rejected

### Requirement: Correct answer resolves the round

When the host marks the current answerer correct, the round SHALL resolve as `correct` with
that player recorded as the winner.

#### Scenario: Correct ends the round

- **WHEN** the host marks the current answerer correct
- **THEN** the round is resolved as `correct` and that player is the winner

### Requirement: Incorrect passes to the next fastest

When the host marks the current answerer incorrect, the turn SHALL pass to the next fastest
buzzer who has not yet answered this round. If no such player remains, the round SHALL
resolve without a winner.

#### Scenario: Pass to the next in the queue

- **WHEN** the host marks the current answerer incorrect and other buzzers remain
- **THEN** the next fastest un-judged buzzer becomes the current answerer

#### Scenario: No one left resolves the round

- **WHEN** the host marks the current answerer incorrect and no un-judged buzzers remain
- **THEN** the round resolves as `exhausted` with no winner

### Requirement: A player answers at most once per round

A player who has been judged in a round SHALL NOT be given the turn again in that round.

#### Scenario: Judged player is not re-selected

- **WHEN** a player has been judged incorrect and the turn passes on
- **THEN** that player is not selected again as the current answerer in that round
