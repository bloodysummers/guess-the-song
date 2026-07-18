## Why

Cierra el ciclo de la ronda: hoy alguien buzzea y responde en voz alta, pero nada decide si
acertó ni reparte puntos. El host —que es el juez— necesita marcar Correcto/Incorrecto,
pasar el turno al siguiente más rápido cuando alguien falla, otorgar puntos y revelar la
respuesta al final. Sin esto no hay ganador.

## What Changes

- **Juicio del host:** sobre el jugador que responde (`current_answerer`), el host marca
  **Correcto** o **Incorrecto**. Solo el host juzga y solo al que tiene el turno.
- **Pase al siguiente:** al marcar Incorrecto, el turno pasa al siguiente más rápido de la
  cola que aún no ha respondido; si no queda nadie, la ronda se cierra sin acierto.
- **Puntuación con modo configurable (elegido por el host al crear la sesión):**
  - **`simple`** — 1 punto por canción adivinada (estilo juego de mesa).
  - **`speed`** — `BASE × dificultad × velocidad` (estilo arcade).
  En ambos: sin penalización y sin reducción por posición en la cola; se actualiza el marcador.
- **Revelación de la respuesta:** al cerrar la ronda (acierto o cola agotada) se revela la
  canción a los jugadores vía `round_ended` — nunca antes.
- **Marcador:** los participantes ven los puntajes actualizarse.
- **Implementación de transporte:** `judge` deja de ser stub; nuevos eventos
  `answer_judged`, `round_ended`, `score_updated`.

## Capabilities

### New Capabilities
- `judging`: el host valida al respondiente actual (correcto/incorrecto), con pase al
  siguiente en la cola; autoridad exclusiva del host; solo sobre el turno vigente.
- `scoring`: cálculo y asignación de puntos (base × dificultad × velocidad, sin penalización
  ni reducción por posición) y marcador acumulado.
- `answer-reveal`: revelación de la respuesta a los jugadores al cerrar la ronda, sin
  filtrarla antes.

### Modified Capabilities
<!-- Ninguna a nivel de requisitos. Se implementa sobre las interfaces existentes. -->

## Impact

- **Backend/datos:** uso de `judgements`; columnas de revelación en `rounds`
  (`revealed_*`, nulas hasta el cierre); `judgements` en la publicación Realtime;
  denormalización de `players.score`.
- **`SupabaseTransport`:** implementación de `judge` + suscripciones a `rounds` UPDATE
  (turno/cierre/revelación) y `judgements` INSERT; emisión de `answer_judged`/
  `round_ended`/`score_updated`.
- **Frontend:** `/host` gana botones Correcto/Incorrecto y marcador; `/play` ve la
  respuesta revelada y su puntaje al cerrar la ronda.
- **Motor de puntuación:** función pura en `lib/game/scoring.ts` (testeable).
- **Depende de:** `add-round-buzzer` (rondas, buzzer, cola). Fuera de alcance: podio y fin
  de partida (Fase 5, `add-endgame`).
