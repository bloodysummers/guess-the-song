## Context

Última fase del MVP. Con juicio y puntaje listos, falta que la partida termine sola (por N
rondas o por agotar la playlist) y muestre un podio. Reutiliza el patrón existente:
decisiones server-side, eventos por Realtime, e hidratación en (re)conexión.

Referencias: [proposal](./proposal.md), [data-model](../../../docs/data-model.md) §3/§6.

## Goals / Non-Goals

**Goals:**

- Fin de partida por `roundsTotal` o por playlist agotada → `sessions.status = finished`.
- Podio (jugadores por puntaje, sin el host) visible para todos.
- Progreso "Ronda X de N" durante el juego.
- "Jugar de nuevo": reset de puntajes/rondas con los mismos jugadores.
- `endGame` real + evento `game_ended`.

**Non-Goals:**

- Persistencia de historial de partidas / ranking global (backlog).
- Desempates elaborados (empate se muestra por orden de puntaje).

## Decisions

**1. La decisión de fin vive en `POST /api/rounds`.** Al iniciar/avanzar: se resuelve la
ronda activa (skipped), y **antes de crear una nueva** se evalúa el fin:
- si `rondas jugadas >= roundsTotal` → fin;
- si no quedan pistas sin usar → fin.
En fin: `sessions.status = finished` y la respuesta es `{ gameOver: true }` (sin pista).
Así "playlist agotada" deja de ser error y se vuelve cierre natural (modifica
`round-lifecycle`).

**2. Podio por evento derivado de `session_updated`.** El transporte, al ver
`session_updated` con `status = "finished"`, lee los jugadores (no host) ordenados por
`score` desc y despacha `game_ended { podium }`. Llega a host y jugadores por igual (ambos
suscritos a `sessions` UPDATE). Alternativa: incluir el podio en la respuesta del endpoint —
descartada porque solo llegaría al host.

**3. `session_updated` inicial en el subscribe.** Al conectarse, el transporte lee la sesión
(`status`, `config`, `rounds_total`) y despacha `session_updated`, para que los clientes
conozcan `roundsTotal` (progreso) y detecten una partida ya `finished` al reconectar.

**4. Progreso "Ronda X de N".** `round_started.roundNumber` (ya existe) + `roundsTotal` de
`session_updated`. Puro cálculo en la UI.

**5. Jugar de nuevo (`POST /api/sessions/restart`, solo host).** Pone `players.score = 0`,
borra `rounds`/`buzzes`/`judgements` de la sesión, `status = lobby`, `current_round_id =
null`. Los clientes detectan la transición a `lobby` y hacen `resume()` (re-suscribe →
re-emite roster, cero puntajes y sin ronda) + reset de la vista (`sessionGen`). Reutiliza el
mecanismo de reset de sesión ya existente.

## Risks / Trade-offs

- **[Conteo de rondas vs `roundsTotal`]** → se cuenta por filas de `rounds` de la sesión tras
  resolver la activa; simple y determinista.
- **[Refresco del cliente en "jugar de nuevo"]** → `resume()` reconstruye todo; puede haber
  un parpadeo breve, aceptable.
- **[Reconexión a partida terminada]** → el `session_updated` inicial con `finished` permite
  mostrar el podio directo.
- **[Empates]** → se listan por orden de puntaje; desempate fino queda fuera de alcance.

## Migration Plan

1. Sin migración de esquema (usa `sessions.status`, `players.score`, tablas existentes).
2. `POST /api/rounds`: lógica de fin (N rondas / sin pistas) → `finished` + `{ gameOver }`.
3. `POST /api/sessions/restart` (host): reset de puntajes/rondas → `lobby`.
4. `SupabaseTransport`: `endGame`; `game_ended` desde `session_updated` finished;
   `session_updated` inicial; `startRound` maneja `{ gameOver }`.
5. UI: progreso "Ronda X de N", pantalla de podio, botón "Jugar de nuevo" (host).
6. Verificar: fin por N rondas y por playlist agotada; podio ordenado; reinicio.

## Open Questions

- **¿Auto-avance opcional?** Hoy el host pulsa "Siguiente ronda" manualmente; auto-avance
  tras revelar queda como mejora futura, no bloquea el MVP.
