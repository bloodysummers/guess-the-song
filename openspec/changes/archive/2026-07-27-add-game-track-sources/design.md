## Context

Refactor de la fuente de canciones: en vez de que el juego referencie una playlist global, cada
juego materializa su propio `game_tracks` (snapshot) desde una fuente pluggable. Efímero,
provider-agnóstico, sin acumulación global. Prepara Spotify y opción múltiple. Decisión del
usuario: usar la YouTube Data API (key), y snapshot por juego (equivalente a "en memoria" para
un backend serverless).

## Goals / Non-Goals

**Goals:**

- `game_tracks` por juego, efímero (cascade con el juego/sesión).
- Fuentes: curada (catálogo) y YouTube/YT Music (Data API).
- Rondas y revelación desde `game_tracks`, provider-agnóstico.
- Anti-trampa: `game_tracks` no legible por anon.

**Non-Goals:**

- Spotify (misma arquitectura, otra épica).
- OAuth / playlists privadas.
- Recordar fuentes a nivel sesión para no re-pegar (mejora futura).
- Validar embedding por video (se maneja en runtime con `onError`).

## Decisions

**1. `game_tracks` (snapshot por juego).** `id, game_id (fk games cascade), provider,
provider_ref, answer_title, answer_artist, answer_aliases, year, default_start_ms, position`.
Índice por `game_id`. RLS: sin política para `anon` (bloqueada, como `tracks`); service role la
llena/lee.

**2. La fuente se resuelve al crear el juego.** `POST /api/games` recibe
`source: { type: "curated", playlistId } | { type: "youtube", url }`.
- **curada:** copia de `tracks` where `playlist_id` → `game_tracks`.
- **youtube:** parseo del `list=` (acepta `youtube.com` y `music.youtube.com`) → Data API
  (`playlists.list` para el título, `playlistItems.list` paginado) → normalización → insert.
`game_tracks` es la única fuente de juego a partir de ahí.

**3. `games` deja de referenciar el catálogo.** Se quita `games.playlist_id`; se agrega
`games.source_label` (texto para mostrar el origen, p. ej. el nombre de la playlist). Las tablas
`tracks`/`playlists` quedan como **catálogo curado** (una de las fuentes).

**4. Rondas referencian `game_tracks`.** `rounds.track_id` → `rounds.game_track_id`
(fk game_tracks). Selección sin-repetir por `game_track_id` dentro del juego; el
`round_host_payload` (provider/ref/startMs) y la revelación salen del `game_track`.

**5. Normalización heurística.** Quitar paréntesis/corchetes y ruido (official, video, lyrics,
audio, hd, 4k, mv…); dividir por " - " en artista/canción; fallback: canal como artista, título
limpio como canción. Se saltan entradas "Deleted/Private video" o sin `videoId`. Cap ~100.

**6. YouTube = YouTube Music.** Las playlists públicas de YT Music son playlists de YouTube; se
leen con la misma Data API y se tocan con el mismo IFrame player. No hay provider separado.

## Risks / Trade-offs

- **[Refactor amplio]** → toca creación de juego, selección de ronda y juicio; se implementa por
  fases con checkpoint por API antes de la prueba visual.
- **[Re-materializar por juego]** → cada juego re-lee/re-copia la fuente (barato: 1-2 llamadas a
  la API; copia curada trivial). Recordar fuentes por sesión queda como mejora.
- **[Títulos sucios]** → normalización heurística; afecta calidad de opción múltiple, no el
  buzzer.
- **[Cuota Data API]** → 10k/día; `playlistItems.list` barato; cap de tracks.

## Migration Plan

1. Migración: `game_tracks`; `rounds.game_track_id` (reemplaza `track_id`); `games` quita
   `playlist_id`, agrega `source_label`; RLS/grants (bloqueada a anon); Realtime no requerido en
   `game_tracks` (no se difunde).
2. `YOUTUBE_API_KEY` en env / `.env.example` / Vercel.
3. Helper Data API (parseo URL + fetch paginado) + normalización.
4. `POST /api/games`: materializar `game_tracks` desde la fuente.
5. Round-start y judge desde `game_tracks`.
6. Transporte `createGame(source, config)`; UI de config con selección de fuente.
7. Verificar: crear juego curado y crear juego desde URL real; jugar; anon no lee `game_tracks`.

## Open Questions

- **Nombre del juego/origen:** usar el título de la playlist (YouTube) o el nombre curado como
  `source_label`; editable por el host es mejora futura.
