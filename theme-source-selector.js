const fs = require('fs');
const http = require('http');
const path = require('path');
const { buildIconCandidates, generateIconPuzzles, GROUPS } = require('./generate-icon-puzzles');

const PORT = Number(process.env.THEME_SELECT_PORT || 3131);
const HOST = '127.0.0.1';
const SELECTION_PATH = path.resolve(__dirname, 'theme-source-selection.json');
const REPORT_PATH = path.resolve(__dirname, 'theme-source-generation-report.json');

const THEME_DEFS = [
  {
    key: 'animals',
    title: '동물',
    tokens: ['cat', 'dog', 'bird', 'fish', 'rabbit', 'squirrel', 'turtle', 'paw', 'bug', 'ant', 'shrimp', 'shell', 'cow', 'horse'],
  },
  {
    key: 'food',
    title: '음식',
    tokens: ['apple', 'banana', 'bean', 'beer', 'bowl', 'cake', 'carrot', 'cherry', 'coffee', 'cookie', 'croissant', 'cup', 'food', 'grape', 'hamburger', 'ice', 'milk', 'pizza', 'sandwich', 'soda', 'watermelon'],
  },
  {
    key: 'nature',
    title: '자연/날씨',
    tokens: ['balloon', 'cloud', 'flower', 'leaf', 'lotus', 'moon', 'rain', 'snow', 'snowflake', 'sprout', 'star', 'sun', 'tree', 'tulip', 'umbrella', 'water', 'wind'],
  },
  {
    key: 'sports',
    title: '스포츠',
    tokens: ['baseball', 'basketball', 'bowling', 'football', 'golf', 'hockey', 'medal', 'trophy'],
  },
  {
    key: 'vehicles',
    title: '탈것',
    tokens: ['airplane', 'ambulance', 'bus', 'cable', 'car', 'rocket', 'truck', 'vehicle'],
  },
  {
    key: 'daily',
    title: '생활',
    tokens: ['backpack', 'basket', 'bath', 'book', 'bookmark', 'cardholder', 'clock', 'eyeglasses', 'hard', 'hat', 'key', 'lamp', 'lock', 'notebook', 'ticket', 'wallet', 'watch'],
  },
  {
    key: 'arts',
    title: '음악/예술',
    tokens: ['album', 'camera', 'disco', 'film', 'guitar', 'image', 'microphone', 'music', 'note', 'photo'],
  },
  {
    key: 'rewards',
    title: '보상/기념',
    tokens: ['badge', 'bell', 'cake', 'crown', 'fire', 'gift', 'heart', 'medal', 'shield', 'sparkles', 'trophy'],
  },
  {
    key: 'places',
    title: '장소/건물',
    tokens: ['building', 'castle', 'globe', 'house', 'library', 'lighthouse', 'map', 'pin', 'store', 'warehouse'],
  },
];

const OTHER_THEME = { key: 'other', title: '기타' };
let iconCache = null;
let buildInProgress = false;

function splitTokens(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .filter(Boolean);
}

function classifyIcon(icon) {
  const tokens = new Set([
    ...splitTokens(icon.sourceName),
    ...splitTokens(icon.titleEn),
    ...splitTokens(icon.titleKo),
  ]);
  const matched = THEME_DEFS.find((theme) => theme.tokens.some((token) => tokens.has(token)));
  return matched || OTHER_THEME;
}

function getPackLabel(sourcePack) {
  if (sourcePack === 'phosphor') return 'Phosphor';
  if (sourcePack === 'phosphor-fill') return 'Phosphor Fill';
  if (sourcePack === 'phosphor-bold') return 'Phosphor Bold';
  if (sourcePack === 'lucide') return 'Lucide';
  if (sourcePack === 'hero') return 'Heroicons';
  return sourcePack || 'Unknown';
}

function loadSelectionIds() {
  if (!fs.existsSync(SELECTION_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(SELECTION_PATH, 'utf8') || '{}');
    return Array.isArray(parsed.selectedIds)
      ? parsed.selectedIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

async function getIcons() {
  if (!iconCache) {
    const icons = await buildIconCandidates();
    const seen = new Set();
    const uniqueIcons = icons.filter((icon) => {
      if (!icon?.id || seen.has(icon.id)) return false;
      seen.add(icon.id);
      return true;
    });
    iconCache = uniqueIcons.map((icon) => {
      const theme = classifyIcon(icon);
      return {
        id: icon.id,
        sourcePack: icon.sourcePack || '',
        sourcePackLabel: getPackLabel(icon.sourcePack),
        sourceName: icon.sourceName || '',
        titleKo: icon.titleKo || '',
        titleEn: icon.titleEn || '',
        sizeGroup: icon.sizeGroup || '',
        sizeTitleKo: GROUPS[icon.sizeGroup]?.titleKo || icon.sizeGroup || '',
        sizeTitleEn: GROUPS[icon.sizeGroup]?.titleEn || icon.sizeGroup || '',
        sourceUrl: icon.sourceUrl || '',
        themeKey: theme.key,
        themeTitle: theme.title,
      };
    });
  }
  return iconCache;
}

async function saveSelectionIds(selectedIds) {
  const icons = await getIcons();
  const selectedSet = new Set((Array.isArray(selectedIds) ? selectedIds : []).map((id) => String(id || '').trim()).filter(Boolean));
  const orderedIds = icons.filter((icon) => selectedSet.has(icon.id)).map((icon) => icon.id);
  fs.writeFileSync(SELECTION_PATH, `${JSON.stringify({ selectedIds: orderedIds }, null, 2)}\n`, 'utf8');
  return orderedIds;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function getHtml() {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>테마 퍼즐 원본 선택</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #eef4fb;
      --panel: #ffffff;
      --line: #b7c7d9;
      --ink: #10254a;
      --muted: #64748b;
      --blue: #228ed1;
      --blue2: #5bc5ff;
      --pink: #ff5a88;
      --green: #2faf85;
      --shadow: 8px 8px 0 rgba(16, 37, 74, 0.18);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, "Malgun Gothic", sans-serif;
      background: var(--bg);
      color: var(--ink);
    }
    header {
      position: sticky;
      top: 0;
      z-index: 5;
      background: rgba(238, 244, 251, 0.96);
      border-bottom: 2px solid var(--line);
      backdrop-filter: blur(8px);
    }
    .wrap {
      width: min(1180px, calc(100vw - 28px));
      margin: 0 auto;
      padding: 18px 0;
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.1;
      letter-spacing: 0;
    }
    .sub {
      color: var(--muted);
      font-size: 13px;
      margin-top: 5px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    button, select, input[type="search"] {
      font: inherit;
      border: 2px solid #14426d;
      border-radius: 8px;
      background: #fff;
      color: var(--ink);
      min-height: 38px;
    }
    button {
      cursor: pointer;
      font-weight: 800;
      padding: 0 14px;
      box-shadow: 3px 3px 0 rgba(20, 66, 109, 0.18);
    }
    button.primary {
      background: linear-gradient(135deg, var(--blue), var(--blue2));
      color: #fff;
    }
    button.green {
      background: var(--green);
      color: #fff;
    }
    button:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    .toolbar {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 10px;
      align-items: center;
      margin-top: 14px;
    }
    input[type="search"] {
      width: 100%;
      padding: 0 12px;
    }
    select {
      padding: 0 10px;
      font-weight: 700;
    }
    .tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 12px 0 2px;
    }
    .tab {
      white-space: nowrap;
      border-color: #2b5f91;
      box-shadow: none;
      min-height: 34px;
      background: #fff;
    }
    .tab.active {
      background: #10254a;
      color: #fff;
    }
    main .wrap {
      padding-top: 18px;
    }
    .summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(188px, 1fr));
      gap: 12px;
      padding-bottom: 40px;
    }
    .card {
      display: grid;
      grid-template-rows: 118px auto;
      min-height: 226px;
      background: var(--panel);
      border: 3px solid #14426d;
      border-radius: 8px;
      box-shadow: var(--shadow);
      overflow: hidden;
      cursor: pointer;
      position: relative;
    }
    .card.selected {
      outline: 4px solid var(--pink);
    }
    .preview {
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #ffffff, #edf5ff);
      border-bottom: 2px solid var(--line);
      padding: 16px;
    }
    .preview img {
      width: 76px;
      height: 76px;
      object-fit: contain;
      image-rendering: auto;
    }
    .meta {
      padding: 10px;
      min-width: 0;
    }
    .name {
      font-size: 15px;
      font-weight: 900;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .en {
      color: var(--muted);
      font-size: 12px;
      margin-top: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 10px;
    }
    .chip {
      border: 1px solid #b7c7d9;
      border-radius: 999px;
      padding: 3px 7px;
      font-size: 11px;
      color: #244466;
      background: #f8fbff;
      font-weight: 800;
    }
    .check {
      position: absolute;
      top: 8px;
      left: 8px;
      width: 24px;
      height: 24px;
      accent-color: var(--pink);
    }
    .status {
      min-height: 20px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
      margin-top: 8px;
    }
    @media (max-width: 720px) {
      .toolbar {
        grid-template-columns: 1fr;
      }
      .actions {
        width: 100%;
      }
      .actions button {
        flex: 1 1 130px;
      }
      .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .card {
        min-height: 214px;
        grid-template-rows: 104px auto;
      }
      .preview img {
        width: 66px;
        height: 66px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <div class="top">
        <div>
          <h1>테마 퍼즐 원본 선택</h1>
          <div class="sub">원본 SVG를 먼저 고르고, 선택한 것만 노노그램으로 만든다.</div>
        </div>
        <div class="actions">
          <button id="saveBtn" class="primary">선택 저장</button>
          <button id="buildBtn" class="green">선택한 것만 퍼즐 만들기</button>
        </div>
      </div>
      <div class="toolbar">
        <input id="search" type="search" placeholder="이름, 출처, id 검색" />
        <select id="sizeFilter"></select>
        <div class="actions">
          <button id="selectVisible">보이는 것 선택</button>
          <button id="clearVisible">보이는 것 해제</button>
        </div>
      </div>
      <div id="tabs" class="tabs"></div>
      <div id="status" class="status"></div>
    </div>
  </header>
  <main>
    <div class="wrap">
      <div class="summary">
        <div id="visibleCount">불러오는 중</div>
        <div id="selectedCount">0개 선택</div>
      </div>
      <div id="grid" class="grid"></div>
    </div>
  </main>
  <script>
    const state = {
      icons: [],
      selected: new Set(),
      theme: 'all',
      size: 'all',
      query: '',
      themes: [],
      sizes: [],
      busy: false,
    };

    const els = {
      tabs: document.getElementById('tabs'),
      grid: document.getElementById('grid'),
      search: document.getElementById('search'),
      sizeFilter: document.getElementById('sizeFilter'),
      selectedCount: document.getElementById('selectedCount'),
      visibleCount: document.getElementById('visibleCount'),
      status: document.getElementById('status'),
      saveBtn: document.getElementById('saveBtn'),
      buildBtn: document.getElementById('buildBtn'),
      selectVisible: document.getElementById('selectVisible'),
      clearVisible: document.getElementById('clearVisible'),
    };

    function getFilteredIcons() {
      const q = state.query.trim().toLowerCase();
      return state.icons.filter((icon) => {
        if (state.theme !== 'all' && icon.themeKey !== state.theme) return false;
        if (state.size !== 'all' && icon.sizeGroup !== state.size) return false;
        if (!q) return true;
        return [icon.id, icon.sourceName, icon.titleKo, icon.titleEn, icon.sourcePackLabel]
          .join(' ')
          .toLowerCase()
          .includes(q);
      });
    }

    function setBusy(isBusy, message) {
      state.busy = isBusy;
      els.saveBtn.disabled = isBusy;
      els.buildBtn.disabled = isBusy;
      els.status.textContent = message || '';
    }

    function renderTabs() {
      els.tabs.textContent = '';
      state.themes.forEach((theme) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tab' + (state.theme === theme.key ? ' active' : '');
        btn.textContent = theme.title;
        btn.addEventListener('click', () => {
          state.theme = theme.key;
          render();
        });
        els.tabs.appendChild(btn);
      });
    }

    function renderSizeFilter() {
      els.sizeFilter.textContent = '';
      state.sizes.forEach((size) => {
        const option = document.createElement('option');
        option.value = size.key;
        option.textContent = size.title;
        els.sizeFilter.appendChild(option);
      });
      els.sizeFilter.value = state.size;
    }

    function renderCard(icon) {
      const card = document.createElement('label');
      card.className = 'card' + (state.selected.has(icon.id) ? ' selected' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'check';
      checkbox.checked = state.selected.has(icon.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) state.selected.add(icon.id);
        else state.selected.delete(icon.id);
        render();
      });
      card.appendChild(checkbox);

      const preview = document.createElement('div');
      preview.className = 'preview';
      const img = document.createElement('img');
      img.src = icon.sourceUrl;
      img.alt = icon.titleEn || icon.sourceName;
      img.loading = 'lazy';
      preview.appendChild(img);
      card.appendChild(preview);

      const meta = document.createElement('div');
      meta.className = 'meta';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = icon.titleKo || icon.sourceName;
      const en = document.createElement('div');
      en.className = 'en';
      en.textContent = icon.titleEn || icon.id;
      const chips = document.createElement('div');
      chips.className = 'chips';
      [icon.themeTitle, icon.sizeTitleEn, icon.sourcePackLabel].forEach((text) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = text;
        chips.appendChild(chip);
      });
      meta.append(name, en, chips);
      card.appendChild(meta);
      return card;
    }

    function render() {
      renderTabs();
      renderSizeFilter();
      const visible = getFilteredIcons();
      els.selectedCount.textContent = state.selected.size + '개 선택';
      els.visibleCount.textContent = visible.length + '개 표시 / 전체 ' + state.icons.length + '개';
      els.grid.textContent = '';
      visible.forEach((icon) => els.grid.appendChild(renderCard(icon)));
    }

    async function saveSelection() {
      setBusy(true, '선택 저장 중');
      const res = await fetch('/api/selection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selectedIds: Array.from(state.selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');
      state.selected = new Set(data.selectedIds || []);
      setBusy(false, '저장 완료: ' + state.selected.size + '개');
      render();
    }

    async function buildSelection() {
      setBusy(true, '선택한 원본을 퍼즐로 만드는 중');
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selectedIds: Array.from(state.selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      const failed = data.failedCount ? ', 실패 ' + data.failedCount + '개' : '';
      setBusy(false, '퍼즐 생성 완료: ' + data.finalCount + '개' + failed);
    }

    els.search.addEventListener('input', () => {
      state.query = els.search.value;
      render();
    });
    els.sizeFilter.addEventListener('change', () => {
      state.size = els.sizeFilter.value;
      render();
    });
    els.selectVisible.addEventListener('click', () => {
      getFilteredIcons().forEach((icon) => state.selected.add(icon.id));
      render();
    });
    els.clearVisible.addEventListener('click', () => {
      getFilteredIcons().forEach((icon) => state.selected.delete(icon.id));
      render();
    });
    els.saveBtn.addEventListener('click', () => saveSelection().catch((error) => setBusy(false, error.message)));
    els.buildBtn.addEventListener('click', () => buildSelection().catch((error) => setBusy(false, error.message)));

    fetch('/api/icons')
      .then((res) => res.json())
      .then((data) => {
        state.icons = data.icons || [];
        state.selected = new Set(data.selectedIds || []);
        state.themes = data.themes || [];
        state.sizes = data.sizes || [];
        render();
        els.status.textContent = '원본 아이콘을 골라줘.';
      })
      .catch((error) => {
        els.status.textContent = error.message || '원본 목록을 불러오지 못했다.';
      });
  </script>
</body>
</html>`;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(getHtml());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/icons') {
      const icons = await getIcons();
      const themes = [{ key: 'all', title: '전체' }, ...THEME_DEFS.map(({ key, title }) => ({ key, title })), OTHER_THEME];
      const sizes = [
        { key: 'all', title: '전체 크기' },
        ...Object.entries(GROUPS).map(([key, group]) => ({ key, title: `${group.titleEn} (${group.targetSize})` })),
      ];
      sendJson(res, 200, { icons, themes, sizes, selectedIds: loadSelectionIds() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/selection') {
      const body = await readJsonBody(req);
      const selectedIds = await saveSelectionIds(body.selectedIds);
      sendJson(res, 200, { ok: true, selectedIds });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/build') {
      if (buildInProgress) {
        sendJson(res, 409, { ok: false, error: '이미 퍼즐 생성 중이다.' });
        return;
      }
      buildInProgress = true;
      try {
        const body = await readJsonBody(req);
        const selectedIds = await saveSelectionIds(body.selectedIds);
        const result = await generateIconPuzzles({ selectionPath: SELECTION_PATH, reportPath: REPORT_PATH, dedupeVariants: true });
        sendJson(res, 200, {
          ok: true,
          selectedCount: selectedIds.length,
          finalCount: result.report.finalCount,
          passedCount: result.report.passed.length,
          failedCount: result.report.failed.length,
          wroteOutputs: result.report.wroteOutputs,
          reportPath: REPORT_PATH,
        });
      } finally {
        buildInProgress = false;
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error?.message || String(error) });
  }
}

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Theme source selector running at http://${HOST}:${PORT}`);
});
