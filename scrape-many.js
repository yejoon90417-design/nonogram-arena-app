const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const SIZE = Number(process.env.PUZZLE_SIZE || 25);
const SIZE_TO_PARAM = { 10: 1, 15: 2, 20: 3, 25: 4, 30: 5 };
const SIZE_PARAM = Number(process.env.SIZE_PARAM || SIZE_TO_PARAM[SIZE] || 4);
const TARGET = Number(process.env.TARGET || 10000);

const OUT_DIR = path.join(__dirname, "out", `${SIZE}x${SIZE}`);

const MIN_DELAY_MS = Number(process.env.MIN_DELAY_MS || 800);
const MAX_DELAY_MS = Number(process.env.MAX_DELAY_MS || 1800);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeId(id) {
  return String(id).replace(/[^\d]/g, "");
}

(async () => {
  ensureDir(OUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 불필요 리소스 차단
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media")
      return route.abort();
    return route.continue();
  });

  page.setDefaultTimeout(60000);

  let saved = 0;
  let tries = 0;

  while (saved < TARGET) {
    tries++;

    try {
      await page.goto(`https://ko.puzzle-nonograms.com/?size=${SIZE_PARAM}`, {
        waitUntil: "domcontentloaded",
      });

      await page.waitForSelector("#taskLeft");
      await page.waitForSelector("#taskTop");

      const result = await page.evaluate((size) => {

        // ⭐ 핵심: 숫자 줄 분리 정확하게 처리
        const parseHintElement = (el) => {
          if (!el) return [];

          let html = el.innerHTML || "";

          html = html.replace(/<br\s*\/?>/gi, "\n");

          html = html.replace(
            /<\/(div|span|p|li)>\s*<(div|span|p|li)[^>]*>/gi,
            "\n"
          );

          const text = html.replace(/<[^>]*>/g, " ").trim();

          const nums = text
            .split(/[\s\r\n\t]+/)
            .filter(Boolean)
            .map((t) => parseInt(t, 10))
            .filter((n) => Number.isFinite(n));

          return nums;
        };

        const getHints = (selector) => {
          const root = document.querySelector(selector);
          if (!root) return [];

          const items = Array.from(root.children).slice(0, size);

          return items.map(parseHintElement);
        };

        const bodyText = document.body.innerText || "";

        const m =
          bodyText.match(/퍼즐 ID:\s*([\d,]+)/) ||
          bodyText.match(/Puzzle ID:\s*([\d,]+)/);

        const puzzleId = m
          ? parseInt(m[1].replace(/,/g, ""), 10)
          : null;

        return {
          puzzleId,
          width: size,
          height: size,
          row_hints: getHints("#taskLeft"),
          col_hints: getHints("#taskTop"),
          scraped_at: new Date().toISOString(),
        };
      }, SIZE);

      if (!result.puzzleId) {
        console.log("❌ puzzleId 없음, skip");
        continue;
      }

      const id = sanitizeId(result.puzzleId);

      const filePath = path.join(OUT_DIR, `${id}.json`);

      if (fs.existsSync(filePath)) {
        console.log(`⚠️ 이미 존재: ${id}`);
        continue;
      }

      fs.writeFileSync(filePath, JSON.stringify(result, null, 2));

      saved++;

      console.log(`✅ 저장 ${saved}/${TARGET}: ${id}.json`);

      await sleep(rand(MIN_DELAY_MS, MAX_DELAY_MS));

    } catch (e) {
      console.log("⚠️ 에러:", e.message);
      await sleep(2000);
    }
  }

  await browser.close();

  console.log("완료");
})();
