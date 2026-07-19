## Context

Refactor estructural: hoy `sessions` mezcla hub (código/host/jugadores) y partida
(playlist/config/rondas/marcador). Se separa en **Sesión** (hub persistente) y **Juego**
(partida). Es el cambio más invasivo del proyecto; toca esquema, endpoints, transporte y UI.
Decisiones del usuario: marcador **por juego + acumulado de sesión**, y columna **`game_type`**.

## Goals / Non-Goals

**Goals:**

- Sesión persistente (hub); juegos que se crean/terminan sin re-unir jugadores.
- Marcador por juego + acumulado de sesión.
- `game_type` para futuros juegos.
- "Terminar juego" (vuelve al hub) vs "Terminar sesión" (cierra todo).

**Non-Goals:**

- Implementar un segundo tipo de juego (solo dejamos el andamiaje `game_type`).
- Preservar datos de sesiones en curso durante la migración (efímeras).
- Historial persistente entre sesiones distintas (el historial es dentro de la sesión).

## Decisions

**1. Modelo de datos.**
- `sessions`: `id`, `code` (unique), `host_player_id`, `status` (`open` | `closed`),
  `created_at`. *Se quitan* `playlist_id`, `config`, `rounds_total`, `current_round_id`.
- `players`: `id`, `session_id`, `display_name`, `is_host`, `reconnect_token`, `joined_at`.
  *Se quita* `score`.
- `games` (nueva): `id`, `session_id`, `game_type` (default `guess-the-song`), `playlist_id`,
  `config` jsonb, `rounds_total`, `status` (`active` | `finished`), `current_round_id`,
  `created_at`, `ended_at`.
- `game_scores` (nueva): `id`, `game_id`, `player_id`, `score` int default 0,
  unique(game_id, player_id).
- `rounds` / `buzzes` / `judgements`: ganan `game_id` (fk games). **Se mantiene `session_id`**
  (denormalizado) para seguir filtrando Realtime por una clave estable.

**2. Ámbito de juego = `game_id`, filtro Realtime = `session_id`.** Los eventos de
rondas/buzzes/juicios se filtran por `session_id` (estable) y el transporte los acota al
`currentGameId` en cliente (igual que hoy acota buzzes al `currentRoundId`). Evita re-suscribir
por juego.

**3. Marcador por juego + acumulado.** Al puntuar, se actualiza `game_scores` del juego
activo. El evento `score_updated` lleva **dos listas**: `gameScores` (juego actual) y
`sessionTotals` (SUM de `game_scores` por jugador sobre todos los juegos de la sesión,
calculado on-the-fly). El podio muestra el juego; el hub muestra el acumulado.

**4. Ciclo de vida.**
- `POST /api/sessions` (crear sesión): solo `hostName` → sesión `open` + host. Sin juego.
- `POST /api/games` (iniciar juego): host + `{ playlistId, config, roundsTotal }` → crea
  `game` `active`, inicializa `game_scores` en 0 para los jugadores no-host actuales, apunta
  la sesión al juego (o el juego a la sesión). Emite `game_started`.
- Rondas/buzz/juicio/replay: acotados al juego activo (`game_id`).
- Fin del juego (N rondas / playlist agotada / host termina): `games.status = finished` →
  podio. **No** cierra la sesión.
- `POST /api/games/:id/end` (terminar juego): marca `finished` (si el host corta antes).
- Nuevo juego: `POST /api/games` otra vez (nuevos scores 0, nueva config). Jugadores intactos.
- `POST /api/sessions/close` (terminar sesión): `sessions.status = closed`; clientes salen.

**5. Eventos nuevos del transporte.** `game_started { gameId, ... }` y `game_ended` (ya
existe). El hub vs juego se deriva de si hay un juego `active`. `session_updated` refleja
`status` (open/closed). El transporte trae `currentGameId` y filtra por él.

**6. Migración destructiva.** Como no hay datos importantes persistentes, la migración
reestructura sin preservar sesiones en curso. En prod, desplegar sin partidas activas
(`supabase db push`).

## Risks / Trade-offs

- **[Alcance grande]** → se organiza en fases de tareas (esquema → endpoints → transporte →
  UI) y se verifica por API antes de la prueba visual.
- **[Realtime por session_id con múltiples juegos]** → el juego activo es uno a la vez; el
  cliente filtra por `currentGameId`; juegos viejos no emiten (están `finished`).
- **[Acumulado on-the-fly]** → SUM sobre `game_scores` de la sesión; conjunto pequeño, costo
  despreciable; siempre correcto (sin denormalizar).
- **[Migración destructiva en prod]** → coordinar despliegue sin jugadores activos.

## Migration Plan

1. Migración: `games`, `game_scores`; `game_id` en rounds/buzzes/judgements; `sessions.status`
   + quitar columnas de juego; quitar `players.score`; Realtime en `games`/`game_scores`.
2. Endpoints: crear sesión (sin config), `POST /api/games`, `end game`, `close session`;
   rondas/buzz/juicio/replay usando `game_id`; scoring en `game_scores`.
3. Transporte: `createGame`/`endGame`/`closeSession`; `currentGameId`; eventos por juego;
   `score_updated` con `gameScores` + `sessionTotals`.
4. UI: hub de sesión; configurar juego; vista de juego; podio con "Nuevo juego" / "Terminar
   sesión"; jugador permanece en el hub.
5. Verificar por API (crear sesión → juego → rondas → fin → nuevo juego con mismos jugadores
   → acumulado) y luego prueba visual multi-pestaña.

## Open Questions

- **¿`sessions.status = closed` borra la sesión o solo la marca?** Propuesta: marcar `closed`
  (permite limpieza posterior); los clientes salen igual. Cron de limpieza queda para después.
