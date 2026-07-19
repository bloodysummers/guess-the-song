## Why

Hoy la "sesión" mezcla dos cosas: el hub de jugadores (código, host, roster) y la partida
configurada (playlist, modo, rondas, marcador). Por eso "Jugar de nuevo" es frágil y los
jugadores tienen que re-entrar para una partida nueva. Separando **Sesión** (hub persistente)
de **Juego** (una partida) los jugadores se mantienen en la misma sesión mientras el host
inicia/reconfigura/termina juegos, y se abre la puerta a otros tipos de juego en el futuro.

## What Changes

- **Sesión = hub persistente:** `code`, host, jugadores, presencia. Vive hasta "Terminar
  sesión". Ya no guarda config de juego.
- **Juego = partida dentro de una sesión:** playlist, `config`, `rounds_total`, estado,
  rondas, y **su propio marcador**. Se crean y terminan sin tocar la sesión.
- **Marcador por juego + acumulado de sesión:** cada juego tiene su marcador desde cero;
  además hay un acumulado ("ranking de la noche") sumando todos los juegos de la sesión.
- **`game_type`** (default `guess-the-song`) para soportar otros tipos de juego más adelante.
- **Flujo del host:** crear sesión → hub → "Nuevo juego" (configurar) → jugar → podio →
  "Nuevo juego" (mismos jugadores) **o** "Terminar sesión".
- **Flujo del jugador:** unirse una vez por código/QR → permanece en la sesión a través de
  varios juegos, sin re-entrar.
- **Historial de juegos** por sesión (cada juego es una fila).

## Capabilities

### New Capabilities
- `game-lifecycle`: hub de sesión vs juego; crear/terminar juego; permanencia de jugadores
  entre juegos; marcador por juego + acumulado de sesión; `game_type`.

### Modified Capabilities
- `session-lobby`: la sesión deja de contener config de juego; crear sesión ya no crea una
  partida; el "lobby" pasa a ser el hub persistente entre juegos.
- `scoring`: el marcador es por juego (`game_scores`), no en `players.score`; se añade el
  acumulado de sesión.
- `endgame`: el fin de partida termina el **juego** (no la sesión); tras el podio se puede
  iniciar un juego nuevo con los mismos jugadores.

<!-- round-lifecycle / buzzer / judging conservan sus requisitos; solo cambia su
     ámbito de sesión a juego (game_id) — detalle de implementación en design.md. -->>

## Impact

- **Datos (migración grande):** nueva tabla `games` (session_id, game_type, playlist_id,
  config, rounds_total, status, current_round_id, created_at, ended_at); nueva `game_scores`
  (game_id, player_id, score); `rounds`/`buzzes`/`judgements` ganan `game_id` (se mantiene
  `session_id` para el filtro de Realtime); `sessions` pierde `playlist_id`/`config`/
  `rounds_total`/`current_round_id` y gana `status` (open/closed); `players` pierde `score`.
- **Endpoints:** `create session` sin config; nuevos `POST /api/games` (iniciar juego),
  `POST /api/games/:id/end`, `POST /api/sessions/close`; rondas/buzz/juicio/replay acotados a
  `game_id`.
- **`SupabaseTransport`:** `createSession` sin config; nuevos `createGame`/`endGame`/
  `closeSession`; eventos `game_started`/`game_ended`/`score_updated` (por juego + acumulado);
  seguimiento de `currentGameId`.
- **UI:** host (hub + configurar juego + partida + podio + nuevo juego / terminar sesión);
  jugador (hub "esperando juego" + partida + podio, permaneciendo en la sesión).
- **Despliegue:** migración destructiva para sesiones en curso (efímeras); desplegar sin
  partidas activas.
- **Nota:** absorbe y reescribe el flujo de "Jugar de nuevo" (cuyo bug de re-emisión de podio
  ya se corrigió aparte).
