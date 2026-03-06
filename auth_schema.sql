CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(24) UNIQUE NOT NULL,
  nickname VARCHAR(24) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  bot_skill VARCHAR(16),
  rating INTEGER NOT NULL DEFAULT 1500,
  rating_games INTEGER NOT NULL DEFAULT 0,
  rating_wins INTEGER NOT NULL DEFAULT 0,
  rating_losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS race_match_logs (
  id BIGSERIAL PRIMARY KEY,
  room_code VARCHAR(16) NOT NULL,
  game_start_at_ms BIGINT NOT NULL,
  room_created_at_ms BIGINT NOT NULL,
  mode VARCHAR(32) NOT NULL,
  puzzle_id BIGINT,
  width INTEGER,
  height INTEGER,
  winner_user_id BIGINT,
  winner_nickname VARCHAR(64),
  player_count INTEGER NOT NULL DEFAULT 0,
  participants TEXT NOT NULL DEFAULT '',
  rankings_json JSONB NOT NULL,
  players_json JSONB NOT NULL,
  finished_at_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_code, game_start_at_ms)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_rating_desc ON users (rating DESC, rating_games DESC, id ASC);
CREATE INDEX IF NOT EXISTS idx_users_is_bot ON users (is_bot);
CREATE INDEX IF NOT EXISTS idx_race_match_logs_finished_desc ON race_match_logs (finished_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_race_match_logs_mode ON race_match_logs (mode);
