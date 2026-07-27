## ADDED Requirements

### Requirement: A track that cannot be played is replaced, not endured

When the host's player reports that it cannot play the round's track, the system SHALL swap the
round to another playable track from the game's set. The round SHALL NOT be consumed and the
round number SHALL NOT change.

#### Scenario: Unplayable track swapped mid-round

- **WHEN** the provider reports a playback failure and nobody has buzzed
- **THEN** the round is given another track from the game's set and the round number is unchanged

#### Scenario: The bad track never returns

- **WHEN** a track has been replaced for being unplayable
- **THEN** it is not drawn again for any later round of that game

#### Scenario: Nothing left to swap to

- **WHEN** no playable track remains in the game's set
- **THEN** the swap is rejected with a clear error and the host is told

#### Scenario: Repeated failures stop swapping

- **WHEN** several tracks in a row fail to play
- **THEN** swapping stops and the host is told to check the playlist

### Requirement: The host can re-roll the fragment without penalty

The host SHALL be able to play a different random fragment of the SAME track at no scoring cost.
This is a correction tool, not a game action: it SHALL NOT count as a replay.

#### Scenario: Re-rolling costs nothing

- **WHEN** the host re-rolls the fragment
- **THEN** a different fragment of the same track plays and no replay penalty is recorded

#### Scenario: Later replays apply to the new fragment

- **WHEN** the host re-rolls the fragment and afterwards uses the penalized replay
- **THEN** the replay repeats the NEW fragment, not the discarded one

#### Scenario: Not available once the round is in play

- **WHEN** a player has already buzzed
- **THEN** re-rolling is rejected: the fragment being judged can no longer change

### Requirement: Speed scoring measures the audio players actually heard

When the round's audio is restarted by a swap or a re-roll, the round's clock SHALL restart so
speed scoring is measured from the fragment the players got to hear.

#### Scenario: Clock restarts with the new audio

- **WHEN** the track is swapped or the fragment re-rolled
- **THEN** a buzz is timed from that moment, not from the original round start

### Requirement: Only the host recovers a round

Both recovery actions SHALL be rejected for anyone who is not the session host.

#### Scenario: A player attempts recovery

- **WHEN** a non-host requests a swap or a re-roll
- **THEN** it is rejected
