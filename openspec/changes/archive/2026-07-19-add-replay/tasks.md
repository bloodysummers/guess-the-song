## 1. Migración

- [x] 1.1 Migración: `rounds.replay_count int not null default 0`
- [x] 1.2 `supabase db reset` local y verificar

## 2. Backend

- [x] 2.1 `POST /api/rounds/:id/replay`: host; ronda en `playing`; sin buzzes; incrementa `replay_count`; devuelve `{ replayCount }`
- [x] 2.2 Rechazos: no-host, tras buzz, ronda no `playing`
- [x] 2.3 `judge` correcto: `modifier = replay_count >= 1 ? 0.5 : 1` → `computeAward`

## 3. Transporte + contrato

- [x] 3.1 Añadir `replayRound(input)` a `GameTransport` y evento `round_replayed`
- [x] 3.2 `SupabaseTransport.replayRound` → `POST /api/rounds/:id/replay`
- [x] 3.3 En `rounds` UPDATE: si `replay_count` subió → despachar `round_replayed`
- [x] 3.4 `useRoundState` expone `replayCount` (reset en nueva ronda)

## 4. UI

- [x] 4.1 Host: guardar la pista del `round_host_payload` para re-reproducir
- [x] 4.2 Host: botón **"Repetir (penalización)"** cuando `playing` y sin buzzes; al pulsar re-reproduce + `replayRound`
- [x] 4.3 Host: indicador "Repetida ×N"
- [x] 4.4 Jugador: aviso "Canción repetida — penalización" cuando `replayCount > 0`

## 5. Verificación

- [x] 5.1 `supabase db reset`, `typecheck`, `lint`, `test`, `build` en verde
- [x] 5.2 Prueba de servidor: replay incrementa; bloqueado tras buzz y para no-host; acierto tras replay aplica 0.5
- [x] 5.3 Prueba multi-pestaña: host repite (suena de nuevo), aparece "Repetida", y al acertar los puntos van a la mitad — confirmado por el usuario
