const crypto = require("crypto");
const { Pool } = require("pg");
const { buildDbConfig, describeDbTarget, getDbName } = require("./db-config");

const DEFAULT_COUNT = 53;
const DEFAULT_PREFIX = "app_user";
const STARTING_RATING = 500;
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
  "단우",
  "리안",
  "서우",
  "이안",
  "하윤",
  "은우",
  "윤슬",
  "다온",
  "가온",
  "루다",
  "새벽안개",
  "밤하늘",
  "여름별",
  "푸른바다",
  "초록달",
  "달그림자",
  "숲속바람",
  "햇살한스푼",
  "구름조각",
  "노을빛",
  "말랑젤리",
  "초코우유",
  "복숭아",
  "포근곰",
  "치즈볼",
  "꿀단지",
  "솜사탕",
  "붕어빵",
  "모찌모찌",
  "딸기라떼",
  "치킨은살안쪄요",
  "월급루팡",
  "내꿈은돈많은백수",
  "퇴근하고싶다",
  "배고픈짐승",
  "민트초코단",
  "탕수육은찍먹",
  "라면먹고갈래",
  "주식은몰라요",
  "닉네임할게없다",
  "또바기",
  "미리내",
  "아리아",
  "꼬마여우",
  "빛나는밤",
  "어쩌다마주친",
  "그냥지나가는사람",
  "오늘도맑음",
  "행운의편지",
  "비밀의숲",
  "별빛소다",
  "느긋한감자",
  "무지개조각",
];

const BOT_SKILLS = ["easy", "normal", "normal", "hard"];

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
  const rating = 520 + ((index * 37 + 11) % 420);
  const games = 2 + ((index * 5 + 3) % 13);
  const ratingFactor = Math.max(0, Math.min(1, (rating - 520) / 420));
  const wobble = (((index * 17) % 13) - 6) / 100;
  const winRate = Math.max(0.35, Math.min(0.72, 0.42 + ratingFactor * 0.2 + wobble));
  const wins = Math.max(0, Math.min(games, Math.round(games * winRate)));
  const losses = games - wins;
  const currentStreak = wins > 0 ? (index % 3) : 0;
  const bestStreak = Math.max(currentStreak, index % 4);
  const avatarKey = PROFILE_AVATAR_KEYS[index % PROFILE_AVATAR_KEYS.length];
  const missionTotalXp = index % 4 === 0 ? 190 : index % 5 === 0 ? 120 : 0;
  return {
    username: `${prefix}_${serial}`.slice(0, 24),
    nickname: name.slice(0, 24),
    passwordHash: hashUserPassword(crypto.randomBytes(24).toString("hex")),
    rating,
    games,
    wins,
    losses,
    currentStreak,
    bestStreak,
    avatarKey,
    tierKey: tierKeyForRating(rating),
    botSkill: BOT_SKILLS[index % BOT_SKILLS.length],
    botSpawnWeight: 3 + ((index * 5) % 7),
    missionTotalXp,
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
      ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT ${STARTING_RATING},
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
  await pool.query(`ALTER TABLE users ALTER COLUMN rating SET DEFAULT ${STARTING_RATING}`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_rating_desc ON users (rating DESC, rating_games DESC, id ASC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_is_bot ON users (is_bot);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_app_state (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      daily_puzzle_history JSONB NOT NULL DEFAULT '{}'::jsonb,
      mission_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function seedFakeUsers(pool, personas) {
  const seeded = [];
  await pool.query("BEGIN");
  try {
    for (const persona of personas) {
      const completedAtMs = Date.now() - ((persona.rating % 7) + 1) * 86400000;
      const elapsedSec = 360 + (persona.rating % 180);
      const { rows } = await pool.query(
        `INSERT INTO users (
          username, nickname, password_hash, is_bot, bot_skill, bot_spawn_weight,
          rating, rating_games, rating_wins, rating_losses,
          win_streak_current, win_streak_best, profile_avatar_key,
          placement_done, placement_rating, placement_tier_key, placement_version,
          placement_completed_at_ms, placement_solved_sequential, placement_elapsed_sec,
          ui_lang, ui_theme, ui_sound_on, ui_sound_volume
        ) VALUES (
          $1, $2, $3, true, $15, $16,
          $4, $5, $6, $7,
          $8, $9, $10,
          true, $4, $11, $12,
          $13, CASE WHEN $4 >= 700 THEN 1 ELSE 0 END, $14,
          'ko', 'light', true, 100
        )
        ON CONFLICT (username) DO UPDATE SET
          nickname = EXCLUDED.nickname,
          is_bot = true,
          bot_skill = EXCLUDED.bot_skill,
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
          persona.botSkill,
          persona.botSpawnWeight,
        ]
      );
      const userId = Number(rows[0].id);
      await pool.query(
        `INSERT INTO user_app_state (user_id, daily_puzzle_history, mission_state, updated_at)
         VALUES ($1, '{}'::jsonb, $2::jsonb, now())
         ON CONFLICT (user_id) DO UPDATE SET
           mission_state = EXCLUDED.mission_state,
           updated_at = now()`,
        [
          userId,
          JSON.stringify({
            totalXp: persona.missionTotalXp,
            daily: {},
            weekly: {},
          }),
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
      `SELECT
         COUNT(*)::int AS count,
         MIN(rating)::int AS min_rating,
         MAX(rating)::int AS max_rating
       FROM users
       WHERE username = ANY($1::varchar[])`,
      [personas.map((persona) => persona.username)]
    );
    console.log(`Seeded ${seeded.length} app fake users into ${describeDbTarget(config)}.`);
    console.log(`Current ${prefix}_* users: ${rows[0]?.count || seeded.length}`);
    console.log(`Rating range: ${rows[0]?.min_rating || 0}-${rows[0]?.max_rating || 0}`);
    console.log(`Sample: ${seeded.slice(0, 5).map((user) => `${user.nickname}(${user.rating})`).join(", ")}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
