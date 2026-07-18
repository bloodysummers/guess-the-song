## 1. Migración de datos

- [x] 1.1 Migración: `buzzes.session_id` (para filtrar buzzes por sesión en Realtime) + `alter publication supabase_realtime add table rounds, buzzes`
- [x] 1.2 Aplicar con `supabase db reset` y verificar

## 2. YouTubeMusicProvider (implementación real de MusicProvider)

- [x] 2.1 Cargar la IFrame API de YouTube de forma perezosa, encapsulada en `lib/music/youtube-provider.ts`
- [x] 2.2 Reproductor oculto (solo audio) en un contenedor no visible
- [x] 2.3 `play(track, startMs, durationMs)`: cue por `providerRef`, seek a `startMs`, reproducir, y `setTimeout` para detener al cumplir `durationMs`
- [x] 2.4 `stop()`: pausa/detiene inmediatamente; limpiar timers
- [x] 2.5 Verificar que no hay referencias a la IFrame API fuera de `lib/music/`

## 3. Endpoints de mutación (Route Handlers)

- [x] 3.1 `POST /api/rounds` (start/next): verifica host; resuelve ronda activa como `skipped`; pista aleatoria sin repetir (`playlist_exhausted` si no quedan); crea ronda; devuelve al host `{ roundId, roundNumber, audioWindowMs, track, answer }`
- [x] 3.2 `POST /api/rounds/:id/buzz`: verifica identidad y que es jugador (no host); ronda no resuelta; buzz con `server_ts = now()`; rechaza segundo buzz; primer buzz → `answering` + `current_answerer_id`
- [x] 3.3 Helper server-side `verifyIdentity` (host/jugador por `reconnect_token`)

## 4. Implementación de SupabaseTransport

- [x] 4.1 `startRound` / `nextRound`: llaman a `POST /api/rounds`; despachan `round_host_payload` al host
- [x] 4.2 Suscripción `rounds` INSERT → `round_started` (jugadores, sin datos sensibles)
- [x] 4.3 Suscripción `buzzes` INSERT → cola ordenada por `server_ts`; `buzz_registered` y `buzz_queue_updated`
- [x] 4.4 `buzz(input)` llama al endpoint; `emitCurrentRound()` para reconexión a mitad de ronda

## 5. UI del host (`/host`)

- [x] 5.1 Al iniciar ronda: reproducir la ventana de audio vía `MusicProvider` (gesto del host)
- [x] 5.2 Botones "Iniciar ronda" / "Siguiente ronda"; estado de ronda (nº, sonando/answering)
- [x] 5.3 Mostrar la cola de buzzers ordenada con quién responde; detener la música al primer buzz
- [x] 5.4 Mostrar la respuesta esperada de forma discreta (para la fase de juicio; no destacada)

## 6. UI del jugador (`/play`)

- [x] 6.1 Durante la ronda: botón **BUZZ** grande y habilitado
- [x] 6.2 Al buzzear: deshabilitar y mostrar posición en la cola; manejar "ya buzzeaste"
- [x] 6.3 Estado de ronda: esperando, sonando, y quién está respondiendo

## 7. Verificación

- [x] 7.1 `supabase db reset` aplica migraciones sin error
- [x] 7.2 `typecheck`, `lint`, `build` en verde
- [x] 7.3 Prueba de servidor: start_round sin repetir + `playlist_exhausted`; buzz sella `server_ts` y ordena; 2º buzz rechazado; host no puede buzzear
- [x] 7.4 Prueba multi-pestaña (audio + buzz visual): audio suena y se corta al primer buzz; auto-stop al fin de ventana; cola ordenada correcta — confirmado por el usuario
