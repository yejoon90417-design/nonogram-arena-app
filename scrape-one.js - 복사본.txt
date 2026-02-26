// scrape-one.js
// 실행: node scrape-one.js
// 필요: npm i playwright && npx playwright install chromium

const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 불필요 리소스 차단(선택): 안정성/속도↑
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") return route.abort();
    return route.continue();
  });

  page.setDefaultTimeout(60000);

  // networkidle 쓰지 말기 (광고/롱폴링 때문에 timeout 자주 남)
  await page.goto("https://ko.puzzle-nonograms.com/?size=4", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForSelector("#taskLeft", { timeout: 60000 });
  await page.waitForSelector("#taskTop", { timeout: 60000 });

  const result = await page.evaluate(() => {
    const size = 25;

    // 핵심: 한 "힌트 셀" 안의 숫자를 줄 단위로 끊어 읽기
    const parseHintElement = (el) => {
      if (!el) return [];

      // <br> 를 줄바꿈으로 바꾼 뒤 태그 제거
      let html = el.innerHTML || "";
      html = html.replace(/<br\s*\/?>/gi, "\n");
      html = html.replace(/<\/(div|span|p|li)>\s*<(div|span|p|li)[^>]*>/gi, "\n");
      // 모든 태그 제거
      const text = html.replace(/<[^>]*>/g, " ").trim();

      // 줄/공백 기준 토큰화 후, 두 자릿수 포함해서 parseInt
      const nums = text
        .split(/[\s\r\n\t]+/)
        .filter(Boolean)
        .map((t) => parseInt(t, 10))
        .filter((n) => Number.isFinite(n));

      // 빈 줄(힌트 없음)은 []로 두는 게 일반적 (원하면 [0]으로 바꿔도 됨)
      return nums;
    };

    const getHints = (selector) => {
      const root = document.querySelector(selector);
      if (!root) return [];
      // childNodes 말고 "요소(children)"만 가져오면 텍스트 노이즈가 줄어듦
      const items = Array.from(root.children).slice(0, size);
      return items.map(parseHintElement);
    };

    const bodyText = document.body.innerText || "";
    const m =
      bodyText.match(/퍼즐 ID:\s*([\d,]+)/) ||
      bodyText.match(/Puzzle ID:\s*([\d,]+)/);
    const puzzleId = m ? parseInt(m[1].replace(/,/g, ""), 10) : null;

    return {
      puzzleId,
      width: size,
      height: size,
      row_hints: getHints("#taskLeft"),
      col_hints: getHints("#taskTop"),
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();