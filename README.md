# Valorant Tournament Hosting Framework

Event-driven platform specification for orchestrating Valorant tournaments and Discord server automation.

## Architecture Summary

- **Frontend (HTTPS only):** Public brackets, registration dashboard, Discord + Riot OAuth2 login.
- **Backend API (NestJS/TypeScript):** Modular services, tournament format strategy resolution, identity linking, result verification.
- **Broker + Queue (Redis Streams + BullMQ):** Async orchestration between API and Discord worker, retries, priorities, persistence, rate-limited execution.
- **Discord Automation Engine (Sapphire/discord.js):** Queue-driven channel creation and member movement jobs.
- **Database (PostgreSQL):** Transactional core entities with FK integrity (see `infra/postgres/schema.sql`).

## Core Workflows

1. **Dual identity mapping**
   - Discord OAuth2 login captures Snowflake ID.
   - Riot Sign-On OAuth2 login captures `puuid`, `gameName`, `tagLine` via `/riot/account/v1/accounts/me`.
   - Linking requires explicit privacy opt-in and stores both identities on one user row.

2. **Tournament engine + verification**
   - Strategy-based format resolution (Swiss / elimination).
   - Captains create custom lobby manually with tournament settings.
   - Backend verifies post-match outcomes through VAL-MATCH-V1 using registered player `puuid` values.
   - Verification poller reads `/val/match/v1/matchlists/by-puuid/{puuid}`, resolves match payloads from `/val/match/v1/matches/{matchId}`, validates tournament mode, and auto-advances the winner.

3. **Discord warm lobby orchestration**
   - Players gather in a public warm lobby channel.
   - Once 10 ready players are present, move operations are queued.
   - BullMQ worker drains moves with token-bucket style pacing and exponential backoff on 429 responses.

## Security & Compliance Requirements

- Enforce HTTPS for any OAuth2 callback/auth route handling credentials.
- Never hardcode Riot or Discord secrets; inject by environment variables.
- Display an explicit privacy notice for Riot + Discord account linking.

Required credentials are documented in `docs/credentials.md`.

## Docker Deployment

Core processes are dockerized in `docker-compose.yml`:

- `frontend` (web entrypoint placeholder via NGINX; HTTP by default in compose)
- `api` (NestJS backend scaffold container)
- `discord-bot` (Sapphire/discord.js worker scaffold container)
- `postgres` (database with auto schema bootstrap from `infra/postgres/schema.sql`)
- `redis` (broker/cache backend for queueing)

Before startup, copy `.env.example` to `.env` and set real credentials/secrets.

Start the stack:

```bash
docker compose up -d
```

Stop and remove containers/network:

```bash
./scripts/docker-clean.sh
```

Stop and remove containers/network/volumes/local images:

```bash
./scripts/docker-clean-all.sh
```

## API Auth Endpoints (NestJS)

The API scaffold now includes OAuth2 endpoints for dual-identity linking:

- `GET /auth/discord/authorize?privacyOptIn=true`
- `GET /auth/discord/callback` (captures Discord Snowflake identity)
- `GET /auth/riot/authorize?linkToken=...`
- `GET /auth/riot/callback` (exchanges Riot auth code, calls `/riot/account/v1/accounts/me`, and upserts `users`)

## Initial Database Model

The initial PostgreSQL schema includes:

- `users`
- `tournaments`
- `teams`
- `registrations`
- `rounds`
- `matches`
- `match_teams`
- `discord_voice_jobs`

See `infra/postgres/schema.sql`.

Migration scripts are available under `infra/postgres/migrations/`.
