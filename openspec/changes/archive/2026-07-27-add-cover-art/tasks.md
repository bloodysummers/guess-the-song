## 1. Migración

- [x] 1.1 `game_tracks.artwork_url` (text, nullable)
- [x] 1.2 `rounds.revealed_artwork_url` (text, nullable)
- [x] 1.3 `supabase db reset` local y verificar

## 2. Resolución por provider

- [x] 2.1 `lib/music/artwork.ts`: módulo puro (`youtubeArtworkUrl`, `artworkUrlFor`), usable
      desde servidor y cliente
- [x] 2.2 `MusicProvider.artworkUrl(track)` en la interfaz + implementación en
      `YouTubeMusicProvider` (delega en el módulo puro)
- [x] 2.3 La materialización llena `artwork_url` para las dos fuentes (curada y YouTube)

## 3. Reveal

- [x] 3.1 `judge`: copiar `artwork_url` → `rounds.revealed_artwork_url` con los demás `revealed_*`
- [x] 3.2 `RevealedAnswer.artworkUrl`; el transporte lo lee de la fila de la ronda

## 4. UI

- [x] 4.1 Panel del host: portada desde el inicio de la ronda; se limpia al avanzar
- [x] 4.2 Pantalla del jugador: portada junto al "Era: …" al resolverse
- [x] 4.3 Estilo `.cover` (recorte cuadrado) + `onError` que la oculta

## 5. Verificación

- [x] 5.1 `typecheck`, `lint`, `test`, `build` en verde
- [x] 5.2 Prueba de servidor: toda pista (curada e importada) tiene portada y la URL responde 200;
      `revealed_artwork_url` NULA mientras la ronda corre y `anon` no la ve; poblada y legible por
      `anon` tras el juicio
- [x] 5.3 Prueba visual: portada en el panel del host durante la ronda y en la pantalla del
      jugador al revelar — verificado por el host
