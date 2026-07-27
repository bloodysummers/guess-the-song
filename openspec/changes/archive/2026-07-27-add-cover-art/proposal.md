## Why

El panel del host es hoy puro texto. Mostrar la portada de la canción que suena lo hace mucho
más legible de un vistazo, y enseñarla a **todos** al revelar la respuesta hace el cierre de
ronda más vistoso — el mismo momento en que ya se muestra el título.

La portada **es** la respuesta, así que su visibilidad tiene que seguir exactamente las mismas
reglas anti-trampa que el título: para el host siempre (su pantalla ya no es proyectable, porque
muestra la respuesta), y para el jugador **solo** una vez resuelta la ronda.

## What Changes

- **`game_tracks.artwork_url` (nueva columna):** la portada se resuelve **una vez**, al
  materializar el juego, para que cada provider la aporte a su manera. YouTube la deriva del
  `videoId` (sin llamada a la API ni quota); Spotify más adelante la traerá de su API.
- **`rounds.revealed_artwork_url` (nueva columna):** se copia al resolverse la ronda, igual que
  `revealed_title`/`revealed_artist`. Es el único camino por el que la portada llega al jugador,
  porque `game_tracks` no es legible por `anon`.
- **`RevealedAnswer` gana `artworkUrl`:** una URL de imagen, no una referencia de provider — al
  jugador se le da algo que pintar, nunca algo con qué buscar la canción.
- **UI:** portada en el panel del host desde que arranca la ronda; portada en la pantalla del
  jugador junto al "Era: …" al revelar.

## Capabilities

### New Capabilities
- `cover-art`: portada de la pista, resuelta por provider al materializar el juego y expuesta
  según las mismas reglas de visibilidad que la respuesta.

## Impact

- **Datos:** `game_tracks.artwork_url`, `rounds.revealed_artwork_url` (ambas nullable; una pista
  sin portada simplemente no la muestra).
- **Backend:** la materialización resuelve la portada; `judge` la revela con los demás campos.
- **Transporte:** `RevealedAnswer.artworkUrl`.
- **UI:** panel del host y pantalla del jugador.
- **Sin config externa, sin quota:** para YouTube la URL se deriva del `videoId`.
- **Depende de:** `add-game-track-sources`. Prepara: Spotify (aporta su propia `artwork_url`).
