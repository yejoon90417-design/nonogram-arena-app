const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { buildDbConfig, describeDbTarget } = require("./db-config");

const ROOT = __dirname;
const TARGET_SIZES = [
  [5, 5],
  [10, 10],
  [15, 15],
];
const TARGET_COUNT = Math.max(1, Number(process.env.BATTLE_PUZZLES_PER_SIZE || 1000));
const BATCH_SIZE = Math.max(1, Number(process.env.BATTLE_PUZZLES_BATCH || 100));
const REPLACE = process.argv.includes("--replace");

const linePatternCache = new Map();

function normalizeClues(clues) {
  if (!Array.isArray(clues)) return [];
  const normalized = clues.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
  return normalized.length === 1 && normalized[0] === 0 ? [] : normalized;
}

function patternKey(length, clues) {
  return `${length}:${clues.join(",")}`;
}

function getLinePatterns(length, rawClues) {
  const clues = normalizeClues(rawClues);
  const key = patternKey(length, clues);
  const cached = linePatternCache.get(key);
  if (cached) return cached;

  if (!clues.length) {
    const empty = [new Array(length).fill(0)];
    linePatternCache.set(key, empty);
    return empty;
  }

  const minLength = clues.reduce((sum, value) => sum + value, 0) + clues.length - 1;
  if (minLength > length) {
    linePatternCache.set(key, []);
    return [];
  }

  const patterns = [];
  const place = (clueIndex, position, line) => {
    if (clueIndex >= clues.length) {
      const next = line.slice();
      for (let i = position; i < length; i += 1) next[i] = 0;
      patterns.push(next);
      return;
    }

    const remainingBlocks = clues.slice(clueIndex + 1).reduce((sum, value) => sum + value, 0);
    const remainingGaps = clues.length - clueIndex - 1;
    const maxStart = length - (clues[clueIndex] + remainingBlocks + remainingGaps);
    for (let start = position; start <= maxStart; start += 1) {
      const next = line.slice();
      for (let i = position; i < start; i += 1) next[i] = 0;
      for (let i = 0; i < clues[clueIndex]; i += 1) next[start + i] = 1;
      const nextPosition = start + clues[clueIndex];
      if (clueIndex < clues.length - 1) {
        next[nextPosition] = 0;
        place(clueIndex + 1, nextPosition + 1, next);
      } else {
        place(clueIndex + 1, nextPosition, next);
      }
    }
  };

  place(0, 0, new Array(length).fill(0));
  linePatternCache.set(key, patterns);
  return patterns;
}

function lineMatchesPattern(pattern, line) {
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] !== -1 && line[i] !== pattern[i]) return false;
  }
  return true;
}

function cloneCandidates(candidates) {
  return candidates.map((list) => list.slice());
}

function propagate(grid, width, height, rowCandidates, colCandidates) {
  let changed = true;
  while (changed) {
    changed = false;

    for (let y = 0; y < height; y += 1) {
      const line = grid.slice(y * width, y * width + width);
      const nextCandidates = rowCandidates[y].filter((pattern) => lineMatchesPattern(pattern, line));
      if (!nextCandidates.length) return null;
      if (nextCandidates.length !== rowCandidates[y].length) {
        rowCandidates[y] = nextCandidates;
        changed = true;
      }

      for (let x = 0; x < width; x += 1) {
        const value = nextCandidates[0][x];
        if (nextCandidates.every((pattern) => pattern[x] === value) && grid[y * width + x] !== value) {
          grid[y * width + x] = value;
          changed = true;
        }
      }
    }

    for (let x = 0; x < width; x += 1) {
      const line = Array.from({ length: height }, (_, y) => grid[y * width + x]);
      const nextCandidates = colCandidates[x].filter((pattern) => lineMatchesPattern(pattern, line));
      if (!nextCandidates.length) return null;
      if (nextCandidates.length !== colCandidates[x].length) {
        colCandidates[x] = nextCandidates;
        changed = true;
      }

      for (let y = 0; y < height; y += 1) {
        const value = nextCandidates[0][y];
        if (nextCandidates.every((pattern) => pattern[y] === value) && grid[y * width + x] !== value) {
          grid[y * width + x] = value;
          changed = true;
        }
      }
    }
  }

  return { grid, rowCandidates, colCandidates };
}

function choosePivot(grid, width, height, rowCandidates, colCandidates) {
  let best = null;
  let bestScore = Infinity;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (grid[index] !== -1) continue;
      const score = rowCandidates[y].length + colCandidates[x].length;
      if (score < bestScore) {
        bestScore = score;
        best = index;
      }
    }
  }
  return best;
}

function solvePuzzle(rowHints, colHints, width, height, solutionLimit = 2) {
  const startedAt = Date.now();
  const rowCandidates = rowHints.map((hints) => getLinePatterns(width, hints).slice());
  const colCandidates = colHints.map((hints) => getLinePatterns(height, hints).slice());
  if (rowCandidates.some((list) => !list.length) || colCandidates.some((list) => !list.length)) {
    return { solutions: [], solveTimeMs: Date.now() - startedAt };
  }

  const solutions = [];
  const dfs = (grid, rows, cols) => {
    if (solutions.length >= solutionLimit) return;
    const state = propagate(grid.slice(), width, height, cloneCandidates(rows), cloneCandidates(cols));
    if (!state) return;
    const pivot = choosePivot(state.grid, width, height, state.rowCandidates, state.colCandidates);
    if (pivot == null) {
      solutions.push(state.grid.map((value) => (value === 1 ? 1 : 0)));
      return;
    }

    dfs(Object.assign(state.grid.slice(), { [pivot]: 1 }), state.rowCandidates, state.colCandidates);
    dfs(Object.assign(state.grid.slice(), { [pivot]: 0 }), state.rowCandidates, state.colCandidates);
  };

  dfs(new Array(width * height).fill(-1), rowCandidates, colCandidates);
  return { solutions, solveTimeMs: Date.now() - startedAt };
}

function packCells(cells, width, height) {
  const out = Buffer.alloc(Math.ceil((width * height) / 8));
  for (let i = 0; i < width * height; i += 1) {
    if (Number(cells[i]) === 1) out[Math.floor(i / 8)] |= 1 << (i % 8);
  }
  return out;
}

function listPuzzleFiles(width, height) {
  const dir = path.join(ROOT, "out", `${width}x${height}`);
  return fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((name) => path.join(dir, name));
}

async function ensureSchema(pool) {
  await pool.query(`
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
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_puzzles_size ON puzzles(width, height);`);
}

async function insertBatch(pool, batch) {
  if (!batch.length) return;
  const values = [];
  const placeholders = [];
  batch.forEach((item, index) => {
    const base = index * 8;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb, $${base + 5}::jsonb, $${base + 6}, $${base + 7}, $${base + 8})`
    );
    values.push(
      item.id,
      item.width,
      item.height,
      JSON.stringify(item.rowHints),
      JSON.stringify(item.colHints),
      item.solutionBits,
      item.isUnique,
      item.solveTimeMs
    );
  });

  await pool.query(
    `INSERT INTO puzzles (id, width, height, row_hints, col_hints, solution_bits, is_unique, solve_time_ms)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (id) DO UPDATE SET
       width = EXCLUDED.width,
       height = EXCLUDED.height,
       row_hints = EXCLUDED.row_hints,
       col_hints = EXCLUDED.col_hints,
       solution_bits = EXCLUDED.solution_bits,
       is_unique = EXCLUDED.is_unique,
       solve_time_ms = EXCLUDED.solve_time_ms`,
    values
  );
}

async function seedSize(pool, width, height) {
  const files = listPuzzleFiles(width, height);
  const batch = [];
  let inserted = 0;
  let scanned = 0;
  let skipped = 0;
  let unique = 0;

  for (const file of files) {
    if (inserted >= TARGET_COUNT) break;
    scanned += 1;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const rowHints = data.row_hints;
    const colHints = data.col_hints;
    const { solutions, solveTimeMs } = solvePuzzle(rowHints, colHints, width, height, 2);
    if (!solutions.length) {
      skipped += 1;
      continue;
    }
    const isUnique = solutions.length === 1;
    if (isUnique) unique += 1;
    batch.push({
      id: Number(data.puzzleId),
      width,
      height,
      rowHints,
      colHints,
      solutionBits: packCells(solutions[0], width, height),
      isUnique,
      solveTimeMs,
    });
    inserted += 1;

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(pool, batch.splice(0, batch.length));
      console.log(`${width}x${height}: inserted ${inserted}/${TARGET_COUNT}`);
    }
  }

  await insertBatch(pool, batch);
  return { width, height, scanned, inserted, skipped, unique };
}

async function main() {
  const config = buildDbConfig(process.env);
  const pool = new Pool(config);
  console.log(`battle puzzle seed target: ${describeDbTarget(config)}`);
  try {
    await ensureSchema(pool);
    if (REPLACE) {
      await pool.query(
        `DELETE FROM puzzles WHERE (width = 5 AND height = 5) OR (width = 10 AND height = 10) OR (width = 15 AND height = 15)`
      );
    }

    const results = [];
    for (const [width, height] of TARGET_SIZES) {
      results.push(await seedSize(pool, width, height));
    }

    const { rows } = await pool.query(`
      SELECT width, height, COUNT(*)::int AS count, SUM(CASE WHEN is_unique THEN 1 ELSE 0 END)::int AS unique_count
      FROM puzzles
      WHERE (width = 5 AND height = 5) OR (width = 10 AND height = 10) OR (width = 15 AND height = 15)
      GROUP BY width, height
      ORDER BY width, height
    `);
    console.log(JSON.stringify({ results, dbCounts: rows }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
