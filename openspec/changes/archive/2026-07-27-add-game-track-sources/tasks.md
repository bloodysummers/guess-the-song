## 1. Configuración externa

- [x] 1.1 `YOUTUBE_API_KEY` (server-only) en `.env.local` + documentar en `.env.example`
- [x] 1.2 Agregar `YOUTUBE_API_KEY` a Vercel (producción) — hecho por el host

## 2. Migración

- [x] 2.1 Nueva `game_tracks` (game_id fk cascade, provider, provider_ref, answer_title, answer_artist, answer_aliases, year, default_start_ms, position)
- [x] 2.2 `rounds`: reemplazar `track_id` por `game_track_id` (fk game_tracks)
- [x] 2.3 `games`: quitar `playlist_id`, agregar `source_label`
- [x] 2.4 RLS: `game_tracks` bloqueada a anon (como `tracks`); grants a service_role
- [x] 2.5 `supabase db reset` local y verificar

## 3. Backend — fuentes y materialización

- [x] 3.1 Helper: parseo del `playlistId` desde URL de `youtube.com` y `music.youtube.com`
- [x] 3.2 Cliente Data API: `playlists.list` (título) + `playlistItems.list` paginado; cap ~100; saltar no disponibles
- [x] 3.3 Normalización de títulos → answer_title/artist
- [x] 3.4 `POST /api/games`: recibe `source` (curada|youtube); materializa `game_tracks` (curada = copia de `tracks`; youtube = Data API); guarda `source_label`; errores claros (URL inválida, playlist vacía)

## 4. Backend — juego desde game_tracks

- [x] 4.1 `POST /api/games/:id/rounds`: seleccionar `game_track` aleatorio sin repetir dentro del juego; fin por `roundsTotal`/agotado
- [x] 4.2 Round-start devuelve el payload del `game_track` (provider/ref/startMs/answer); ronda guarda `game_track_id`
- [x] 4.3 `judge`: revelar desde el `game_track` de la ronda

## 5. Transporte + UI

- [x] 5.1 `CreateGameInput` incluye `source` (curada|youtube); `createGame` lo pasa
- [x] 5.2 UI config del juego: elegir playlist curada **o** pegar URL de YouTube/YT Music; estados de carga/error
- [x] 5.3 `fetchPlaylists` sigue devolviendo el catálogo curado (para la opción curada)

## 6. Verificación

- [x] 6.1 `typecheck`, `lint`, `test`, `build` en verde
- [x] 6.2 Prueba de servidor: crear juego curado (materializa game_tracks copiadas) y desde URL real de YouTube (materializa normalizadas); jugar rondas sin repetir; anon NO lee `game_tracks`; URL inválida rechazada
- [x] 6.3 Prueba visual: crear juego desde una playlist propia de YouTube, jugar una ronda; y desde una curada
      — verificado por el host con playlists públicas de YouTube y de YouTube Music

## Notas de implementación

- **`game_tracks.album`** — se agregó una columna no listada en 2.1. Sin ella, el juicio perdía
  `answer.album` (`AnswerReference.album`) y el extra de punto por álbum quedaba muerto para las
  playlists curadas. Las importadas la dejan en `null`.
- **`vitest.config.ts`** — nuevo, solo para replicar el alias `@/*` de `tsconfig.json`. No existía
  config de vitest porque hasta ahora ningún módulo bajo prueba usaba el alias.
- **Normalización** — además de paréntesis/corchetes y la cola `| ruido`, se pela ruido final sin
  brackets (`… HD`, `… letra`), que apareció en la prueba con una playlist real. Sigue sin dividir
  guiones sin espacios (`EN ALGUN LUGAR-DUNCAN DHU`): partiría `a-ha`, `Jay-Z`.
