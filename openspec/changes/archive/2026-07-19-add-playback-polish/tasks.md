## 1. Interfaz MusicProvider

- [x] 1.1 `MusicProvider.play` → `(track, startMs: number | null, durationMs) => Promise<number>` (null = randomizar; devuelve el start usado)

## 2. YouTubeMusicProvider

- [x] 2.1 `onStateChange`/PLAYING: arrancar el temporizador de corte cuando el audio realmente suena (no al pedir play)
- [x] 2.2 Random start (fiable): `loadVideoById` en **mute** → `getDuration` (poll) → start aleatorio dentro de `[FLOOR, dur − ventana − cola]` → `seekTo` → `unMute`. Evita el `cueVideoById` flaky que dejaba la 1ª reproducción muda
- [x] 2.3 `startMs` numérico → reproducir exacto (replay); devolver el start usado; fallback si no hay duración

## 3. UI del host

- [x] 3.1 Al iniciar ronda: `play(track, null, window)` y guardar el `startMs` devuelto para el replay
- [x] 3.2 Replay: `play(track, startGuardado, window)` (mismo fragmento)
- [x] 3.3 Botón "Finalizar partida" cuando `roundNumber >= roundsTotal`

## 4. Verificación

- [x] 4.1 `typecheck` y `test` en verde
- [x] 4.2 Prueba visual/auditiva (usuario): reproducción fiable (fix del `cueVideoById` flaky); fragmentos aleatorios; replay = mismo fragmento; botón "Finalizar partida" — confirmado por el usuario
