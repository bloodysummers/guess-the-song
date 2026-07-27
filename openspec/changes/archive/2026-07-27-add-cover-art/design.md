## Context

La portada es la respuesta en forma de imagen, así que el diseño lo dicta el anti-trampa, no la
UI. El repo ya resolvió este problema para el título: `game_tracks` está bloqueada para `anon`, y
al resolverse la ronda el servidor **denormaliza** la respuesta en `rounds.revealed_*`, que sí es
legible. La portada se cuelga de ese mismo mecanismo en vez de inventar uno nuevo.

## Decisions

**1. Resolver la portada al materializar, no al reproducir.** `game_tracks.artwork_url` se llena
cuando se crea el juego. Así cada provider la aporta a su manera (YouTube la deriva del
`videoId`; Spotify la traerá de su API) y el resto del sistema solo ve una URL. Alternativa
descartada: derivarla en el cliente desde `provider`+`providerRef` — funciona para YouTube, pero
obliga a cada consumidor a conocer los providers, y no sirve para Spotify.

**2. Denormalizar en `rounds.revealed_artwork_url`.** Es el único camino por el que la portada
puede llegar al jugador, porque `game_tracks` no es legible por `anon`. Al reutilizar el patrón
de `revealed_title`, la portada hereda gratis la propiedad importante: **está NULL hasta que la
ronda se resuelve**, así que no hay ventana en la que un jugador pueda leerla antes de tiempo.

**3. `RevealedAnswer.artworkUrl` es una URL, no una referencia de provider.** Al jugador se le
entrega algo que pintar, nunca un `videoId` con el que buscar la canción. (El host sí tiene el
`providerRef`, pero el host ya conoce la respuesta.)

**4. `artworkUrlFor()` vive en un módulo puro (`lib/music/artwork.ts`).** Lo usan el servidor
(materialización) y el cliente (panel del host). No puede vivir en `YouTubeMusicProvider` porque
esa clase es solo-navegador (IFrame API) y el servidor la importaría solo para construir un
string.

**5. El host la deriva, no la lee de la ronda.** El host ya recibe `providerRef` en
`round_host_payload`, así que ve la portada desde que arranca la ronda sin esperar al reveal ni
consultar nada.

## Risks / Trade-offs

- **[La portada delata la respuesta]** → mismas reglas que el título. Verificado: `anon` lee
  `revealed_artwork_url` como `null` mientras la ronda corre.
- **[Thumbnail inexistente]** → `hqdefault` existe siempre en YouTube; aun así, `onError` la
  oculta para que una imagen rota nunca rompa el panel.
- **[Relación de aspecto]** → los thumbnails de YouTube son 16:9 con la carátula centrada;
  `object-fit: cover` recorta a cuadrado y quita las barras.
- **[URL guardada, no derivada en lectura]** → si YouTube cambiara el patrón de URL, las
  `game_tracks` ya materializadas quedarían con URLs viejas. Irrelevante: son efímeras.
