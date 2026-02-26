const { Pool } = require("pg");

const SRC = {
  host: process.env.SRC_PGHOST || "localhost",
  port: Number(process.env.SRC_PGPORT || 5432),
  user: process.env.SRC_PGUSER || "postgres",
  password: process.env.SRC_PGPASSWORD || "1234",
  database: process.env.SRC_PGDATABASE || "nonogram_prod",
};

const DST = {
  host: process.env.DST_PGHOST || process.env.PGHOST,
  port: Number(process.env.DST_PGPORT || process.env.PGPORT || 5432),
  user: process.env.DST_PGUSER || process.env.PGUSER,
  password: process.env.DST_PGPASSWORD || process.env.PGPASSWORD,
  database: process.env.DST_PGDATABASE || process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false },
};

const BATCH = Number(process.env.BATCH || 1000);

if (!DST.host || !DST.user || !DST.password || !DST.database) {
  console.error("Missing destination DB env vars (DST_PG* or PG*).");
  process.exit(1);
}

const srcPool = new Pool(SRC);
const dstPool = new Pool(DST);

async function ensureSchema() {
  const q = `
    CREATE TABLE IF NOT EXISTS puzzles_raw (
      id BIGINT PRIMARY KEY,
      width INT NOT NULL,
      height INT NOT NULL,
      row_hints JSONB NOT NULL,
      col_hints JSONB NOT NULL,
      scraped_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS puzzles (
      id BIGINT PRIMARY KEY,
      width INT NOT NULL,
      height INT NOT NULL,
      row_hints JSONB NOT NULL,
      col_hints JSONB NOT NULL,
      solution_bits BYTEA NOT NULL,
      is_unique BOOLEAN NOT NULL DEFAULT FALSE,
      solve_time_ms INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_puzzles_size ON puzzles(width, height);
  `;
  await dstPool.query(q);
}

async function copyTableRaw() {
  let lastId = 0n;
  let total = 0;
  for (;;) {
    const { rows } = await srcPool.query(
      `SELECT id, width, height, row_hints, col_hints, scraped_at
       FROM puzzles_raw
       WHERE id > $1
       ORDER BY id
       LIMIT $2`,
      [lastId.toString(), BATCH]
    );
    if (!rows.length) break;

    const values = [];
    const placeholders = [];
    rows.forEach((r, i) => {
      const n = i * 6;
      placeholders.push(
        `($${n + 1},$${n + 2},$${n + 3},$${n + 4}::jsonb,$${n + 5}::jsonb,$${n + 6})`
      );
      values.push(
        r.id,
        r.width,
        r.height,
        JSON.stringify(r.row_hints),
        JSON.stringify(r.col_hints),
        r.scraped_at
      );
    });

    await dstPool.query(
      `INSERT INTO puzzles_raw (id, width, height, row_hints, col_hints, scraped_at)
       VALUES ${placeholders.join(",")}
       ON CONFLICT (id) DO NOTHING`,
      values
    );

    total += rows.length;
    lastId = BigInt(rows[rows.length - 1].id);
    console.log(`puzzles_raw copied: ${total}`);
  }
}

async function copyTablePuzzles() {
  let lastId = 0n;
  let total = 0;
  for (;;) {
    const { rows } = await srcPool.query(
      `SELECT id, width, height, row_hints, col_hints, solution_bits, is_unique, solve_time_ms, created_at
       FROM puzzles
       WHERE id > $1
       ORDER BY id
       LIMIT $2`,
      [lastId.toString(), BATCH]
    );
    if (!rows.length) break;

    const values = [];
    const placeholders = [];
    rows.forEach((r, i) => {
      const n = i * 9;
      placeholders.push(
        `($${n + 1},$${n + 2},$${n + 3},$${n + 4}::jsonb,$${n + 5}::jsonb,$${n + 6},$${n + 7},$${n + 8},$${n + 9})`
      );
      values.push(
        r.id,
        r.width,
        r.height,
        JSON.stringify(r.row_hints),
        JSON.stringify(r.col_hints),
        r.solution_bits,
        r.is_unique,
        r.solve_time_ms,
        r.created_at
      );
    });

    await dstPool.query(
      `INSERT INTO puzzles (id, width, height, row_hints, col_hints, solution_bits, is_unique, solve_time_ms, created_at)
       VALUES ${placeholders.join(",")}
       ON CONFLICT (id) DO NOTHING`,
      values
    );

    total += rows.length;
    lastId = BigInt(rows[rows.length - 1].id);
    console.log(`puzzles copied: ${total}`);
  }
}

async function main() {
  try {
    await ensureSchema();
    await copyTableRaw();
    await copyTablePuzzles();
    const c1 = await dstPool.query("SELECT COUNT(*)::int AS n FROM puzzles_raw");
    const c2 = await dstPool.query("SELECT COUNT(*)::int AS n FROM puzzles");
    console.log(`done: puzzles_raw=${c1.rows[0].n}, puzzles=${c2.rows[0].n}`);
  } finally {
    await srcPool.end();
    await dstPool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

