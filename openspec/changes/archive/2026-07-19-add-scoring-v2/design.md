## Context

Cambio pequeño y de fundación. El motor de puntuación (`lib/game/scoring.ts`) es una función
pura ya testeada; aquí se sube el base de `simple` y se añade un modificador para que replay
(B) y gamificación (F) puedan aplicar penalizaciones/boosts sin tocar el motor de nuevo.

## Goals / Non-Goals

**Goals:**

- `simple` → 10 puntos base (antes 1).
- `computeAward` acepta `modifier` multiplicativo (default 1).
- Cobertura unitaria del nuevo base y del modificador.

**Non-Goals:**

- Usar el modificador todavía (lo hará `add-replay`). Aquí el juicio pasa `modifier = 1`.
- Hacer el base configurable por sesión (constante por ahora; se puede exponer luego).

## Decisions

**1. `BASE_SIMPLE = 10` como constante.** Suficiente para medios puntos y penalizaciones sin
fracciones raras; no hace falta exponerlo en `config` todavía. Alternativa: campo en
`SessionConfig` — pospuesto para no inflar la UI ahora.

**2. `modifier` multiplicativo antes de extras.**
`award = round(base(mode) × modifier) + extras`, con `base(simple) = 10` y
`base(speed) = round(BASE × difficultyMultiplier × speedFactor)`. `modifier` default 1.
Penalización = `< 1`, boost = `> 1`. Aplica a ambos modos de forma uniforme.

**3. Sin migración.** Los puntos ya son enteros en `judgements.awarded_points` y
`players.score`; solo cambia el valor calculado.

## Risks / Trade-offs

- **[Cambio de balance percibido]** → partidas en `simple` ahora suman de 10 en 10; es el
  comportamiento deseado y esperado por el usuario.
- **[Redondeo con modificador]** → se redondea el producto `base × modifier` antes de extras;
  documentado y cubierto por prueba.

## Migration Plan

1. `scoring.ts`: `BASE_SIMPLE = 10`; añadir `modifier` a `AwardInput` y aplicarlo.
2. `judge` endpoint: pasar `modifier: 1` explícito.
3. Actualizar `scoring.test.ts` (base 10, modificador, default sin cambio).
4. `typecheck`, `lint`, `test`, `build`.
