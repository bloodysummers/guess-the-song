## Why

Tres detalles de pulido detectados jugando: (1) el botón "Siguiente ronda" no comunica que
la última ronda termina la partida; (2) en dificultades muy cortas (1s) la ventana de audio
no es consistente porque el temporizador de corte arranca antes de que el audio realmente
suene (buffering); (3) el fragmento siempre empieza en un segundo fijo, dando ventaja a quien
ya jugó las mismas canciones.

## What Changes

- **Botón de ronda final:** cuando la ronda actual es la última (`roundNumber === roundsTotal`),
  el control del host dice **"Finalizar partida"** en vez de "Siguiente ronda".
- **Ventana de audio precisa:** el temporizador que corta el audio arranca cuando el player
  emite el estado **`PLAYING`** (audio realmente sonando), no cuando se pide reproducir. Así
  la ventana dura lo configurado incluso en 1s, sin que el buffering la acorte.
- **Inicio aleatorio del fragmento:** cada vez que sale una canción, el segundo de inicio se
  elige **al azar dentro de la duración** (con la ventana completa dentro de la pista). En un
  **replay** de la misma ronda se usa **exactamente el mismo fragmento**.

## Capabilities

### Modified Capabilities
- `music-playback`: la ventana se mide desde el inicio real de reproducción, y el offset de
  inicio se randomiza por reproducción (estable dentro de una ronda / en replay).
- `endgame`: el control de avance del host indica el fin de partida en la última ronda.

## Impact

- **`MusicProvider.play`:** firma pasa a `play(track, startMs: number | null, durationMs)` y
  **devuelve el `startMs` usado** (para que el host lo reutilice en el replay). `null` =
  randomizar.
- **`YouTubeMusicProvider`:** temporizador atado al evento `onStateChange` (PLAYING); random
  start vía `cueVideoById` → `getDuration` → `seekTo` → `playVideo`.
- **Host (`/host`):** al iniciar ronda randomiza y guarda el `startMs` devuelto; el replay
  usa ese mismo; el botón muestra "Finalizar partida" en la última ronda.
- **Sin migración de esquema.** `tracks.default_start_ms` queda como fallback si no se puede
  leer la duración.
- **Depende de:** `add-round-buzzer` (playback) y `add-endgame` (progreso).
