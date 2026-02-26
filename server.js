const crypto = require("crypto");
const cors = require("cors");
const express = require("express");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 3000);
const USE_SSL =
  process.env.PGSSLMODE === "require" ||
  process.env.PGSSL === "true" ||
  process.env.NODE_ENV === "production";
const DB_CONFIG = {
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "1234",
  database: process.env.PGDATABASE || "nonogram_prod",
  ssl: USE_SSL ? { rejectUnauthorized: false } : false,
};

const app = express();
const pool = new Pool(DB_CONFIG);
const raceRooms = new Map();
const ROOM_TTL_MS = 1000 * 60 * 60 * 12;

app.use(cors());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});
app.use(express.json({ limit: "1mb" }));

function expectedByteLength(width, height) {
  return Math.ceil((width * height) / 8);
}

function packCells(cells, width, height) {
  const n = width * height;
  if (!Array.isArray(cells) || cells.length !== n) {
    throw new Error(`cells must be an array with length ${n}`);
  }

  const out = Buffer.alloc(expectedByteLength(width, height));
  for (let i = 0; i < n; i += 1) {
    const v = Number(cells[i]);
    if (v !== 0 && v !== 1) {
      throw new Error("cells must contain only 0 or 1");
    }
    if (v === 1) {
      out[Math.floor(i / 8)] |= 1 << (i % 8);
    }
  }
  return out;
}

function parseUserBits(body, width, height) {
  if (typeof body.userBitsBase64 === "string") {
    return Buffer.from(body.userBitsBase64, "base64");
  }
  if (typeof body.userBitsHex === "string") {
    return Buffer.from(body.userBitsHex, "hex");
  }
  if (Array.isArray(body.cells)) {
    return packCells(body.cells, width, height);
  }
  throw new Error("Provide one of: userBitsBase64, userBitsHex, or cells");
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function randomPlayerId() {
  return crypto.randomBytes(12).toString("hex");
}

function makeRoomCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = randomCode();
    if (!raceRooms.has(code)) return code;
  }
  return `${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

function normalizeNickname(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  return s.slice(0, 24);
}

function roomPublicState(room) {
  const players = Array.from(room.players.values())
    .map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      joinedAt: p.joinedAt,
      finishedAt: p.finishedAt,
      elapsedSec: p.elapsedSec,
    }))
    .sort((a, b) => (a.joinedAt > b.joinedAt ? 1 : -1));

  const finished = players.filter((p) => Number.isInteger(p.elapsedSec));
  finished.sort((a, b) => {
    if (a.elapsedSec !== b.elapsedSec) return a.elapsedSec - b.elapsedSec;
    return a.finishedAt > b.finishedAt ? 1 : -1;
  });

  const winner = finished[0] || null;
  return {
    roomCode: room.roomCode,
    puzzleId: room.puzzleId,
    width: room.width,
    height: room.height,
    createdAt: room.createdAt,
    players,
    winner,
    isFinished: Boolean(winner),
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of raceRooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      raceRooms.delete(code);
    }
  }
}, 1000 * 60 * 15);

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/puzzles/:id", async (req, res) => {
  const puzzleId = Number(req.params.id);
  if (!Number.isInteger(puzzleId)) {
    return res.status(400).json({ ok: false, error: "Invalid puzzle id" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, width, height, row_hints, col_hints, is_unique
       FROM puzzles
       WHERE id = $1`,
      [puzzleId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Puzzle not found" });
    }
    return res.json({ ok: true, puzzle: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

const getRandomPuzzleBySize = async (req, res) => {
  const width = Number(req.query?.width);
  const height = Number(req.query?.height);

  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return res.status(400).json({ ok: false, error: "width/height are required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, width, height, row_hints, col_hints, is_unique
       FROM puzzles
       WHERE width = $1 AND height = $2
       ORDER BY random()
       LIMIT 1`,
      [width, height]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "No puzzle found for size" });
    }

    return res.json({ ok: true, puzzle: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

app.get("/puzzles-random", getRandomPuzzleBySize);
app.get("/puzzles/random", getRandomPuzzleBySize);

app.post("/race/create", async (req, res) => {
  const nickname = normalizeNickname(req.body?.nickname);
  const width = Number(req.body?.width);
  const height = Number(req.body?.height);

  if (!nickname) {
    return res.status(400).json({ ok: false, error: "nickname is required" });
  }
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return res.status(400).json({ ok: false, error: "width/height are required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, width, height, row_hints, col_hints, is_unique
       FROM puzzles
       WHERE width = $1 AND height = $2
       ORDER BY random()
       LIMIT 1`,
      [width, height]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "No puzzle found for size" });
    }

    const puzzle = rows[0];
    const roomCode = makeRoomCode();
    const playerId = randomPlayerId();
    const nowIso = new Date().toISOString();
    const room = {
      roomCode,
      puzzleId: puzzle.id,
      width: puzzle.width,
      height: puzzle.height,
      createdAt: Date.now(),
      players: new Map(),
    };
    room.players.set(playerId, {
      playerId,
      nickname,
      joinedAt: nowIso,
      finishedAt: null,
      elapsedSec: null,
    });
    raceRooms.set(roomCode, room);

    return res.json({
      ok: true,
      roomCode,
      playerId,
      puzzle,
      room: roomPublicState(room),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/race/join", async (req, res) => {
  const roomCode = String(req.body?.roomCode || "").trim().toUpperCase();
  const nickname = normalizeNickname(req.body?.nickname);
  if (!roomCode) {
    return res.status(400).json({ ok: false, error: "roomCode is required" });
  }
  if (!nickname) {
    return res.status(400).json({ ok: false, error: "nickname is required" });
  }
  const room = raceRooms.get(roomCode);
  if (!room) {
    return res.status(404).json({ ok: false, error: "Room not found" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, width, height, row_hints, col_hints, is_unique
       FROM puzzles
       WHERE id = $1`,
      [room.puzzleId]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "Puzzle not found for room" });
    }

    const playerId = randomPlayerId();
    room.players.set(playerId, {
      playerId,
      nickname,
      joinedAt: new Date().toISOString(),
      finishedAt: null,
      elapsedSec: null,
    });

    return res.json({
      ok: true,
      roomCode,
      playerId,
      puzzle: rows[0],
      room: roomPublicState(room),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/race/:roomCode", (req, res) => {
  const roomCode = String(req.params.roomCode || "").trim().toUpperCase();
  const room = raceRooms.get(roomCode);
  if (!room) {
    return res.status(404).json({ ok: false, error: "Room not found" });
  }
  return res.json({ ok: true, room: roomPublicState(room) });
});

app.post("/race/finish", (req, res) => {
  const roomCode = String(req.body?.roomCode || "").trim().toUpperCase();
  const playerId = String(req.body?.playerId || "").trim();
  const elapsedSec = Number(req.body?.elapsedSec);
  if (!roomCode || !playerId || !Number.isFinite(elapsedSec)) {
    return res.status(400).json({ ok: false, error: "roomCode/playerId/elapsedSec are required" });
  }

  const room = raceRooms.get(roomCode);
  if (!room) {
    return res.status(404).json({ ok: false, error: "Room not found" });
  }
  const player = room.players.get(playerId);
  if (!player) {
    return res.status(404).json({ ok: false, error: "Player not found in room" });
  }

  if (!Number.isInteger(player.elapsedSec)) {
    player.elapsedSec = Math.max(0, Math.floor(elapsedSec));
    player.finishedAt = new Date().toISOString();
  }

  return res.json({ ok: true, room: roomPublicState(room) });
});

app.post("/verify", async (req, res) => {
  const puzzleId = Number(req.body?.puzzleId);
  if (!Number.isInteger(puzzleId)) {
    return res.status(400).json({ ok: false, error: "puzzleId is required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT width, height, solution_bits, is_unique
       FROM puzzles
       WHERE id = $1`,
      [puzzleId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Puzzle not found" });
    }

    const row = rows[0];
    const expectedLen = expectedByteLength(row.width, row.height);
    const userBits = parseUserBits(req.body, row.width, row.height);

    if (userBits.length !== expectedLen) {
      return res.status(400).json({
        ok: false,
        error: `Invalid bit length: got ${userBits.length}, expected ${expectedLen}`,
      });
    }

    const isCorrect =
      row.solution_bits.length === userBits.length &&
      crypto.timingSafeEqual(row.solution_bits, userBits);

    return res.json({
      ok: true,
      isCorrect,
      isUnique: row.is_unique,
      width: row.width,
      height: row.height,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
