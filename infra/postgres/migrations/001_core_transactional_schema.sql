CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  captain_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, name),
  UNIQUE (tournament_id, id)
);

CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, team_id),
  CONSTRAINT registrations_team_tournament_fk FOREIGN KEY (tournament_id, team_id)
    REFERENCES teams(tournament_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  stage TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, round_number),
  UNIQUE (tournament_id, id)
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_id UUID NOT NULL,
  riot_match_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  winner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  team_one_score INTEGER,
  team_two_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT matches_round_tournament_fk FOREIGN KEY (tournament_id, round_id)
    REFERENCES rounds(tournament_id, id) ON DELETE CASCADE,
  UNIQUE (tournament_id, id)
);

CREATE TABLE IF NOT EXISTS match_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id UUID NOT NULL,
  team_id UUID NOT NULL,
  side TEXT,
  is_winner BOOLEAN,
  UNIQUE (match_id, team_id),
  CONSTRAINT match_teams_match_tournament_fk FOREIGN KEY (tournament_id, match_id)
    REFERENCES matches(tournament_id, id) ON DELETE CASCADE,
  CONSTRAINT match_teams_team_tournament_fk FOREIGN KEY (tournament_id, team_id)
    REFERENCES teams(tournament_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS discord_voice_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  user_snowflake TEXT NOT NULL,
  from_channel_id TEXT,
  to_channel_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  rate_limit_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT discord_voice_jobs_context_chk CHECK (
    tournament_id IS NOT NULL OR match_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_users_riot_game_name_tag_line
  ON users (riot_game_name, riot_tag_line);

CREATE INDEX IF NOT EXISTS idx_discord_voice_jobs_status_next_attempt
  ON discord_voice_jobs (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_discord_voice_jobs_ready
  ON discord_voice_jobs (next_attempt_at)
  WHERE status = 'queued' AND next_attempt_at IS NOT NULL;
