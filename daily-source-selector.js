const fs = require("fs");
const http = require("http");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.DAILY_SELECT_PORT || 3134);
const TARGET_COUNT = 50;
const SELECTION_PATH = path.resolve(__dirname, "daily-source-selection.json");
const CACHE_PATH = path.resolve(__dirname, "daily-recognizable-candidates.cache.json");
const OUT_DIR = path.resolve(__dirname, "out");
const ONLINE_NONOGRAMS_DIR = path.join(OUT_DIR, "onlinenonograms", "en", "bw-micro");
const DAILY_CANVAS_SIZE = 15;
const LINE_PATTERN_CACHE = new Map();

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJsonForScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function normalizeClueLine(line) {
  if (!Array.isArray(line)) return [];
  return line.map((value) => Number(value || 0)).filter((value) => value > 0);
}

function normalizeClues(lines) {
  return Array.isArray(lines) ? lines.map(normalizeClueLine) : [];
}

function clueKey(length, clues) {
  return `${length}|${clues.join(",")}`;
}

function generateCompositions(total, parts, prefix, onResult) {
  if (parts === 1) {
    onResult([...prefix, total]);
    return;
  }
  for (let value = 0; value <= total; value += 1) {
    prefix.push(value);
    generateCompositions(total - value, parts - 1, prefix, onResult);
    prefix.pop();
  }
}

function getLinePatterns(length, clues) {
  const normalized = normalizeClueLine(clues);
  const key = clueKey(length, normalized);
  if (LINE_PATTERN_CACHE.has(key)) return LINE_PATTERN_CACHE.get(key);

  if (!normalized.length) {
    const empty = [Array.from({ length }, () => 0)];
    LINE_PATTERN_CACHE.set(key, empty);
    return empty;
  }

  const blockCount = normalized.length;
  const minLength = normalized.reduce((sum, value) => sum + value, 0) + blockCount - 1;
  if (minLength > length) {
    LINE_PATTERN_CACHE.set(key, []);
    return [];
  }

  const patterns = [];
  const remaining = length - minLength;
  generateCompositions(remaining, blockCount + 1, [], (gaps) => {
    const line = [];
    for (let i = 0; i < gaps[0]; i += 1) line.push(0);
    for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
      for (let i = 0; i < normalized[blockIndex]; i += 1) line.push(1);
      if (blockIndex < blockCount - 1) {
        for (let i = 0; i < 1 + gaps[blockIndex + 1]; i += 1) line.push(0);
      }
    }
    for (let i = 0; i < gaps[gaps.length - 1]; i += 1) line.push(0);
    patterns.push(line);
  });

  LINE_PATTERN_CACHE.set(key, patterns);
  return patterns;
}

function patternMatchesKnown(pattern, known) {
  for (let i = 0; i < known.length; i += 1) {
    if (known[i] !== -1 && pattern[i] !== known[i]) return false;
  }
  return true;
}

function intersectPatterns(patterns, length) {
  if (!patterns.length) return null;
  const forced = [];
  for (let i = 0; i < length; i += 1) {
    const value = patterns[0][i];
    let same = true;
    for (let p = 1; p < patterns.length; p += 1) {
      if (patterns[p][i] !== value) {
        same = false;
        break;
      }
    }
    forced.push(same ? value : -1);
  }
  return forced;
}

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function cloneCandidates(candidates) {
  return candidates.map((candidateList) => candidateList.slice());
}

function getKnownColumn(grid, x) {
  return grid.map((row) => row[x]);
}

function solveNonogram(width, height, rowClues, colClues) {
  const startedAt = Date.now();
  const longestSide = Math.max(width, height);
  const timeLimitMs = longestSide <= 10 ? 80 : longestSide <= 15 ? 220 : longestSide <= 20 ? 360 : 520;
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => -1));
  const rowCandidates = rowClues.map((clues) => getLinePatterns(width, clues));
  const colCandidates = colClues.map((clues) => getLinePatterns(height, clues));
  const solutions = [];

  if (
    rowCandidates.length !== height ||
    colCandidates.length !== width ||
    rowCandidates.some((patterns) => !patterns.length) ||
    colCandidates.some((patterns) => !patterns.length)
  ) {
    return { solution: null, solveTimeMs: 0, reason: "invalid_clues" };
  }

  function timeUp() {
    return Date.now() - startedAt > timeLimitMs;
  }

  function propagate(currentGrid, currentRows, currentCols) {
    let changed = true;
    while (changed) {
      if (timeUp()) return null;
      changed = false;

      for (let y = 0; y < height; y += 1) {
        const filtered = currentRows[y].filter((pattern) => patternMatchesKnown(pattern, currentGrid[y]));
        if (!filtered.length) return null;
        if (filtered.length !== currentRows[y].length) {
          currentRows[y] = filtered;
          changed = true;
        }
        const forced = intersectPatterns(filtered, width);
        for (let x = 0; x < width; x += 1) {
          if (forced[x] !== -1 && currentGrid[y][x] !== forced[x]) {
            currentGrid[y][x] = forced[x];
            changed = true;
          }
        }
      }

      for (let x = 0; x < width; x += 1) {
        const known = getKnownColumn(currentGrid, x);
        const filtered = currentCols[x].filter((pattern) => patternMatchesKnown(pattern, known));
        if (!filtered.length) return null;
        if (filtered.length !== currentCols[x].length) {
          currentCols[x] = filtered;
          changed = true;
        }
        const forced = intersectPatterns(filtered, height);
        for (let y = 0; y < height; y += 1) {
          if (forced[y] !== -1 && currentGrid[y][x] !== forced[y]) {
            currentGrid[y][x] = forced[y];
            changed = true;
          }
        }
      }
    }

    return { grid: currentGrid, rows: currentRows, cols: currentCols };
  }

  function chooseUnknownCell(currentGrid, currentRows, currentCols) {
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (currentGrid[y][x] !== -1) continue;
        const score = currentRows[y].length + currentCols[x].length;
        if (score < bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  }

  function dfs(currentGrid, currentRows, currentCols) {
    if (solutions.length || timeUp()) return;
    const propagated = propagate(cloneGrid(currentGrid), cloneCandidates(currentRows), cloneCandidates(currentCols));
    if (!propagated) return;

    const cell = chooseUnknownCell(propagated.grid, propagated.rows, propagated.cols);
    if (!cell) {
      solutions.push(propagated.grid.map((row) => row.map((value) => (value === 1 ? 1 : 0))));
      return;
    }

    for (const value of [0, 1]) {
      if (solutions.length || timeUp()) return;
      const nextGrid = cloneGrid(propagated.grid);
      nextGrid[cell.y][cell.x] = value;
      dfs(nextGrid, propagated.rows, propagated.cols);
    }
  }

  dfs(grid, rowCandidates, colCandidates);
  return {
    solution: solutions[0] || null,
    solveTimeMs: Date.now() - startedAt,
    reason: solutions[0] ? "" : "solver_timeout_or_ambiguous",
  };
}

function rowsFromSolution(solution) {
  return solution.map((row) => row.map((cell) => (cell ? "#" : ".")).join(""));
}

function countFilled(rows) {
  return rows.reduce((total, row) => total + Array.from(row).filter((cell) => cell === "#").length, 0);
}

function resizeRows(rows, targetWidth, targetHeight) {
  const sourceHeight = rows.length;
  const sourceWidth = rows[0]?.length || 0;
  if (!sourceWidth || !sourceHeight || !targetWidth || !targetHeight) return [];
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

function scaleRowsToDailyCanvas(rows, canvasSize = DAILY_CANVAS_SIZE) {
  const sourceHeight = rows.length;
  const sourceWidth = rows[0]?.length || 0;
  if (!sourceWidth || !sourceHeight) return [];
  const longestSide = Math.max(sourceWidth, sourceHeight);
  const contentLongestSide = canvasSize;
  const targetWidth = Math.max(1, Math.round((sourceWidth / longestSide) * contentLongestSide));
  const targetHeight = Math.max(1, Math.round((sourceHeight / longestSide) * contentLongestSide));
  return centerRows(resizeRows(rows, targetWidth, targetHeight), canvasSize);
}

const TITLE_KO_BY_ID = new Map([
  [104642, "탁구채"],
  [104810, "집"],
  [104812, "집"],
  [104864, "별"],
  [104865, "퍼즐 조각"],
  [104998, "파이프 절단기"],
  [105169, "스포츠 로고"],
  [105303, "물병"],
  [105470, "밸브 부품"],
  [105555, "달팽이"],
  [105643, "헬리콥터 정면"],
  [105943, "실린더 피스톤"],
  [106050, "왕관"],
  [106188, "고양이"],
  [106217, "양초"],
  [106420, "발자국"],
  [106757, "침대"],
  [107350, "커피 메이커"],
  [107573, "캘리퍼스"],
  [107574, "사람"],
  [107575, "버섯"],
  [107576, "새"],
  [107577, "가지"],
  [107578, "쥐"],
  [107579, "양"],
  [107580, "물고기"],
  [107581, "양파"],
  [107582, "잎사귀"],
  [107583, "배"],
  [107640, "나선 문양"],
  [107695, "선인장"],
  [107696, "꽃"],
  [107757, "시계"],
  [108057, "꽃"],
  [108192, "꽃"],
  [108288, "음표"],
  [108366, "공룡"],
  [108561, "도토리"],
  [108588, "집"],
  [108608, "조명"],
  [108946, "전구"],
  [109318, "슬리퍼"],
  [109597, "해골"],
  [109717, "전기 절연체"],
  [109931, "강세 기호"],
  [110400, "새"],
  [110682, "집"],
  [110720, "물고기"],
]);

const TITLE_KO_BY_NAME = new Map([
  ["ping pong paddle", "탁구채"],
  ["house", "집"],
  ["star", "별"],
  ["a piece of the puzzle", "퍼즐 조각"],
  ["pipe cutter", "파이프 절단기"],
  ["adidas logo", "스포츠 로고"],
  ["jug", "물병"],
  ["valve rocker", "밸브 부품"],
  ["snail", "달팽이"],
  ["helicopter full face", "헬리콥터 정면"],
  ["cylinder piston", "실린더 피스톤"],
  ["crown", "왕관"],
  ["cat", "고양이"],
  ["candle", "양초"],
  ["footprint", "발자국"],
  ["bed", "침대"],
  ["coffee maker", "커피 메이커"],
  ["calipers", "캘리퍼스"],
  ["man", "사람"],
  ["mushroom", "버섯"],
  ["bird", "새"],
  ["eggplant", "가지"],
  ["mouse", "쥐"],
  ["ram", "양"],
  ["fish", "물고기"],
  ["onion", "양파"],
  ["leaf", "잎사귀"],
  ["ship", "배"],
  ["zdravstvuy", "나선 문양"],
  ["кактус", "선인장"],
  ["цветок", "꽃"],
  ["часы", "시계"],
  ["нота", "음표"],
  ["dinosaur", "공룡"],
  ["acorns", "도토리"],
  ["дом", "집"],
  ["luminaire", "조명"],
  ["car light bulb", "전구"],
  ["flip-flops", "슬리퍼"],
  ["skull", "해골"],
  ["electric insulator", "전기 절연체"],
  ["circumflex above the letter", "강세 기호"],
]);

function getKoreanTitle(title, puzzleId) {
  const numericId = Number(puzzleId || 0);
  const rawTitle = String(title || "").trim();
  if (rawTitle.includes("큰 퍼즐")) return rawTitle;
  if (TITLE_KO_BY_ID.has(numericId)) return TITLE_KO_BY_ID.get(numericId);
  const normalized = rawTitle.toLowerCase();
  if (TITLE_KO_BY_NAME.has(normalized)) return TITLE_KO_BY_NAME.get(normalized);
  return "모양 퍼즐";
}

function localizeCandidate(candidate) {
  const originalTitle = candidate.originalTitle || candidate.title || "";
  if (candidate.sourceIconId) {
    return {
      ...candidate,
      originalTitle,
      title: candidate.title || getKoreanTitle(originalTitle, candidate.puzzleId),
    };
  }
  return {
    ...candidate,
    originalTitle,
    title: getKoreanTitle(originalTitle, candidate.puzzleId),
  };
}

function getShapeCategory(titleKo) {
  const title = String(titleKo || "");
  if (/(새|고양이|달팽이|쥐|양|물고기|공룡)/.test(title)) return "creature";
  if (/(꽃|잎사귀|도토리|양파|가지|선인장|버섯)/.test(title)) return "nature";
  if (/(별|왕관|해골|음표|강세|나선|퍼즐)/.test(title)) return "symbol";
  return "object";
}

function localizeCandidateData(data) {
  return {
    ...data,
    candidates: Array.isArray(data?.candidates) ? data.candidates.map(localizeCandidate) : [],
  };
}

function normalizeSolutionRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (Array.isArray(row)) {
        return row.map((cell) => (Number(cell) > 0 ? "#" : ".")).join("");
      }
      return String(row || "")
        .trim()
        .replaceAll("1", "#")
        .replaceAll("0", ".");
    })
    .filter(Boolean);
}

function getHintsFromRows(rows, axis) {
  const lines =
    axis === "col"
      ? Array.from({ length: rows[0]?.length || 0 }, (_, x) => rows.map((row) => row[x] || ".").join(""))
      : rows;

  return lines.map((line) => {
    const hints = [];
    let run = 0;
    for (const cell of line) {
      if (cell === "#") run += 1;
      else if (run) {
        hints.push(run);
        run = 0;
      }
    }
    if (run) hints.push(run);
    return hints;
  });
}

function loadSourcePuzzles() {
  const puzzles = [];
  if (!fs.existsSync(ONLINE_NONOGRAMS_DIR)) return puzzles;

  const filenames = fs
    .readdirSync(ONLINE_NONOGRAMS_DIR)
    .filter((filename) => /^\d+\.json$/i.test(filename))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  for (const filename of filenames) {
    const sourcePath = path.join(ONLINE_NONOGRAMS_DIR, filename);
    try {
      const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
      const sourceRows = normalizeSolutionRows(parsed.solutionStrings || parsed.decodedPuzzle?.solution);
      const sourceWidth = Number(parsed.width || parsed.payload?.sx || sourceRows[0]?.length || 0);
      const sourceHeight = Number(parsed.height || parsed.payload?.sy || sourceRows.length || 0);
      if (!sourceWidth || !sourceHeight || !sourceRows.length) continue;
      const puzzleId = Number(parsed.puzzleId || parsed.payload?.id || path.basename(filename, ".json"));
      const rawTitle = parsed.decodedTitle || parsed.title || `Puzzle ${puzzleId}`;
      const titleKo = getKoreanTitle(rawTitle, puzzleId);
      const rows = scaleRowsToDailyCanvas(sourceRows);
      puzzles.push({
        puzzleId,
        title: titleKo,
        originalTitle: rawTitle,
        width: DAILY_CANVAS_SIZE,
        height: DAILY_CANVAS_SIZE,
        originalWidth: sourceWidth,
        originalHeight: sourceHeight,
        originalSizeLabel: `${sourceWidth}x${sourceHeight}`,
        category: getShapeCategory(titleKo),
        rowHints: getHintsFromRows(rows, "row"),
        colHints: getHintsFromRows(rows, "col"),
        rows,
        likes: Number(parsed.likes || 0),
        dislikes: Number(parsed.dislikes || 0),
        detailUrl: parsed.detailUrl || parsed.canonicalUrl || "",
        scrapedAt: parsed.scrapedAt || parsed.scraped_at || "",
        sourcePath: path.relative(__dirname, sourcePath).replaceAll("\\", "/"),
      });
    } catch {
      // Broken source files are ignored; the report count below still tells us how many loaded.
    }
  }
  return puzzles;
}

function buildCandidates() {
  const sourcePuzzles = loadSourcePuzzles();
  const candidates = [];
  const skipped = { total: 0, invalid: 0, unsolved: 0 };

  for (let index = 0; index < sourcePuzzles.length; index += 1) {
    const puzzle = sourcePuzzles[index];
    const solved = puzzle.rows?.length
      ? { solution: null, rows: puzzle.rows, solveTimeMs: 0, reason: "" }
      : solveNonogram(puzzle.width, puzzle.height, puzzle.rowHints, puzzle.colHints);
    if (!solved.rows && !solved.solution) {
      skipped.total += 1;
      if (solved.reason === "invalid_clues") skipped.invalid += 1;
      else skipped.unsolved += 1;
      continue;
    }
    const rows = solved.rows || rowsFromSolution(solved.solution);
    const filledCells = countFilled(rows);
      candidates.push({
        id: `${puzzle.width}x${puzzle.height}-${puzzle.puzzleId}`,
        puzzleId: puzzle.puzzleId,
      title: puzzle.title || getKoreanTitle(puzzle.title, puzzle.puzzleId),
      originalTitle: puzzle.originalTitle || puzzle.title || "",
      width: puzzle.width,
      height: puzzle.height,
      sizeLabel: `${puzzle.width}x${puzzle.height}`,
      rowHints: puzzle.rowHints,
      colHints: puzzle.colHints,
      rows,
      filledCells,
      density: Math.round((filledCells / (puzzle.width * puzzle.height)) * 100),
      solveTimeMs: solved.solveTimeMs,
      likes: puzzle.likes || 0,
      dislikes: puzzle.dislikes || 0,
      originalSizeLabel: puzzle.originalSizeLabel || "",
      category: puzzle.category || "object",
      score:
        (puzzle.likes || 0) -
        (puzzle.dislikes || 0) +
        (100 - Math.abs(46 - Math.round((filledCells / (puzzle.width * puzzle.height)) * 100)) * 2),
      detailUrl: puzzle.detailUrl || "",
      scrapedAt: puzzle.scrapedAt,
      sourcePath: puzzle.sourcePath,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceTotal: sourcePuzzles.length,
    skipped,
    candidates,
  };
}

function loadCandidates() {
  if (fs.existsSync(CACHE_PATH)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
      if (Array.isArray(cached?.candidates)) return localizeCandidateData(cached);
    } catch {
      // Fall through and rebuild the cache.
    }
  }
  const built = buildCandidates();
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(built, null, 2)}\n`, "utf8");
  return localizeCandidateData(built);
}

function loadSelectionIds() {
  if (!fs.existsSync(SELECTION_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(SELECTION_PATH, "utf8"));
    return Array.isArray(parsed?.selectedIds)
      ? parsed.selectedIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function saveSelection(selectedIds, candidates) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const cleanIds = Array.from(new Set(selectedIds.map((id) => String(id || "").trim()).filter(Boolean))).filter((id) =>
    byId.has(id)
  );
  const items = cleanIds.map((id) => byId.get(id));
  const payload = {
    selectedAt: new Date().toISOString(),
    targetCount: TARGET_COUNT,
    selectedIds: cleanIds,
    items,
  };
  fs.writeFileSync(SELECTION_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

function renderPage(data, selectedIds) {
  const payload = {
    candidates: data.candidates,
    selectedIds,
    targetCount: TARGET_COUNT,
    stats: {
      generatedAt: data.generatedAt,
      sourceTotal: data.sourceTotal,
      solvedTotal: data.candidates.length,
      skipped: data.skipped,
    },
  };

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>일일퀴즈 그림 퍼즐 선택</title>
  <style>
    :root {
      --ink: #12243a;
      --muted: #607089;
      --line: #c9d7e7;
      --soft: #edf5fc;
      --panel: #ffffff;
      --blue: #1f8ed2;
      --teal: #11a5af;
      --fill: #31425f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
      background: #f3f7fb;
    }
    .shell {
      width: min(1320px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 24px 0 64px;
    }
    .top {
      position: sticky;
      top: 0;
      z-index: 10;
      margin: 0 -16px 18px;
      padding: 18px 16px;
      background: rgba(243, 247, 251, 0.92);
      border-bottom: 1px solid rgba(201, 215, 231, 0.72);
      backdrop-filter: blur(10px);
    }
    h1 {
      margin: 0 0 6px;
      font-size: 28px;
      letter-spacing: 0;
    }
    .sub {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }
    .controls {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      margin-top: 16px;
      align-items: center;
    }
    .filters,
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    button,
    input,
    select {
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      color: var(--ink);
      font: inherit;
      font-weight: 800;
    }
    button {
      padding: 0 14px;
      cursor: pointer;
    }
    button.active {
      border-color: #247eb6;
      color: #fff;
      background: linear-gradient(180deg, #41a9ed 0%, #247eb6 100%);
    }
    button.primary {
      min-width: 132px;
      color: #fff;
      border-color: #158a95;
      background: linear-gradient(180deg, #36b8c2 0%, #168a96 100%);
    }
    input {
      width: min(320px, 100%);
      padding: 0 12px;
      font-weight: 700;
    }
    select {
      padding: 0 10px;
    }
    .count {
      min-width: 104px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      font-weight: 900;
    }
    .count.good {
      border-color: #35a275;
      color: #16734e;
      background: #effdf6;
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0 0;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.72);
      color: var(--muted);
      font-size: 13px;
      font-weight: 800;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
      gap: 12px;
    }
    .card {
      min-height: 206px;
      padding: 10px;
      border: 2px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
      box-shadow: 0 8px 18px rgba(20, 42, 66, 0.07);
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: #77add7;
      box-shadow: 0 12px 26px rgba(20, 42, 66, 0.11);
    }
    .card.selected {
      border-color: var(--blue);
      background: linear-gradient(180deg, #ffffff 0%, #edf8ff 100%);
    }
    .cardTop {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .cardId {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 900;
    }
    .title {
      height: 34px;
      margin-top: 8px;
      overflow: hidden;
      color: var(--ink);
      font-size: 13px;
      font-weight: 900;
      line-height: 1.25;
    }
    .check {
      width: 24px;
      height: 24px;
      accent-color: var(--blue);
      flex: none;
    }
    .preview {
      width: 100%;
      aspect-ratio: 1 / 1;
      border: 1px solid #d8e2ee;
      border-radius: 8px;
      background:
        linear-gradient(180deg, #ffffff 0%, #f4f8fc 100%);
      overflow: hidden;
      display: grid;
      place-items: center;
    }
    .preview svg {
      width: 88%;
      height: 88%;
      display: block;
      filter: drop-shadow(0 8px 14px rgba(18, 36, 58, 0.12));
    }
    .meta {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
    }
    .empty {
      display: none;
      padding: 40px;
      border: 1px dashed var(--line);
      border-radius: 12px;
      color: var(--muted);
      background: #fff;
      text-align: center;
      font-weight: 900;
    }
    .toast {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 20;
      min-width: 220px;
      padding: 14px 16px;
      border-radius: 10px;
      color: #fff;
      background: rgba(18, 36, 58, 0.94);
      box-shadow: 0 14px 36px rgba(18, 36, 58, 0.24);
      font-weight: 900;
      opacity: 0;
      transform: translateY(12px);
      pointer-events: none;
      transition: opacity 140ms ease, transform 140ms ease;
    }
    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    @media (max-width: 720px) {
      .shell {
        width: min(100vw - 20px, 520px);
        padding-top: 12px;
      }
      .controls {
        grid-template-columns: 1fr;
      }
      input {
        width: 100%;
      }
      .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="top">
      <h1>일일퀴즈 그림 퍼즐 선택</h1>
      <p class="sub">테마 퍼즐 제외. 알아보기 쉬운 그림을 15x15 캔버스에 맞춰 키운 후보를 보고 일일퍼즐용으로 골라 저장합니다.</p>
      <div class="controls">
        <div class="filters">
          <button class="sizeBtn active" data-filter="all">전체</button>
          <button class="sizeBtn" data-filter="creature">동물/생물</button>
          <button class="sizeBtn" data-filter="nature">자연/식물</button>
          <button class="sizeBtn" data-filter="object">사물</button>
          <button class="sizeBtn" data-filter="symbol">기호/도형</button>
          <button id="selectedOnlyBtn" type="button">선택만</button>
          <input id="searchInput" type="search" placeholder="제목 또는 번호 검색" />
          <select id="sortSelect" aria-label="정렬">
            <option value="score">추천순</option>
            <option value="id">번호순</option>
            <option value="density">밀도 적당한 순</option>
            <option value="filled">채워진 칸 많은 순</option>
            <option value="likes">좋아요순</option>
          </select>
        </div>
        <div class="actions">
          <span id="selectedCount" class="count">0/${TARGET_COUNT}</span>
          <button id="clearBtn" type="button">선택 해제</button>
          <button id="saveBtn" type="button" class="primary">선택 저장</button>
        </div>
      </div>
      <div class="stats">
        <span class="pill">그림 후보 ${payload.stats.sourceTotal.toLocaleString("ko-KR")}개</span>
        <span class="pill">표시 ${payload.stats.solvedTotal.toLocaleString("ko-KR")}개</span>
        <span class="pill">제외 ${payload.stats.skipped.total.toLocaleString("ko-KR")}개</span>
        <span class="pill">저장 파일 daily-source-selection.json</span>
      </div>
    </section>
    <div id="grid" class="grid"></div>
    <div id="empty" class="empty">조건에 맞는 퍼즐이 없습니다.</div>
  </div>
  <div id="toast" class="toast"></div>
  <script id="payload" type="application/json">${safeJsonForScript(payload)}</script>
  <script>
    const payload = JSON.parse(document.getElementById("payload").textContent);
    const candidates = payload.candidates;
    const targetCount = payload.targetCount;
    const selected = new Set(payload.selectedIds);
    let activeFilter = "all";
    let selectedOnly = false;

    const grid = document.getElementById("grid");
    const empty = document.getElementById("empty");
    const selectedCount = document.getElementById("selectedCount");
    const searchInput = document.getElementById("searchInput");
    const sortSelect = document.getElementById("sortSelect");
    const selectedOnlyBtn = document.getElementById("selectedOnlyBtn");
    const toast = document.getElementById("toast");

    function showToast(message) {
      toast.textContent = message;
      toast.classList.add("show");
      window.clearTimeout(showToast.timer);
      showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1600);
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function buildPreview(candidate) {
      const width = candidate.width;
      const height = candidate.height;
      const rects = [];
      for (let y = 0; y < height; y += 1) {
        const row = candidate.rows[y] || "";
        for (let x = 0; x < width; x += 1) {
          if (row[x] === "#") {
            rects.push('<rect x="' + x + '" y="' + y + '" width="1" height="1" rx="0.08" fill="#263957" />');
          }
        }
      }
      const lines = [];
      for (let i = 1; i < width; i += 1) {
        lines.push('<line x1="' + i + '" y1="0" x2="' + i + '" y2="' + height + '" stroke="#eef3f8" stroke-width="0.035" />');
      }
      for (let i = 1; i < height; i += 1) {
        lines.push('<line x1="0" y1="' + i + '" x2="' + width + '" y2="' + i + '" stroke="#eef3f8" stroke-width="0.035" />');
      }
      return '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + candidate.id + '">' +
        '<rect width="' + width + '" height="' + height + '" rx="0.18" fill="#ffffff" />' +
        rects.join("") +
        lines.join("") +
        '</svg>';
    }

    function updateCount() {
      selectedCount.textContent = selected.size + "/" + targetCount;
      selectedCount.classList.toggle("good", selected.size === targetCount);
    }

    function sortItems(items) {
      const mode = sortSelect.value;
      const next = items.slice();
      if (mode === "score") {
        next.sort((a, b) => b.score - a.score || b.likes - a.likes || a.puzzleId - b.puzzleId);
      } else if (mode === "density") {
        next.sort((a, b) => Math.abs(45 - a.density) - Math.abs(45 - b.density) || a.puzzleId - b.puzzleId);
      } else if (mode === "filled") {
        next.sort((a, b) => b.filledCells - a.filledCells || a.puzzleId - b.puzzleId);
      } else if (mode === "likes") {
        next.sort((a, b) => b.likes - a.likes || a.puzzleId - b.puzzleId);
      } else {
        next.sort((a, b) => a.puzzleId - b.puzzleId);
      }
      return next;
    }

    function getVisibleItems() {
      const search = searchInput.value.trim().toLowerCase();
      return sortItems(candidates.filter((candidate) => {
        if (activeFilter !== "all" && candidate.category !== activeFilter) return false;
        if (selectedOnly && !selected.has(candidate.id)) return false;
        if (
          search &&
          !String(candidate.puzzleId).includes(search) &&
          !candidate.id.toLowerCase().includes(search) &&
          !String(candidate.title || "").toLowerCase().includes(search) &&
          !String(candidate.originalTitle || "").toLowerCase().includes(search)
        ) return false;
        return true;
      }));
    }

    function render() {
      const items = getVisibleItems();
      const fragment = document.createDocumentFragment();
      grid.textContent = "";

      for (const candidate of items) {
        const card = document.createElement("article");
        card.className = "card" + (selected.has(candidate.id) ? " selected" : "");
        card.dataset.id = candidate.id;
        card.innerHTML =
          '<div class="cardTop">' +
          '<div class="cardId">#' + candidate.puzzleId + '</div>' +
          '<input class="check" type="checkbox" aria-label="' + candidate.id + ' 선택" ' + (selected.has(candidate.id) ? "checked" : "") + ' />' +
          '</div>' +
          '<div class="preview">' + buildPreview(candidate) + '</div>' +
          '<div class="title">' + escapeHtml(candidate.title) + '</div>' +
          '<div class="meta"><span>' + candidate.sizeLabel + '</span><span>원본 ' + candidate.originalSizeLabel + '</span><span>채움 ' + candidate.density + '%</span></div>';
        fragment.appendChild(card);
      }

      grid.appendChild(fragment);
      empty.style.display = items.length ? "none" : "block";
      updateCount();
    }

    document.querySelectorAll(".sizeBtn").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".sizeBtn").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        activeFilter = button.dataset.filter;
        render();
      });
    });

    selectedOnlyBtn.addEventListener("click", () => {
      selectedOnly = !selectedOnly;
      selectedOnlyBtn.classList.toggle("active", selectedOnly);
      render();
    });

    grid.addEventListener("click", (event) => {
      const card = event.target.closest(".card");
      if (!card) return;
      const id = card.dataset.id;
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      card.classList.toggle("selected", selected.has(id));
      const check = card.querySelector(".check");
      if (check) check.checked = selected.has(id);
      updateCount();
    });

    searchInput.addEventListener("input", render);
    sortSelect.addEventListener("change", render);

    document.getElementById("clearBtn").addEventListener("click", () => {
      selected.clear();
      render();
    });

    document.getElementById("saveBtn").addEventListener("click", async () => {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIds: Array.from(selected) }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        showToast(result.message || "저장 실패");
        return;
      }
      showToast(result.count + "개 저장 완료");
    });

    render();
  </script>
</body>
</html>`;
}

const data = loadCandidates();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (req.method === "GET" && url.pathname === "/") {
    const page = renderPage(data, loadSelectionIds());
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/save") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const saved = saveSelection(Array.isArray(parsed.selectedIds) ? parsed.selectedIds : [], data.candidates);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, count: saved.selectedIds.length, path: SELECTION_PATH }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, message: error.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Daily source selector: http://${HOST}:${PORT}`);
  console.log(`Shape candidates: ${data.candidates.length}/${data.sourceTotal}`);
  console.log(`Selection file: ${SELECTION_PATH}`);
});
