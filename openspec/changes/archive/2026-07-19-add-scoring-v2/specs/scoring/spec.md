## RENAMED Requirements

- FROM: `### Requirement: Simple mode awards one point per correct answer`
- TO: `### Requirement: Simple mode awards the base points per correct answer`

## MODIFIED Requirements

### Requirement: Simple mode awards the base points per correct answer

In `simple` mode, a correct answer SHALL award the base points (10 by default), regardless
of difficulty, speed, or queue position.

#### Scenario: Base points per correct answer

- **WHEN** a player is judged correct in `simple` mode
- **THEN** the base points (10) are recorded and added to that player's total

## ADDED Requirements

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
