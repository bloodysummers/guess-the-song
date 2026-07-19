## Context

Tres pulidos de reproducción/UX detectados jugando. Los tres son acotados; #2 y #3 comparten
el rework del `YouTubeMusicProvider` (eventos del player). #1 es un cambio de etiqueta.

## Goals / Non-Goals

**Goals:**

- Botón "Finalizar partida" en la última ronda.
- Ventana de audio medida desde el `PLAYING` real (arregla 1s inconsistente).
- Inicio de fragmento aleatorio, idéntico en replay.

**Non-Goals:**

- Buscar el "mejor" fragmento (más reconocible); solo aleatoriedad acotada.
- Randomizar en Spotify u otros providers (aplica al de YouTube; otros lo harán al llegar).

## Decisions

**1. Temporizador atado a `onStateChange` (PLAYING).** El player expone `onStateChange`; al
llegar a `PLAYING` (estado 1) se arranca el `setTimeout(windowMs)` que corta. `play()` marca
un `pendingWindowMs`; el primer `PLAYING` tras pedir reproducir lo consume. Así el buffering
no come la ventana. Alternativa: medir con `getCurrentTime` en un intervalo — más frágil.

**2. Random start vía cue → duration → seek → play.** Para randomizar hace falta la duración,
disponible tras cargar. Secuencia: `cueVideoById` (carga en pausa) → `getDuration` (con poll
hasta que sea > 0, ~2s máx) → elegir start aleatorio dentro de `[FLOOR, duración − ventana −
cola]` → `seekTo(start)` → `playVideo`. Si no se obtiene duración → fallback
(`default_start_ms` de la pista o un valor fijo).

**3. `play` devuelve el `startMs` usado; `null` = randomizar.** El host, al iniciar ronda,
llama `play(track, null, window)` y guarda el `startMs` devuelto. El **replay** llama
`play(track, startGuardado, window)` (exacto). Así el fragmento es estable dentro de la ronda
y en el replay, pero distinto en cada nueva aparición. Alternativa: exponer `getDuration()` y
randomizar en el host — más ida y vuelta; se prefiere encapsular en el provider.

**4. Botón final por comparación simple.** `roundNumber >= roundsTotal` → "Finalizar partida".
El endpoint ya termina la partida en ese avance (no cambia backend).

## Risks / Trade-offs

- **[`getDuration` tarda o no llega]** → poll con timeout + fallback; no bloquea la ronda.
- **[Autoplay tras cue+seek+play]** → sigue siendo gesto del host (clic en iniciar), válido.
- **[Se pierde el `default_start_ms` curado]** → es el objetivo (randomizar); queda como
  fallback si no hay duración.
- **[No puedo probar audio localmente]** → verificación visual/auditiva la hace el usuario;
  aquí se cubre con typecheck/test y revisión de lógica.

## Migration Plan

1. `MusicProvider.play` → `(track, startMs: number | null, durationMs) => Promise<number>`.
2. `YouTubeMusicProvider`: `onStateChange`/PLAYING para el timer; cue→duration→seek→play para
   el random; devolver el start usado.
3. Host: randomizar al iniciar y guardar el start; replay con el start guardado; botón final.
4. `typecheck` + `test`. Prueba visual/auditiva por el usuario (1s consistente; fragmentos
   distintos; replay igual; botón "Finalizar partida").
