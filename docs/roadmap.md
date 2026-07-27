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

## MVP = Fases 1–5 — ✅ COMPLETO y desplegado (2026-07-18)

Juego jugable end-to-end en producción (Vercel + Supabase remoto): crear sala → unirse por
código/QR → sonar canción (YouTube) → buzzer sellado en servidor → juicio del host →
puntuación (modos `simple`/`speed`) → podio → jugar de nuevo. Todas las fases con specs
archivados en OpenSpec.

---

# Roadmap Post-MVP (por épicas)

Reorganizado por valor y dependencias. Las "épicas" agrupan varios changes de OpenSpec.
Regla: primero lo que da valor de juego sin dependencias externas; los providers (que
necesitan cuentas/API keys y revisión de plataforma) como esfuerzo dedicado aparte.

## Completado adicional (fuera de secuencia, del feedback de juego)

- ✅ **`add-playback-polish`** — botón de ronda final, ventana de audio precisa (timer en
  `PLAYING`), inicio de fragmento aleatorio (+ manejo de `onError` de YouTube).
- ✅ **`add-session-game-split`** — Sesión (hub persistente) separada de Juego; marcador por
  juego + acumulado de sesión; `game_type` para futuros juegos. Desplegado a producción.
- ✅ **`add-game-track-sources`** — cada juego materializa su propio `game_tracks` desde una
  fuente pluggable: playlist curada del catálogo **o** URL pública de YouTube / YouTube Music
  (Data API). Efímero, provider-agnóstico, no legible por `anon`. Cubre D1+D2.
- ✅ **`add-cover-art`** — portada de la pista en el panel del host durante la ronda, y para
  todos al revelar la respuesta (misma regla de visibilidad que el título).
- ✅ **`add-playback-recovery`** — una pista que no se puede reproducir se cambia sola sin
  consumir ronda; botón del host para otro fragmento aleatorio sin penalización.

### Pendientes chicos detectados

- **`FALLBACK_START_MS` a ciegas** (`lib/music/youtube-provider.ts`): si `getDuration()` no
  responde en 2 s, salta a 20 s sin saber si la canción dura tanto — en pistas cortas cae más
  allá del final y suena silencio. Sospechoso, **no medido**. Salió de `add-playback-recovery`;
  el botón de "otro fragmento" ya deja al host recuperarse mientras tanto.
- **Playlists privadas de YouTube** — requieren OAuth (`youtube.readonly`, scope sensible con
  verificación de Google para producción). Descartado por ahora a favor de Spotify. Las **no
  listadas** ya funcionan con la API key actual.

---

## Épica A — Modelo de puntuación v2 (fundación) · `add-scoring-v2` — ✅ COMPLETA

**Por qué primero:** habilita penalizaciones y boosts para replay y gamificación.

- Cambiar el modo base de 1 punto fijo a **base configurable (default 10)** → permite medios
  puntos, penalizaciones y bonificaciones sin fracciones raras.
- Modelo de puntos con "modificadores" (penalización/boost) que otros features aplican.
- Pequeño; sin dependencias externas. Desbloquea B y F.

## Épica B — Replay / segunda oportunidad · `add-replay` — ✅ COMPLETA

- Botón **Replay** del host cuando se agota la ventana sin buzz (segunda reproducción).
- Penalización por modo: `speed` → factor reducido / tope; `base` → medio punto.
- Depende de Épica A.

## Épica C — Modo opción múltiple · `add-multiple-choice-mode` — ⬅ SIGUIENTE

- Modo auto-validado (sin juez): aparecen N opciones y gana quien acierte más rápido.
- **Distractores desde los metadatos de la propia playlist** (ya tenemos `answer_title`/
  `answer_artist` en cada `track`) → **no depende de los providers**.
- Config: modo de juego (buzzer vs opción múltiple) al crear la sesión.

## Épica D — Playlists propias y providers (esfuerzo grande, multi-change)

Extiende `MusicProvider` con un lado de **catálogo** (listar playlists, leer pistas) +
pipeline de **importación/normalización** a nuestro modelo `track`. Ver
[`docs/providers.md`](./providers.md) para los prerequisitos externos y las restricciones
reales de cada plataforma.

- **D1 · `add-provider-catalog`** — interfaz de catálogo + importación/normalización.
- **D2 · `add-youtube-public-playlists`** — el host pega una **URL de playlist pública** de
  YouTube; se lee con API key (sin login del usuario). Reproducción gratis (IFrame). *Menor
  fricción → primer paso recomendado.*
- **D3 · `add-youtube-account`** — conectar cuenta (OAuth) para listas **privadas** de
  YouTube Music. Requiere verificación de Google para producción.
- **D4 · `add-spotify-provider`** — OAuth + Web Playback SDK. Metadatos limpios, pero la
  reproducción completa exige **Spotify Premium** del host; revisión de app para escalar.

> Las 3 opciones para el host quedan: (1) listas curadas del juego [YouTube, ya existe],
> (2) YouTube propio, (3) Spotify propio.

## Épica E — PWA instalable · `add-pwa`

- Manifest + iconos (varios tamaños) + `apple-touch-icon` + `theme-color`.
- **Service worker** (Serwist o next-pwa) para que sea instalable — es lo "adicional" además
  del manifest/favicon. HTTPS ya lo da Vercel. Offline no es crítico (el juego necesita red).
- Independiente; se puede hacer en cualquier momento.

## Épica F — Gamificación estilo juego de mesa (exploratoria) · `add-game-mechanics`

- Boosts, bonificaciones random en canciones específicas, y **cambios de mecánica elegidos
  por el ganador de la ronda**.
- Depende de Épica A (modelo de puntos con modificadores). Requiere una fase de diseño
  propia; profundizar más adelante.

## Pospuesto

- **Perfiles / historial** — persistencia de jugadores y ranking histórico. Alcance poco
  claro; se retoma después.
- **Anti-abuso / rate limiting** — proteger buzz/join ante abuso a mayor escala.

---

## Secuencia recomendada

```
A (scoring v2) ─► B (replay) ─► C (opción múltiple)      [valor rápido, sin externos]
E (PWA)                                                  [en paralelo, independiente]
D1 ─► D2 (YouTube público) ─► D3/D4 (cuentas OAuth)      [providers, con setup externo]
F (gamificación)                                         [tras A, exploratoria]
```
