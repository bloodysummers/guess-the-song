## Why

El MVP casi está: se crea sala, se juega, se juzga y se puntúa — pero la partida nunca
termina "sola". El campo "número de rondas" no hace nada y quedarse sin canciones lanza un
error genérico. Falta cerrar el ciclo: terminar tras N rondas o al agotar la playlist, y
mostrar un podio con el ganador.

## What Changes

- **Fin por número de rondas:** la partida termina cuando se han jugado las `roundsTotal`
  rondas configuradas.
- **Fin por playlist agotada:** si se acaban las canciones antes de llegar a N, la partida
  también termina — como cierre natural, no como error.
- **Estado `finished` + podio:** al terminar, `sessions.status → finished` y todos (host y
  jugadores) ven el ranking de jugadores por puntaje.
- **Progreso de ronda:** "Ronda X de N" visible durante el juego, para que el número tenga
  sentido.
- **Jugar de nuevo:** el host puede reiniciar la partida con los mismos jugadores (marcador
  a cero, se limpian rondas/buzzes/juicios, vuelta a `lobby`).
- **Implementación de transporte:** `endGame` deja de ser stub; nuevo evento `game_ended`
  con el podio; `session_updated` inicial para exponer `roundsTotal`.

## Capabilities

### New Capabilities
- `endgame`: condiciones de fin (N rondas o playlist agotada), estado `finished`, podio,
  jugar de nuevo, y progreso de ronda hacia el total.

### Modified Capabilities
- `round-lifecycle`: la "playlist agotada" deja de ser un error de inicio de ronda y pasa a
  ser un disparador de fin de partida (comportamiento a nivel de requisito).

## Impact

- **Backend/datos:** el endpoint de inicio de ronda decide fin de partida (N rondas o sin
  pistas) y marca `sessions.status = finished`; nuevo endpoint de "jugar de nuevo" (reset).
- **`SupabaseTransport`:** `endGame` real; en `session_updated` con `finished` construye y
  emite `game_ended` (podio); `session_updated` inicial en el subscribe para `roundsTotal`.
- **Frontend:** `/host` y `/play` muestran progreso "Ronda X de N", pantalla de **podio** al
  terminar, y el host ve el botón "Jugar de nuevo".
- **Depende de:** `add-judging-scoring` (puntajes) y `add-round-buzzer` (rondas). Cierra el
  MVP.
