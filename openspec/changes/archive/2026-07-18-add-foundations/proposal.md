## Why

Guess the Song necesita una base técnica desacoplada antes de construir cualquier
funcionalidad jugable. Establecer ahora las interfaces (`GameTransport`, `MusicProvider`),
el esquema de datos y las fronteras de visibilidad evita acoplarnos a Supabase/YouTube y
garantiza que las reglas anti-trampa sean estructurales, no un parche posterior.

## What Changes

- Se crea el proyecto **Next.js (App Router) + TypeScript** con rutas base `/host` y
  `/play` (placeholders) y la configuración de calidad (lint/format).
- Se enlaza un proyecto **Supabase** (local + remoto) con variables de entorno y se
  definen las **migraciones del esquema** (`playlists`, `tracks`, `sessions`, `players`,
  `rounds`, `buzzes`, `judgements`).
- Se establece la **RLS base** y la convención de **canales Realtime** (público de sesión
  vs privado del host) que sostiene las reglas anti-trampa.
- Se define la interfaz **`GameTransport`** (contrato de acciones/eventos con
  destinatarios) e implementación **esqueleto `SupabaseTransport`** (stubs que compilan).
- Se define la interfaz **`MusicProvider`** (sin implementación real todavía).
- Se agrega una **semilla mínima**: 1 playlist curada con ~10 tracks para pruebas.

## Capabilities

### New Capabilities
- `game-transport`: contrato único de comunicación entre la lógica del juego y el backend
  (acciones, eventos, destinatarios y regla de encapsulación del SDK); incluye las
  fronteras de visibilidad de datos (qué evento llega a jugadores vs solo al host).
- `music-provider`: contrato de la capa de reproducción de música que abstrae al proveedor
  (YouTube/Spotify) tras una interfaz común.
- `game-data`: modelo de persistencia del juego — entidades, relaciones y RLS base que
  hacen cumplir las fronteras de acceso (buzz sellado en servidor, juicio solo del host).

### Modified Capabilities
<!-- Ninguna: es el primer change, no hay specs previos. -->

## Impact

- **Nuevo repo/app:** proyecto Next.js + TypeScript desde cero.
- **Dependencias:** `next`, `react`, `@supabase/supabase-js`; tooling de lint/format;
  CLI de Supabase para migraciones.
- **Infraestructura:** proyecto Supabase (Postgres + Realtime + Auth), free tier.
- **Contratos:** interfaces `GameTransport` y `MusicProvider` que consumirán todas las
  fases posteriores (Lobby, Ronda/Buzzer, Juicio/Scoring, Cierre).
- **Sin funcionalidad jugable todavía:** este change no entrega flujo de juego, solo la
  base sobre la que se implementará.
