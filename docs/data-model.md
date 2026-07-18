# Guess the Song — Modelo de datos, estados y contrato de transporte

> Expande §8 del [spec base](./base-spec.md). Define las entidades, la máquina de estados
> del juego, el contrato de `GameTransport` y las reglas de visibilidad (anti-trampa).
> Es un documento de diseño: los tipos y campos son la base a refinar en OpenSpec, no el
> esquema final de producción.

---

## 1. Entidades (visión general)

```
Playlist 1───* Track
Session *───1 Playlist
Session 1───* Player          (uno de ellos is_host = true → presentador/juez, no puntúa)
Session 1───* Round
Round   1───1 Track           (la pista sonando en esa ronda)
Round   1───* Buzz            (un buzz por jugador por ronda)
Round   1───* Judgement       (juicios del host sobre cada intento)
Player  1───* Buzz
Player  1───* Judgement
```

Principios:
- El **host** es un `Player` con `is_host = true`; **no** buzzea ni acumula puntaje.
- El puntaje "verdad" se deriva de `judgements`; `players.score` es denormalización cache.
- El **orden del buzzer es autoritativo del servidor** (timestamp sellado server-side),
  nunca del reloj del cliente.

---

## 2. Esquema (Supabase / Postgres)

> Notación abreviada. `pk` = primary key, `fk` = foreign key. Tipos orientativos.

### `playlists`
| col | tipo | notas |
|---|---|---|
| id | uuid pk | |
| name | text | "Rock 80s", "Pop en Español", … |
| description | text | |
| theme | text | género/época/mood |
| cover_url | text | opcional |
| is_predefined | bool | curadas del sistema vs importadas por host (futuro) |
| created_at | timestamptz | |

### `tracks`
| col | tipo | notas |
|---|---|---|
| id | uuid pk | |
| playlist_id | uuid fk → playlists | |
| provider | text enum | `youtube` (MVP) \| `spotify` (futuro) |
| provider_ref | text | id de video de YouTube |
| answer_title | text | título canónico |
| answer_artist | text | artista canónico |
| answer_aliases | text[] | alternativas aceptadas (para referencia del juez) |
| year | int | para bonus opcional |
| album | text | opcional, para bonus opcional |
| default_start_ms | int | dónde arranca el "gancho" de la canción |

### `sessions`
| col | tipo | notas |
|---|---|---|
| id | uuid pk | |
| code | text unique | código corto de unión (4–6 chars) |
| playlist_id | uuid fk → playlists | |
| host_player_id | uuid fk → players | el presentador/juez |
| status | text enum | `lobby` \| `active` \| `finished` |
| config | jsonb | ver §2.1 |
| current_round_id | uuid fk → rounds | nullable |
| rounds_total | int | nº de rondas de la partida |
| created_at | timestamptz | |

#### 2.1 `sessions.config` (jsonb)
```jsonc
{
  "scoringMode": "simple",      // "simple" (1 punto por canción) | "speed" (base × dificultad × velocidad)
  "audioWindowMs": 5000,        // dificultad: 15000 / 10000 / 5000 / 3000 / 1000
  "allowSteal": true,           // si el 2º+ más rápido puede responder tras un fallo
  "wrongBuzzPenalty": 0,        // puntos que se restan por buzzear y fallar (0 = sin penalización)
  "extraPoints": {              // bonus opcionales que el host puede conceder (solo en "speed")
    "artist": false,
    "album": false,
    "year": false
  }
}
```

### `players`
| col | tipo | notas |
|---|---|---|
| id | uuid pk | |
| session_id | uuid fk → sessions | |
| display_name | text | |
| is_host | bool | true = presentador/juez (no buzzea, no puntúa) |
| score | int | denormalización del total (fuente: `judgements`) |
| joined_at | timestamptz | |
| (presencia/online) | — | vía Supabase Realtime Presence, **no** se persiste |

### `rounds`
| col | tipo | notas |
|---|---|---|
| id | uuid pk | |
| session_id | uuid fk → sessions | |
| round_number | int | |
| track_id | uuid fk → tracks | pista seleccionada (aleatoria, sin repetir) |
| audio_window_ms | int | snapshot de dificultad de esta ronda |
| phase | text enum | `playing` \| `answering` \| `resolved` |
| current_answerer_id | uuid fk → players | de quién es el turno de responder (nullable) |
| resolution | text enum | `correct` \| `exhausted` \| `timeout` \| `skipped` (nullable hasta resolver) |
| winner_player_id | uuid fk → players | nullable |
| started_at | timestamptz | |
| ended_at | timestamptz | nullable |

### `buzzes`
| col | tipo | notas |
|---|---|---|
| id | uuid pk | |
| round_id | uuid fk → rounds | |
| player_id | uuid fk → players | |
| server_ts | timestamptz | **sellado en servidor** (default `now()` / Edge Function) |
| rank | int | orden calculado por `server_ts` dentro de la ronda |
| — | — | unique(round_id, player_id): un buzz por jugador por ronda |

### `judgements`
| col | tipo | notas |
|---|---|---|
| id | uuid pk | |
| round_id | uuid fk → rounds | |
| player_id | uuid fk → players | quién respondió |
| verdict | text enum | `correct` \| `incorrect` |
| awarded_points | int | 0 si incorrecto |
| bonus_flags | jsonb | `{ "artist": true, "year": false }` — extras concedidos |
| judged_at | timestamptz | |

---

## 3. Máquina de estados

### Nivel sesión
```
LOBBY  ──(host: start_round)──►  ACTIVE  ──(host: end_game / last round)──►  FINISHED
                                   ▲  │
                                   └──┘  (loop de rondas)
```

### Nivel ronda (`rounds.phase`)
```
                 host: start_round
   (nace) ───────────────────────►  PLAYING
                                       │  primer buzz  → música se pausa,
                                       │               current_answerer = rank 1
                                       ▼
                                   ANSWERING ──────────────────────────────┐
                                       │                                    │
              host: judge(correct)     │      host: judge(incorrect)        │
                                       │      y quedan buzzers en cola      │
                                       ▼      (allowSteal) → siguiente rank │
                                   RESOLVED ◄─────────────────────────────  │
                                    (correct)                               │
                                       ▲                                    │
             cola agotada / timeout ───┴──── RESOLVED (exhausted|timeout) ◄─┘
```

Notas:
- En `PLAYING`, si nadie buzzea y se agota `audio_window_ms` + un margen → `timeout`.
- En `ANSWERING`, si `judge(incorrect)` y no quedan buzzers en cola (o `allowSteal=false`)
  → `RESOLVED (exhausted)`.
- Al pasar a `RESOLVED` se **revela la respuesta a los jugadores** (nunca antes).

---

## 4. Contrato de `GameTransport`

Interfaz única con la que habla la lógica del juego. El SDK de Supabase vive **solo**
dentro de `SupabaseTransport`.

### 4.1 Acciones cliente → servidor (`emit`)

| Acción | Emisor | Payload | Devuelve |
|---|---|---|---|
| `create_session` | Host | `{ hostName, playlistId, config }` | `{ sessionId, sessionCode, hostPlayerId }` |
| `join_session` | Player | `{ code, displayName }` | `{ sessionId, playerId }` |
| `start_round` | Host | `{ }` | `{ roundId }` |
| `buzz` | Player | `{ roundId }` | `{ ok }` (el `server_ts` lo sella el servidor) |
| `judge` | Host | `{ roundId, playerId, verdict, bonusFlags? }` | `{ ok }` |
| `next_round` | Host | `{ }` | `{ roundId }` |
| `end_game` | Host | `{ }` | `{ ok }` |
| `leave` | Cualquiera | `{ }` | `{ ok }` |

### 4.2 Eventos servidor → cliente (`on` / `off`)

| Evento | Destinatarios | Payload |
|---|---|---|
| `session_updated` | Todos | `{ status, config, roundsTotal, currentRoundNumber }` |
| `player_joined` | Todos | `{ player: { id, displayName } }` |
| `player_left` | Todos | `{ playerId }` |
| `presence_updated` | Todos | `{ onlinePlayerIds: [] }` |
| `round_started` | **Jugadores** | `{ roundId, roundNumber, audioWindowMs, buzzEnabled: true }` — **sin** datos de la pista |
| `round_host_payload` | **Solo host** | `{ roundId, track: { provider, providerRef, startMs, audioWindowMs }, answer: { title, artist, aliases, year, album } }` |
| `music_control` | **Solo host** | `{ action: 'play' \| 'stop', atMs }` (el host reproduce vía `MusicProvider`) |
| `buzz_registered` | Todos | `{ roundId, playerId, rank }` |
| `buzz_queue_updated` | Todos | `{ roundId, queue: [{ playerId, rank }], currentAnswererId }` |
| `answer_judged` | Todos | `{ roundId, playerId, verdict, awardedPoints, nextAnswererId \| null }` |
| `round_ended` | Todos | `{ roundId, resolution, winnerPlayerId \| null, revealedAnswer: { title, artist, year } }` |
| `score_updated` | Todos | `{ scores: [{ playerId, total }] }` |
| `game_ended` | Todos | `{ podium: [{ playerId, displayName, total, position }] }` |
| `error` | Emisor | `{ code, message }` |

---

## 5. Reglas de visibilidad (anti-trampa)

Críticas porque la música solo suena en el host y los jugadores no deben poder "buscar"
la respuesta:

1. **Los jugadores nunca reciben** `track.provider_ref`, `answer_*`, ni la URL/video.
   Esos datos viajan **solo** por el canal privado del host (`round_host_payload`).
2. **La respuesta correcta se revela a jugadores solo en `round_ended`** (`revealedAnswer`),
   nunca durante `playing`/`answering`.
3. **El timestamp del buzz lo sella el servidor** (`buzzes.server_ts` con `now()` /
   Edge Function). El cliente solo dispara `buzz`; el orden y el `rank` se calculan en el
   backend. RLS (Row Level Security) impide que un jugador escriba/lea buzzes ajenos de
   forma indebida.
4. **El juicio (`judge`) solo lo puede emitir el host** de esa sesión (validado por RLS /
   Edge Function contra `sessions.host_player_id`).

> Implementación con Supabase: canales de Realtime separados (uno público de sesión, uno
> privado de host), RLS en las tablas, y una Edge Function o RPC para `buzz`, `start_round`
> y `judge` de modo que el servidor sea la autoridad (no confiar en el cliente).

---

## 6. Puntuación (modo configurable por el host)

El modo se elige al crear la sesión (`config.scoringMode`):

- **`simple`** (default, estilo juego de mesa): **1 punto por canción adivinada.** Ignora
  dificultad, velocidad y posición.
- **`speed`** (estilo arcade): fórmula ponderada de abajo.

### Modo `speed`

`awarded_points = round(BASE * difficultyMultiplier * speedFactor) + extras`

- `BASE` = 100 (placeholder).
- `difficultyMultiplier` según ventana de audio (más corta = más difícil = más puntos):

  | audioWindowMs | multiplicador |
  |---|---|
  | 15000 | 1.0 |
  | 10000 | 1.25 |
  | 5000 | 1.5 |
  | 3000 | 2.0 |
  | 1000 | 3.0 |

- `speedFactor` ∈ (0, 1]: proporción de rapidez del buzz ganador respecto a la ventana
  (buzz más temprano → más cerca de 1).
- `extras`: +N por cada dato correcto habilitado en `config.extraPoints` (artista/álbum/año),
  concedido por el host vía `bonus_flags`.
- **Pase al siguiente (decidido):** cuando el 1º falla, responde el 2º más rápido, y así
  por la cola. **Quien acierte gana los puntos completos, sin reducción por posición.**
  El `speedFactor` se calcula sobre el buzz de quien acierta.
- **Fallo (decidido):** **sin penalización** en el MVP (`wrongBuzzPenalty = 0`).

> Valores concretos de `BASE` y de la curva de `speedFactor` quedan como pendiente de §10
> del spec base, a cerrar antes de implementar el módulo de scoring.
