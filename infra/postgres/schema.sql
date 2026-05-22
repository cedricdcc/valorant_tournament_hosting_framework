CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  discord_snowflake TEXT UNIQUE NOT NULL,
  discord_username TEXT,
  riot_puuid TEXT UNIQUE,
  riot_game_name TEXT,
  riot_tag_line TEXT,
  privacy_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_identity_opt_in_chk CHECK (
    (riot_puuid IS NULL AND riot_game_name IS NULL AND riot_tag_line IS NULL)
    OR (
      riot_puuid IS NOT NULL
      AND riot_game_name IS NOT NULL
      AND riot_tag_line IS NOT NULL
      AND privacy_opt_in = TRUE
    )
  )
);

CREATE TABLE IF NOT EXISTS tournaments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  captain_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, name)
);

CREATE TABLE IF NOT EXISTS registrations (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, team_id)
);

CREATE TABLE IF NOT EXISTS rounds (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  stage TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, round_number)
);

CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_id BIGINT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  riot_match_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  winner_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
  team_one_score INTEGER,
  team_two_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_teams (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  side TEXT,
  is_winner BOOLEAN,
  UNIQUE (match_id, team_id)
);

CREATE TABLE IF NOT EXISTS discord_voice_jobs (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id BIGINT REFERENCES matches(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  user_snowflake TEXT NOT NULL,
  from_channel_id TEXT,
  to_channel_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  rate_limit_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ,
  CONSTRAINT discord_voice_jobs_context_chk CHECK (
    tournament_id IS NOT NULL OR match_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_discord_voice_jobs_status_next_attempt
  ON discord_voice_jobs (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_discord_voice_jobs_ready
  ON discord_voice_jobs (next_attempt_at)
  WHERE status = 'queued' AND next_attempt_at IS NOT NULL;
