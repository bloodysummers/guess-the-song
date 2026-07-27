## Why

En partidas reales hay canciones que simplemente no suenan, y hoy **fallan en silencio**: el
`onError` del provider solo hacía `console.warn`, así que la ronda se quedaba muda sin que nadie
se enterara. Peor: `play()` resolvía como exitosa, y el host veía "🎵 Sonando…" sin audio.

Al medir contra una playlist real de 50 entradas aparecieron **dos causas distintas**, que
necesitan **dos soluciones distintas**:

1. **La pista no se puede reproducir.** 1 de 46 videos estaba bloqueado por región en MX. También
   entran aquí el embebido deshabilitado y los videos que mueren entre el import y la partida
   (los borrados/privados sí los filtra el import). Esto **sí** dispara `onError`.
2. **La pista suena, pero el fragmento es inservible** — silencio, ambiente, un trozo sin pistas.
   Esto **no dispara nada**: ningún provider distingue silencio de música.

## What Changes

- **El provider reporta los fallos** en vez de tragárselos: `MusicProvider.onPlaybackError()`.
- **Cambio automático de pista:** ante un fallo duro, la ronda cambia a otra pista **sin consumir
  una ronda** y sin que los jugadores se enteren. La pista mala queda marcada (`unplayable`) para
  no volver a salir en ese juego. Tope de 3 cambios seguidos, para que una playlist rota no gire
  para siempre.
- **Botón "otro fragmento" (sin penalización):** herramienta del host, no mecánica de juego.
  Reproduce **otro fragmento aleatorio de la misma canción** y no cobra nada. Las repeticiones
  penalizadas posteriores aplican **al fragmento nuevo**, no al descartado.
- **Ambas acciones reinician `started_at`**, para que la puntuación por velocidad se mida contra
  el audio que los jugadores realmente llegaron a oír.

## Capabilities

### Modified Capabilities
- `round-playback`: una ronda ya no queda varada por una pista que no suena, y el host puede
  descartar un fragmento inservible sin castigar a nadie.

## Impact

- **Datos:** `game_tracks.unplayable` (boolean, default false).
- **Backend:** `POST /api/rounds/:id/replace-track` y `POST /api/rounds/:id/refragment`. Ambos
  host-only, ambos rechazados una vez que alguien pulsó el buzzer.
- **Transporte:** `replaceRoundTrack()` y `refragmentRound()`; el reemplazo re-emite
  `round_host_payload`, así que el host solo "recibe otra canción" y la toca.
- **UI:** botón "🎲 Otro fragmento (sin penalización)" junto al de repetir; aviso al host cuando
  una canción se cambia sola.
- **Depende de:** `add-game-track-sources`.

## Notas

- `already_buzzed` en estos endpoints es una guarda defensiva: el primer buzz ya mueve la fase a
  `answering`, así que en la práctica salta antes `round_not_replayable`. Se conserva por si la
  fila de buzz existe sin que el cambio de fase haya llegado.
- Queda **fuera**: `FALLBACK_START_MS` salta a 20 s a ciegas cuando `getDuration()` no responde
  en 2 s, y puede caer más allá del final en canciones cortas. Es sospechoso pero no medido; el
  botón de otro fragmento ya deja al host recuperarse. Vale la pena revisarlo aparte.
