# Guess the Song — Roadmap

> Plan de entrega por fases. Cada fase se aborda como uno o más *changes* en OpenSpec.
> Se apoya en el [spec base](./base-spec.md) y el [modelo de datos](./data-model.md).
> El objetivo es un MVP jugable end-to-end lo antes posible, e ir sumando profundidad.

## Principios de entrega

- **Vertical antes que horizontal:** priorizar tener un flujo jugable completo (aunque
  simple) sobre pulir un módulo aislado.
- **Desacople desde el día 1:** la lógica del juego habla con `GameTransport` y
  `MusicProvider`, nunca con los SDKs directos.
- **Autoridad del servidor:** orden del buzzer y juicios se validan en backend, no en el
  cliente.
- **Un change = una capacidad coherente,** con criterios de "hecho" verificables.

---

## Fase 1 — Fundaciones  ·  `add-foundations`  ·  **← empezamos aquí**

**Objetivo:** esqueleto técnico sobre el que se construye todo. Nada jugable aún.

**Alcance:**
- Proyecto Next.js (App Router) + TypeScript, estructura de carpetas, linting/formato.
- Proyecto Supabase enlazado (local + remoto), variables de entorno.
- Esquema inicial y migraciones: `playlists`, `tracks`, `sessions`, `players`, `rounds`,
  `buzzes`, `judgements` (según [data-model](./data-model.md)).
- RLS base y convención de canales Realtime (público de sesión / privado de host).
- Definición de la interfaz **`GameTransport`** + implementación esqueleto
  **`SupabaseTransport`** (métodos stub que ya compilan).
- Definición de la interfaz **`MusicProvider`** (sin implementación real todavía).
- Rutas base `/host` y `/play` (placeholders).
- Semilla mínima: 1 playlist curada con ~10 tracks para poder probar.

**Depende de:** nada.

**Hecho cuando:** el proyecto arranca en local, conecta a Supabase, las migraciones
aplican, y las interfaces `GameTransport`/`MusicProvider` existen y compilan.

---

## Fase 2 — Lobby  ·  `add-lobby`

**Objetivo:** crear y unirse a una sesión.

**Alcance:**
- Host: `create_session` (elige playlist + `config` de dificultad), genera `code` + QR.
- Player: `join_session` por código, nombre visible, sin cuenta.
- Presencia en vivo (Supabase Realtime Presence): lista de jugadores conectados.
- Vista de sala de espera (host y jugador) con estado `lobby`.
- Manejo de `player_left` / reconexión básica.

**Depende de:** Fase 1.

**Hecho cuando:** un host crea sesión, varios jugadores entran por código desde sus
teléfonos y todos se ven en la sala en tiempo real.

---

## Fase 3 — Ronda y buzzer  ·  `add-round-buzzer`

**Objetivo:** el corazón del juego — sonar la canción y competir por el buzz.

**Alcance:**
- Implementación real de `MusicProvider` para **YouTube (IFrame API)**, reproductor
  oculto (solo audio), `play(startMs, windowMs)` / `stop()`.
- `start_round` (host): selección de track aleatorio sin repetir, difusión de
  `round_started` (jugadores, sin datos de pista) y `round_host_payload` (solo host).
- Reproducción de la ventana de audio X segundos en el dispositivo host.
- **Buzz sellado en servidor** (Edge Function/RPC): `server_ts`, `rank`, cola ordenada.
- Pausa de música al primer buzz; difusión de `buzz_registered` / `buzz_queue_updated`.
- Transición de fase de ronda `playing → answering`; `timeout` si nadie buzzea.
- UI de jugador (botón BUZZ + estado) y de host (reproductor + cola de buzzers).

**Depende de:** Fases 1–2.

**Hecho cuando:** suena la canción en el host, los jugadores buzzean, el servidor ordena
la cola de forma justa y la música se pausa al primer buzz.

---

## Fase 4 — Juicio y puntuación  ·  `add-judging-scoring`

**Objetivo:** resolver la ronda y llevar el marcador.

**Alcance:**
- UI de juez del host: muestra `answer` esperado (título/artista/aliases/año) + botones
  **Correcto / Incorrecto**; toggles de bonus (artista/álbum/año) según `config`.
- `judge`: correcto → puntos (motor de scoring) y fin de ronda; incorrecto → pase al
  siguiente en la cola (sin reducción de puntos); cola agotada → `exhausted`.
- **Motor de scoring:** `BASE × multiplicador_dificultad × speedFactor + extras`
  (valores de `BASE`/curva a afinar aquí). Sin penalización por fallo.
- `round_ended` con `revealedAnswer` (revelación de la respuesta a jugadores).
- Actualización de `score_updated` y denormalización en `players.score`.
- `next_round` para encadenar rondas.

**Depende de:** Fase 3.

**Hecho cuando:** el host juzga, el fallo pasa al siguiente más rápido, se otorgan puntos
correctamente y la respuesta se revela al cerrar la ronda.

---

## Fase 5 — Cierre de partida  ·  `add-endgame`

**Objetivo:** terminar la partida con broche.

**Alcance:**
- `end_game` (o fin automático al completar `rounds_total`).
- Pantalla de **podio** (`game_ended` con posiciones) en host y jugadores.
- Opción "jugar de nuevo" reiniciando marcador con los mismos jugadores.
- Estado de sesión `finished`.

**Depende de:** Fase 4.

**Hecho cuando:** al terminar las rondas se muestra el podio y se puede reiniciar.

---

## MVP = Fases 1–5

Al cerrar la Fase 5 tenemos el juego jugable end-to-end: crear sala, unirse, jugar rondas
con buzzer, juzgar, puntuar y ver podio, con playlists curadas sobre YouTube.

---

## Post-MVP (backlog, sin orden fijo)

| Feature | Change tentativo | Nota |
|---|---|---|
| Proveedor Spotify | `add-spotify-provider` | Segunda impl. de `MusicProvider` (Premium + OAuth) |
| Modo opción múltiple | `add-multiple-choice-mode` | Auto-validado, sin juez; distractores desde la playlist |
| Modo "verbal sin juez" | — | Variante auto-validada descartada del MVP, revivible |
| Playlists propias del host | `add-host-playlists` | Importar y normalizar listas de YouTube/Spotify |
| Bonus por datos extra (UI pulida) | `add-extra-points` | Flujo fino de artista/álbum/año |
| PWA instalable | `add-pwa` | "Ícono en el home" sin dejar la web |
| Perfiles / historial | `add-profiles-history` | Persistencia de jugadores y ranking histórico |
| Penalización por buzz fallido (opt-in) | `add-wrong-buzz-penalty` | Config opcional, hoy en 0 |
| Anti-abuso / rate limiting | `add-abuse-guards` | Protección del buzz y del join |
| Despliegue remoto | `add-remote-deploy` | Enlazar proyecto Supabase remoto + `supabase db push` + seed remoto + deploy a Vercel. Hasta entonces, desarrollo 100% en Supabase local |

---

## Dependencias (resumen)

```
Fase 1 ─► Fase 2 ─► Fase 3 ─► Fase 4 ─► Fase 5
                                   └─► (backlog post-MVP)
```
