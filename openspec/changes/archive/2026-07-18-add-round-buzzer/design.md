## Context

Con el lobby funcionando, esta fase añade la mecánica central: reproducir una ventana de
audio y competir por el buzzer. Reutiliza el patrón de `add-lobby` (mutaciones server-side
con service role, lecturas/eventos por Realtime anon) y estrena dos cosas: la
implementación real de `MusicProvider` (YouTube) y la frontera host-only de datos sensibles.

Referencias: [proposal](./proposal.md), [data-model](../../../docs/data-model.md) §3/§4/§5.

## Goals / Non-Goals

**Goals:**

- `YouTubeMusicProvider` real: reproductor oculto (solo audio), `play(startMs, windowMs)`,
  `stop()`, fin automático de ventana.
- `startRound`/`nextRound` (host): selección aleatoria sin repetir; payload host-only con
  pista + respuesta; `round_started` sin datos sensibles para jugadores.
- `buzz`: `server_ts` sellado en servidor, cola ordenada, un buzz por jugador, host no buzzea.
- Pausa de la música al primer buzz; fase `answering` con `current_answerer`.
- UI: host reproduce y ve la cola; jugador ve el botón BUZZ y el estado.

**Non-Goals:**

- Juicio (correcto/incorrecto), puntuación y revelación de la respuesta → Fase 4.
- Persistencia de "qué sonó" para historial; despliegue remoto.

## Decisions

**1. Payload host-only vía la respuesta de `startRound` (no por broadcast).** El host es
quien llama a `POST /api/rounds`, así que la pista + respuesta se devuelven **en esa
respuesta** solo a él. Los jugadores se enteran de la ronda por `postgres_changes` sobre
`rounds` (INSERT), que expone `round_number`/`audio_window_ms` pero **no** la respuesta
(la tabla `tracks` sigue bloqueada a anon, así que `track_id` es inútil para el jugador).
Alternativa: canal Realtime "de host" — descartada porque cualquiera podría suscribirse.

**2. Reproducción YouTube oculta e iniciada por gesto del host.** IFrame API en un `div`
oculto (audio only). El host reproduce tras hacer clic en "iniciar ronda" (gesto de usuario
→ satisface las políticas de autoplay). Fin de ventana con `setTimeout(windowMs)` →
`pauseVideo`. `startMs` viene de `tracks.default_start_ms`.

**3. Buzz sellado en servidor.** `POST /api/rounds/:id/buzz` con identidad del jugador; el
servidor inserta el buzz con `server_ts = now()` (el cliente nunca envía la hora). El
`unique (round_id, player_id)` garantiza un buzz por jugador. La cola se ordena por
`server_ts` (valores autoritativos), así que todos los clientes derivan el mismo orden.
Alternativa: confiar en timestamps del cliente — descartada por injusta/manipulable.

**4. Primer buzz → servidor cambia fase y answerer.** Al registrar el primer buzz, el
endpoint pone `rounds.phase = 'answering'` y `current_answerer_id`. El host detecta el
primer buzz (evento de cola) y llama `MusicProvider.stop()`. La transición viaja por
`postgres_changes` de `rounds` (UPDATE).

**5. Selección aleatoria sin repetir, server-side.** Se eligen pistas de la playlist que no
estén en rondas previas de la sesión (`track_id NOT IN (...)`), al azar. Si no quedan →
error `playlist_exhausted`.

**6. `startRound` y `nextRound` comparten endpoint.** `POST /api/rounds` resuelve cualquier
ronda activa como `skipped` (hasta que exista el juicio) y arranca una nueva. Así avanzar es
idempotente respecto al estado de ronda.

## Risks / Trade-offs

- **[Video no disponible / embedding deshabilitado / region-lock]** → el host puede avanzar;
  validar los IDs del seed al probar y sustituir los que fallen.
- **[Políticas de autoplay bloquean el audio]** → el player se crea/reproduce tras el gesto
  del host; si aún así falla, mostrar un botón de "reproducir" explícito.
- **[Latencia de red en el buzz]** → el orden lo fija `server_ts`, no el render del cliente;
  la latencia afecta a todos por igual (inherente a un buzzer online). Se documenta, no se
  elimina.
- **[La pantalla del host podría revelar la respuesta si se castea a la TV]** → en esta fase
  el host recibe la respuesta pero la UI la muestra **discretamente** (la UI de juicio de la
  Fase 4 definirá su presentación); no se destaca en pantalla.
- **[Pocas pistas vs rondas]** → manejo explícito de `playlist_exhausted`.

## Migration Plan

1. Migración: añadir `rounds` y `buzzes` a la publicación `supabase_realtime`.
2. `YouTubeMusicProvider` en `lib/music/` (IFrame API encapsulada).
3. Endpoints `POST /api/rounds` (start/next) y `POST /api/rounds/:id/buzz`.
4. Implementar `startRound`/`nextRound`/`buzz` + eventos en `SupabaseTransport`.
5. UI host (reproducción + cola de buzzers) y jugador (botón BUZZ + estado).
6. Verificar con `db reset` + prueba multi-pestaña (audio suena, buzz ordena, pausa).

## Open Questions

- **Margen tras la ventana:** ¿damos ~1 s de gracia tras el audio para buzzear, o el buzz
  solo cuenta mientras suena? (Propuesta: permitir buzz hasta un pequeño margen tras el fin.)
- **Reproducción del host en la misma máquina de pruebas:** el audio sale por el equipo del
  host; para la prueba multi-pestaña basta con oír una vez desde la pestaña host.
