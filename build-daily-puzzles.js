const fs = require("fs");
const path = require("path");

const SELECTION_PATH = path.resolve(__dirname, "daily-source-selection.json");
const OUTPUT_PATH = path.resolve(__dirname, "frontend", "src", "dailyPuzzles.generated.js");

function formatJsString(value) {
  return JSON.stringify(String(value || "")).replace(/[<>\u007f-\uffff]/g, (char) => {
    if (char === "<") return "\\u003c";
    if (char === ">") return "\\u003e";
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

function rowsToJs(rows) {
  return `[\n${rows.map((row) => `      ${formatJsString(row)}`).join(",\n")}\n    ]`;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => String(row || "")).filter(Boolean);
}

function buildDailyPuzzleModule(items) {
  const body = items
    .map((item) => {
      const rows = normalizeRows(item.rows);
      const width = Number(item.width || rows[0]?.length || 0);
      const height = Number(item.height || rows.length || 0);
      return `  {
    id: ${formatJsString(item.id || item.sourceIconId || item.puzzleId)},
    sourceIconId: ${formatJsString(item.sourceIconId || "")},
    sourcePack: ${formatJsString(item.sourcePack || "")},
    sourceName: ${formatJsString(item.sourceName || "")},
    titleKo: ${formatJsString(item.title || item.titleKo || "오늘의 퍼즐")},
    titleEn: ${formatJsString(item.originalTitle || item.titleEn || "Daily Puzzle")},
    width: ${width},
    height: ${height},
    rows: ${rowsToJs(rows)},
  }`;
    })
    .join(",\n");

  return `// Auto-generated from daily-source-selection.json.
// This file intentionally contains only the selected daily puzzle pool.
export const GENERATED_DAILY_PUZZLES = [
${body}
];
`;
}

function main() {
  if (!fs.existsSync(SELECTION_PATH)) {
    throw new Error(`Missing selection file: ${SELECTION_PATH}`);
  }
  const parsed = JSON.parse(fs.readFileSync(SELECTION_PATH, "utf8"));
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (!items.length) {
    throw new Error("daily-source-selection.json has no selected items.");
  }
  fs.writeFileSync(OUTPUT_PATH, buildDailyPuzzleModule(items), "utf8");
  console.log(`Wrote ${items.length} daily puzzles to ${OUTPUT_PATH}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
