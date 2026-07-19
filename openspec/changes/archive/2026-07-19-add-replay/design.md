## Context

Extiende la ronda con una repetición opcional antes del primer buzz. La reproducción del
audio es cliente (el host ya tiene la pista del `round_host_payload`); el servidor solo lleva
la cuenta para aplicar la penalización al puntuar. Usa el `modifier` del motor (scoring v2).

## Goals / Non-Goals

**Goals:**

- Replay del host mientras la ronda está en `playing` y sin buzzes.
- Penalización al acertar si hubo replay (modifier 0.5 por defecto).
- Visibilidad de "repetida" para todos.

**Non-Goals:**

- Auto-replay; límite estricto de repeticiones (se permite repetir varias veces, la
  penalización no se acumula por ahora).
- Penalizaciones distintas por modo (uniforme 0.5; se puede afinar luego).

## Decisions

**1. Reproducción en el host, conteo en el servidor.** El botón Replay del host reproduce de
nuevo vía `MusicProvider` (guardamos la pista del último `round_host_payload`) y llama a
`POST /api/rounds/:id/replay`, que valida (host, fase `playing`, sin buzzes) e incrementa
`rounds.replay_count`. Alternativa: reproducir desde el servidor — no aplica (el audio vive
en el host).

**2. Penalización al puntuar, no al repetir.** El juicio correcto calcula
`modifier = replay_count >= 1 ? REPLAY_PENALTY (0.5) : 1` y lo pasa a `computeAward`. Así la
penalización es una sola regla en el punto de puntuar, uniforme para ambos modos.

**3. `round_replayed` para visibilidad.** El transporte, en `rounds` UPDATE, detecta que
`replay_count` subió y despacha `round_replayed { roundId, replayCount }`. `useRoundState`
expone `replayCount`; host y jugador muestran el aviso.

**4. Sin acumulación de penalización.** Repetir varias veces mantiene 0.5 (repetida = media).
Simple y predecible; acumular queda para más adelante si se desea.

## Risks / Trade-offs

- **[Repetir tras buzz]** → validación server-side (fase `playing` + sin buzzes) lo bloquea.
- **[Host recarga y pierde la pista para re-reproducir]** → caso borde; tras recarga el host
  puede avanzar. No se resuelve el re-reproducir mid-round tras recarga (igual que hoy).
- **[Percepción de penalización]** → el indicador "repetida (penalización)" lo hace explícito.

## Migration Plan

1. Migración: `rounds.replay_count int not null default 0`.
2. `POST /api/rounds/:id/replay` (host, playing, sin buzzes) → incrementa contador.
3. `judge` correcto: `modifier` según `replay_count`.
4. `SupabaseTransport`: `replayRound`; `round_replayed` desde `rounds` UPDATE; `useRoundState`
   con `replayCount`.
5. UI: host (botón Replay + re-reproducir + "Repetida ×N"); jugador (aviso de penalización).
6. Verificar: servidor (replay incrementa; bloqueado tras buzz/no-host; penalización al
   acertar) + multi-pestaña.

## Open Questions

- **¿Penalización configurable por el host?** Default 0.5 fijo por ahora; podría ir en
  `config` más adelante.
