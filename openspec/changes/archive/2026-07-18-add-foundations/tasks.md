## 1. Andamiaje del proyecto

- [x] 1.1 Inicializar proyecto Next.js (App Router) + TypeScript en la raíz del repo
- [x] 1.2 Configurar ESLint + Prettier (o Biome) y scripts de `lint`/`format`/`typecheck`
- [x] 1.3 Definir estructura de carpetas: `app/`, `lib/transport/`, `lib/music/`, `lib/game/`, `supabase/`
- [x] 1.4 Crear rutas placeholder `app/host/page.tsx` y `app/play/page.tsx`
- [x] 1.5 Crear `.env.example` con variables de Supabase y documentar en README

## 2. Supabase y esquema de datos

- [x] 2.1 Instalar y configurar la CLI de Supabase; iniciar entorno local (`supabase init` + `start`)
- [ ] 2.2 Crear proyecto Supabase remoto y enlazarlo; cargar variables — DIFERIDO al step de despliegue remoto (ver roadmap)
- [x] 2.3 Migración: tabla `playlists`
- [x] 2.4 Migración: tabla `tracks`
- [x] 2.5 Migración: tabla `sessions`
- [x] 2.6 Migración: tabla `players`
- [x] 2.7 Migración: tabla `rounds`
- [x] 2.8 Migración: tabla `buzzes` (unique(round,player), server_ts sellado)
- [x] 2.9 Migración: tabla `judgements`
- [x] 2.10 Verificar que las migraciones aplican en una base limpia y las FKs se enforcean — aplicado local vía `db reset`

## 3. RLS y convención de tiempo real

- [x] 3.1 Habilitar RLS en `sessions`, `players`, `rounds`, `buzzes`, `judgements`
- [x] 3.2 Política: escritura en `judgements` restringida al host/servicio (no-anon)
- [x] 3.3 Documentar la convención de canales Realtime: público de sesión vs privado de host
- [x] 3.4 Prueba: un no-host es rechazado al insertar en `judgements` — verificado vía API local (401), con controles de lectura permitida y `tracks` bloqueada

## 4. Semilla de datos

- [x] 4.1 Crear seed con 1 playlist curada y ≥10 tracks (con answer_title y answer_artist)
- [x] 4.2 Verificar que el seed corre y deja una playlist jugable — aplicado local vía `db reset`

## 5. Interfaz GameTransport

- [x] 5.1 Definir la interfaz `GameTransport` con acciones tipadas
- [x] 5.2 Definir `on`/`off` y tipos de eventos, marcando los host-only (`HOST_ONLY_EVENTS`)
- [x] 5.3 Garantizar en tipos que `round_started` (jugador) no incluye track ref ni answer, y `round_host_payload` sí
- [x] 5.4 Implementar `SupabaseTransport` como esqueleto (stubs + emisor de eventos) que compila
- [x] 5.5 Verificar que ningún import de `@supabase/*` existe fuera de `lib/transport/`

## 6. Interfaz MusicProvider

- [x] 6.1 Definir la interfaz `MusicProvider`: `play`, `stop`, `search` con firmas tipadas
- [x] 6.2 Verificar que compila sin implementación concreta y sin SDKs de música en lógica/UI

## 7. Verificación del change

- [x] 7.1 `typecheck` y `lint` pasan sin errores
- [x] 7.2 La app arranca y conecta a Supabase local; `/host` y `/play` renderizan
- [x] 7.3 `openspec validate add-foundations` pasa
