# Guess the Song — Spec Base

> Documento vivo. Recoge los principios del juego y las decisiones de diseño con su
> justificación. Las secciones marcadas con **[ABIERTO]** requieren confirmación antes
> de convertirse en decisiones firmes. Este documento es el punto de partida para
> trabajar por pasos con OpenSpec.

## Decisiones confirmadas (2026-07-18)

| # | Decisión | Elección |
|---|---|---|
| 1 | Plataforma | **Web App (Next.js)** — modelo host + jugadores por navegador |
| 2 | Proveedor de música (MVP) | **YouTube (IFrame API)** primero; Spotify después, tras `MusicProvider` |
| 3 | Mecánica de respuesta (MVP) | **Buzzer** + validación del host (Correcto/Incorrecto) |
| 4 | Origen de canciones | **Playlists curadas predefinidas**; a futuro, listas propias del host |
| 5 | Backend / tiempo real | **Supabase** (Realtime + Postgres + Auth), detrás de una **abstracción `GameTransport`** en el front |

---

## 1. Concepto

Juego de fiesta para adivinar canciones lo más rápido posible. Empieza a sonar una
canción durante un tiempo limitado (configurable, p. ej. 15s → 1s según dificultad) y
los jugadores compiten por identificarla. Varias personas escuchan la misma música
"live" y responden desde sus dispositivos. Puede haber puntos extra por datos
adicionales (artista, álbum, año).

**Pilar de diseño:** *sin complicaciones*. Cero fricción para unirse, reglas obvias,
partida que arranca en menos de un minuto.

---

## 2. Decisión de plataforma — **Recomendación: Web App (Next.js)**

El juego es del tipo **host + jugadores** (modelo Jackbox / Kahoot / Crowdpurr): una
pantalla central reproduce la música y cada jugador usa su teléfono como control. Para
ese modelo, la web gana con claridad:

| Criterio | Web App (Next.js) | App móvil (React Native) |
|---|---|---|
| Fricción para unirse | Abrir URL + código. **Cero instalación** | Todos deben instalar la app (mata una fiesta) |
| Multiplataforma | Automática (cualquier navegador) | Build iOS + Android + stores |
| Rol de host / pantalla grande | Trivial (abrir en laptop/TV, castear a bocina) | Requiere app en el dispositivo host |
| Tiempo real multi-dispositivo | WebSockets estándar | Igual, pero con más plumbing |
| Iteración / despliegue | Instantáneo (una URL) | Ciclos de store, versiones fragmentadas |
| Reproducción de música en navegador | SDKs web de Spotify / YouTube disponibles | SDKs nativos, más restricciones |

**Conclusión:** el factor decisivo es la fricción de entrada. Un juego de fiesta muere
si cada invitado tiene que ir a la store, instalar y crear cuenta. Con web, el host
comparte un código y todos entran desde su navegador.

> El único escenario donde móvil ganaría es si el juego fuera "un solo dispositivo que
> pasa de mano en mano" o requiriera capacidades nativas (no es el caso). Una PWA
> instalable cubre después el deseo de "ícono en el home" sin renunciar a la web.

---

## 3. Modelo de sesión (derivado de la decisión anterior)

- **Host / Screen:** crea la sesión, muestra el código, reproduce la música, lleva el
  marcador. Corre en laptop/TV/tablet. Puede castearse a una bocina.
- **Players:** entran desde el navegador de su teléfono con un **código de sesión**
  (4–6 caracteres) o QR. Solo escriben un nombre; sin cuenta, sin instalación.
- Un jugador podría también ser el host (auto-hospedar) para grupos pequeños.

Entidades base: `Session`, `Player`, `Round`, `Track`, `Answer`, `Score`.

---

## 4. Fuente de música — **el riesgo técnico crítico (decidido: YouTube primero)**

Esta es la parte que más condiciona el MVP. Resumen honesto del estado de cada servicio:

### Spotify (Web Playback SDK)
- Permite reproducir **pistas completas** en el navegador.
- **Requiere que el host tenga Spotify Premium** y haga login OAuth.
- Los `preview_url` de 30s ya no son fiables para apps nuevas; hay que usar el SDK de
  reproducción completa (que exige Premium).
- Términos de uso: el uso "tipo juego/quiz" cae en zona gris; conviene revisar la
  política antes de escalar.
- **Ventaja:** catálogo enorme y control de reproducción preciso (start en seg. X, stop).

### YouTube / YouTube Music (IFrame Player API)
- Reproduce en el navegador **sin cuenta premium y sin login del jugador**.
- Fricción mínima para el host.
- Contras: anuncios ocasionales, disponibilidad variable de videos, y hay que ocultar
  el video (queremos solo audio) — se puede con un reproductor oculto.
- No hay una "YouTube Music API" pública de reproducción; se usa la IFrame API con el
  video correspondiente.

**Decisión:** el MVP arranca con **YouTube (IFrame API)** por su baja fricción (sin
login premium), y **Spotify queda como segundo proveedor** detrás de una capa de
abstracción `MusicProvider` (interfaz: `play(trackId, startMs, durationMs)`, `stop()`,
`search()`). Así el juego no queda acoplado a un proveedor.

> **Nota de contenido:** no se traerá "cualquier canción del mundo" de YouTube. El pool
> de reproducción viene de **playlists curadas** (§7), de modo que cada pista tiene un
> `answer` conocido y consistente (título + artista canónicos), y evitamos videos con
> títulos ruidosos, covers o mezclas que arruinen la validación.

---

## 5. Cómo responden los jugadores — **Recomendación: modelo Buzzer**

Análisis de las tres opciones que planteaste:

| Opción | Cómo funciona | Pros | Contras |
|---|---|---|---|
| **Buzzer** ⭐ | Cada teléfono es un botón. El primero en presionar "para" la música y responde en voz alta; el host valida. Si falla, pasa al 2º más rápido (ranking de reacción). | Máxima energía de fiesta, auténtico "name that tune", simple de entender, no requiere preparar opciones | Necesita a un **humano (host) que valide** la respuesta hablada |
| **Opción múltiple** | Aparecen N opciones en cada teléfono; gana quien acierta más rápido. | Auto-puntuación, sin juez, escala a muchos jugadores | Hay que **generar distractores creíbles**, revela la respuesta, baja la energía de "gritar" |
| **Escribir respuesta** | El jugador teclea el título; matching difuso. | Sin opciones que revelen nada | Lento, matching frágil, poco divertido — **descartada** |

**Recomendación:** **Buzzer como mecánica principal**. Es la que mejor captura el
espíritu de fiesta y es la más simple de *jugar*. La validación por parte del host
(un botón "Correcto / Incorrecto") es aceptable e incluso divertida en fiesta, y evita
todo el trabajo de generar opciones.

**Opción múltiple queda como modo alternativo** para un futuro (útil para jugar sin
host activo o de forma 100% automática). No para el MVP.

### Flujo del modo Buzzer
1. Host inicia ronda → suena la canción por X segundos.
2. Cualquier jugador presiona **BUZZ** → la música se pausa al instante en todos.
3. El servidor registra el **orden de reacción** (timestamps). El más rápido tiene el
   turno para responder en voz alta.
4. Host marca **Correcto** (puntos, fin de ronda) o **Incorrecto** (pasa el turno al
   siguiente más rápido; opcionalmente penalización).
5. Si nadie acierta y se agota, se revela la canción, 0 puntos, siguiente ronda.

---

## 6. Puntuación (propuesta base, ajustable)

- Acierto: puntos base + **bonus por velocidad** (mientras menos tardó en buzzear /
  menor la ventana de audio elegida, más puntos).
- **Bonus opcional** por datos extra correctos (artista / álbum / año) — el host los
  concede con toggles.
- Fallo tras buzzear: penalización pequeña opcional (para evitar buzz a lo loco).
- Marcador acumulado por sesión; pantalla de podio al final.

---

## 7. Origen de las canciones — **decidido: playlists curadas**

- **MVP:** el juego trae **playlists curadas predefinidas** (por género, década, mood,
  etc.). Cada pista de la playlist es un objeto `Track` con: `providerId` (id de YouTube),
  `answerTitle`, `answerArtist`, `year`, `startMs` sugerido, y aliases aceptados para la
  validación. Esto garantiza un `answer` limpio y consistente.
- **Evolución:** más adelante, permitir que el **host importe sus propias listas**
  (YouTube/Spotify), con un paso de "normalización" que extraiga título/artista canónicos.

**Selección dentro de la partida:** aleatoria desde la playlist elegida, sin repetición,
de forma que el orden no sea predecible.

### Rol del host frente a las canciones — decidido: **host = presentador/juez, NO concursa**
La mecánica Buzzer es **verbal** (el jugador dice la canción en voz alta) — así se
conserva la adrenalia y la energía de fiesta. Eso obliga a un **juez humano** que escuche
y valide, y que por tanto **ve la respuesta correcta**. Por eso el host es el
**presentador/juez y no participa como concursante**.

- La app le muestra al host el `answer` esperado (título + artista + aliases) para
  juzgar rápido y consistente, más botones **Correcto / Incorrecto**.
- La respuesta correcta se revela a los jugadores **solo al final de la ronda** (tras un
  acierto o al agotarse la cola de buzzers / el tiempo), nunca a media ronda — así el
  pase al siguiente más rápido no queda bloqueado.

> Trade-off aceptado: no "todos juegan" simultáneamente (el host presenta). Una versión
> "auto-validada sin juez" (respuesta privada en el dispositivo) queda **descartada para
> el MVP** por cambiar demasiado el estilo y bajar la adrenalina. Podría revivirse como
> **modo alternativo** en el futuro.

---

## 8. Arquitectura técnica (alto nivel)

- **Frontend:** Next.js (App Router) + React. Dos vistas: `/host` y `/play`.
- **Backend / tiempo real:** **Supabase** — Realtime (WebSockets gestionados) para el
  buzzer y el estado de sesión, Postgres para playlists/tracks/marcadores, y Auth ligera
  si se necesita. Free tier para el MVP.
- **Sincronización del buzzer:** los timestamps de reacción se ordenan de forma
  **autoritativa del lado del servidor** (no confiar en el reloj del cliente). Con
  Supabase esto se resuelve escribiendo los buzzes en una tabla con `server timestamp` /
  Edge Function que sella la hora, y difundiendo el orden resultante.

### Capas de abstracción en el front (para no acoplarnos a proveedores)

El juego habla **solo con interfaces**, nunca directo con el SDK del proveedor. Así
podemos cambiar Supabase (o YouTube) por otra cosa sin tocar la lógica del juego.

- **`MusicProvider`** — abstrae YouTube/Spotify.
  `play(trackId, startMs, durationMs)`, `stop()`, `search()`.
- **`GameTransport`** — abstrae toda la comunicación con el backend / tiempo real.
  Ejemplo de contrato (a afinar en OpenSpec):
  - `createSession(hostProfile): { sessionCode }`
  - `joinSession(code, player): { playerId }`
  - `on(event, handler)` / `off(event, handler)` — eventos: `player_joined`,
    `round_started`, `buzz`, `buzz_queue_updated`, `answer_judged`, `round_ended`,
    `score_updated`, `player_left`.
  - `emit(action, payload)` — acciones: `buzz`, `start_round`, `judge` (correcto/
    incorrecto), `next_round`.
  - `presence()` / `disconnect()` para reconexión.
  - Implementación inicial: `SupabaseTransport`. Futuras posibles: `CloudflareDOTransport`,
    `SocketIOTransport`, todas cumpliendo la misma interfaz.

> Regla: los componentes de React y la máquina de estados del juego dependen de
> `GameTransport` (la interfaz), no de `@supabase/*`. El SDK de Supabase vive **solo**
> dentro de `SupabaseTransport`.

---

## 9. Alcance del MVP (propuesta)

1. Host crea sesión → código + QR.
2. Jugadores entran con código y nombre.
3. Host inicia ronda; música suena X segundos (YouTube IFrame).
4. Buzzer en tiempo real con ranking de reacción.
5. Host valida Correcto/Incorrecto; puntuación con bonus de velocidad.
6. Marcador y podio final.
7. Dificultad = duración de la ventana de audio (15/10/5/3/1 s).

**Fuera del MVP:** opción múltiple, login Spotify, bonus por artista/álbum/año,
persistencia de perfiles, ranking histórico, PWA instalable.

---

## 10. Estado de las decisiones

**Resueltas** (ver tabla al inicio): plataforma, proveedor de música, mecánica de
respuesta y origen de canciones.

**Pendientes por definir en el siguiente paso (con OpenSpec):**

1. **Curaduría inicial:** ¿cuántas playlists y de qué temáticas para el MVP? ¿Los tracks
   viven en Postgres (Supabase) desde el inicio o en JSON estático primero?
2. **Detalles de puntuación:** valores concretos de puntos base, curva de bonus por
   velocidad, y si habrá penalización por buzz fallido.
3. **Reconexión / anti-trampa:** manejo de jugadores que se caen y reconectan; sellado de
   timestamp del buzzer del lado servidor (principio ya fijado en §8).
4. **Contrato de `GameTransport`:** afinar la lista final de eventos/acciones y payloads.
