## ADDED Requirements

### Requirement: Scoring mode is chosen by the host

The host SHALL choose a scoring mode when creating the session. The supported modes are
`simple` (one point per correct answer) and `speed` (`base × difficultyMultiplier ×
speedFactor`). The chosen mode SHALL apply to the whole session.

#### Scenario: Mode is set at creation

- **WHEN** the host creates a session with a scoring mode
- **THEN** every correct answer in that session is scored with the chosen mode

### Requirement: Simple mode awards one point per correct answer

In `simple` mode, a correct answer SHALL award exactly one point, regardless of difficulty,
speed, or queue position.

#### Scenario: One point per correct answer

- **WHEN** a player is judged correct in `simple` mode
- **THEN** exactly one point is recorded and added to that player's total

### Requirement: Speed mode scales points by difficulty and speed

In `speed` mode, a correct answer SHALL award `base × difficultyMultiplier × speedFactor`
plus any granted extras.

#### Scenario: Faster buzz scores higher

- **WHEN** two correct answers in `speed` mode use the same audio window but different buzz
  times
- **THEN** the earlier buzz (relative to the window) yields more points

#### Scenario: Shorter window scores higher

- **WHEN** two correct answers in `speed` mode share the same speed factor but different
  audio windows
- **THEN** the shorter window yields more points

### Requirement: Correct answers add points; no penalty, no position reduction

A correct answer SHALL record its award on the judgement and add it to the player's total.
There SHALL be no penalty and no reduction for the winner's position in the buzz queue, in
any mode.

#### Scenario: Full points regardless of position

- **WHEN** the winner answered after earlier buzzers failed (a later queue position)
- **THEN** the award is not reduced for their position

### Requirement: No points on incorrect or unsolved

An incorrect answer SHALL award zero points, and a round no one answers correctly SHALL
change no player's total, in any mode.

#### Scenario: Incorrect awards zero

- **WHEN** a player is judged incorrect
- **THEN** their award is zero and their total does not increase

#### Scenario: Exhausted round awards nothing

- **WHEN** a round resolves without a correct answer
- **THEN** no player's total changes

### Requirement: Scoreboard reflects totals

Participants SHALL see each player's accumulated score update after points are awarded.

#### Scenario: Score update broadcast

- **WHEN** points are awarded for a correct answer
- **THEN** a `score_updated` event reflects the new totals
