## Context

`add-round-buzzer` deja la ronda en `answering` con una cola ordenada y un
`current_answerer`, pero sin forma de decidir el acierto ni repartir puntos. Esta fase añade
el juicio del host, el pase al siguiente, la puntuación y la revelación. Reutiliza el patrón
establecido: mutaciones server-side (service role) y eventos/lecturas por Realtime anon.

Referencias: [proposal](./proposal.md), [data-model](../../../docs/data-model.md) §3/§4/§6.

## Goals / Non-Goals

**Goals:**

- Juicio del host (correcto/incorrecto) sobre el `current_answerer`, con autoridad exclusiva
  del host y solo en fase `answering`.
- Pase al siguiente buzzer no juzgado; cierre por `exhausted` si no queda nadie.
- Motor de puntuación puro y testeable; asignación autoritativa server-side; marcador.
- Revelación de la respuesta a jugadores al cerrar la ronda, sin filtrarla antes.
- `judge` real + eventos `answer_judged`, `round_ended`, `score_updated`.

**Non-Goals:**

- Podio y fin de partida (Fase 5).
- Bonus por artista/álbum/año con UI pulida (se deja el camino de datos vía `bonus_flags`,
  pero `config.extraPoints` está en `false` por defecto).

## Decisions

**1. Juicio en un endpoint server-side.** `POST /api/rounds/:id/judge` con
`{ sessionId, hostPlayerId, reconnectToken, targetPlayerId, verdict, bonusFlags? }`. Valida
que el llamante es el host, que la ronda está en `answering` y que `targetPlayerId` es el
`current_answerer`. Solo el servidor decide y muta.

**2. Pase al siguiente por `judgements`.** El siguiente respondiente es el buzz más temprano
(`server_ts`) cuyo jugador **no** tiene aún un `judgement` en esa ronda. En Incorrecto se
inserta el judgement (0 puntos) y se recalcula el `current_answerer`; si no hay candidato →
ronda `resolved`/`exhausted`. Así "un jugador responde una vez por ronda" es estructural.

**3. Revelación por columnas nulas en `rounds`.** Se añaden `revealed_title`,
`revealed_artist`, `revealed_year` (nulas hasta el cierre). Al resolver, el servidor las
llena desde `tracks`. Los jugadores las reciben por `postgres_changes` de `rounds` (UPDATE),
que ya pueden leer — y como están nulas hasta el cierre, la respuesta **no se filtra antes**.
`tracks` sigue bloqueada a anon. Alternativa: broadcast Realtime — descartada por ser menos
persistente y más frágil que una columna.

**4. Modo de puntuación configurable (`config.scoringMode`).** El host elige el modo al
crear la sesión; se guarda en `sessions.config` (jsonb, sin migración). Motor puro en
`lib/game/scoring.ts`: `computeAward({ mode, audioWindowMs, timeToBuzzMs, extras })`.
- **`simple`** (default, estilo juego de mesa): `awarded = 1` por acierto. Ignora
  dificultad, velocidad y posición.
- **`speed`** (estilo arcade): `awarded = round(BASE × difficultyMultiplier(audioWindowMs)
  × speedFactor) + extras`, con:
  - `BASE = 100`.
  - `difficultyMultiplier`: 15s→1.0, 10s→1.25, 5s→1.5, 3s→2.0, 1s→3.0.
  - `speedFactor = clamp(1 − timeToBuzzMs / audioWindowMs, 0.1, 1)`, donde
    `timeToBuzzMs = buzz.server_ts − round.started_at`.
  - `extras`: +N por bonus concedido (0 por defecto).
- Ambos modos: sin penalización; sin reducción por posición (gana puntos completos quien
  acierte). Función pura → testeable.
Alternativa: un único modo — descartada; el host quiere elegir entre "estilo juego de mesa"
y "estilo arcade".

**5. `current_answerer` como fuente de verdad del turno.** El transporte toma el turno
vigente de `rounds.current_answerer_id` (vía UPDATE), no de `queue[0]`, porque tras un pase
el respondiente ya no es el primero de la cola.

**6. Realtime.** Se añade `judgements` a la publicación. El transporte se suscribe a:
`rounds` UPDATE (turno / `resolved` / revelación → `round_ended`) y `judgements` INSERT
(`answer_judged`; y re-lee `players.score` para `score_updated`).

## Risks / Trade-offs

- **[Punto cero del `speedFactor`]** → se mide `server_ts − started_at`; hay latencia entre
  crear la ronda y que el audio suene en el host, uniforme entre jugadores. Es un proxy
  aceptable para el MVP; se documenta y se puede refinar luego.
- **[`score_updated` por re-lectura]** → tras `judgements` INSERT se re-leen los puntajes;
  el endpoint ya commiteó `players.score`, así que la re-lectura es consistente.
- **[Carreras en el pase de turno]** → el recálculo del `current_answerer` es server-side y
  condicionado a la fase, evitando estados inconsistentes.
- **[Host que juzga fuera de turno]** → validación estricta (fase `answering` +
  `current_answerer`).

## Migration Plan

1. Migración: `rounds` + `revealed_title/artist/year`; `judgements` a la publicación Realtime.
2. `lib/game/scoring.ts` (función pura) + prueba unitaria.
3. `POST /api/rounds/:id/judge` (correcto/incorrecto, pase, puntos, revelación).
4. `SupabaseTransport`: `judge` + suscripciones `rounds` UPDATE y `judgements` INSERT;
   `current_answerer` desde el round; `round_ended`/`answer_judged`/`score_updated`.
5. UI host (Correcto/Incorrecto + marcador) y jugador (respuesta revelada + puntaje).
6. Verificar: prueba de servidor (correcto/incorrecto/pase/exhausted/puntos) + multi-pestaña.

## Open Questions

- **Valor de los extras** (artista/álbum/año) si se habilitan: propuesto +25 c/u. No
  bloquea (deshabilitados por defecto).
- **¿Empate final?** Se resuelve en la Fase 5 (podio); aquí solo se acumulan puntos.
