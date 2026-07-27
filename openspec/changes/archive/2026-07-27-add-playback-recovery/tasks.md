## 1. Migración

- [x] 1.1 `game_tracks.unplayable` (boolean not null default false)
- [x] 1.2 `supabase db reset` local y verificar

## 2. Provider

- [x] 2.1 `PlaybackError` + `MusicProvider.onPlaybackError(handler)` en la interfaz
- [x] 2.2 `YouTubeMusicProvider.handleError` deja de tragarse el error y lo reporta

## 3. Backend

- [x] 3.1 `POST /api/rounds/:id/replace-track`: marca la pista como `unplayable`, elige otra sana
      no usada, reinicia `started_at`, devuelve pista + respuesta + `audioWindowMs`
- [x] 3.2 `POST /api/rounds/:id/refragment`: reinicia `started_at` sin tocar `replay_count`
- [x] 3.3 Guardas en ambos: host-only, fase `playing`, sin buzzes
- [x] 3.4 La selección de ronda excluye pistas `unplayable`

## 4. Transporte + UI

- [x] 4.1 `replaceRoundTrack()` (re-emite `round_host_payload`) y `refragmentRound()`
- [x] 4.2 Host: al fallar la reproducción, cambia de pista solo; tope `MAX_TRACK_SWAPS = 3`
- [x] 4.3 Host: botón "🎲 Otro fragmento (sin penalización)" + hint; actualiza `lastTrackRef`
      para que el replay penalizado repita el fragmento nuevo
- [x] 4.4 Estilos `.hint` / `.panel button.secondary`

## 5. Verificación

- [x] 5.1 `typecheck`, `lint`, `test`, `build` en verde
- [x] 5.2 Prueba de servidor (16 checks): el cambio no consume ronda ni mueve `round_number`;
      la pista mala queda marcada y no vuelve a salir; sin pistas sanas da error claro;
      refragment no toca `replay_count` y sí reinicia `started_at`; el replay penalizado sigue
      penalizando; ambos rechazados tras un buzz y para no-host
- [x] 5.3 Prueba visual: forzar una canción que no suene (p. ej. bloqueada por región) y ver el
      cambio automático; usar "otro fragmento" y comprobar que el replay siguiente repite el
      fragmento nuevo — verificado por el host con una playlist con 13/50 bloqueados en MX

## Corregido tras la prueba

- El aviso de error del provider decía "embedding disabled by the owner" para el código 150, pero
  YouTube reutiliza 101/150 para cualquier restricción del dueño (embebido, región, edad). Ahora
  dice "restricted by the owner (embedding or region)".
- Regresión de UI: la regla `.panel button.secondary` alcanzaba también al botón *Incorrecto* del
  juicio y rompía su fila. Los botones de recuperación quedaron acotados en `.round-tools`.

## Pendiente aparte

Fuera del alcance de este change; anotado en `docs/roadmap.md` → "Pendientes chicos detectados":
`FALLBACK_START_MS` (20 s) se usa a ciegas cuando `getDuration()` no responde en 2 s; en
canciones cortas puede caer más allá del final. Sospechoso, no medido.
