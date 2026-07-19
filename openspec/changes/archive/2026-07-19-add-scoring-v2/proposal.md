## Why

El modo `simple` da 1 punto por canción — un entero sin margen para penalizaciones ni
boosts. Subir el base a 10 puntos y añadir un **modificador** al motor de puntuación crea la
fundación para el replay (segunda oportunidad con penalización) y la gamificación estilo
juego de mesa (boosts, bonificaciones). Cambio pequeño que desbloquea las épicas B y F.

## What Changes

- **Modo `simple` = base 10 puntos** por canción adivinada (antes 1). Sigue ignorando
  velocidad y dificultad.
- **Modificador en el motor:** `computeAward` acepta un `modifier` multiplicativo
  (default 1). Penalizaciones (`< 1`, p. ej. 0.5 = medio) y boosts (`> 1`) se expresan así,
  para ambos modos. Sin cambios de comportamiento hasta que un feature lo use.
- Las pruebas unitarias del motor cubren el nuevo base y el modificador.

## Capabilities

### New Capabilities
<!-- Ninguna nueva. -->

### Modified Capabilities
- `scoring`: el modo `simple` pasa de 1 punto a un base de 10; el cálculo admite un
  modificador multiplicativo (penalización/boost).

## Impact

- **`lib/game/scoring.ts`:** `BASE_SIMPLE = 10`; `computeAward({ ..., modifier })`.
- **`app/api/rounds/[id]/judge/route.ts`:** pasa `modifier = 1` (sin cambio funcional aún).
- **Pruebas:** `lib/game/scoring.test.ts` actualizado.
- **Sin migración de esquema** (los puntos ya son enteros en `judgements`/`players`).
- **Depende de:** `add-judging-scoring`. Desbloquea: `add-replay` (B) y `add-game-mechanics` (F).
