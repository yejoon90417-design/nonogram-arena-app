const crypto = require("crypto");
const { Pool } = require("pg");
const { buildDbConfig, describeDbTarget, getDbName } = require("./db-config");

const DEFAULT_COUNT = 50;
const DEFAULT_PREFIX = "app_user";
const CURRENT_PLACEMENT_VERSION = Math.max(1, Number(process.env.PLACEMENT_VERSION || 1));

const PROFILE_AVATAR_KEYS = [
  "default-user",
  "default-ember",
  "default-rose",
  "default-mint",
  "default-violet",
  "default-cobalt",
  "default-sky",
  "default-ocean",
  "default-forest",
  "default-sage",
  "default-lavender",
  "default-orchid",
  "default-plum",
];

const BASE_NICKNAMES = [
  "픽셀마루",
  "노노봄",
  "셀채움",
  "단서왕",
  "라인마스터",
  "그림조각",
  "빠른손",
  "차분한풀이",
  "파랑칸",
  "빨강칸",
  "보드장인",
  "작은승부",
  "정답수집가",
  "미니퍼즐러",
  "격자탐험",
  "집중모드",
  "스피드셀",
  "힌트절약",
  "완성주의",
  "한칸승부",
  "조용한고수",
  "패턴러너",
  "셀마스터",
  "노노스타",
  "퍼즐루키",
  "퍼즐브론즈",
  "퍼즐실버",
  "퍼즐골드",
  "퍼즐다이아",
  "퍼즐마스터",
  "하루한판",
  "숨은그림",
  "열정풀이",
  "단서추적",
  "검은칸",
  "빈칸확인",
  "침착한손",
  "빠른완성",
  "균형감각",
  "연승도전",
  "랭킹도전",
  "배틀연습",
  "스몰클리어",
  "미디엄클리어",
  "라지클리어",
  "엑스라지",
  "신중한플레이",
  "반전승부",
  "마지막칸",
  "오늘도완성",
];

function isEnabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function clampInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function hashUserPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function normalizePrefix(raw) {
  const normalized = String(raw || DEFAULT_PREFIX)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || DEFAULT_PREFIX;
}

function tierKeyForRating(rating) {
  if (rating >= 2500) return "master";
  if (rating >= 2000) return "diamond";
  if (rating >= 1500) return "gold";
  if (rating >= 1000) return "silver";
  return "bronze";
}

function buildPersona(index, prefix) {
  const serial = String(index + 1).padStart(3, "0");
  const name = BASE_NICKNAMES[index % BASE_NICKNAMES.length];
  const rating = 820 + ((index * 97 + 180) % 1680);
  const games = 16 + ((index * 11 + 9) % 96);
  const ratingFactor = Math.max(0, Math.min(1, (rating - 820) / 1680));
  const wobble = (((index * 17) % 15) - 7) / 100;
  const winRate = Math.max(0.28, Math.min(0.82, 0.34 + ratingFactor * 0.38 + wobble));
  const wins = Math.max(0, Math.min(games, Math.round(games * winRate)));
  const losses = games - wins;
  const currentStreak = wins > 0 ? (index * 3) % 7 : 0;
  const bestStreak = Math.max(currentStreak, 2 + ((index * 5) % 13));
  const avatarKey = PROFILE_AVATAR_KEYS[index % PROFILE_AVATAR_KEYS.length];
  return {
    username: `${prefix}_${serial}`.slice(0, 24),
    nickname: `${name}${String(index + 1).padStart(2, "0")}`.slice(0, 24),
    passwordHash: hashUserPassword(crypto.randomBytes(24).toString("hex")),
    rating,
    games,
    wins,
    losses,
    currentStreak,
    bestStreak,
    avatarKey,
    tierKey: tierKeyForRating(rating),
  };
}

function hasExplicitTargetEnv() {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.PGHOST ||
      process.env.PGDATABASE ||
      process.env.PGUSER ||
      process.env.PGPASSWORD
  );
}

function assertSeedAllowed(config) {
  if (!isEnabled(process.env.ALLOW_APP_DB_SEED)) {
    throw new Error("Set ALLOW_APP_DB_SEED=true before seeding the app DB.");
  }
  if (!hasExplicitTargetEnv()) {
    throw new Error("Set DATABASE_URL or PG* env vars for the new app DB. Refusing to use default DB config.");
  }
  const dbName = getDbName(config).toLowerCase();
  if (dbName === "nonogram_prod" && !isEnabled(process.env.ALLOW_LEGACY_DB_SEED)) {
    throw new Error("Target database is nonogram_prod. Refusing to seed the legacy/web DB.");
  }
}

async function ensureUsersTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(24) UNIQUE NOT NULL,
      nickname VARCHAR(24) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 1500,
      ADD COLUMN IF NOT EXISTS rating_games INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rating_wins INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rating_losses INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS win_streak_current INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS win_streak_best INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS bot_skill VARCHAR(16),
      ADD COLUMN IF NOT EXISTS bot_spawn_weight INTEGER NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS profile_avatar_key VARCHAR(64) NOT NULL DEFAULT 'default-user',
      ADD COLUMN IF NOT EXISTS ui_lang VARCHAR(8) NOT NULL DEFAULT 'ko',
      ADD COLUMN IF NOT EXISTS ui_theme VARCHAR(8) NOT NULL DEFAULT 'light',
      ADD COLUMN IF NOT EXISTS ui_sound_on BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS ui_sound_volume INTEGER,
      ADD COLUMN IF NOT EXISTS patch_notes_dismissed_version VARCHAR(64),
      ADD COLUMN IF NOT EXISTS email VARCHAR(320),
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS placement_done BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS placement_rating INTEGER,
      ADD COLUMN IF NOT EXISTS placement_tier_key VARCHAR(32),
      ADD COLUMN IF NOT EXISTS placement_version INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS placement_completed_at_ms BIGINT,
      ADD COLUMN IF NOT EXISTS placement_solved_sequential INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS placement_elapsed_sec INTEGER NOT NULL DEFAULT 0;
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_rating_desc ON users (rating DESC, rating_games DESC, id ASC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_is_bot ON users (is_bot);`);
}

async function seedFakeUsers(pool, personas) {
  const seeded = [];
  await pool.query("BEGIN");
  try {
    for (const persona of personas) {
      const completedAtMs = Date.now() - ((persona.rating % 31) + 1) * 86400000;
      const elapsedSec = 260 + (persona.rating % 420);
      const { rows } = await pool.query(
        `INSERT INTO users (
          username, nickname, password_hash, is_bot, bot_skill, bot_spawn_weight,
          rating, rating_games, rating_wins, rating_losses,
          win_streak_current, win_streak_best, profile_avatar_key,
          placement_done, placement_rating, placement_tier_key, placement_version,
          placement_completed_at_ms, placement_solved_sequential, placement_elapsed_sec,
          ui_lang, ui_theme, ui_sound_on, ui_sound_volume
        ) VALUES (
          $1, $2, $3, false, NULL, 3,
          $4, $5, $6, $7,
          $8, $9, $10,
          true, $4, $11, $12,
          $13, 5, $14,
          'ko', 'light', true, 100
        )
        ON CONFLICT (username) DO UPDATE SET
          nickname = EXCLUDED.nickname,
          is_bot = false,
          bot_skill = NULL,
          bot_spawn_weight = EXCLUDED.bot_spawn_weight,
          rating = EXCLUDED.rating,
          rating_games = EXCLUDED.rating_games,
          rating_wins = EXCLUDED.rating_wins,
          rating_losses = EXCLUDED.rating_losses,
          win_streak_current = EXCLUDED.win_streak_current,
          win_streak_best = EXCLUDED.win_streak_best,
          profile_avatar_key = EXCLUDED.profile_avatar_key,
          placement_done = EXCLUDED.placement_done,
          placement_rating = EXCLUDED.placement_rating,
          placement_tier_key = EXCLUDED.placement_tier_key,
          placement_version = EXCLUDED.placement_version,
          placement_completed_at_ms = EXCLUDED.placement_completed_at_ms,
          placement_solved_sequential = EXCLUDED.placement_solved_sequential,
          placement_elapsed_sec = EXCLUDED.placement_elapsed_sec,
          ui_lang = EXCLUDED.ui_lang,
          ui_theme = EXCLUDED.ui_theme,
          ui_sound_on = EXCLUDED.ui_sound_on,
          ui_sound_volume = EXCLUDED.ui_sound_volume
        RETURNING id, username, nickname, rating`,
        [
          persona.username,
          persona.nickname,
          persona.passwordHash,
          persona.rating,
          persona.games,
          persona.wins,
          persona.losses,
          persona.currentStreak,
          persona.bestStreak,
          persona.avatarKey,
          persona.tierKey,
          CURRENT_PLACEMENT_VERSION,
          completedAtMs,
          elapsedSec,
        ]
      );
      seeded.push(rows[0]);
    }
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
  return seeded;
}

async function main() {
  const config = buildDbConfig();
  assertSeedAllowed(config);
  const count = clampInteger(process.env.APP_FAKE_USER_COUNT, DEFAULT_COUNT, 1, 500);
  const prefix = normalizePrefix(process.env.APP_FAKE_USER_PREFIX);
  const personas = Array.from({ length: count }, (_, index) => buildPersona(index, prefix));
  const pool = new Pool(config);

  try {
    await ensureUsersTable(pool);
    const seeded = await seedFakeUsers(pool, personas);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM users WHERE username = ANY($1::varchar[])`,
      [personas.map((persona) => persona.username)]
    );
    console.log(`Seeded ${seeded.length} app fake users into ${describeDbTarget(config)}.`);
    console.log(`Current ${prefix}_* users: ${rows[0]?.count || seeded.length}`);
    console.log(`Sample: ${seeded.slice(0, 5).map((user) => `${user.nickname}(${user.rating})`).join(", ")}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
