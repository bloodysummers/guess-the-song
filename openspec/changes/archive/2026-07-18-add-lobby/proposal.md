## Why

Sin lobby no hay partida: es el primer flujo jugable. El host debe poder crear una sesión
y compartir un código para que los jugadores entren desde su navegador sin instalar nada,
y todos deben verse conectados en tiempo real antes de empezar. Aquí `SupabaseTransport`
deja de ser esqueleto y empieza a implementar comunicación real.

## What Changes

- **Crear sesión (host):** el host elige una playlist y la configuración de dificultad
  (`config`), y obtiene un **código de unión** corto y único, más un **QR** para compartir.
- **Unirse (jugador):** un jugador entra con el código y un nombre visible, sin cuenta.
  Manejo de código inválido/inexistente y de sesión ya iniciada.
- **Identidad reconectable:** al unirse/crear, el cliente recibe un identificador de jugador
  y un token ligero que persiste localmente para **reconectar** sin perder su lugar.
- **Sala de espera:** vistas de host y de jugador en estado `lobby` con la lista de
  participantes que se actualiza en vivo.
- **Presencia en vivo:** los participantes ven quién está conectado (join/leave) usando
  Supabase Realtime Presence.
- **Implementación de transporte:** `createSession`, `joinSession`, `leave`, `presence` y
  los eventos `player_joined` / `player_left` / `presence_updated` / `session_updated`
  dejan de ser stubs.

## Capabilities

### New Capabilities
- `session-lobby`: creación de sesión con código/QR, unión por código con nombre,
  identidad reconectable, reglas de acceso (sesión en `lobby`) y sala de espera.
- `session-presence`: estado de conexión en vivo de los participantes (quién está online)
  y su difusión a la sesión.

### Modified Capabilities
<!-- Ninguna. game-transport ya definió el contrato en add-foundations; aquí se implementa
     su comportamiento, no se cambian sus requisitos. -->

## Impact

- **`SupabaseTransport`:** primeras implementaciones reales (create/join/leave/presence +
  suscripción a canales Realtime de la sesión).
- **Backend/datos:** uso de las tablas `sessions` y `players`; generación de `code` único;
  escrituras autoritativas (crear sesión/jugador) del lado servidor (server action / RPC con
  service role), no directo desde el cliente anon.
- **Frontend:** vistas `/host` y `/play` dejan de ser placeholders para el flujo de lobby;
  dependencia de una librería de QR.
- **Identidad:** almacenamiento local de un token de jugador para reconexión (sin cuentas).
- **Depende de:** `add-foundations` (esquema, RLS, interfaces).
