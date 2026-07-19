# scoring Specification

## Purpose
TBD - created by archiving change add-judging-scoring. Update Purpose after archive.
## Requirements
### Requirement: Scoring mode is chosen by the host

The host SHALL choose a scoring mode when creating the session. The supported modes are
`simple` (one point per correct answer) and `speed` (`base × difficultyMultiplier ×
speedFactor`). The chosen mode SHALL apply to the whole session.

#### Scenario: Mode is set at creation

- **WHEN** the host creates a session with a scoring mode
- **THEN** every correct answer in that session is scored with the chosen mode

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

Scores SHALL be kept per game (a game's scoreboard, separate from `players`). Participants
SHALL see the current game's scoreboard update after points are awarded, and SHALL also be
able to see the session's cumulative total per player across all of its games.

#### Scenario: Game score update broadcast

- **WHEN** points are awarded for a correct answer in a game
- **THEN** a `score_updated` event reflects the current game's scores

#### Scenario: Cumulative session total available

- **WHEN** points are awarded across the games of a session
- **THEN** the cumulative total per player (the sum of their game scores in the session) is
  available to participants

### Requirement: Simple mode awards the base points per correct answer

In `simple` mode, a correct answer SHALL award the base points (10 by default), regardless
of difficulty, speed, or queue position.

#### Scenario: Base points per correct answer

- **WHEN** a player is judged correct in `simple` mode
- **THEN** the base points (10) are recorded and added to that player's total

### Requirement: Awards can be scaled by a modifier

The scoring engine SHALL accept a multiplicative `modifier` (default 1) applied to the
computed award before extras, so features can express penalties (`< 1`) or boosts (`> 1`) in
any mode. With the default modifier the award is unchanged.

#### Scenario: Default modifier leaves the award unchanged

- **WHEN** an award is computed without a modifier
- **THEN** the result equals the base award for that mode

#### Scenario: A penalty modifier reduces the award

- **WHEN** an award is computed with a modifier below 1 (for example 0.5)
- **THEN** the award is reduced proportionally

