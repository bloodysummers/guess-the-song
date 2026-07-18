## Context

Con Fundaciones lista (esquema, RLS, interfaces), el lobby es el primer flujo jugable y la
primera implementación real de `SupabaseTransport`. Una restricción heredada define la
arquitectura: por la RLS, el rol `anon` **no puede escribir** en `sessions`/`players`
(lo verificamos: insertar es rechazado). Por tanto, todas las mutaciones del lobby deben
ejecutarse **del lado servidor** con la service role, mientras que las lecturas y la
presencia van por el cliente anon (Realtime).

Referencias: [proposal](./proposal.md), [data-model](../../../docs/data-model.md) §2/§4/§5.

## Goals / Non-Goals

**Goals:**

- Crear sesión (host) con código único + QR y configuración de dificultad.
- Unirse (jugador) por código con nombre, sin cuenta; rechazo de códigos inválidos o de
  sesiones no en `lobby`.
- Identidad reconectable (token local verificado en servidor).
- Sala de espera con lista de participantes y **presencia** en vivo (join/leave/online).
- Implementar en `SupabaseTransport`: `createSession`, `joinSession`, `leave`, `presence`
  y la emisión de `player_joined` / `player_left` / `presence_updated` / `session_updated`.

**Non-Goals:**

- Rondas, buzzer, música, juicio y scoring (fases posteriores).
- Unión tardía a mitad de partida.
- Cuentas de usuario / login.
- Despliegue remoto (sigue en local; ver change `add-remote-deploy`).

## Decisions

**1. Mutaciones vía endpoints de servidor (service role), no desde el cliente.**
`createSession` / `joinSession` / `leave` en `SupabaseTransport` llaman a Route Handlers de
Next.js (`app/api/...`) que usan un cliente Supabase server-only con `SUPABASE_SERVICE_ROLE_KEY`.
El cliente anon nunca escribe. Alternativa: relajar RLS para permitir inserts anon —
descartada por inseguro (rompería la autoridad del servidor y el modelo anti-trampa).

**2. Lecturas y presencia por el cliente anon (Realtime).** La sala de espera se suscribe a
un canal Realtime por sesión; la lista de participantes se lee de `players` (anon SELECT ya
permitido) y el online/offline se deriva de **Supabase Realtime Presence**. La abstracción
`GameTransport` oculta esta mezcla (HTTP para escribir, WS para leer).

**3. Código de unión corto y único, con entrada manual como camino primario.** Generado en
el servidor con un alfabeto sin caracteres ambiguos (sin `0/O`, `1/I/L`), longitud 5; se
reintenta ante colisión apoyándose en el `unique` de `sessions.code`. El **código se muestra
en grande** en la sala del host. La página `/play` **siempre** ofrece un formulario de
entrada manual (teclear código + nombre); el **QR es solo un atajo** que codifica
`/play?code=XXXX` para pre-rellenar el código en un teléfono. Sin QR no se pierde ninguna
funcionalidad.

> **Workaround para pruebas locales:** abrir varias pestañas/ventanas en
> `http://localhost:3000/play`, teclear el mismo código y distintos nombres. Permite simular
> múltiples jugadores en una máquina sin escanear nada.

**4. Identidad reconectable con token verificado.** Se añade la columna
`players.reconnect_token` (migración de este change). Al unirse/crear, el servidor devuelve
`playerId` + `reconnectToken`; el cliente los guarda en `localStorage`. Al reconectar, el
servidor valida que el token corresponde al `playerId` antes de readmitirlo (evita
suplantación, ya que `players` es legible públicamente). Alternativa: usar solo `playerId`
de `localStorage` — descartada porque cualquiera puede leer ids ajenos y suplantar.

**5. Presencia keyed por `playerId`.** El canal de presencia se rastrea con el `playerId`
como clave, de modo que un reload/reconexión no genere participantes duplicados.

**6. Nombres únicos por sesión.** El nombre visible debe ser único dentro de la sesión
(comparación case-insensitive, con trim), incluyendo el del host. Se valida en el servidor
al unirse y se refuerza con un índice único en base de datos —`unique (session_id,
lower(trim(display_name)))`— para evitar carreras entre joins simultáneos. Motivo: con
nombres repetidos el host no sabría a quién adjudicar. Alternativa: desambiguar
automáticamente (Ana, Ana 2) — descartada por confundir igual en voz alta.

## Risks / Trade-offs

- **[Colisión de código]** → `unique` en `sessions.code` + reintento server-side con backoff
  corto; alfabeto amplio hace la colisión rara.
- **[Fugas de la service role]** → vive solo en Route Handlers (server); nunca `NEXT_PUBLIC_`.
- **[Suplantación por `localStorage`]** → `reconnect_token` verificado en servidor.
- **[Presencia poco fiable / duplicados]** → clave por `playerId`; la lista "verdad" son las
  filas de `players`, la presencia solo marca online/offline.
- **[Sesiones huérfanas]** → fuera de alcance limpiarlas aquí; anotar para un change de
  mantenimiento (TTL/cron) más adelante.

## Migration Plan

1. Migración: `alter table players add column reconnect_token`.
2. Cliente Supabase server-only (service role) en `lib/transport/server/`.
3. Route Handlers para create/join/leave; generación de código; validaciones.
4. Implementar métodos reales en `SupabaseTransport` + suscripción Realtime + presencia.
5. UI de `/host` (crear + sala de espera + QR) y `/play` (unirse + sala de espera).
6. Verificar con `db reset` local y prueba manual multi-navegador.

## Open Questions

- **Longitud/alfabeto del código:** propuesto 5 chars sin ambiguos. ¿Preferencia?
- **Máximo de jugadores por sesión:** default 20. ¿Ajustar?
- **Reingreso tras `leave`:** ¿puede volver a entrar con el mismo nombre/código?
