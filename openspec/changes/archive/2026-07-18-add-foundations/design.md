## Context

Guess the Song es un juego de fiesta web (Next.js) con modelo host + jugadores: el host
reproduce música y valida respuestas; los jugadores compiten con un buzzer desde el
navegador. El backend elegido es Supabase (Realtime + Postgres + Auth), pero la lógica del
juego no debe acoplarse a él. Este change entrega solo la base: proyecto, esquema,
interfaces y encapsulación. No hay flujo jugable todavía.

Documentos de referencia: [proposal](./proposal.md), [spec base](../../../docs/base-spec.md),
[modelo de datos](../../../docs/data-model.md), [roadmap](../../../docs/roadmap.md).

## Goals / Non-Goals

**Goals:**

- Levantar Next.js (App Router) + TypeScript con rutas `/host` y `/play` (placeholders).
- Enlazar Supabase y definir migraciones para las 7 tablas del modelo de datos.
- RLS base y convención de canales Realtime (público de sesión / privado del host).
- Interfaces `GameTransport` y `MusicProvider` con `SupabaseTransport` como esqueleto que
  compila; ningún SDK de proveedor fuera de su implementación.
- Semilla mínima: 1 playlist curada con ~10 tracks.

**Non-Goals:**

- Lógica de juego (lobby, ronda, buzzer, juicio, scoring, podio) — fases posteriores.
- Implementación real de `MusicProvider` (YouTube) — Fase 3.
- Autenticación de usuarios con cuentas; el join es anónimo por código.
- Definir valores finales de scoring.

## Decisions

**1. Abstracción `GameTransport` desde el día 1 (en vez de usar `@supabase/*` directo).**
La lógica del juego y los componentes dependen de una interfaz; el SDK vive solo en
`SupabaseTransport`. Alternativa considerada: usar Supabase directo por velocidad —
descartada porque acopla todo el front al proveedor y contradice la decisión #5 del spec
base (poder cambiar el backend sin reescribir el juego).

**2. Abstracción `MusicProvider` análoga.** Misma razón: permitir Spotify u otros
proveedores después sin tocar la lógica. En foundations solo se define la interfaz.

**3. El servidor es la autoridad de datos sensibles y de tiempo.** Se establece la
convención de dos canales Realtime (público de sesión, privado de host) y RLS base para
que las fronteras anti-trampa sean estructurales. Alternativa: filtrar en el cliente —
descartada por insegura. Nota: la *ejecución* del sellado de buzz y del juicio pertenece a
fases posteriores; aquí se deja la base (canales + RLS + `host_player_id`).

**4. Migraciones versionadas con la CLI de Supabase.** Esquema como código (migraciones +
seed) para reproducibilidad local/remota. Alternativa: crear tablas a mano en el panel —
descartada por no ser reproducible.

**5. `players.score` denormalizado, `judgements` como fuente de verdad.** Se decide en el
modelo; foundations solo crea las tablas y la relación, sin lógica de cálculo.

## Risks / Trade-offs

- **[Sobre-abstracción temprana]** → Mantener las interfaces mínimas y guiadas por el
  contrato del modelo de datos; no añadir métodos especulativos.
- **[Free tier de Supabase limita conexiones/tiempo]** → Aceptable para MVP; el desacople
  permite migrar backend después sin reescribir el juego.
- **[Stubs que compilan pero no hacen nada]** → Marcar claramente los métodos como stub y
  cubrir su contrato con los specs; las fases siguientes los implementan contra el spec.
- **[Deriva entre el modelo de datos (docs) y las migraciones]** → Las migraciones son la
  fuente de verdad ejecutable; mantener `docs/data-model.md` sincronizado al cerrar el
  change.

## Migration Plan

1. Crear proyecto Supabase (remoto) y entorno local con la CLI.
2. Escribir migraciones para las 7 tablas + RLS base + políticas mínimas.
3. Escribir seed con 1 playlist y ~10 tracks.
4. Aplicar migraciones en local, verificar, luego en remoto.
5. Rollback: las migraciones son reversibles; al ser proyecto nuevo, el riesgo es bajo
   (se puede resetear la base sin pérdida de datos reales).

## Open Questions

- ¿Los tracks de la playlist semilla se cargan por seed SQL o por un pequeño script? (No
  bloquea; decidir al implementar.)
- ¿Estructura de carpetas del front para transports/providers? (Propuesta: `lib/transport/`
  y `lib/music/`; confirmar convención al scaffolding.)
