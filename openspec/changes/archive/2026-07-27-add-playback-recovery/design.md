## Context

Medición sobre una playlist pública real (50 entradas) antes de diseñar nada:

| Hipótesis | Resultado |
|---|---|
| Videos borrados/privados | 4 de 50 — **ya los filtra el import**, no son la causa |
| Embebido deshabilitado | 0 de 46 |
| Bloqueo por región (MX) | **1 de 46** ← causa real de fallo duro |
| Videos largos (concierto) | 0 > 10 min |

Conclusión: los fallos duros existen pero son raros, y **no explican todos los casos**. El resto
es un fragmento que suena pero no sirve. Son dos problemas y se resuelven distinto.

## Decisions

**1. Un fallo duro no consume ronda.** Se cambia `rounds.game_track_id` en la misma fila en vez
de resolver la ronda y abrir otra. Los jugadores no pierden una ronda por un video roto, y el
`round_number` no se mueve. Para el host es transparente: el transporte re-emite
`round_host_payload` y el dispositivo simplemente toca lo que le den.

**2. La pista mala se marca (`unplayable`), no se borra.** Borrarla desordenaría `position` y
perdería el registro. Con el flag basta para excluirla de futuros sorteos del juego.

**3. El re-fragmento NO toca `replay_count`.** La penalización cuelga de ese contador, así que no
incrementarlo es literalmente "sin penalización". No hace falta un flag nuevo.

**4. Las dos acciones reinician `started_at`.** Es lo menos obvio del cambio. La velocidad se
calcula como `buzz.server_ts - round.started_at`; si el host descarta un fragmento a los 15 s de
ronda, quien acierte 1 s después del fragmento nuevo puntuaría como si hubiera tardado 16 s. Al
reiniciar el reloj, la velocidad se mide contra el audio que los jugadores oyeron de verdad.
*(El replay penalizado existente no reinicia el reloj, pero ahí está compensado a propósito por
el factor de penalización.)*

**5. El re-fragmento necesita servidor solo por el reloj.** El audio suena en el dispositivo del
host, así que reproducir otro fragmento es puramente local. La única razón de la llamada es
`started_at`. Sin esa decisión, el endpoint sobraría.

**6. Tope de 3 cambios seguidos.** Sin tope, una playlist regional entera giraría marcando pistas
hasta agotarlas. El contador se reinicia en cada ronda nueva.

## Risks / Trade-offs

- **[El host se salta canciones difíciles]** → el botón es discrecional y puede usarse para
  descartar fragmentos que sí valían. Es aceptable: el host ya es el juez del juego.
- **[Ventaja de información]** → el host oye dos fragmentos y los jugadores uno. No importa: el
  host ya conoce la respuesta.
- **[Silencio sigue sin detectarse solo]** → no hay forma de distinguir silencio de música desde
  el IFrame; por eso es un botón y no algo automático.
