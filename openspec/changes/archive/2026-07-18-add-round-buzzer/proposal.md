## Why

Es el corazón del juego: sonar una canción por X segundos y dejar que los jugadores
compitan por el buzzer. Aquí `MusicProvider` obtiene su primera implementación real
(YouTube) y se estrena el modelo anti-trampa: los datos de la pista y la respuesta viajan
**solo al host**, mientras los jugadores solo reciben "suena la ronda, ¡buzz!". La
justicia del buzzer exige que el orden lo determine el **servidor**, no el cliente.

## What Changes

- **Reproducción YouTube (host):** implementación real de `MusicProvider` con la IFrame API,
  reproductor oculto (solo audio), `play(startMs, windowMs)` y `stop()`.
- **Iniciar ronda (host):** selección de una pista **aleatoria sin repetir** de la playlist;
  se crea la ronda; el host recibe la pista + respuesta (payload host-only) y suena el audio;
  los jugadores reciben `round_started` **sin** datos de la pista.
- **Buzzer sellado en servidor:** el jugador dispara `buzz`; el servidor sella `server_ts`
  de forma autoritativa y calcula el **orden/rank** de la cola. Un jugador solo puede
  buzzear una vez por ronda; el host no buzzea.
- **Pausa al primer buzz:** al primer buzz la música se detiene y la ronda pasa a
  `answering`, con el más rápido como `current_answerer`; se difunde la cola ordenada.
- **Fin de ventana / timeout:** si nadie buzzea, el audio termina al agotarse la ventana y
  el host puede avanzar a la siguiente ronda.
- **Avanzar rondas:** el host inicia la siguiente ronda (la actual se resuelve como
  `skipped` por ahora; el juicio y la puntuación llegan en la Fase 4).
- **Implementación de transporte:** `startRound`, `nextRound` y `buzz` dejan de ser stubs;
  nuevos eventos `round_started`, `round_host_payload`, `music_control`, `buzz_registered`,
  `buzz_queue_updated`.

## Capabilities

### New Capabilities
- `music-playback`: reproducción real de una ventana de audio desde YouTube (solo audio,
  oculto) detrás de `MusicProvider`, con `play`/`stop` y fin automático de la ventana.
- `round-lifecycle`: iniciar rondas con selección aleatoria sin repetir, separación de datos
  host-only vs jugadores, transición de fases y avance entre rondas.
- `buzzer`: registro de buzz con timestamp sellado en servidor, cola ordenada justa, un buzz
  por jugador, y pausa de la música al primer buzz.

### Modified Capabilities
<!-- Ninguna a nivel de requisitos. Se implementa el comportamiento sobre las interfaces
     ya definidas (music-provider, game-transport). -->

## Impact

- **`MusicProvider`:** primera implementación concreta (`YouTubeMusicProvider`); dependencia
  de la IFrame API de YouTube (cargada solo dentro de la implementación).
- **Backend/datos:** uso de `rounds` y `buzzes`; endpoints server-side para iniciar ronda
  (selección + payload host-only) y para buzz (sellado de `server_ts`, orden). Realtime en
  `rounds` y `buzzes`.
- **`SupabaseTransport`:** implementación de `startRound`/`nextRound`/`buzz` + nuevos eventos.
- **Frontend:** `/host` reproduce el audio y muestra la cola de buzzers; `/play` muestra el
  botón BUZZ y el estado de la ronda.
- **Anti-trampa:** primer uso real de la frontera host-only (pista/respuesta nunca llegan al
  jugador). Depende de `add-foundations` y `add-lobby`.
- **Fuera de alcance:** juicio (correcto/incorrecto), puntuación y revelación de respuesta
  (Fase 4, `add-judging-scoring`).
