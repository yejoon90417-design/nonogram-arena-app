CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(24) UNIQUE NOT NULL,
  nickname VARCHAR(24) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_rating_desc ON users (rating DESC, rating_games DESC, id ASC);
