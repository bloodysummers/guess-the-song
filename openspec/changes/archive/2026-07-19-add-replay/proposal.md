## Why

Si la ventana de audio termina y nadie buzzeó, hoy la ronda queda muerta (el host solo puede
avanzar). Un botón de **Replay** da una segunda oportunidad — con una **penalización** de
puntos al acertar, para que no sea gratis. Aprovecha el modificador del motor (`add-scoring-v2`).

## What Changes

- **Botón Replay (host):** cuando la ronda está sonando/lista y **nadie ha buzzeado**, el
  host puede repetir la ventana de audio. Se puede repetir más de una vez.
- **Penalización al acertar:** si la ronda fue repetida, el acierto aplica un `modifier`
  penalizador (default **0.5** = medio). Uniforme para ambos modos (`simple`: 10→5; `speed`:
  factor reducido a la mitad).
- **Indicador de "repetida":** host y jugadores ven que la canción fue repetida (con
  penalización).
- **Transporte:** nuevo `replayRound` y evento `round_replayed`.

## Capabilities

### New Capabilities
- `replay`: repetición de la ventana de audio por el host antes del primer buzz, con
  penalización de puntos al acierto y visibilidad para todos.

### Modified Capabilities
<!-- Ninguna a nivel de requisitos; usa el modificador de scoring ya existente. -->

## Impact

- **Datos:** `rounds.replay_count` (int, default 0). Sin otros cambios de esquema.
- **Backend:** `POST /api/rounds/:id/replay` (host, fase `playing`, sin buzzes) incrementa el
  contador; el juicio correcto pasa `modifier` según `replay_count`.
- **`SupabaseTransport`:** `replayRound`; en `rounds` UPDATE detecta el incremento y despacha
  `round_replayed`.
- **Frontend:** host reproduce de nuevo el audio (guarda la pista del `round_host_payload`) y
  muestra "Repetida ×N"; jugador ve el aviso de penalización.
- **Depende de:** `add-scoring-v2` (modificador) y `add-round-buzzer`/`add-judging-scoring`.
