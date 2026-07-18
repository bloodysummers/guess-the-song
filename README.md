# Guess the Song

Party game to guess a song as fast as possible. A host plays music out loud and validates
answers; players use their phones as buzzers and race to respond.

- **Platform:** Web app (Next.js, App Router) — host + players over the browser, no install.
- **Music:** YouTube first (behind a `MusicProvider` abstraction); Spotify later.
- **Answering:** verbal buzzer with the host as presenter/judge.
- **Backend:** Supabase (Realtime + Postgres + Auth), behind a `GameTransport` abstraction.

See the design docs:

- [`docs/base-spec.md`](docs/base-spec.md) — locked decisions and game principles
- [`docs/data-model.md`](docs/data-model.md) — schema, state machine, transport contract, anti-cheat rules
- [`docs/roadmap.md`](docs/roadmap.md) — delivery phases (mapped to OpenSpec changes)

Work is planned and tracked with [OpenSpec](https://github.com/Fission-AI/OpenSpec) under
`openspec/changes/`.

## Getting started

```bash
npm install

# Configure Supabase (see supabase/README.md), then:
cp .env.example .env.local   # fill in your Supabase project values

npm run dev                  # http://localhost:3000
```

Routes: `/` (home), `/host` (presenter/judge), `/play` (player). The `/host` and `/play`
views are placeholders until the Lobby and Round/Buzzer phases.

## Project layout

```
app/                 Next.js routes (/, /host, /play)
lib/
  game/              shared domain types
  transport/         GameTransport interface + SupabaseTransport (only place @supabase/* is imported)
  music/             MusicProvider interface (no concrete provider yet)
supabase/            database as code — migrations + seed (see supabase/README.md)
docs/                design documents
openspec/            spec-driven change proposals
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next lint) |
| `npm run format` | Prettier write |

## Architecture principle

Game logic and UI depend only on the `GameTransport` and `MusicProvider` interfaces —
never on `@supabase/*` or a music provider SDK directly. This keeps the backend and music
source swappable without touching the game.
