const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const {
  analyzePuzzle,
  buildIconCandidates,
  renderIconRows,
} = require("./generate-icon-puzzles");

const TARGET_COUNT = Number(process.env.DAILY_ICON_TARGET || 200);
const TARGET_SIZE = Number(process.env.DAILY_ICON_SIZE || 15);
const OUTPUT_PATH = path.resolve(__dirname, "daily-recognizable-candidates.cache.json");
const THEME_SAMPLES_PATH = path.resolve(__dirname, "creator-samples.generated.json");

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => String(row || "")).filter(Boolean);
}

function resizeRows(rows, targetWidth, targetHeight) {
  const sourceHeight = rows.length;
  const sourceWidth = rows[0]?.length || 0;
  if (!sourceWidth || !sourceHeight) return [];
  return Array.from({ length: targetHeight }, (_, y) => {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / targetHeight));
    return Array.from({ length: targetWidth }, (_, x) => {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / targetWidth));
      return rows[sourceY]?.[sourceX] === "#" ? "#" : ".";
    }).join("");
  });
}

function centerRows(rows, canvasSize) {
  const height = rows.length;
  const width = rows[0]?.length || 0;
  const offsetX = Math.max(0, Math.floor((canvasSize - width) / 2));
  const offsetY = Math.max(0, Math.floor((canvasSize - height) / 2));
  const canvas = Array.from({ length: canvasSize }, () => Array.from({ length: canvasSize }, () => "."));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rows[y]?.[x] === "#") canvas[y + offsetY][x + offsetX] = "#";
    }
  }
  return canvas.map((row) => row.join(""));
}

function scaleRowsToCanvas(rows, canvasSize = TARGET_SIZE) {
  const normalized = normalizeRows(rows);
  const sourceHeight = normalized.length;
  const sourceWidth = normalized[0]?.length || 0;
  if (!sourceWidth || !sourceHeight) return [];
  const longestSide = Math.max(sourceWidth, sourceHeight);
  const targetWidth = Math.max(1, Math.round((sourceWidth / longestSide) * canvasSize));
  const targetHeight = Math.max(1, Math.round((sourceHeight / longestSide) * canvasSize));
  return centerRows(resizeRows(normalized, targetWidth, targetHeight), canvasSize);
}

function getRuns(line) {
  const clues = [];
  let run = 0;
  for (const cell of line) {
    if (cell === "#") run += 1;
    else if (run) {
      clues.push(run);
      run = 0;
    }
  }
  if (run) clues.push(run);
  return clues;
}

function getHintsFromRows(rows, axis) {
  const lines =
    axis === "col"
      ? Array.from({ length: rows[0]?.length || 0 }, (_, x) => rows.map((row) => row[x] || ".").join(""))
      : rows;
  return lines.map(getRuns);
}

function countFilledCells(rows) {
  return rows.reduce((sum, row) => sum + [...row].filter((cell) => cell === "#").length, 0);
}

function getUsedThemeIds() {
  if (!fs.existsSync(THEME_SAMPLES_PATH)) return new Set();
  try {
    const samples = JSON.parse(fs.readFileSync(THEME_SAMPLES_PATH, "utf8"));
    if (!Array.isArray(samples)) return new Set();
    return new Set(samples.map((sample) => String(sample.id || "")).filter(Boolean));
  } catch {
    return new Set();
  }
}

function getCategory(icon) {
  const text = `${icon.sourceName || ""} ${icon.titleKo || ""} ${icon.titleEn || ""}`.toLowerCase();
  if (/(cat|dog|bird|fish|mouse|rabbit|turtle|squirrel|snail|bug|shrimp|paw|bone|ghost|동물|고양|강아|새|물고|쥐|토끼|거북|달팽|벌레|유령)/.test(text)) return "creature";
  if (/(flower|leaf|tree|sprout|cloud|sun|moon|star|rain|snow|mountain|waves|꽃|잎|나무|구름|해|달|별|비|눈|파도)/.test(text)) return "nature";
  if (/(heart|crown|diamond|badge|dice|music|note|spark|ticket|medal|trophy|하트|왕관|보석|주사위|음표|메달|트로피)/.test(text)) return "symbol";
  return "object";
}

function compareIconPriority(a, b) {
  const groupPriority = { medium: 0, large: 1, xlarge: 2, small: 3 };
  const packPriority = { lucide: 0, phosphor: 1, hero: 2 };
  return (
    (groupPriority[a.sizeGroup] ?? 9) - (groupPriority[b.sizeGroup] ?? 9) ||
    (packPriority[a.sourcePack] ?? 9) - (packPriority[b.sourcePack] ?? 9) ||
    String(a.titleKo || a.titleEn || a.id).localeCompare(String(b.titleKo || b.titleEn || b.id), "ko")
  );
}

function buildCandidatePool(allIcons) {
  const usedThemeIds = getUsedThemeIds();
  const seenIds = new Set();
  return allIcons
    .filter((icon) => icon?.id && icon?.sourceUrl && !usedThemeIds.has(icon.id))
    .sort(compareIconPriority)
    .filter((icon) => {
      if (seenIds.has(icon.id)) return false;
      seenIds.add(icon.id);
      return true;
    });
}

async function buildDailyIconCandidates() {
  const allIcons = await buildIconCandidates();
  const icons = buildCandidatePool(allIcons);
  const skipped = {
    total: 0,
    fetch: 0,
    render: 0,
    density: 0,
    logic: 0,
  };
  const candidates = [];

  const chromeExecutablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "");
  const browser = await chromium.launch({
    headless: true,
    ...(chromeExecutablePath && fs.existsSync(chromeExecutablePath) ? { executablePath: chromeExecutablePath } : {}),
  });

  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body style=\"margin:0;background:#fff\"></body></html>");

    for (const icon of icons) {
      if (candidates.length >= TARGET_COUNT) break;
      let svgText = "";
      try {
        const response = await fetch(icon.sourceUrl);
        if (!response.ok) {
          skipped.fetch += 1;
          skipped.total += 1;
          continue;
        }
        svgText = await response.text();
      } catch {
        skipped.fetch += 1;
        skipped.total += 1;
        continue;
      }

      let rows = [];
      try {
        rows = scaleRowsToCanvas(await renderIconRows(page, svgText, TARGET_SIZE), TARGET_SIZE);
      } catch {
        skipped.render += 1;
        skipped.total += 1;
        continue;
      }
      if (!rows.length) {
        skipped.render += 1;
        skipped.total += 1;
        continue;
      }

      const filledCells = countFilledCells(rows);
      const density = Math.round((filledCells / (TARGET_SIZE * TARGET_SIZE)) * 100);
      if (density < 16 || density > 76) {
        skipped.density += 1;
        skipped.total += 1;
        continue;
      }

      const analysis = analyzePuzzle(rows);
      if (!analysis.unique || analysis.needsGuess) {
        skipped.logic += 1;
        skipped.total += 1;
        continue;
      }

      candidates.push({
        id: `daily-${icon.id}`,
        puzzleId: 800000 + candidates.length + 1,
        sourceIconId: icon.id,
        sourcePack: icon.sourcePack || "",
        sourceName: icon.sourceName || "",
        title: icon.titleKo || icon.titleEn || icon.sourceName || "그림 퍼즐",
        originalTitle: icon.titleEn || icon.sourceName || "",
        width: TARGET_SIZE,
        height: TARGET_SIZE,
        sizeLabel: `${TARGET_SIZE}x${TARGET_SIZE}`,
        originalSizeLabel: icon.groupTitleKo || icon.sizeGroup || "",
        category: getCategory(icon),
        rowHints: getHintsFromRows(rows, "row"),
        colHints: getHintsFromRows(rows, "col"),
        rows,
        filledCells,
        density,
        solveTimeMs: 0,
        likes: 0,
        dislikes: 0,
        score: 100 - Math.abs(45 - density) * 2,
        detailUrl: icon.sourceUrl || "",
        scrapedAt: new Date().toISOString(),
        sourcePath: `icon:${icon.id}`,
      });
    }
  } finally {
    await browser.close();
  }

  return {
    kind: "daily-icon-candidates-v1",
    generatedAt: new Date().toISOString(),
    sourceTotal: icons.length,
    skipped,
    candidates,
  };
}

async function main() {
  const data = await buildDailyIconCandidates();
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Wrote ${data.candidates.length}/${TARGET_COUNT} daily candidates to ${OUTPUT_PATH}`);
  console.log(`Source icons: ${data.sourceTotal}, skipped: ${JSON.stringify(data.skipped)}`);
  if (data.candidates.length < TARGET_COUNT) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
