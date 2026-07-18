# Supabase — setup

This folder holds the database as code: migrations and seed data.

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- Docker running (for the local stack), **or** a remote Supabase project.

## First-time setup

```bash
# 1. Initialize the local Supabase config (creates config.toml).
#    Migrations in ./migrations and ./seed.sql are preserved.
supabase init

# 2a. Local development (needs Docker running):
supabase start          # boots Postgres + Realtime + Studio locally
supabase db reset       # applies all migrations, then runs seed.sql

# 2b. Or link to a remote project and push:
supabase link --project-ref <your-project-ref>
supabase db push        # applies migrations to the remote database
# then run supabase/seed.sql against the remote DB (SQL editor or psql)
```

## Environment variables

Copy the project's API values into `.env.local` at the repo root (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; authoritative writes)

## Migrations

| File | Purpose |
| --- | --- |
| `migrations/20260718000001_initial_schema.sql` | Enums + 7 tables (playlists, tracks, sessions, players, rounds, buzzes, judgements) |
| `migrations/20260718000002_rls.sql` | RLS baseline: tracks locked to server, gameplay tables read-only for clients, judgement writes host/server-only |
| `seed.sql` | One curated playlist ("Clásicos Imprescindibles") with 10 tracks |

## Anti-cheat posture (baseline)

- `tracks` (which holds the answers) is **not** readable by the public `anon` role —
  only the service role (server) reads it, so the answer never reaches a player.
- Clients may **read** gameplay rows (for Realtime) but **not write** them. Authoritative
  writes — sealing buzz timestamps, judging — happen server-side with the service role.

See `docs/data-model.md` §5 for the full rationale.
