## 1. Motor de puntuación

- [x] 1.1 `lib/game/scoring.ts`: `BASE_SIMPLE = 10`; `simple` devuelve 10 (antes 1)
- [x] 1.2 Añadir `modifier?: number` a `AwardInput` (default 1) y aplicarlo: `round(base × modifier) + extras`

## 2. Endpoint de juicio

- [x] 2.1 `app/api/rounds/[id]/judge/route.ts`: pasar `modifier: 1` a `computeAward` (sin cambio funcional aún)

## 3. Pruebas

- [x] 3.1 `lib/game/scoring.test.ts`: `simple` → 10; modifier default no cambia; modifier 0.5 reduce a la mitad; boost > 1 aumenta

## 4. Verificación

- [x] 4.1 `typecheck`, `lint`, `test`, `build` en verde
