## 1. Migración de datos

- [x] 1.1 Migración: `alter table players add column reconnect_token text` (default aleatorio server-side)
- [x] 1.2 Migración: índice único `unique (session_id, lower(trim(display_name)))` para nombres únicos por sesión
- [x] 1.3 Aplicar con `supabase db reset` local y verificar columna e índice

## 2. Infraestructura de servidor

- [x] 2.1 Cliente Supabase server-only con service role en `lib/transport/server/supabase-admin.ts` (nunca `NEXT_PUBLIC_`)
- [x] 2.2 Utilidad de generación de código: alfabeto sin ambiguos, longitud 5, con reintento ante colisión
- [x] 2.3 Cliente Supabase browser (anon) para Realtime en `lib/transport/browser-client.ts`

## 3. Endpoints de mutación (Route Handlers)

- [x] 3.1 `POST /api/sessions` — crea sesión + host player; devuelve `{ sessionId, sessionCode, hostPlayerId, reconnectToken }`
- [x] 3.2 `POST /api/sessions/join` — valida código, estado `lobby` y **nombre único**; crea player; rechaza inválido/no-lobby/nombre tomado
- [x] 3.3 `POST /api/sessions/leave` — verifica token y elimina al jugador; dispara notificación a los demás
- [x] 3.4 `POST /api/sessions/reconnect` — valida `playerId` + `reconnectToken` y readmite sin duplicar
- [x] 3.5 Tope de jugadores por sesión (default 20) aplicado en join

## 4. Implementación de SupabaseTransport

- [x] 4.1 `createSession` / `joinSession` / `resume` / `leave` llaman a los Route Handlers (no escriben directo)
- [x] 4.2 Suscripción al canal Realtime de la sesión; emitir `player_joined` / `player_left` / `session_updated`
- [x] 4.3 Presencia con Realtime Presence keyed por `playerId`; emitir `presence_updated`; `presence()` devuelve online ids
- [x] 4.4 `disconnect()` limpia suscripciones y presencia

## 5. UI del host (`/host`)

- [x] 5.1 Formulario de creación: elegir playlist (del seed) + dificultad (`audioWindowMs`) + nº de rondas
- [x] 5.2 Sala de espera: mostrar **código en grande** (para entrada manual) + QR que apunta a `/play?code=XXXX`
- [x] 5.3 Lista de participantes en vivo con estado online/offline (host marcado como presentador)

## 6. UI del jugador (`/play`)

- [x] 6.1 Formulario de unión en `/play`: entrada manual de código (prellenado si viene por `?code=`, editable) + nombre
- [x] 6.2 Manejo de errores: código inválido, sesión ya iniciada/terminada, nombre ya tomado
- [x] 6.3 Sala de espera del jugador con lista de participantes en vivo

## 7. Reconexión

- [x] 7.1 Guardar `{ sessionId, playerId, reconnectToken, ... }` en `sessionStorage` (por pestaña) al crear/unirse
- [x] 7.2 Al cargar, si hay identidad para una sesión activa, reingresar como el mismo jugador (sin duplicar)

## 8. Verificación

- [x] 8.1 `supabase db reset` aplica migraciones + seed sin error
- [x] 8.2 Prueba realtime multi-pestaña: host + 2 jugadores se ven en vivo (roster). Presencia e INSERT verificados por script; leave/reconnect por API
- [x] 8.3 Prueba negativa (servidor): código inexistente, sesión no-lobby, nombre duplicado (caso/espacios) — todos rechazados
- [x] 8.4 `typecheck`, `lint` y `build` en verde
