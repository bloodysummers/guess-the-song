## Why

Hoy un juego se ata a una playlist curada del catálogo (`games.playlist_id` → `tracks`).
Eso no escala a playlists propias del host ni a múltiples providers: importar listas externas a
las tablas globales las acumularía para siempre y visibles para todos. La solución escalable es
que **cada juego materialice su propio set de canciones (snapshot) desde una fuente pluggable**,
guardado de forma **efímera** y **provider-agnóstica**. Así se soporta lo curado, YouTube/YT
Music (ahora) y Spotify (después) con el mismo modelo, y queda listo para opción múltiple.

## What Changes

- **`game_tracks` (nueva):** el snapshot de canciones de un juego — `provider`, `provider_ref`,
  `answer_title`, `answer_artist`, `position`. Se llena al **crear el juego** y se borra en
  cascada con el juego/sesión (efímero, sin acumulación global, sin fuga entre sesiones).
- **El juego se crea desde una FUENTE:** curada (una playlist del catálogo) **o** una URL de
  playlist pública de **YouTube / YouTube Music** (misma Data API, se aceptan ambos dominios).
- **Materialización:** curada → copia del catálogo; YouTube → lectura con la **Data API v3**
  (key) + normalización de títulos. Entradas no disponibles se saltan.
- **Rondas y juicio desde `game_tracks`:** la selección sin-repetir y la revelación salen del
  snapshot del juego, no del catálogo global.
- **Anti-trampa intacto:** `game_tracks` no es legible por `anon` (las respuestas no llegan al
  jugador), igual que `tracks`.

## Capabilities

### New Capabilities
- `game-tracks`: set de canciones materializado por juego desde una fuente pluggable
  (curada / YouTube), provider-agnóstico y efímero; base de la selección de ronda y la
  revelación.

### Modified Capabilities
- `game-lifecycle`: "el host inicia un juego" ahora recibe una **fuente** (curada o URL de
  YouTube) y materializa el snapshot, en vez de referenciar una playlist global.

<!-- round-lifecycle conserva su requisito (pista aleatoria sin repetir); solo cambia el
     origen a game_tracks — detalle de implementación en design.md. -->

## Impact

- **Config externa:** `YOUTUBE_API_KEY` (server-only), en `.env.local` y Vercel.
- **Datos:** nueva `game_tracks`; `rounds.track_id` → `rounds.game_track_id`; `games` pierde
  `playlist_id` y gana `source_label` (para mostrar el origen). `tracks`/`playlists` quedan como
  **catálogo curado** (fuente), ya no se usan directo en juego.
- **Backend:** `POST /api/games` recibe una fuente y materializa `game_tracks`; round-start y
  judge leen de `game_tracks`; helper server-side para la Data API (parseo de URL + fetch
  paginado + normalización).
- **Transporte/UI:** `createGame` pasa la fuente; la config de juego ofrece playlists curadas +
  campo para pegar una URL de YouTube/YT Music.
- **Depende de:** `add-session-game-split`. Desbloquea: Spotify (mismo modelo) y opción múltiple
  (distractores desde `game_tracks`).
