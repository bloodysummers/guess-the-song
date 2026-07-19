## 1. Migración de esquema

- [x] 1.1 Nueva tabla `games` (session_id, game_type default 'guess-the-song', playlist_id, config jsonb, rounds_total, status active|finished, current_round_id, created_at, ended_at)
- [x] 1.2 Nueva tabla `game_scores` (game_id, player_id, score int default 0, unique(game_id, player_id))
- [x] 1.3 `rounds`/`buzzes`/`judgements`: añadir `game_id` (fk games); mantener `session_id` para filtro Realtime
- [x] 1.4 `sessions`: añadir `status` (open|closed); quitar `playlist_id`/`config`/`rounds_total`/`current_round_id`
- [x] 1.5 `players`: quitar `score`
- [x] 1.6 RLS/grants para `games` y `game_scores`; Realtime en `games`, `game_scores`
- [x] 1.7 Aplicar con `supabase db reset` y verificar

## 2. Endpoints de sesión

- [x] 2.1 `POST /api/sessions` (crear): solo `hostName` → sesión `open` + host (sin config de juego)
- [x] 2.2 `POST /api/sessions/close` (host): marcar sesión `closed`
- [x] 2.3 `join`/`leave`/`reconnect`: siguen operando a nivel sesión (sin cambios de contrato)

## 3. Endpoints de juego

- [x] 3.1 `POST /api/games` (host): `{ playlistId, config, roundsTotal }` → crea `game` active, `game_scores` en 0 para jugadores no-host, `game_type`
- [x] 3.2 `POST /api/games/:id/end` (host): marcar juego `finished`
- [x] 3.3 `POST /api/games/:gameId/rounds` (start/next): selección sin repetir dentro del juego; fin por `roundsTotal`/playlist agotada → juego `finished`
- [x] 3.4 `buzz`/`judge`/`replay`: acotados a `game_id`; juicio actualiza `game_scores` (no `players.score`)

## 4. Transporte

- [x] 4.1 `createSession` sin config; nuevos `createGame(config)`, `endGame()`, `closeSession()`
- [x] 4.2 Seguimiento de `currentGameId`; eventos de ronda/buzz/juicio acotados al juego activo
- [x] 4.3 Nuevo evento `game_started`; `game_ended` sigue; hub vs juego derivado de si hay juego activo
- [x] 4.4 `score_updated` lleva `gameScores` (juego) + `sessionTotals` (SUM por jugador en la sesión)
- [x] 4.5 Hidratación en (re)conexión: sesión (roster/status) + juego activo (ronda/scores) si existe

## 5. UI del host

- [x] 5.1 Hub de sesión: código/QR + roster + presencia + acumulado de sesión; botón "Nuevo juego" y "Terminar sesión"
- [x] 5.2 Configurar juego (playlist/modo/dificultad/rondas) → `createGame`
- [x] 5.3 Vista de juego (rondas/buzz/juicio/marcador del juego) — reusar lo existente acotado al juego
- [x] 5.4 Podio del juego → "Nuevo juego" (mismos jugadores) / "Terminar sesión"

## 6. UI del jugador

- [x] 6.1 Hub: "esperando a que el host inicie un juego" + acumulado de sesión; permanecer sin re-unirse
- [x] 6.2 Vista de juego (BUZZ/estado/marcador) al iniciar un juego
- [x] 6.3 Al terminar el juego: podio; al terminar sesión: salir

## 7. Verificación

- [x] 7.1 `supabase db reset` + `typecheck` + `lint` + `test` en verde (build lo corre el usuario / deploy)
- [x] 7.2 Prueba de servidor: crear sesión → juego → rondas → fin → **nuevo juego con los mismos jugadores** (sin re-unir) → `game_scores` en 0 y acumulado suma ambos; `close session` cierra
- [x] 7.3 Prueba multi-pestaña: jugadores permanecen en la sesión entre juegos; podio por juego; acumulado de la sesión; "Terminar sesión" saca a todos
