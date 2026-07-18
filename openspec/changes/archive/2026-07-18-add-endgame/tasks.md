## 1. Fin de partida en el endpoint de ronda

- [x] 1.1 `POST /api/rounds`: tras resolver la ronda activa, si `rondas jugadas >= roundsTotal` → `sessions.status = finished`, responder `{ gameOver: true }`
- [x] 1.2 Playlist agotada → también `finished` + `{ gameOver: true }` (en vez de error `playlist_exhausted`)
- [x] 1.3 Caso normal (quedan rondas y pistas) sigue creando la ronda como antes

## 2. Jugar de nuevo

- [x] 2.1 `POST /api/sessions/restart` (solo host): `players.score = 0`, borra `rounds`/`buzzes`/`judgements` de la sesión, `status = lobby`, `current_round_id = null`

## 3. Implementación de SupabaseTransport

- [x] 3.1 `session_updated` inicial en `subscribe()` (leer `status`, `config`, `rounds_total`)
- [x] 3.2 En `session_updated` con `status = finished` → leer jugadores (no host) por `score` desc → despachar `game_ended { podium }`
- [x] 3.3 `startRound` maneja la respuesta `{ gameOver }` (no despacha `round_host_payload`)
- [x] 3.4 `restart()` → `POST /api/sessions/restart` (endGame se deja como stub; el fin es automático)

## 4. UI del host (`/host`)

- [x] 4.1 Progreso "Ronda X de N" durante el juego
- [x] 4.2 Pantalla de **podio** al terminar (ranking por puntaje)
- [x] 4.3 Botón **"Jugar de nuevo"** → restart + refresco de vista

## 5. UI del jugador (`/play`)

- [x] 5.1 Progreso "Ronda X de N"
- [x] 5.2 Pantalla de **podio** al terminar (con "¡ganaste!" si aplica)
- [x] 5.3 Al reiniciar (status → lobby): refrescar vista y volver a la sala de espera

## 6. Verificación

- [x] 6.1 `supabase db reset` (sin cambios de esquema), `typecheck`, `lint`, `build`, `test` en verde
- [x] 6.2 Prueba de servidor: fin tras N rondas (`gameOver`); fin por playlist agotada (`gameOver`, no error); restart deja puntajes en 0 y `status = lobby`
- [x] 6.3 Prueba multi-pestaña (visual): jugar N rondas → podio; "Jugar de nuevo" reinicia; progreso "Ronda X de N" — confirmado por el usuario
