const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: process.env.PG_PASSWORD || "1234", // 비번은 환경변수로 권장
  database: "nonogram_prod",
});

const SIZE = Number(process.env.PUZZLE_SIZE || 25);
const INPUT_DIR =
  process.env.PUZZLE_DIR || path.join(__dirname, "out", `${SIZE}x${SIZE}`);
const BATCH_SIZE = 200;

function listJsonFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .map((f) => path.join(dir, f));
}

(async () => {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error("입력 폴더가 없음:", INPUT_DIR);
    process.exit(1);
  }

  const files = listJsonFiles(INPUT_DIR);
  console.log("총 파일:", files.length);

  await client.connect();

  let ok = 0;
  let fail = 0;

  try {
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await client.query("BEGIN");

      for (const file of batch) {
        try {
          const j = JSON.parse(fs.readFileSync(file, "utf8"));

          await client.query(
            `
            INSERT INTO puzzles_raw (id, width, height, row_hints, col_hints, source_url, scraped_at)
            VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)
            ON CONFLICT (id) DO NOTHING
            `,
            [
              Number(j.puzzleId),
              Number(j.width),
              Number(j.height),
              JSON.stringify(j.row_hints),
              JSON.stringify(j.col_hints),
              j.source_url || null,
              j.scraped_at ? new Date(j.scraped_at) : null,
            ]
          );

          ok++;
        } catch (e) {
          fail++;
          console.log("⚠️ 실패:", file, e.message);
        }
      }

      await client.query("COMMIT");
      console.log(`✅ 진행 ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} (ok ${ok}, fail ${fail})`);
    }
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ 트랜잭션 에러:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log("끝! ok =", ok, "fail =", fail);
})();
