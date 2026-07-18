## 1. Migración de datos

- [x] 1.1 Migración: `rounds` + columnas `revealed_title`, `revealed_artist`, `revealed_year` (nulas)
- [x] 1.2 Migración: `judgements.session_id` (filtro Realtime) + `alter publication supabase_realtime add table judgements`
- [x] 1.3 Aplicar con `supabase db reset` y verificar

## 2. Modo de puntuación y motor

- [x] 2.1 `scoringMode: "simple" | "speed"` en `SessionConfig` (`lib/game/types.ts`); default `simple`
- [x] 2.2 Selector de modo en el formulario de creación del host (`/host`)
- [x] 2.3 `lib/game/scoring.ts`: función pura `computeAward({ mode, audioWindowMs, timeToBuzzMs, extras })`
- [x] 2.4 Prueba unitaria (vitest): `simple`→1; `speed` velocidad/ventana; floor; extras — 5/5 pasan

## 3. Endpoint de juicio (Route Handler)

- [x] 3.1 `POST /api/rounds/:id/judge`: verifica host; ronda en `answering`; target = `current_answerer`
- [x] 3.2 Correcto: `computeAward` según `config.scoringMode`, inserta `judgement`, suma a `players.score`, resuelve `correct` + winner + revela desde `tracks`
- [x] 3.3 Incorrecto: inserta `judgement` (0); pasa al siguiente buzzer no juzgado; si no hay → `exhausted` + revela
- [x] 3.4 Rechazos: no-host, fuera de `answering`, target ≠ current_answerer

## 4. Implementación de SupabaseTransport

- [x] 4.1 `judge(input)` llama al endpoint (`targetPlayerId = input.playerId`)
- [x] 4.2 Suscripción `rounds` UPDATE: turno desde `current_answerer_id`; `resolved` → `round_ended` con `revealedAnswer`
- [x] 4.3 Suscripción `judgements` INSERT → `answer_judged`; re-lee `players.score` → `score_updated`
- [x] 4.4 `currentAnswererId` del round como fuente de verdad

## 5. UI del host (`/host`)

- [x] 5.1 Con respondiente actual: botones **Correcto** / **Incorrecto**
- [x] 5.2 Al resolver: resultado (acertó X / nadie acertó, era «…») y "Siguiente ronda"
- [x] 5.3 Marcador acumulado que se actualiza con `score_updated`

## 6. UI del jugador (`/play`)

- [x] 6.1 Al cerrar la ronda: respuesta revelada y quién acertó
- [x] 6.2 Puntaje propio
- [x] 6.3 Estado del turno: "responde X" / "tu turno de responder"

## 7. Verificación

- [x] 7.1 `supabase db reset`, `typecheck`, `lint`, `build` en verde
- [x] 7.2 Prueba de servidor: correcto→puntos+resuelve; incorrecto→pase; agotar→`exhausted`; no-host/fuera-de-turno rechazados; revelación solo al cierre
- [x] 7.3 Prueba unitaria del motor de puntuación pasa (5/5)
- [x] 7.4 Prueba multi-pestaña (visual): host juzga, pase funciona, puntos, revelación y marcador — confirmado por el usuario (incluye fix de reinicio de sesión)
