import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { closeView, getAnonymousKey, GoogleAdMob, setIosSwipeGestureEnabled } from "@apps-in-toss/web-framework";
import EmojiPicker from "emoji-picker-react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, CalendarDays, CheckCircle2, ChevronDown, Eraser, Flame, Home, Lightbulb, Lock, LogIn, Palette, Redo2, Shuffle, Square, Trophy, Undo2, User, UserPlus, Volume2, VolumeX, X } from "lucide-react";
import { GENERATED_CREATOR_SAMPLE_PUZZLES } from "./creatorSamples.generated";
import { GENERATED_DAILY_PUZZLES } from "./dailyPuzzles.generated";
import "./App.css";

const DEFAULT_API_BASE = "https://nonogram-api.onrender.com";

function normalizeApiBase(raw) {
  const value = String(raw || "").trim();
  if (!value) return DEFAULT_API_BASE;
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  if (value.startsWith("//")) return `https:${value}`.replace(/\/+$/, "");
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(value)) return `https://${value}`.replace(/\/+$/, "");
  return DEFAULT_API_BASE;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
const IS_APPS_IN_TOSS = import.meta.env.VITE_APPS_IN_TOSS === "true";
const BUILD_MODE = import.meta.env.MODE;
const REVIVE_AD_GROUP_ID = String(import.meta.env.VITE_REVIVE_AD_GROUP_ID || import.meta.env.VITE_REVIVE_AD_UNIT_ID || "").trim();
const REVIVE_AD_TEST_FALLBACK =
  import.meta.env.DEV || BUILD_MODE === "apk" || import.meta.env.VITE_SIMULATE_REWARD_AD === "true";
const MAX_HISTORY = 200;
const PUZZLE_MAX_HP = 3;
const PUZZLE_MAX_HINTS = 3;
const PUZZLE_HINT_REWARD_AMOUNT = 1;
const PUZZLE_HP_DAMAGE_MS = 820;
const PUZZLE_HINT_REVEAL_MS = 860;
const REVIVE_AD_TEST_MS = 850;
const REVIVE_AD_TIMEOUT_MS = 45000;
const SOLVED_REVEAL_DURATION_MS = 2600;
const SOLVED_PAINT_DEFAULT_PALETTE = ["#2563eb", "#60a5fa", "#1d4ed8", "#dbeafe"];

function getViewportWidth() {
  if (typeof window === "undefined") return 430;
  return Math.max(
    320,
    Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement?.clientWidth || 430)
  );
}

function getViewportHeight() {
  if (typeof window === "undefined") return 860;
  return Math.max(
    560,
    Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement?.clientHeight || 860)
  );
}

const SOLVED_PAINT_PALETTE_RULES = [
  { keys: ["ambulance", "구급차"], colors: ["#f8fafc", "#ef4444", "#2563eb", "#fee2e2"] },
  { keys: ["candy-cane", "사탕 지팡이"], colors: ["#f8fafc", "#ef4444", "#16a34a", "#fee2e2"] },
  { keys: ["cloud-rain", "rain cloud", "비 구름"], colors: ["#93c5fd", "#38bdf8", "#1d4ed8", "#e0f2fe"] },
  { keys: ["cake-slice", "케이크 한조각"], colors: ["#f9a8d4", "#fde68a", "#be185d", "#fff7ed"] },
  { keys: ["key-round", "동그란 열쇠"], colors: ["#facc15", "#f59e0b", "#92400e", "#fef3c7"] },
  { keys: ["moon-star", "별 달"], colors: ["#fde68a", "#818cf8", "#312e81", "#fff7ed"] },
  { keys: ["badge-alert", "경고 배지"], colors: ["#f97316", "#fde047", "#b91c1c", "#ffedd5"] },
  { keys: ["badge-check", "check badge", "체크 배지"], colors: ["#22c55e", "#86efac", "#15803d", "#dcfce7"] },
  { keys: ["badge-plus", "plus badge", "플러스 배지"], colors: ["#3b82f6", "#93c5fd", "#1d4ed8", "#dbeafe"] },
  { keys: ["heart", "하트"], colors: ["#e11d48", "#fb7185", "#9f1239", "#ffe4e6"] },
  { keys: ["gift", "선물"], colors: ["#dc2626", "#facc15", "#1d4ed8", "#fee2e2"] },
  { keys: ["fire", "불"], colors: ["#f97316", "#facc15", "#dc2626", "#ffedd5"] },
  { keys: ["moon", "달"], colors: ["#fde68a", "#a5b4fc", "#312e81", "#fff7ed"] },
  { keys: ["star", "sparkle", "반짝임", "별"], colors: ["#facc15", "#fde68a", "#f59e0b", "#fffbeb"] },
  { keys: ["light-bulb", "lamp", "bulb", "전구", "스탠드"], colors: ["#fde047", "#fbbf24", "#92400e", "#fff7ad"] },
  { keys: ["bell", "종"], colors: ["#facc15", "#fbbf24", "#b45309", "#fef3c7"] },
  { keys: ["key", "lock", "열쇠", "자물쇠"], colors: ["#facc15", "#f59e0b", "#78350f", "#fef3c7"] },
  { keys: ["medal", "trophy", "crown", "메달", "트로피", "왕관"], colors: ["#facc15", "#f59e0b", "#92400e", "#fef3c7"] },
  { keys: ["basketball", "농구공"], colors: ["#f97316", "#fb923c", "#7c2d12", "#ffedd5"] },
  { keys: ["apple", "cherry", "citrus", "사과", "체리", "감귤"], colors: ["#ef4444", "#f97316", "#15803d", "#fee2e2"] },
  { keys: ["banana", "바나나"], colors: ["#fde047", "#facc15", "#854d0e", "#fef9c3"] },
  { keys: ["grape", "포도"], colors: ["#7c3aed", "#a78bfa", "#4c1d95", "#ede9fe"] },
  { keys: ["bean", "콩"], colors: ["#84cc16", "#a3e635", "#3f6212", "#ecfccb"] },
  { keys: ["coffee", "beer", "커피", "맥주"], colors: ["#b45309", "#fbbf24", "#451a03", "#fef3c7"] },
  { keys: ["cake", "ice-cream", "croissant", "pizza", "hamburger", "sandwich", "bowl-food", "food", "케이크", "아이스크림", "크루아상", "피자", "햄버거", "샌드위치", "음식"], colors: ["#fb7185", "#fde68a", "#b45309", "#fff7ed"] },
  { keys: ["flower", "tulip", "lotus", "꽃", "튤립", "튀립", "연꽃"], colors: ["#ec4899", "#f9a8d4", "#16a34a", "#fce7f3"] },
  { keys: ["leaf", "sprout", "tree", "palm", "forest", "잎사귀", "새싹", "나무", "야자", "소나무", "숲"], colors: ["#16a34a", "#84cc16", "#166534", "#dcfce7"] },
  { keys: ["cloud", "snowflake", "bath", "구름", "눈송이", "욕조"], colors: ["#bfdbfe", "#60a5fa", "#1d4ed8", "#f0f9ff"] },
  { keys: ["umbrella", "우산"], colors: ["#7c3aed", "#38bdf8", "#4c1d95", "#ede9fe"] },
  { keys: ["globe", "lifebuoy", "지구", "구명튜브"], colors: ["#2563eb", "#22c55e", "#dc2626", "#dbeafe"] },
  { keys: ["car", "bus", "truck", "airplane", "rocket", "vehicle", "자동차", "버스", "트럭", "비행기", "로켓", "케이블카"], colors: ["#ef4444", "#60a5fa", "#1d4ed8", "#fee2e2"] },
  { keys: ["house", "store", "library", "castle", "lighthouse", "building", "집", "상점", "도서관", "성탑", "등대"], colors: ["#d97706", "#fbbf24", "#475569", "#ffedd5"] },
  { keys: ["book", "notebook", "bookmark", "ticket", "cardholder", "wallet", "책", "노트", "북마크", "티켓", "카드", "지갑"], colors: ["#2563eb", "#f97316", "#1e3a8a", "#dbeafe"] },
  { keys: ["camera", "photo", "film", "microphone", "music", "note", "카메라", "사진", "영화", "마이크", "음표"], colors: ["#7c3aed", "#38bdf8", "#312e81", "#ede9fe"] },
  { keys: ["game-controller", "lego", "smile", "게임", "레고", "스마일"], colors: ["#facc15", "#22c55e", "#2563eb", "#fef9c3"] },
  { keys: ["shield", "check", "방패", "체크"], colors: ["#2563eb", "#22c55e", "#1e3a8a", "#dbeafe"] },
  { keys: ["map-pin", "pin", "핀"], colors: ["#ef4444", "#fb7185", "#991b1b", "#fee2e2"] },
  { keys: ["chat", "bubble", "message", "notification", "말풍선", "알림"], colors: ["#38bdf8", "#a78bfa", "#1d4ed8", "#e0f2fe"] },
  { keys: ["user", "baby", "사용자", "아기"], colors: ["#fbbf24", "#fb7185", "#92400e", "#fef3c7"] },
  { keys: ["ghost", "유령"], colors: ["#f8fafc", "#c4b5fd", "#7c3aed", "#ffffff"] },
  { keys: ["milk", "우유"], colors: ["#f8fafc", "#93c5fd", "#1e3a8a", "#ffffff"] },
  { keys: ["soda", "음료"], colors: ["#ef4444", "#38bdf8", "#991b1b", "#fee2e2"] },
  { keys: ["cat", "dog", "rabbit", "squirrel", "paw", "bird", "turtle", "ant", "bug", "shrimp", "shell", "고양이", "강아지", "토끼", "발자국", "새", "거북이", "개미", "벌레", "새우", "조개"], colors: ["#f59e0b", "#fcd34d", "#92400e", "#fff7ed"] },
  { keys: ["hard-hat", "helmet", "cap", "안전모", "헬멧"], colors: ["#facc15", "#f59e0b", "#422006", "#fef3c7"] },
  { keys: ["hat", "backpack", "basket", "모자", "배낭", "바구니"], colors: ["#a16207", "#f59e0b", "#422006", "#fef3c7"] },
  { keys: ["clock", "alarm", "시계"], colors: ["#38bdf8", "#f8fafc", "#1e3a8a", "#e0f2fe"] },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBridgeMethodSupported(method) {
  try {
    return method?.isSupported?.() === true;
  } catch {
    return false;
  }
}

function cleanupBridgeListener(cleanup) {
  try {
    cleanup?.();
  } catch {
    // Native bridge cleanup can throw when the host has already disposed the listener.
  }
}

function isLocalNativeRuntime() {
  try {
    return window?.Capacitor?.isNativePlatform?.() === true || window?.location?.protocol === "capacitor:";
  } catch {
    return false;
  }
}

async function sha256Hex(value) {
  if (!window?.crypto?.subtle || typeof TextEncoder !== "function") {
    throw new Error("crypto_not_supported");
  }
  const bytes = new TextEncoder().encode(String(value || ""));
  const hash = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildTossGameAuthPayload(userHash) {
  const digest = await sha256Hex(userHash);
  return {
    username: `toss-${digest.slice(0, 18)}`,
    nickname: `토스유저${digest.slice(0, 8)}`,
    password: `Toss${digest.slice(0, 24)}9a`,
  };
}
const AUTH_TOKEN_KEY = "nonogram-auth-token";
const AUTH_USER_KEY = "nonogram-auth-user";
const PROFILE_AVATAR_LOCAL_OVERRIDES_KEY = "nonogram-local-profile-avatar-overrides";
const LANG_KEY = "nonogram-ui-lang";
const THEME_KEY = "nonogram-ui-theme";
const STYLE_VARIANT_KEY = "nonogram-ui-style-variant";
const SOUND_ENABLED_KEY = "nonogram-sound-enabled-v1";
const TUTORIAL_SEEN_KEY = "nonogram-tutorial-seen-v1";
const DAILY_PUZZLE_HISTORY_KEY = "nonogram-daily-puzzle-history-v1";
const SHOULD_PERSIST_DAILY_PUZZLE_HISTORY = true;
const MISSION_STATE_KEY = "nonogram-mission-state-v1";
const SHOULD_PERSIST_MISSION_STATE = true;
const APP_STATE_SAVE_DEBOUNCE_MS = 700;
const CREATOR_ADMIN_KEY = "nonogram-creator-admin-key";
const PVP_SIZE_KEYS = ["5x5", "10x10", "15x15", "20x20", "25x25"];
const PVP_BATTLE_SIZE_KEYS = ["5x5", "10x10", "15x15"];
const PVP_SIZE_KEYS_LOW_TIER = PVP_BATTLE_SIZE_KEYS;
const PVP_SIZE_KEYS_GOLD_TIER = PVP_BATTLE_SIZE_KEYS;
const PVP_SIZE_KEYS_DIAMOND_PLUS = PVP_BATTLE_SIZE_KEYS;
const APPS_IN_TOSS_SIZE_KEYS = ["5x5", "10x10", "15x15"];
const APPS_IN_TOSS_DEFAULT_SIZE = "10x10";
const SINGLE_SIZE_KEYS = IS_APPS_IN_TOSS ? APPS_IN_TOSS_SIZE_KEYS : PVP_SIZE_KEYS;
const CREATOR_DEFAULT_SIZE = IS_APPS_IN_TOSS ? 10 : 12;
const CREATOR_MAX_SIZE = IS_APPS_IN_TOSS ? 15 : 40;
const PVP_REVEAL_RESULT_HOLD_MS = 1600;
const SOUND_MASTER_GAIN_MAX = 0.34;
const CREATOR_REACTION_OPTIONS = [
  { key: "like", emoji: "👍", labelKo: "좋아요", labelEn: "Like" },
];
const CONTENT_PAGE_REDIRECTS = {
  "/about": "/about/index.html",
  "/how-to-play": "/how-to-play/index.html",
  "/pvp-guide": "/pvp-guide/index.html",
  "/ranking-guide": "/ranking-guide/index.html",
  "/updates": "/updates/index.html",
  "/faq": "/faq/index.html",
  "/privacy": "/privacy/index.html",
  "/terms": "/terms/index.html",
};
const MODE_TO_PATH = {
  menu: "/",
  single: "/single",
  create: "/create",
  multi: "/multi",
  pvp: "/pvp",
  placement_test: "/pvp",
  auth: "/auth",
  tutorial: "/tutorial",
  ranking: "/ranking",
  legacy_ranking: "/ranking-legacy",
  replay_hall: "/hall",
};
const PLACEMENT_TIME_LIMIT_SEC = 300;
const PLACEMENT_STAGES = [
  { key: "s1", sizeKey: "5x5", labelKo: "1번 퍼즐", labelEn: "Puzzle 1" },
  { key: "s2", sizeKey: "10x10", labelKo: "2번 퍼즐", labelEn: "Puzzle 2" },
  { key: "s3", sizeKey: "10x10", labelKo: "3번 퍼즐", labelEn: "Puzzle 3" },
  { key: "s4", sizeKey: "15x15", labelKo: "4번 퍼즐", labelEn: "Puzzle 4" },
  { key: "s5", sizeKey: "15x15", labelKo: "5번 퍼즐", labelEn: "Puzzle 5" },
];
const TIER_IMAGE_MAP = {
  bronze: "/tiers/bronze.png",
  silver: "/tiers/silver.png",
  gold: "/tiers/gold.png",
  diamond: "/tiers/diamond.png",
  master: "/tiers/master.png",
};
const TIER_GUIDE_IMAGE_MAP = {
  ko: "/tier-guide/ko.png",
  en: "/tier-guide/en.png",
};
const DEFAULT_PROFILE_AVATAR_KEY = "default-user";
const DEFAULT_PROFILE_AVATAR_OPTIONS = [
  { key: "default-user", labelKo: "스마일", labelEn: "Smile", emoji: "😎", colorA: "#8dc8ff", colorB: "#31568e" },
  { key: "default-ember", labelKo: "불꽃", labelEn: "Fire", emoji: "🔥", colorA: "#ffb26b", colorB: "#b24a1f" },
  { key: "default-rose", labelKo: "장미", labelEn: "Rose", emoji: "🌹", colorA: "#ff9cc4", colorB: "#a33d67" },
  { key: "default-mint", labelKo: "클로버", labelEn: "Clover", emoji: "🍀", colorA: "#91efc3", colorB: "#2d7c59" },
  { key: "default-violet", labelKo: "유니콘", labelEn: "Unicorn", emoji: "🦄", colorA: "#c4a7ff", colorB: "#6540ab" },
  { key: "default-cobalt", labelKo: "보석", labelEn: "Gem", emoji: "💎", colorA: "#8cb3ff", colorB: "#29478f" },
  { key: "default-sky", labelKo: "구름", labelEn: "Cloud", emoji: "☁️", colorA: "#9fe6ff", colorB: "#347aa0" },
  { key: "default-ocean", labelKo: "파도", labelEn: "Wave", emoji: "🌊", colorA: "#79d4ff", colorB: "#1e4f8a" },
  { key: "default-forest", labelKo: "숲", labelEn: "Forest", emoji: "🌲", colorA: "#7fd48c", colorB: "#275c39" },
  { key: "default-sage", labelKo: "잎", labelEn: "Leaf", emoji: "🌿", colorA: "#b9ddc3", colorB: "#4b6d55" },
  { key: "default-lavender", labelKo: "나비", labelEn: "Butterfly", emoji: "🦋", colorA: "#d4c2ff", colorB: "#7053b0" },
  { key: "default-orchid", labelKo: "벚꽃", labelEn: "Blossom", emoji: "🌸", colorA: "#f4b8ff", colorB: "#9545a3" },
  { key: "default-plum", labelKo: "포도", labelEn: "Grape", emoji: "🍇", colorA: "#c999d8", colorB: "#63356f" },
  { key: "default-crimson", labelKo: "하트", labelEn: "Heart", emoji: "❤️", colorA: "#ff8da1", colorB: "#8b2239" },
  { key: "default-coral", labelKo: "물고기", labelEn: "Fish", emoji: "🐠", colorA: "#ffaf93", colorB: "#a34934" },
  { key: "default-peach", labelKo: "복숭아", labelEn: "Peach", emoji: "🍑", colorA: "#ffd2a8", colorB: "#ad6a3f" },
  { key: "default-sand", labelKo: "별", labelEn: "Star", emoji: "⭐", colorA: "#ead4aa", colorB: "#907247" },
  { key: "default-lemon", labelKo: "레몬", labelEn: "Lemon", emoji: "🍋", colorA: "#fff08a", colorB: "#9a7e23" },
  { key: "default-lime", labelKo: "개구리", labelEn: "Frog", emoji: "🐸", colorA: "#d5ff7e", colorB: "#6c8e18" },
  { key: "default-teal", labelKo: "문어", labelEn: "Octopus", emoji: "🐙", colorA: "#84f0dc", colorB: "#1e7d72" },
  { key: "default-aqua", labelKo: "돌고래", labelEn: "Dolphin", emoji: "🐬", colorA: "#8cf6ff", colorB: "#1c7c88" },
  { key: "default-azure", labelKo: "고양이", labelEn: "Cat", emoji: "🐱", colorA: "#9ec8ff", colorB: "#2859a2" },
  { key: "default-navy", labelKo: "펭귄", labelEn: "Penguin", emoji: "🐧", colorA: "#7c98cb", colorB: "#22385e" },
  { key: "default-slate", labelKo: "곰", labelEn: "Bear", emoji: "🐻", colorA: "#c1ccda", colorB: "#516074" },
  { key: "default-silverline", labelKo: "로봇", labelEn: "Robot", emoji: "🤖", colorA: "#dfe5ef", colorB: "#6a7788" },
  { key: "default-goldline", labelKo: "왕관", labelEn: "Crown", emoji: "👑", colorA: "#ffe18d", colorB: "#a57217" },
  { key: "default-bronzeline", labelKo: "방패", labelEn: "Shield", emoji: "🛡️", colorA: "#e5b28a", colorB: "#8b512f" },
  { key: "default-berry", labelKo: "딸기", labelEn: "Strawberry", emoji: "🍓", colorA: "#f2a4d6", colorB: "#8e3f71" },
  { key: "default-fuchsia", labelKo: "무지개", labelEn: "Rainbow", emoji: "🌈", colorA: "#ff9cf8", colorB: "#9a2da1" },
  { key: "default-ruby", labelKo: "체리", labelEn: "Cherry", emoji: "🍒", colorA: "#ff9e9e", colorB: "#932d44" },
  { key: "default-ice", labelKo: "눈꽃", labelEn: "Snow", emoji: "❄️", colorA: "#d8fbff", colorB: "#4e87a6" },
  { key: "default-cloud", labelKo: "퍼즐", labelEn: "Puzzle", emoji: "🧩", colorA: "#edf2f7", colorB: "#778396" },
  { key: "default-night", labelKo: "달", labelEn: "Moon", emoji: "🌙", colorA: "#8da0c8", colorB: "#2c3553" },
  { key: "default-spring", labelKo: "꽃", labelEn: "Flower", emoji: "🌻", colorA: "#baf6b0", colorB: "#4f8a43" },
  { key: "default-sunset", labelKo: "태양", labelEn: "Sun", emoji: "☀️", colorA: "#ffc28b", colorB: "#bf5f33" },
  { key: "default-dawn", labelKo: "로켓", labelEn: "Rocket", emoji: "🚀", colorA: "#ffd7a8", colorB: "#996548" },
  { key: "default-trophy", labelKo: "트로피", labelEn: "Trophy", emoji: "🏆", colorA: "#ffd873", colorB: "#8e6320" },
  { key: "default-lock", labelKo: "잠금", labelEn: "Lock", emoji: "🔒", colorA: "#b7c2cf", colorB: "#475769" },
  { key: "default-sun", labelKo: "번개", labelEn: "Bolt", emoji: "⚡", colorA: "#ffcf73", colorB: "#b86c21" },
  { key: "default-moon", labelKo: "별밤", labelEn: "Night Sky", emoji: "✨", colorA: "#a9b8ff", colorB: "#4c569c" },
  { key: "default-settings", labelKo: "게임", labelEn: "Gamepad", emoji: "🎮", colorA: "#9fe0ff", colorB: "#2b6d8d" },
  { key: "default-home", labelKo: "집", labelEn: "Home", emoji: "🏠", colorA: "#8df0c1", colorB: "#2d7756" },
  { key: "default-sound", labelKo: "음표", labelEn: "Note", emoji: "🎵", colorA: "#f6a0ef", colorB: "#8a3c91" },
  { key: "default-undo", labelKo: "타겟", labelEn: "Target", emoji: "🎯", colorA: "#9ad6ff", colorB: "#2667a0" },
  { key: "default-redo", labelKo: "여우", labelEn: "Fox", emoji: "🦊", colorA: "#ffb28e", colorB: "#a24d34" },
  { key: "default-eraser", labelKo: "판다", labelEn: "Panda", emoji: "🐼", colorA: "#d3dae7", colorB: "#546173" },
  { key: "default-honey", labelKo: "꿀", labelEn: "Honey", emoji: "🍯", colorA: "#ffd979", colorB: "#aa6a18" },
  { key: "default-tiger", labelKo: "호랑이", labelEn: "Tiger", emoji: "🐯", colorA: "#ffc48a", colorB: "#aa5c1d" },
  { key: "default-rabbit", labelKo: "토끼", labelEn: "Rabbit", emoji: "🐰", colorA: "#ffd3e7", colorB: "#b65f88" },
  { key: "default-dog", labelKo: "강아지", labelEn: "Dog", emoji: "🐶", colorA: "#ffd9b0", colorB: "#a46c3c" },
  { key: "default-wolf", labelKo: "늑대", labelEn: "Wolf", emoji: "🐺", colorA: "#c8d3e7", colorB: "#5b6b84" },
  { key: "default-koala", labelKo: "코알라", labelEn: "Koala", emoji: "🐨", colorA: "#d6dde7", colorB: "#687485" },
  { key: "default-monkey", labelKo: "원숭이", labelEn: "Monkey", emoji: "🐵", colorA: "#e6c5a1", colorB: "#8b5f36" },
  { key: "default-chick", labelKo: "병아리", labelEn: "Chick", emoji: "🐤", colorA: "#fff0a0", colorB: "#a98422" },
  { key: "default-owl", labelKo: "부엉이", labelEn: "Owl", emoji: "🦉", colorA: "#d6c4aa", colorB: "#7a5c35" },
  { key: "default-turtle", labelKo: "거북이", labelEn: "Turtle", emoji: "🐢", colorA: "#b4eb8a", colorB: "#4b8134" },
  { key: "default-crab", labelKo: "게", labelEn: "Crab", emoji: "🦀", colorA: "#ffb79b", colorB: "#ab4e38" },
  { key: "default-mushroom", labelKo: "버섯", labelEn: "Mushroom", emoji: "🍄", colorA: "#ffd5c7", colorB: "#9b493d" },
  { key: "default-cactus", labelKo: "선인장", labelEn: "Cactus", emoji: "🌵", colorA: "#b6e99a", colorB: "#487d33" },
  { key: "default-pizza", labelKo: "피자", labelEn: "Pizza", emoji: "🍕", colorA: "#ffd59e", colorB: "#ae6631" },
  { key: "default-burger", labelKo: "버거", labelEn: "Burger", emoji: "🍔", colorA: "#f2cc8d", colorB: "#8c5c2c" },
  { key: "default-donut", labelKo: "도넛", labelEn: "Donut", emoji: "🍩", colorA: "#ffbfda", colorB: "#a44a78" },
  { key: "default-ball", labelKo: "공", labelEn: "Ball", emoji: "⚽", colorA: "#d9e5ef", colorB: "#55677a" },
  { key: "default-dice", labelKo: "주사위", labelEn: "Dice", emoji: "🎲", colorA: "#ecf2f9", colorB: "#6d7d8f" },
  { key: "default-headphone", labelKo: "헤드폰", labelEn: "Headphone", emoji: "🎧", colorA: "#bdd5ff", colorB: "#4c63a7" },
  { key: "default-book", labelKo: "책", labelEn: "Book", emoji: "📚", colorA: "#ffc56b", colorB: "#8c4f1f" },
  { key: "default-pencil", labelKo: "연필", labelEn: "Pencil", emoji: "✏️", colorA: "#ffd98f", colorB: "#8a6831" },
  { key: "default-lightbulb", labelKo: "전구", labelEn: "Bulb", emoji: "💡", colorA: "#fff08b", colorB: "#a0821c" },
  { key: "default-magnet", labelKo: "자석", labelEn: "Magnet", emoji: "🧲", colorA: "#ffb4b4", colorB: "#9c4052" },
  { key: "default-anchor", labelKo: "앵커", labelEn: "Anchor", emoji: "⚓", colorA: "#c6d5e6", colorB: "#516a86" },
];
const HALL_PROFILE_AVATAR_OPTIONS = PVP_SIZE_KEYS.flatMap((sizeKey) =>
  [1, 2, 3].map((rank) => ({
    key: `hall-${sizeKey}-${rank}`,
    sizeKey,
    rank,
    group: "hall",
    labelKo: `${sizeKey} ${rank}위`,
    labelEn: `${sizeKey} Rank ${rank}`,
    unlockHintKo: `${sizeKey} 명예의 전당 ${rank}위`,
    unlockHintEn: `${sizeKey} Hall of Fame Rank ${rank}`,
    imageSrc: `/profile/hall/${sizeKey}-${rank}.png`,
  }))
);
const LEGACY_SPECIAL_AVATAR_KEY_MAP = {
  "default-rank-1": "special-rating-1",
  "default-rank-2": "special-rating-2",
  "default-rank-3": "special-rating-3",
};
const RATING_SPECIAL_PROFILE_AVATAR_OPTIONS = [1, 2, 3].map((rank) => ({
  key: `special-rating-${rank}`,
  rank,
  group: "rating",
  labelKo: `레이팅 ${rank}위`,
  labelEn: `Rating #${rank}`,
  unlockHintKo: `레이팅 랭킹 ${rank}위`,
  unlockHintEn: `Rating leaderboard #${rank}`,
  imageSrc: `/profile/special/rating-${rank}.png`,
}));
const STREAK_SPECIAL_PROFILE_AVATAR_OPTIONS = [1, 2, 3].map((rank) => ({
  key: `special-streak-${rank}`,
  rank,
  group: "streak",
  labelKo: `최다 연승 ${rank}위`,
  labelEn: `Win Streak #${rank}`,
  unlockHintKo: `최다 연승 랭킹 ${rank}위`,
  unlockHintEn: `Best win streak #${rank}`,
  imageSrc: `/profile/special/streak-${rank}.png`,
}));
const TIER_SPECIAL_PROFILE_AVATAR_OPTIONS = ["bronze", "silver", "gold", "diamond", "master"].map((tierKey) => {
  const tier = getTierInfoByRating(
    tierKey === "master" ? 2500 : tierKey === "diamond" ? 2000 : tierKey === "gold" ? 1500 : tierKey === "silver" ? 1000 : 0
  );
  return {
    key: `special-tier-${tierKey}`,
    tierKey,
    group: "tier",
    labelKo: `${tier.labelKo} 프로필`,
    labelEn: `${tier.labelEn} Profile`,
    unlockHintKo: `${tier.labelKo} 이상 티어 달성`,
    unlockHintEn: `Reach ${tier.labelEn} tier or higher`,
    imageSrc: `/profile/special/tier-${tierKey}.png`,
  };
});
const SPECIAL_PROFILE_AVATAR_OPTIONS = [
  ...HALL_PROFILE_AVATAR_OPTIONS,
  ...TIER_SPECIAL_PROFILE_AVATAR_OPTIONS,
  ...RATING_SPECIAL_PROFILE_AVATAR_OPTIONS,
  ...STREAK_SPECIAL_PROFILE_AVATAR_OPTIONS,
];
const PLACEMENT_REVEAL_TEST_PRESETS = [
  { key: "bronze", rating: 820, solvedSequential: 1, elapsedSec: 292 },
  { key: "silver", rating: 1280, solvedSequential: 2, elapsedSec: 268 },
  { key: "gold", rating: 1760, solvedSequential: 3, elapsedSec: 241 },
  { key: "diamond", rating: 2140, solvedSequential: 4, elapsedSec: 222 },
  { key: "master", rating: 2580, solvedSequential: 5, elapsedSec: 208 },
];
const PVP_RESULT_FX_TEST_PRESETS = [
  { key: "bronze_win", labelKo: "브론즈 승리", labelEn: "Bronze Win", from: 742, to: 781, outcome: "win" },
  { key: "silver_win", labelKo: "실버 승리", labelEn: "Silver Win", from: 1164, to: 1198, outcome: "win" },
  { key: "gold_win", labelKo: "골드 승리", labelEn: "Gold Win", from: 1738, to: 1766, outcome: "win" },
  { key: "diamond_win", labelKo: "다이아 승리", labelEn: "Diamond Win", from: 2180, to: 2211, outcome: "win" },
  { key: "promotion", labelKo: "승급 테스트", labelEn: "Promotion Test", from: 1492, to: 1524, outcome: "win" },
  { key: "demotion", labelKo: "강등 테스트", labelEn: "Demotion Test", from: 1512, to: 1481, outcome: "loss" },
];
const MATCH_SIM_PROFILE_PRESETS = [
  { key: "bronze", rating: 820 },
  { key: "silver", rating: 1240 },
  { key: "gold", rating: 1760 },
  { key: "diamond", rating: 2180 },
  { key: "master", rating: 2630 },
];
const MATCH_SIM_MAX_WAIT_SEC = 50;
const MATCH_SIM_RECENT_IDS = ["h_silver_2", "h_gold_2"];
const MATCH_FLOW_TEST_BASE_RATING = 585;
const MATCH_FLOW_TEST_OPPONENT = {
  nickname: "ghost",
  rating: 612,
  ratingRank: 84,
};
const MATCH_SIM_POOL = [
  { id: "h_bronze_1", nickname: "Damon", rating: 862, isBot: false },
  { id: "h_bronze_2", nickname: "ghost", rating: 944, isBot: false },
  { id: "h_silver_1", nickname: "yukis", rating: 1188, isBot: false },
  { id: "h_silver_2", nickname: "소나", rating: 1364, isBot: false },
  { id: "h_gold_1", nickname: "vexxxx", rating: 1682, isBot: false },
  { id: "h_gold_2", nickname: "김득완", rating: 1811, isBot: false },
  { id: "h_diamond_1", nickname: "greeedy", rating: 2094, isBot: false },
  { id: "h_diamond_2", nickname: "러브식걸", rating: 2278, isBot: false },
  { id: "h_master_1", nickname: "눈구신데요", rating: 2582, isBot: false },
  { id: "h_master_2", nickname: "1등이되겠다", rating: 2710, isBot: false },
  { id: "b_silver_1", nickname: "Mika", rating: 1290, isBot: true },
  { id: "b_gold_1", nickname: "Juno", rating: 1718, isBot: true },
  { id: "b_gold_2", nickname: "Seth", rating: 1866, isBot: true },
  { id: "b_diamond_1", nickname: "Rin", rating: 2140, isBot: true },
  { id: "b_master_1", nickname: "Nova", rating: 2594, isBot: true },
];
const MATCH_SIM_STAGE_FLOW = [
  { key: "tight", startSec: 0, labelKo: "같은 티어 · ±120", labelEn: "Same tier · ±120" },
  { key: "widen", startSec: 10, labelKo: "같은 티어 · ±220", labelEn: "Same tier · ±220" },
  { key: "adjacent", startSec: 20, labelKo: "인접 티어 · ±350", labelEn: "Adjacent tier · ±350" },
  { key: "broad", startSec: 35, labelKo: "봇 후보 포함 · ±500", labelEn: "Bots included · ±500" },
  { key: "forced", startSec: 50, labelKo: "강제 매칭", labelEn: "Forced match" },
];
const CONTENT_PAGE_LINKS = [
  { href: "/about/index.html", labelKo: "게임 소개", labelEn: "About the Game" },
  { href: "/how-to-play/index.html", labelKo: "플레이 방법", labelEn: "How to Play" },
  { href: "/pvp-guide/index.html", labelKo: "PvP 가이드", labelEn: "Ranked PvP Guide" },
  { href: "/ranking-guide/index.html", labelKo: "랭킹 가이드", labelEn: "Ranking and Hall Guide" },
  { href: "/updates/index.html", labelKo: "업데이트", labelEn: "Patch Notes" },
  { href: "/faq/index.html", labelKo: "FAQ", labelEn: "FAQ" },
];
const HOME_MODE_CARDS = [
  {
    key: "single",
    eyebrowKo: "혼자 즐기는 모드",
    eyebrowEn: "Solo mode",
    titleKo: "싱글은 퍼즐을 차분하게 익히고 기록을 쌓는 모드입니다.",
    titleEn: "Practice clean solves and learn each board at your own pace.",
    bodyKo: "튜토리얼부터 일반 퍼즐, 유저 제작 퍼즐까지 혼자 풀면서 풀이 감각과 완주 기록을 차근차근 다질 수 있습니다.",
    bodyEn: "Single mode is built for repetition, timing, and puzzle understanding, from tutorial boards to larger clears and creator-made puzzles.",
  },
  {
    key: "multi",
    eyebrowKo: "함께 푸는 레이스",
    eyebrowEn: "Multiplayer race",
    titleKo: "멀티는 같은 보드를 동시에 시작해 먼저 끝내는 승부입니다.",
    titleEn: "Start together, solve the same puzzle, and race under pressure.",
    bodyKo: "로비에서 준비를 맞춘 뒤 같은 퍼즐을 동시에 열고, 속도와 정확도로 순위를 가르는 실시간 레이스를 즐길 수 있습니다.",
    bodyEn: "Multiplayer rooms are designed around quick starts and shared boards, so the focus stays on pace, accuracy, and finishing first.",
  },
  {
    key: "pvp",
    eyebrowKo: "등급전 모드",
    eyebrowEn: "Ranked PvP",
    titleKo: "PvP는 바로 매칭해서 같은 퍼즐로 겨루는 정식 대전 모드입니다.",
    titleEn: "Queue into direct duels with reveal and rating movement.",
    bodyKo: "비슷한 실력대의 상대와 같은 퍼즐을 동시에 풀고, 승패에 따라 티어, 연승, 랭킹이 함께 움직입니다.",
    bodyEn: "Face players around your skill band on the same puzzle, with wins and losses feeding directly into visible tiers, streaks, and ranking tables.",
  },
];
const HOME_SYSTEM_CARDS = [
  {
    key: "rating",
    titleKo: "티어와 레이팅",
    titleEn: "Visible tiers and rating",
    bodyKo: "브론즈부터 마스터까지 이어지는 티어 구조 위에서, PvP 결과에 따라 레이팅이 오르내리며 내 위치가 분명하게 보이도록 설계했습니다.",
    bodyEn: "Bronze through Master gives players a clear ladder to climb, while match results move rating in a way that feels legible from game to game.",
  },
  {
    key: "records",
    titleKo: "기록 시스템",
    titleEn: "Records worth chasing",
    bodyKo: "싱글 완주 기록, 명예의 전당 최고 기록, 현재 연승, 랭킹표가 서로 다른 목표를 보여줘서 플레이 성과가 한 가지 점수로만 묶이지 않습니다.",
    bodyEn: "Single clears, Hall of Fame best times, active streaks, and leaderboard positions each highlight a different kind of progress instead of collapsing everything into one score.",
  },
  {
    key: "creator",
    titleKo: "유저 제작 퍼즐",
    titleEn: "Creator-made puzzles",
    bodyKo: "직접 만든 퍼즐을 올리고 댓글과 리액션을 받으며, 공식 퍼즐 밖으로도 커뮤니티 퍼즐 라이브러리를 넓혀갈 수 있습니다.",
    bodyEn: "Players can submit their own boards, collect comments and reactions, and help build a library that extends beyond the official rotation.",
  },
];
const HOME_SCREEN_CARDS = [
  {
    key: "board",
    titleKo: "보드 화면",
    titleEn: "Board view",
    bodyKo: "힌트, 셀, 타이머, 수정 도구를 한 화면에 모아 두어 풀이 흐름을 끊지 않고 읽고 표시하고 되돌릴 수 있게 했습니다.",
    bodyEn: "Hints, cells, timer controls, and correction tools stay close to the solving surface so the player can read, mark, and recover without leaving the board.",
  },
  {
    key: "rank",
    titleKo: "랭킹 화면",
    titleEn: "Ranking tables",
    bodyKo: "현재 레이팅, 티어 분포, 내 순위를 빠르게 훑을 수 있도록 표 중심으로 정리한 화면입니다.",
    bodyEn: "The ranking surface is built for scanning: current rating, visible tier context, and relative standing can all be checked quickly.",
  },
  {
    key: "hall",
    titleKo: "명예의 전당",
    titleEn: "Hall of Fame",
    bodyKo: "퍼즐 크기별 최고 기록과 상위 연승 기록을 따로 보여줘서, 한 판 승패를 넘는 장기 목표를 만들 수 있습니다.",
    bodyEn: "Best times by board size and top streak lists create long-term goals for players who want something more durable than a single win.",
  },
];
const HOME_FAQ_ITEMS = [
  {
    key: "placement",
    questionKo: "PvP는 바로 플레이할 수 있나요?",
    questionEn: "Can I jump straight into ranked PvP?",
    answerKo: "네. 로그인하지 않아도 상대 매칭을 시작할 수 있고, 로그인하면 등급전 매칭으로 이어집니다.",
    answerEn: "Yes. You can start opponent matchmaking without login, and signed-in players can enter ranked matchmaking directly.",
  },
  {
    key: "single",
    questionKo: "싱글 기록과 명예의 전당 기록은 무엇이 다른가요?",
    questionEn: "How are Single records different from Hall of Fame records?",
    answerKo: "싱글은 내가 푼 퍼즐의 진행과 완주 기록을 중심으로 보고, 명예의 전당은 퍼즐 크기별 최고 타임 경쟁을 보여주는 공개 기록판입니다.",
    answerEn: "Single mode tracks your own clears and progression across boards, while Hall of Fame is built around public best-time targets by puzzle size.",
  },
  {
    key: "creator",
    questionKo: "유저 제작 퍼즐은 누구나 올릴 수 있나요?",
    questionEn: "Can players publish their own puzzles?",
    answerKo: "로그인한 유저라면 제작기에서 퍼즐을 만들고 제출할 수 있지만, 공개 목록에 보이는 퍼즐은 승인과 검수를 거쳐야 합니다.",
    answerEn: "Yes. Signed-in players can build and submit puzzles, but public listings are still filtered through approval and moderation.",
  },
  {
    key: "guide",
    questionKo: "처음 들어왔으면 어디부터 보면 좋나요?",
    questionEn: "Where should I start if I am new to the site?",
    answerKo: "플레이 방법 페이지부터 보고, 그다음 PvP와 랭킹 화면을 보면 티어, 명예의 전당, 등급전 흐름을 빠르게 이해할 수 있습니다.",
    answerEn: "Start with How to Play, then check PvP and Ranking if you want to understand tiers, Hall records, and ranked progression.",
  },
];
const HOME_UPDATE_ITEMS = [
  {
    key: "2026-03-22",
    date: "2026-03-22",
    titleKo: "콘텐츠 페이지와 정책 페이지를 새로 정리했습니다.",
    titleEn: "Content pages and policy pages were rebuilt.",
    bodyKo: "홈에서 게임 구조를 더 또렷하게 소개하고, 가이드, FAQ, 개인정보처리방침, 이용약관으로 바로 이동할 수 있게 정리했습니다.",
    bodyEn: "The home page now explains the game more clearly and points directly to dedicated guides, FAQ, privacy, and terms pages.",
  },
  {
    key: "2026-03-18",
    date: "2026-03-18",
    titleKo: "등급전 흐름을 더 매끈하게 다듬었습니다.",
    titleEn: "Ranked flow was tightened.",
    bodyKo: "매칭, 퍼즐 공개, 대전 시작 단계가 더 자연스럽게 이어지도록 상태 전환과 안내 흐름을 정리했습니다.",
    bodyEn: "Matchmaking, reveal, and start phases were tuned so the state changes feel easier to follow before the actual solve begins.",
  },
  {
    key: "2026-03-12",
    date: "2026-03-12",
    titleKo: "유저 제작 퍼즐과 토론 기능을 확장했습니다.",
    titleEn: "Creator submissions and discussion tools expanded.",
    bodyKo: "커뮤니티 목록, 댓글, 리액션, 승인 흐름을 넓혀서 유저 퍼즐을 공유하고 둘러보기 쉽게 만들었습니다.",
    bodyEn: "Community listings, comments, reactions, and review flow were expanded to make sharing player-made puzzles easier.",
  },
];
const MENU_TOUR_STEPS = [
  {
    key: "menu",
    imageSrc: "/site-tour/menu.png",
    shortKo: "메인",
    shortEn: "Home",
    summaryKo: "처음 들어왔을 때 전체 구조를 보는 시작 화면",
    summaryEn: "The starting screen for modes, guides, and updates",
    titleKo: "메인 화면에서 전체 구조를 먼저 파악합니다",
    titleEn: "Start by reading the whole structure from the main screen.",
    bodyKo:
      "처음 들어오면 모드 버튼, 가이드 링크, 최근 업데이트가 한곳에 모여 있어 사이트가 어떤 구조로 움직이는지 빠르게 파악할 수 있습니다.",
    bodyEn:
      "On first entry, mode buttons, guide links, and recent updates are grouped together so the site's structure is easy to understand quickly.",
    pointsKo: ["모드 선택", "가이드 링크", "최근 업데이트"],
    pointsEn: ["Mode entry", "Guide links", "Recent updates"],
    ctaKo: "메인에서 시작",
    ctaEn: "Start from Home",
    action: "menu",
  },
  {
    key: "auth",
    imageSrc: "/site-tour/auth.png",
    shortKo: "로그인",
    shortEn: "Auth",
    summaryKo: "멀티, PvP, 제작 기능을 쓰기 전에 거치는 화면",
    summaryEn: "The entry point for multiplayer, PvP, and creator features",
    titleKo: "로그인과 회원가입은 상단 버튼 또는 보호된 모드 진입 시 열립니다",
    titleEn: "Login and sign-up open from the top bar or when you enter protected modes.",
    bodyKo:
      "멀티, PvP, 제작 기능처럼 기록이 남는 화면은 계정 기반으로 동작합니다. 그래서 처음엔 로그인 화면을 거쳐 계정을 연결한 뒤 본격적인 경쟁과 제작 기능을 이용하게 됩니다.",
    bodyEn:
      "Persistent modes such as multiplayer, PvP, and creator tools are account-based, so you pass through the auth screen before using them fully.",
    pointsKo: ["로그인", "회원가입", "보호된 기능 진입"],
    pointsEn: ["Login", "Sign up", "Protected mode entry"],
    ctaKo: "로그인 화면 열기",
    ctaEn: "Open Auth",
    action: "auth",
  },
  {
    key: "tutorial",
    imageSrc: "/site-tour/tutorial.png",
    shortKo: "튜토리얼",
    shortEn: "Tutorial",
    summaryKo: "조작과 규칙을 짧게 익히는 입문 구간",
    summaryEn: "A short onboarding flow for rules and controls",
    titleKo: "튜토리얼로 조작과 힌트 읽는 법을 익힙니다",
    titleEn: "Use the tutorial to learn controls and clue reading.",
    bodyKo:
      "노노그램이 낯설다면 튜토리얼에서 채우기, 표시하기, 되돌리기 흐름을 먼저 익히고 실제 퍼즐로 넘어가는 편이 훨씬 안정적입니다.",
    bodyEn:
      "If nonograms are new to you, learning fill, mark, and undo flow in the tutorial makes the jump to real puzzles much smoother.",
    pointsKo: ["기본 규칙", "보드 조작", "실전 진입 준비"],
    pointsEn: ["Basic rules", "Board controls", "Ready for real play"],
    ctaKo: "튜토리얼 열기",
    ctaEn: "Open Tutorial",
    action: "tutorial",
  },
  {
    key: "single",
    imageSrc: "/site-tour/single.png",
    shortKo: "싱글",
    shortEn: "Single",
    summaryKo: "혼자 풀면서 기록과 풀이 감각을 쌓는 모드",
    summaryEn: "A solo mode for records and puzzle feel",
    titleKo: "싱글에서 퍼즐 이해와 완주 기록을 쌓습니다",
    titleEn: "Build puzzle understanding and clear records in Single.",
    bodyKo:
      "혼자 차분히 퍼즐을 풀면서 힌트 읽는 감각을 익히고, 더 빠르고 정확한 완주를 목표로 반복 연습하기 좋은 공간입니다.",
    bodyEn:
      "Single is the best place to learn clue flow, repeat boards, and improve clean, accurate clears at your own pace.",
    pointsKo: ["차분한 풀이", "개인 기록", "반복 연습"],
    pointsEn: ["Calm solving", "Personal records", "Repeat practice"],
    ctaKo: "싱글 들어가기",
    ctaEn: "Open Single",
    action: "single",
  },
  {
    key: "multi",
    imageSrc: "/site-tour/multi.png",
    shortKo: "멀티",
    shortEn: "Multi",
    summaryKo: "방을 만들거나 참가해 같은 보드를 동시에 푸는 화면",
    summaryEn: "A live race on the same board",
    titleKo: "멀티에서는 방을 만들고 같은 퍼즐을 동시에 시작합니다",
    titleEn: "In Multi, everyone starts the same puzzle and races for placement.",
    bodyKo:
      "로비에서 준비를 맞춘 뒤 같은 보드를 열고, 누가 먼저 완주하는지 겨루는 방식이라 속도와 안정감이 동시에 중요해집니다.",
    bodyEn:
      "After readying in a room, everyone opens the same board together, making both pace and stability matter.",
    pointsKo: ["로비 준비", "동시 시작", "실시간 순위"],
    pointsEn: ["Lobby ready", "Shared start", "Live placement"],
    ctaKo: "멀티 열기",
    ctaEn: "Open Multi",
    action: "multi",
  },
  {
    key: "pvp",
    imageSrc: "/site-tour/pvp.png",
    shortKo: "PvP",
    shortEn: "PvP",
    summaryKo: "바로 진입하는 정식 경쟁 모드",
    summaryEn: "Structured ranked play with direct matchmaking",
    titleKo: "PvP는 티어와 레이팅이 실제로 반영되는 경쟁 모드입니다",
    titleEn: "PvP is the competitive mode where tiers and rating really move.",
    bodyKo:
      "비슷한 실력의 상대를 찾고, 같은 퍼즐이 공개되면 승패와 함께 레이팅이 갱신됩니다.",
    bodyEn:
      "You face similar opponents, then play a rated match on the revealed puzzle.",
    pointsKo: ["바로 매칭", "동일 퍼즐", "레이팅 변화"],
    pointsEn: ["Direct queue", "Same puzzle", "Rating movement"],
    ctaKo: "PvP 열기",
    ctaEn: "Open PvP",
    action: "pvp",
  },
  {
    key: "ranking",
    imageSrc: "/site-tour/ranking.png",
    shortKo: "랭킹",
    shortEn: "Ranking",
    summaryKo: "현재 레이팅과 순위를 빠르게 확인하는 화면",
    summaryEn: "A fast view of rating and leaderboard position",
    titleKo: "랭킹 화면에서는 지금 내 위치를 빠르게 확인할 수 있습니다",
    titleEn: "The ranking screen makes your current standing easy to check.",
    bodyKo:
      "레이팅, 티어, 순위가 표 중심으로 정리되어 있어 지금 어느 구간에 있는지, 누가 앞서 있는지를 한눈에 훑을 수 있습니다.",
    bodyEn:
      "Rating, tier, and rank are arranged in a scan-friendly table so you can quickly see where you stand.",
    pointsKo: ["현재 순위", "티어 분포", "비교 확인"],
    pointsEn: ["Current rank", "Tier spread", "Easy comparison"],
    ctaKo: "랭킹 열기",
    ctaEn: "Open Ranking",
    action: "ranking",
  },
  {
    key: "hall",
    imageSrc: "/site-tour/hall.png",
    shortKo: "명예의 전당",
    shortEn: "Hall",
    summaryKo: "퍼즐 크기별 최고 기록과 연승을 보는 화면",
    summaryEn: "Best times and streaks by board size",
    titleKo: "명예의 전당은 장기 목표를 보여주는 기록판입니다",
    titleEn: "Hall of Fame is the board for long-term goals.",
    bodyKo:
      "퍼즐 크기별 최고 기록과 상위 연승 기록이 따로 모여 있어, 단순한 한 판 승패를 넘어서 꾸준한 실력을 추적할 수 있습니다.",
    bodyEn:
      "Best times by puzzle size and top streak lists create a longer-term target beyond a single match result.",
    pointsKo: ["사이즈별 기록", "상위 연승", "장기 목표"],
    pointsEn: ["Size records", "Top streaks", "Long-term goals"],
    ctaKo: "명예의 전당 열기",
    ctaEn: "Open Hall",
    action: "hall",
  },
  {
    key: "create",
    imageSrc: "/site-tour/create.png",
    shortKo: "제작기",
    shortEn: "Creator",
    summaryKo: "직접 퍼즐을 만들고 제출하는 공간",
    summaryEn: "A place to build and submit your own puzzles",
    titleKo: "제작기에서 유저 퍼즐을 만들고 커뮤니티에 공유할 수 있습니다",
    titleEn: "Use Creator to build puzzles and share them with the community.",
    bodyKo:
      "퍼즐을 직접 설계하고 제출한 뒤 댓글과 리액션을 통해 반응을 볼 수 있어, 사이트 전체가 소비형 콘텐츠를 넘어 제작형 공간으로 확장됩니다.",
    bodyEn:
      "By creating boards, submitting them, and collecting reactions, the site expands from puzzle consumption into puzzle creation.",
    pointsKo: ["직접 제작", "제출과 검수", "댓글과 리액션"],
    pointsEn: ["Build directly", "Submit and review", "Comments and reactions"],
    ctaKo: "제작기 열기",
    ctaEn: "Open Creator",
    action: "create",
  },
];
const TIER_ORDER = {
  bronze: 0,
  silver: 1,
  gold: 2,
  diamond: 3,
  master: 4,
};

function normalizePath(pathname) {
  let path = pathname || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path === "/index.html") return "/";
  path = path.replace(/\/+$/, "");
  return path || "/";
}

function getModeFromPath(pathname) {
  const path = normalizePath(pathname);
  if (path === "/single") return "single";
  if (path === "/create") return "create";
  if (path === "/multi") return "multi";
  if (path === "/pvp") return "pvp";
  if (path === "/placement") return "pvp";
  if (path === "/placement-test") return "pvp";
  if (path === "/auth") return "auth";
  if (path === "/tutorial") return "tutorial";
  if (path === "/ranking") return "ranking";
  if (path === "/ranking-legacy") return "legacy_ranking";
  if (path === "/hall") return "replay_hall";
  return "menu";
}

function getPathFromMode(mode) {
  return MODE_TO_PATH[mode] || "/";
}

function normalizeUiLang(raw) {
  return String(raw || "").toLowerCase() === "ko" ? "ko" : "en";
}

function normalizeUiStyleVariant(raw) {
  return "default";
}

function getTierInfoByRating(ratingRaw, rankRaw = null) {
  const rating = Math.max(0, Math.round(Number(ratingRaw || 0)));
  if (rating >= 2500) {
    return { key: "master", labelKo: "마스터", labelEn: "Master" };
  }
  if (rating >= 2000) return { key: "diamond", labelKo: "다이아", labelEn: "Diamond" };
  if (rating >= 1500) return { key: "gold", labelKo: "골드", labelEn: "Gold" };
  if (rating >= 1000) return { key: "silver", labelKo: "실버", labelEn: "Silver" };
  return { key: "bronze", labelKo: "브론즈", labelEn: "Bronze" };
}

function getRankingTierInfoByRating(ratingRaw, rankRaw = null) {
  const rank = Number(rankRaw || 0);
  if (Number.isInteger(rank) && rank >= 1 && rank <= 3) {
    return { key: "challenger", labelKo: "챌린저", labelEn: "Challenger" };
  }
  return getTierInfoByRating(ratingRaw, rankRaw);
}

function isGoldOrHigherTierKey(raw) {
  const tierKey = String(raw || "").trim().toLowerCase();
  return tierKey === "gold" || tierKey === "diamond" || tierKey === "master";
}

function getPvpSizeBracketByTierKey(raw) {
  const tierKey = String(raw || "").trim().toLowerCase();
  if (tierKey === "diamond" || tierKey === "master") return "diamond_plus";
  if (tierKey === "gold") return "gold";
  return "low";
}

function getPvpAllowedSizeKeysForBracket(bracket) {
  if (bracket === "diamond_plus") return PVP_SIZE_KEYS_DIAMOND_PLUS;
  if (bracket === "gold") return PVP_SIZE_KEYS_GOLD_TIER;
  return PVP_SIZE_KEYS_LOW_TIER;
}

function getAllowedPvpSizeKeys(players, viewerUser) {
  const playerTierKeys = Array.isArray(players)
    ? players
        .map((player) => getTierInfoByRating(player?.rating, player?.ratingRank).key)
        .filter(Boolean)
    : [];

  if (playerTierKeys.length >= 2) {
    const bracketPriority = { low: 0, gold: 1, diamond_plus: 2 };
    const lowestBracket = playerTierKeys
      .map((tierKey) => getPvpSizeBracketByTierKey(tierKey))
      .reduce(
        (current, next) => (bracketPriority[next] < bracketPriority[current] ? next : current),
        "diamond_plus"
      );
    return getPvpAllowedSizeKeysForBracket(lowestBracket);
  }

  const viewerTierKey =
    String(viewerUser?.placement_tier_key || "").trim().toLowerCase() ||
    getTierInfoByRating(viewerUser?.placement_rating ?? viewerUser?.rating, viewerUser?.ratingRank).key;

  return getPvpAllowedSizeKeysForBracket(getPvpSizeBracketByTierKey(viewerTierKey));
}

function parseHallProfileAvatarKey(raw) {
  const value = String(raw || "").trim().toLowerCase();
  const normalized = LEGACY_SPECIAL_AVATAR_KEY_MAP[value] || value;
  const option = HALL_PROFILE_AVATAR_OPTIONS.find((entry) => entry.key === normalized);
  if (!option) return null;
  return option;
}

function getSpecialProfileAvatarOption(raw) {
  const value = String(raw || "").trim().toLowerCase();
  const normalized = LEGACY_SPECIAL_AVATAR_KEY_MAP[value] || value;
  return SPECIAL_PROFILE_AVATAR_OPTIONS.find((entry) => entry.key === normalized) || null;
}

function isSpecialProfileAvatarKey(raw) {
  return !!getSpecialProfileAvatarOption(raw);
}

function getDefaultProfileAvatarOption(rawKey) {
  const key = String(rawKey || "").trim().toLowerCase();
  return DEFAULT_PROFILE_AVATAR_OPTIONS.find((option) => option.key === key) || DEFAULT_PROFILE_AVATAR_OPTIONS[0];
}

function getProfileAvatarMeta(rawKey) {
  const special = getSpecialProfileAvatarOption(rawKey);
  if (special) {
    return { type: "special", ...special };
  }
  return { type: "default", ...getDefaultProfileAvatarOption(rawKey) };
}

function normalizeProfileAvatarKey(rawKey) {
  const special = getSpecialProfileAvatarOption(rawKey);
  if (special) return special.key;
  return getDefaultProfileAvatarOption(rawKey).key;
}

function readLocalProfileAvatarOverrides() {
  try {
    const raw = localStorage.getItem(PROFILE_AVATAR_LOCAL_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getProfileAvatarOverrideStorageKey(user) {
  const id = Number(user?.id);
  if (Number.isInteger(id) && id > 0) return `id:${id}`;
  const username = String(user?.username || "").trim().toLowerCase();
  if (username) return `username:${username}`;
  return "";
}

function getLocalProfileAvatarOverride(user) {
  const key = getProfileAvatarOverrideStorageKey(user);
  if (!key) return "";
  const overrides = readLocalProfileAvatarOverrides();
  return normalizeProfileAvatarKey(overrides[key] || "");
}

function writeLocalProfileAvatarOverride(user, avatarKey) {
  const key = getProfileAvatarOverrideStorageKey(user);
  if (!key) return;
  try {
    const overrides = readLocalProfileAvatarOverrides();
    overrides[key] = normalizeProfileAvatarKey(avatarKey);
    localStorage.setItem(PROFILE_AVATAR_LOCAL_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // ignore localStorage errors
  }
}

function applyLocalProfileAvatarOverride(user) {
  if (!user || typeof user !== "object") return user;
  const override = getLocalProfileAvatarOverride(user);
  if (!override) {
    if (user.profile_avatar_key) return { ...user, profile_avatar_key: normalizeProfileAvatarKey(user.profile_avatar_key) };
    return { ...user, profile_avatar_key: DEFAULT_PROFILE_AVATAR_KEY };
  }
  return { ...user, profile_avatar_key: override };
}

function ProfileAvatar({ avatarKey, nickname = "", size = "md" }) {
  const meta = getProfileAvatarMeta(avatarKey);
  const label = nickname ? `${nickname} avatar` : "avatar";
  if (meta.type === "hall") {
    return (
      <span className={`profileAvatar profileAvatar-${size} hall`}>
        <img src={meta.imageSrc} alt={label} />
      </span>
    );
  }
  if (meta.imageSrc) {
    return (
      <span className={`profileAvatar profileAvatar-${size} defaultImageAvatar ${meta.key}`}>
        <img src={meta.imageSrc} alt={label} />
      </span>
    );
  }
  if (meta.emoji) {
    return (
      <span
        className={`profileAvatar profileAvatar-${size} defaultAvatar emojiAvatar ${meta.key}`}
        style={{ "--avatar-a": meta.colorA, "--avatar-b": meta.colorB }}
        aria-label={label}
      >
        <span className={`profileAvatarEmoji profileAvatarEmoji-${size}`}>{meta.emoji}</span>
      </span>
    );
  }
  const Icon = meta.Icon || User;
  const iconSize = size === "xl" ? 44 : size === "picker" ? 38 : size === "lg" ? 28 : size === "sm" ? 14 : 18;
  return (
    <span
      className={`profileAvatar profileAvatar-${size} defaultAvatar ${meta.key}`}
      style={{ "--avatar-a": meta.colorA, "--avatar-b": meta.colorB }}
      aria-label={label}
    >
      <Icon size={iconSize} strokeWidth={2.2} />
    </span>
  );
}

function getTierBracketInfo(ratingRaw, rankRaw = null) {
  const rating = Math.max(0, Math.round(Number(ratingRaw || 0)));
  const tier = getTierInfoByRating(rating, rankRaw);
  let min = 0;
  let max = 1000;
  let nextTier = getTierInfoByRating(1000);

  if (tier.key === "silver") {
    min = 1000;
    max = 1500;
    nextTier = getTierInfoByRating(1500);
  } else if (tier.key === "gold") {
    min = 1500;
    max = 2000;
    nextTier = getTierInfoByRating(2000);
  } else if (tier.key === "diamond") {
    min = 2000;
    max = 2500;
    nextTier = getTierInfoByRating(2500);
  } else if (tier.key === "master") {
    min = 2500;
    max = 3000;
    nextTier = null;
  }

  const span = Math.max(1, max - min);
  const progress = Math.max(0, Math.min(100, ((Math.min(rating, max) - min) / span) * 100));

  return {
    tier,
    min,
    max,
    progress,
    nextTier,
  };
}

function getMatchSimRule(waitSecRaw) {
  const waitSec = Math.max(0, Math.floor(Number(waitSecRaw || 0)));
  if (waitSec < 10) {
    return {
      key: "tight",
      maxDiff: 120,
      allowAdjacent: false,
      botsEnabled: false,
      humanChance: 0.18,
      botChance: 0,
      labelKo: "같은 티어 · ±120 · 사람만 탐색",
      labelEn: "Same tier · ±120 · human only",
    };
  }
  if (waitSec < 20) {
    return {
      key: "same_tier_wide",
      maxDiff: 220,
      allowAdjacent: false,
      botsEnabled: false,
      humanChance: 0.28,
      botChance: 0,
      labelKo: "같은 티어 · ±220 · 탐색 범위 확장",
      labelEn: "Same tier · ±220 · widened search",
    };
  }
  if (waitSec < 35) {
    return {
      key: "adjacent",
      maxDiff: 350,
      allowAdjacent: true,
      botsEnabled: false,
      humanChance: 0.4,
      botChance: 0,
      labelKo: "인접 티어 허용 · ±350",
      labelEn: "Adjacent tier allowed · ±350",
    };
  }
  if (waitSec < 50) {
    return {
      key: "broad",
      maxDiff: 500,
      allowAdjacent: true,
      botsEnabled: true,
      humanChance: 0.52,
      botChance: 0.34,
      labelKo: "넓은 탐색 · ±500 · 봇 후보 포함",
      labelEn: "Broad search · ±500 · bots included",
    };
  }
  return {
    key: "forced",
    maxDiff: 9999,
    allowAdjacent: true,
    botsEnabled: true,
    humanChance: 1,
    botChance: 1,
    labelKo: "강제 매칭 단계",
    labelEn: "Forced match stage",
  };
}

function pickMatchSimCandidate(playerRatingRaw, waitSecRaw, recentIds = MATCH_SIM_RECENT_IDS) {
  const playerRating = Math.max(0, Math.round(Number(playerRatingRaw || 0)));
  const rule = getMatchSimRule(waitSecRaw);
  const myTier = getTierInfoByRating(playerRating);
  const playerTierOrder = TIER_ORDER[myTier.key] || 0;

  const eligible = MATCH_SIM_POOL.filter((candidate) => {
    const diff = Math.abs(Number(candidate.rating) - playerRating);
    if (diff > rule.maxDiff) return false;
    const candidateTier = getTierInfoByRating(candidate.rating);
    const tierDistance = Math.abs((TIER_ORDER[candidateTier.key] || 0) - playerTierOrder);
    if (rule.allowAdjacent) return tierDistance <= 1;
    return tierDistance === 0;
  });

  const humans = eligible
    .filter((candidate) => !candidate.isBot && !recentIds.includes(candidate.id))
    .map((candidate) => ({
      ...candidate,
      tier: getTierInfoByRating(candidate.rating),
      source: "human",
      score: Math.abs(candidate.rating - playerRating) + Math.random() * 38,
    }))
    .sort((a, b) => a.score - b.score);

  if (humans.length > 0 && (Math.random() < rule.humanChance || rule.key === "forced")) {
    return {
      ...humans[0],
      matchedAtSec: Math.max(1, Math.floor(Number(waitSecRaw || 0))),
      reasonKo: "사람 우선 규칙으로 매칭",
      reasonEn: "Matched through human-first search",
      rule,
    };
  }

  if (!rule.botsEnabled) return null;

  const bots = eligible
    .filter((candidate) => candidate.isBot)
    .map((candidate) => ({
      ...candidate,
      tier: getTierInfoByRating(candidate.rating),
      source: "bot",
      score: Math.abs(candidate.rating - playerRating) + Math.random() * 54,
    }))
    .sort((a, b) => a.score - b.score);

  if (bots.length > 0 && (Math.random() < rule.botChance || rule.key === "forced")) {
    return {
      ...bots[0],
      matchedAtSec: Math.max(1, Math.floor(Number(waitSecRaw || 0))),
      reasonKo: "대기 시간이 길어져 봇 후보까지 포함",
      reasonEn: "Queue widened to bot candidates after waiting",
      rule,
    };
  }

  return null;
}

function getMatchSimQueueSize(waitSecRaw, playerRatingRaw = 1500) {
  const waitSec = Math.max(0, Math.floor(Number(waitSecRaw || 0)));
  const tier = getTierInfoByRating(playerRatingRaw);
  const tierBoost =
    tier.key === "bronze"
      ? 2
      : tier.key === "silver"
        ? 3
        : tier.key === "gold"
          ? 4
          : tier.key === "diamond"
            ? 3
            : 2;
  const wave = [0, 1, 0, 2, 1, 0, 3, 1][waitSec % 8];
  const widenBoost = waitSec >= 35 ? 2 : waitSec >= 20 ? 1 : 0;
  return Math.max(1, Math.min(9, tierBoost + wave + widenBoost));
}

function getMatchSimOutcomeTarget(fromRatingRaw, mode) {
  const from = Math.max(0, Math.round(Number(fromRatingRaw || 0)));
  const bracket = getTierBracketInfo(from);
  if (mode === "promotion") {
    if (bracket.tier.key === "master") {
      return { to: from + 36, result: "win" };
    }
    return { to: Math.max(from + 18, bracket.max + 18), result: "win" };
  }
  if (mode === "demotion") {
    if (bracket.min <= 0) {
      return { to: Math.max(0, from - 32), result: "loss" };
    }
    return { to: Math.max(0, bracket.min - 22), result: "loss" };
  }
  if (mode === "loss") {
    const lossValue = from >= 2500 ? 22 : from >= 2000 ? 20 : from >= 1500 ? 18 : 16;
    return { to: Math.max(0, from - lossValue), result: "loss" };
  }
  const winValue = from >= 2500 ? 24 : from >= 2000 ? 28 : from >= 1500 ? 32 : 36;
  return { to: from + winValue, result: "win" };
}

function evaluatePlacementResult(rawResults, elapsedSecRaw, currentStageProgressRaw = 0) {
  const elapsedSec = Math.max(1, Math.min(PLACEMENT_TIME_LIMIT_SEC, Math.floor(Number(elapsedSecRaw || 0))));
  const currentStageProgress = Math.max(0, Math.min(1, Number(currentStageProgressRaw || 0)));
  const results = Array.isArray(rawResults) ? rawResults : [];
  let solvedSequential = 0;
  for (const r of results) {
    if (r?.status === "solved") solvedSequential += 1;
    else break;
  }

  let minRating = 0;
  let maxRating = 999;
  if (solvedSequential >= 5) {
    minRating = 2210;
    maxRating = 2499;
  } else if (solvedSequential === 4) {
    minRating = 1760;
    maxRating = 1995;
  } else if (solvedSequential === 3) {
    minRating = 1220;
    maxRating = 1589;
  } else if (solvedSequential === 2) {
    minRating = 820;
    maxRating = 1099;
  } else if (solvedSequential === 1) {
    minRating = 420;
    maxRating = 959;
  } else {
    minRating = 0;
    maxRating = 519;
  }

  const timeScore = Math.max(0, Math.min(1, (PLACEMENT_TIME_LIMIT_SEC - elapsedSec) / PLACEMENT_TIME_LIMIT_SEC));
  const performance = Math.max(0, Math.min(1, 0.14 + 0.72 * Math.sqrt(timeScore)));

  const currentStage = results[solvedSequential];
  const hasPendingCurrent = currentStage && currentStage.status === "pending";
  const stageProgress = hasPendingCurrent ? currentStageProgress : 0;
  const stageBonusCap =
    solvedSequential >= 4 ? 90 : solvedSequential === 3 ? 85 : solvedSequential === 2 ? 70 : solvedSequential === 1 ? 44 : 28;
  const stageProgressBonus = Math.round(stageBonusCap * Math.pow(stageProgress, 0.96));

  const rating = Math.round(
    Math.max(0, Math.min(2499, minRating + (maxRating - minRating) * performance + stageProgressBonus))
  );
  const tier = getTierInfoByRating(rating);
  return {
    rating,
    tier,
    solvedSequential,
    elapsedSec,
    timeScore,
    performance,
    stageProgress,
    stageProgressBonus,
  };
}

function toSheetColumnLabel(index) {
  let n = Number(index) + 1;
  if (!Number.isFinite(n) || n <= 0) return "";
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

const TUTORIAL_GUIDE_STEPS = [
  {
    key: "row2full",
    title: "2번째 줄 힌트 5",
    prompt: "힌트가 5라서 이 줄은 빈칸 없이 꽉 찹니다. 2번째 줄을 모두 채우세요.",
    promptEn: "Hint 5 means the entire row is filled. Paint all cells in row 2.",
    rowHighlights: [1],
    fill: [5, 6, 7, 8, 9],
  },
  {
    key: "row3full",
    title: "3번째 줄 힌트 5",
    prompt: "위쪽이 이미 확정돼 경계가 잡혔어요. 3번째 줄도 전부 채우면 됩니다.",
    promptEn: "The boundary is already fixed from above, so row 3 is also fully filled.",
    rowHighlights: [2],
    fill: [10, 11, 12, 13, 14],
  },
  {
    key: "row4gaps",
    title: "4번째 줄 힌트 1 1 1",
    prompt: "힌트 1-1-1은 각 칸이 떨어져야 하니, 사이칸(2칸·4칸)을 X로 막아주세요.",
    promptEn: "For clue 1-1-1, each filled cell must be separated. Mark gaps (2nd, 4th) with X.",
    rowHighlights: [3],
    mark: [16, 18],
    cellHighlights: [16, 18],
  },
  {
    key: "row4fills",
    title: "4번째 줄 채우기",
    prompt: "막힌 칸 사이로 가능한 자리가 확정됐습니다. 1·3·5칸을 채우세요.",
    promptEn: "Now only the valid slots remain between blocked cells. Fill 1st, 3rd, and 5th.",
    rowHighlights: [3],
    fill: [15, 17, 19],
    cellHighlights: [15, 17, 19],
  },
  {
    key: "row1pair",
    title: "1번째 줄 힌트 1 1",
    prompt: "아래 줄이 이미 막고 있어서 더 내려갈 수 없어요. 1번째 줄은 가운데 두 칸만 채우면 1,1이 맞습니다.",
    promptEn: "The row below blocks further expansion, so only the two center cells fit clue 1,1.",
    rowHighlights: [0],
    fill: [1, 3],
    cellHighlights: [1, 3],
  },
  {
    key: "row5three",
    title: "5번째 줄 힌트 3",
    prompt: "세로 힌트와 맞춰보면 마지막 줄은 중앙 3칸만 가능합니다. 가운데 3칸을 채우세요.",
    promptEn: "Cross-checking column clues, only the middle three cells are possible in the last row.",
    rowHighlights: [4],
    fill: [21, 22, 23],
    cellHighlights: [21, 22, 23],
  },
  {
    key: "finish",
    title: "완성",
    prompt: "좋아요. 논리대로 모두 맞췄고 퍼즐이 완성됐습니다.",
    promptEn: "Great. You solved the puzzle logically and completed it.",
    requireSolved: true,
  },
];

const TUTORIAL_LESSONS = [
  {
    key: "row-full",
    badge: "STEP 1",
    titleKo: "기본 규칙 (가로)",
    titleEn: "Basic Rule (Rows)",
    bodyKo: ["숫자는 연속해서 칠해야 하는 칸의 수입니다.", "숫자 5는 5칸을 모두 칠하라는 뜻입니다."],
    bodyEn: ["A number tells you how many connected cells to fill.", "A 5 means all five cells in the row are filled."],
    width: 5,
    height: 1,
    rowHints: [[5]],
    colHints: [[1], [1], [1], [1], [1]],
    answer: [1, 1, 1, 1, 1],
  },
  {
    key: "col-full",
    badge: "STEP 2",
    titleKo: "기본 규칙 (세로)",
    titleEn: "Basic Rule (Columns)",
    bodyKo: ["세로 줄도 똑같습니다.", "위쪽 숫자를 보고 아래로 5칸을 칠해보세요."],
    bodyEn: ["Columns work the same way.", "Read the top clue and fill five cells downward."],
    width: 1,
    height: 5,
    rowHints: [[1], [1], [1], [1], [1]],
    colHints: [[5]],
    answer: [1, 1, 1, 1, 1],
  },
  {
    key: "split-hints",
    badge: "STEP 3",
    titleKo: "숫자가 여러 개일 때",
    titleEn: "When There Are Multiple Numbers",
    bodyKo: ["1 1처럼 숫자가 두 개 이상이면", "그 사이에는 최소 한 칸 이상의 빈칸이 필요합니다."],
    bodyEn: ["When clues look like 1 1,", "there must be at least one empty cell between groups."],
    width: 5,
    height: 1,
    rowHints: [[1, 1]],
    colHints: [[1], [0], [0], [1], [0]],
    answer: [1, 2, 2, 1, 2],
  },
  {
    key: "use-x",
    badge: "STEP 4",
    titleKo: "X 표시 활용하기",
    titleEn: "Use X Marks",
    bodyKo: ["확실히 칠하지 않는 칸에는 X 표시를 해두면 편합니다.", "X 모드로 빈칸을 막아보세요."],
    bodyEn: ["Mark cells that are definitely empty with X.", "Use X mode to block impossible cells."],
    width: 1,
    height: 5,
    rowHints: [[1], [0], [1], [1], [0]],
    colHints: [[3]],
    answer: [1, 2, 1, 1, 2],
  },
  {
    key: "heart-practice",
    badge: "FINAL",
    titleKo: "실전 연습: 하트",
    titleEn: "Practice: Heart",
    bodyKo: ["가로와 세로 숫자를 모두 확인하며", "하트 모양을 완성해보세요."],
    bodyEn: ["Use both row and column clues", "to complete the heart shape."],
    width: 5,
    height: 5,
    rowHints: [[1, 1], [5], [5], [1, 1, 1], [3]],
    colHints: [[3], [3, 1], [4], [3, 1], [3]],
    answer: [
      2, 1, 2, 1, 2,
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
      1, 2, 1, 2, 1,
      2, 1, 1, 1, 2,
    ],
  },
];

function createTutorialLessonCells(lesson) {
  const total = Math.max(0, Number(lesson?.width || 0) * Number(lesson?.height || 0));
  return new Array(total).fill(0);
}

function normalizeTutorialLessonCells(lesson, cells) {
  const total = Math.max(0, Number(lesson?.width || 0) * Number(lesson?.height || 0));
  const next = Array.isArray(cells) ? cells.slice(0, total) : [];
  while (next.length < total) next.push(0);
  return next.map((value) => (value === 1 || value === 2 ? value : 0));
}

function isTutorialLessonSolved(lesson, cells) {
  if (!lesson || !Array.isArray(lesson.answer)) return false;
  const normalized = normalizeTutorialLessonCells(lesson, cells);
  return lesson.answer.every((expected, index) => normalized[index] === expected);
}

function toBase64Bits(cells, width, height) {
  const byteLength = Math.ceil((width * height) / 8);
  const out = new Uint8Array(byteLength);

  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i] === 1) {
      out[Math.floor(i / 8)] |= 1 << (i % 8);
    }
  }

  let binary = "";
  for (const b of out) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64Bits(bitsBase64, width, height) {
  const total = width * height;
  const cells = new Array(total).fill(0);
  if (!bitsBase64 || typeof bitsBase64 !== "string") return cells;
  let binary = "";
  try {
    binary = atob(bitsBase64);
  } catch {
    return cells;
  }
  const byteLen = Math.ceil(total / 8);
  for (let i = 0; i < total; i += 1) {
    const b = i < byteLen ? (binary.charCodeAt(Math.floor(i / 8)) || 0) : 0;
    cells[i] = ((b >> (i % 8)) & 1) === 1 ? 1 : 0;
  }
  return cells;
}

function cellsFromPackedBytes(bytesLike, width, height) {
  const total = width * height;
  let bytes = null;
  if (ArrayBuffer.isView(bytesLike)) bytes = bytesLike;
  else if (Array.isArray(bytesLike)) bytes = bytesLike;
  else if (bytesLike && Array.isArray(bytesLike.data)) bytes = bytesLike.data;
  if (!bytes) return null;

  const cells = new Array(total).fill(0);
  for (let i = 0; i < total; i += 1) {
    const byte = Number(bytes[Math.floor(i / 8)]) || 0;
    cells[i] = ((byte >> (i % 8)) & 1) === 1 ? 1 : 0;
  }
  return cells;
}

function cellsFromPackedHex(hexValue, width, height) {
  const raw = String(hexValue || "").trim().replace(/^\\x/i, "");
  if (!raw || raw.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(raw)) return null;
  const bytes = [];
  for (let i = 0; i < raw.length; i += 2) {
    bytes.push(Number.parseInt(raw.slice(i, i + 2), 16));
  }
  return cellsFromPackedBytes(bytes, width, height);
}

function cellsFromPackedBase64(bitsBase64, width, height) {
  if (!bitsBase64 || typeof bitsBase64 !== "string" || typeof atob !== "function") return null;
  const total = width * height;
  let binary = "";
  try {
    binary = atob(bitsBase64);
  } catch {
    return null;
  }
  const cells = new Array(total).fill(0);
  const byteLen = Math.ceil(total / 8);
  for (let i = 0; i < total; i += 1) {
    const b = i < byteLen ? (binary.charCodeAt(Math.floor(i / 8)) || 0) : 0;
    cells[i] = ((b >> (i % 8)) & 1) === 1 ? 1 : 0;
  }
  return cells;
}

function normalizePuzzleSolutionCells(values, width, height) {
  if (!Array.isArray(values)) return null;
  const total = width * height;
  const cells = values.slice(0, total).map((value) =>
    value === 1 || value === true || value === "1" || value === "#" ? 1 : 0
  );
  while (cells.length < total) cells.push(0);
  return cells;
}

function getPuzzleSolutionCells(puzzle) {
  const width = Number(puzzle?.width);
  const height = Number(puzzle?.height);
  if (!puzzle || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;

  const direct = normalizePuzzleSolutionCells(puzzle.solution || puzzle.cells || puzzle.answer || puzzle.answers, width, height);
  if (direct) return direct;

  const packedKeys = [
    "solution_bits",
    "solutionBits",
    "solution_bits_base64",
    "solutionBase64",
    "solution_hex",
    "solutionHex",
  ];
  for (const key of packedKeys) {
    const value = puzzle[key];
    const fromBytes = cellsFromPackedBytes(value, width, height);
    if (fromBytes) return fromBytes;
    if (typeof value === "string") {
      const fromHex = cellsFromPackedHex(value, width, height);
      if (fromHex) return fromHex;
      const fromBase64 = cellsFromPackedBase64(value, width, height);
      if (fromBase64) return fromBase64;
    }
  }
  return null;
}

function hashTextToUint(text) {
  let hash = 2166136261;
  const source = String(text || "");
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function seededCellScore(seed, index) {
  let value = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function buildThemeStarterMarkIndices(puzzle) {
  const width = Number(puzzle?.width);
  const height = Number(puzzle?.height);
  const solution = getPuzzleSolutionCells(puzzle);
  if (!solution || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return [];

  const total = width * height;
  const blankIndices = [];
  for (let index = 0; index < Math.min(total, solution.length); index += 1) {
    if (solution[index] !== 1) blankIndices.push(index);
  }
  if (!blankIndices.length) return [];

  const sizeTarget =
    total <= 25
      ? 4
      : total <= 100
        ? 12
        : total <= 225
          ? 22
          : Math.round(total * 0.085);
  const target = Math.max(1, Math.min(blankIndices.length, Math.min(sizeTarget, Math.round(blankIndices.length * 0.32))));
  const rowCap = Math.max(1, Math.ceil(width * 0.26));
  const colCap = Math.max(1, Math.ceil(height * 0.26));
  const seed = hashTextToUint(`${puzzle.id || ""}:${puzzle.creatorPuzzleId || ""}:${width}x${height}`);
  const candidates = blankIndices
    .map((index) => ({ index, score: seededCellScore(seed, index) }))
    .sort((a, b) => a.score - b.score);

  const picked = [];
  const rowCounts = new Array(height).fill(0);
  const colCounts = new Array(width).fill(0);
  for (const candidate of candidates) {
    const x = candidate.index % width;
    const y = Math.floor(candidate.index / width);
    if (rowCounts[y] >= rowCap || colCounts[x] >= colCap) continue;
    picked.push(candidate.index);
    rowCounts[y] += 1;
    colCounts[x] += 1;
    if (picked.length >= target) break;
  }
  for (const candidate of candidates) {
    if (picked.length >= target) break;
    if (!picked.includes(candidate.index)) picked.push(candidate.index);
  }
  return picked.sort((a, b) => a - b);
}

function getRuns(line) {
  const runs = [];
  let count = 0;
  for (const v of line) {
    if (v === 1) count += 1;
    else if (count > 0) {
      runs.push(count);
      count = 0;
    }
  }
  if (count > 0) runs.push(count);
  return runs;
}

function cluesEqual(line, clues) {
  const runs = getRuns(line);
  if (runs.length !== clues.length) return false;
  for (let i = 0; i < runs.length; i += 1) {
    if (runs[i] !== clues[i]) return false;
  }
  return true;
}

function collectSolvedLineSets(sourceCells, puzzle, rowHints, colHints) {
  const rows = new Set();
  const cols = new Set();
  if (!puzzle || !Array.isArray(sourceCells) || sourceCells.length !== puzzle.width * puzzle.height) {
    return { rows, cols };
  }

  for (let y = 0; y < puzzle.height; y += 1) {
    const row = sourceCells.slice(y * puzzle.width, (y + 1) * puzzle.width);
    if (cluesEqual(row, rowHints[y] || [])) rows.add(y);
  }
  for (let x = 0; x < puzzle.width; x += 1) {
    const col = [];
    for (let y = 0; y < puzzle.height; y += 1) col.push(sourceCells[y * puzzle.width + x]);
    if (cluesEqual(col, colHints[x] || [])) cols.add(x);
  }

  return { rows, cols };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - (1 - t) ** 3;
}

function getSolvedPaintDescriptor(puzzle) {
  return [
    puzzle?.creatorPuzzleId,
    puzzle?.id,
    puzzle?.titleKo,
    puzzle?.titleEn,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function solvedPaintKeyMatches(descriptor, key) {
  const normalizedKey = String(key || "").toLowerCase().trim();
  if (!normalizedKey) return false;
  if (/^[a-z0-9 -]+$/.test(normalizedKey)) {
    const escaped = normalizedKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(descriptor);
  }
  return descriptor.includes(normalizedKey);
}

function getSolvedPaintPalette(puzzle) {
  const descriptor = getSolvedPaintDescriptor(puzzle);
  const rule = SOLVED_PAINT_PALETTE_RULES.find((item) =>
    item.keys.some((key) => solvedPaintKeyMatches(descriptor, key))
  );
  return rule?.colors || SOLVED_PAINT_DEFAULT_PALETTE;
}

function getSolvedPaintColor(puzzle, x, y, palette = getSolvedPaintPalette(puzzle)) {
  const [base, accent = base, shade = base, light = accent] = palette;
  const width = Math.max(1, Number(puzzle?.width || 1));
  const height = Math.max(1, Number(puzzle?.height || 1));
  const xRatio = width <= 1 ? 0.5 : x / (width - 1);
  const yRatio = height <= 1 ? 0.5 : y / (height - 1);
  const edgeCell = x === 0 || y === 0 || x === width - 1 || y === height - 1;
  const softHighlight = yRatio < 0.24 && (x + y) % 2 === 0;
  const diagonalGlint = Math.abs(xRatio - yRatio) < 0.12 && (x + y) % 3 === 0;

  if (softHighlight) return light;
  if (edgeCell || yRatio > 0.72) return shade;
  if (diagonalGlint) return accent;
  return base;
}

function getSolvedPreviewPixelStyle(puzzle, index, value, palette = getSolvedPaintPalette(puzzle)) {
  if (value !== 1 && value !== "#") return undefined;
  const width = Math.max(1, Number(puzzle?.width || 1));
  const x = index % width;
  const y = Math.floor(index / width);
  return { backgroundColor: getSolvedPaintColor(puzzle, x, y, palette) };
}

function clampCreatorSize(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed)) return CREATOR_DEFAULT_SIZE;
  return Math.max(5, Math.min(CREATOR_MAX_SIZE, parsed));
}

function normalizeCreatorCells(cells, total) {
  if (!Array.isArray(cells)) return new Array(total).fill(0);
  const normalized = cells.slice(0, total).map((value) => (value === 1 ? 1 : 0));
  while (normalized.length < total) normalized.push(0);
  return normalized;
}

function buildCreatorPuzzle(width, height, cells, meta = {}) {
  const total = width * height;
  const normalized = normalizeCreatorCells(cells, total);
  const row_hints = Array.from({ length: height }, (_, y) =>
    getRuns(normalized.slice(y * width, (y + 1) * width))
  );
  const col_hints = Array.from({ length: width }, (_, x) => {
    const col = [];
    for (let y = 0; y < height; y += 1) col.push(normalized[y * width + x]);
    return getRuns(col);
  });
  return {
    id: meta.id || `custom-${width}x${height}`,
    width,
    height,
    row_hints,
    col_hints,
    solution: normalized.slice(),
    isCustom: true,
    isCustomPreview: Boolean(meta.isPreview),
    isCustomLibrary: Boolean(meta.isLibrary),
    isThemePuzzle: Boolean(meta.isThemePuzzle),
    isCommunityPuzzle: Boolean(meta.isCommunity),
    isDailyPuzzle: Boolean(meta.isDailyPuzzle),
    dailyDate: meta.dailyDate || "",
    creatorPuzzleId: String(meta.creatorPuzzleId || meta.id || ""),
    createdByNickname: meta.createdByNickname || "",
    titleKo: meta.titleKo || "",
    titleEn: meta.titleEn || "",
  };
}

function createCreatorSample(id, titleKo, titleEn, rows) {
  const height = rows.length;
  const width = rows[0]?.length || 0;
  const cells = rows.flatMap((row) => Array.from(row).map((cell) => (cell === "#" ? 1 : 0)));
  return {
    id,
    titleKo,
    titleEn,
    width,
    height,
    cells,
  };
}

const DEFAULT_CREATOR_SAMPLE_PUZZLES = GENERATED_CREATOR_SAMPLE_PUZZLES
  .map((sample) => ({
    ...createCreatorSample(sample.id, sample.titleKo, sample.titleEn, sample.rows),
    sizeGroup: sample.sizeGroup || "medium",
    groupTitleKo: sample.groupTitleKo || "미디엄",
    groupTitleEn: sample.groupTitleEn || "Medium",
    license: sample.license || "",
    targetSize: sample.targetSize || sample.width || 0,
    sourceUrl: sample.sourceUrl || "",
    isSolved: sample.isSolved === true,
    solvedAt: sample.solvedAt || "",
    bestElapsedSec: Number(sample.bestElapsedSec || 0),
    lastElapsedSec: Number(sample.lastElapsedSec || 0),
    solveCount: Number(sample.solveCount || 0),
  }));

const DEFAULT_DAILY_SAMPLE_PUZZLES = GENERATED_DAILY_PUZZLES
  .map((sample) => ({
    ...createCreatorSample(sample.id, sample.titleKo, sample.titleEn, sample.rows),
    sourceIconId: sample.sourceIconId || "",
    sourcePack: sample.sourcePack || "",
    sourceName: sample.sourceName || "",
    sizeGroup: "daily",
    groupTitleKo: "일일퀴즈",
    groupTitleEn: "Daily",
  }))
  .filter((sample) => sample.width > 0 && sample.height > 0 && sample.cells?.length === sample.width * sample.height);

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAILY_WEEKDAY_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DAILY_WEEKDAY_LABELS_EN = ["S", "M", "T", "W", "T", "F", "S"];

function makeDateKey(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateKeyParts(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

function getKstDateKey(date = new Date()) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  return makeDateKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function addDaysToDateKey(dateKey, amount) {
  const parts = parseDateKeyParts(dateKey) || parseDateKeyParts(getKstDateKey());
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + amount * DAY_MS);
  return makeDateKey(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

function normalizeDailyPuzzleHistory(value) {
  const source = value && typeof value === "object" && value.solves && typeof value.solves === "object"
    ? value.solves
    : {};
  const solves = {};
  Object.entries(source).forEach(([dateKey, entry]) => {
    if (!parseDateKeyParts(dateKey)) return;
    solves[dateKey] = entry && typeof entry === "object" ? { ...entry } : { solvedAt: Number(entry || 0) };
  });
  return { solves };
}

function clearStoredDailyPuzzleState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DAILY_PUZZLE_HISTORY_KEY);
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("nonogram-progress-daily-")) localStorage.removeItem(key);
    });
  } catch {
    // Daily quiz test state is disposable.
  }
}

function readDailyPuzzleHistory() {
  if (!SHOULD_PERSIST_DAILY_PUZZLE_HISTORY) {
    clearStoredDailyPuzzleState();
    return { solves: {} };
  }
  if (typeof window === "undefined") return { solves: {} };
  try {
    const raw = localStorage.getItem(DAILY_PUZZLE_HISTORY_KEY);
    if (!raw) return { solves: {} };
    return normalizeDailyPuzzleHistory(JSON.parse(raw));
  } catch {
    return { solves: {} };
  }
}

function writeDailyPuzzleHistory(value) {
  if (!SHOULD_PERSIST_DAILY_PUZZLE_HISTORY) return;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DAILY_PUZZLE_HISTORY_KEY, JSON.stringify(normalizeDailyPuzzleHistory(value)));
  } catch {
    // Daily puzzle history is a retention helper, so storage failures should not block play.
  }
}

function getDailyPuzzleIndex(dateKey, count) {
  if (!count) return 0;
  let hash = 2166136261;
  for (let i = 0; i < String(dateKey).length; i += 1) {
    hash ^= String(dateKey).charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % count;
}

function getDailyPuzzleForDate(samples, dateKey) {
  const pool = Array.isArray(samples) ? samples.filter((sample) => sample?.cells?.length) : [];
  if (!pool.length) return null;
  return pool[getDailyPuzzleIndex(dateKey, pool.length)];
}

function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getDailyMonthCells(dateKey, history) {
  const parts = parseDateKeyParts(dateKey) || parseDateKeyParts(getKstDateKey());
  const firstDay = new Date(Date.UTC(parts.year, parts.month - 1, 1)).getUTCDay();
  const daysInMonth = getDaysInMonth(parts.year, parts.month);
  const solves = normalizeDailyPuzzleHistory(history).solves;
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ key: `blank-start-${index}`, isBlank: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDateKey = makeDateKey(parts.year, parts.month, day);
    cells.push({
      key: cellDateKey,
      dateKey: cellDateKey,
      day,
      isSolved: Boolean(solves[cellDateKey]),
      isToday: cellDateKey === dateKey,
      isFuture: cellDateKey > dateKey,
      isBlank: false,
    });
  }

  while (cells.length < 42) {
    cells.push({ key: `blank-end-${cells.length}`, isBlank: true });
  }
  return cells.slice(0, 42);
}

function getDailyPuzzleStreak(history, todayKey) {
  const solves = normalizeDailyPuzzleHistory(history).solves;
  let cursor = solves[todayKey] ? todayKey : addDaysToDateKey(todayKey, -1);
  let streak = 0;
  while (solves[cursor]) {
    streak += 1;
    cursor = addDaysToDateKey(cursor, -1);
    if (streak > 366) break;
  }
  return streak;
}

function getDailyMonthSolvedCount(history, todayKey) {
  const parts = parseDateKeyParts(todayKey) || parseDateKeyParts(getKstDateKey());
  const prefix = `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-`;
  const solves = normalizeDailyPuzzleHistory(history).solves;
  return Object.keys(solves).filter((dateKey) => dateKey.startsWith(prefix) && dateKey <= todayKey).length;
}

function formatDailyMonthLabel(dateKey, lang) {
  const parts = parseDateKeyParts(dateKey) || parseDateKeyParts(getKstDateKey());
  if (lang === "ko") return `${parts.month}월`;
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(Date.UTC(parts.year, parts.month - 1, 1)));
}

function getDailySolvedDateKey(solvedPuzzle) {
  return String(solvedPuzzle?.dailyDate || "").trim() || getKstDateKey();
}

function buildDailySolvedHistory(history, solvedPuzzle, solvedAt = Date.now()) {
  const dateKey = getDailySolvedDateKey(solvedPuzzle);
  const puzzleId = String(solvedPuzzle?.creatorPuzzleId || solvedPuzzle?.id || "").trim();
  const current = normalizeDailyPuzzleHistory(history);
  return {
    solves: {
      ...current.solves,
      [dateKey]: {
        puzzleId,
        titleKo: solvedPuzzle?.titleKo || "",
        titleEn: solvedPuzzle?.titleEn || "",
        solvedAt,
      },
    },
  };
}

function pickDailySolveEntry(leftEntry, rightEntry) {
  if (!leftEntry) return rightEntry;
  if (!rightEntry) return leftEntry;
  const left = leftEntry && typeof leftEntry === "object" ? leftEntry : { solvedAt: Number(leftEntry || 0) };
  const right = rightEntry && typeof rightEntry === "object" ? rightEntry : { solvedAt: Number(rightEntry || 0) };
  const leftAt = Math.max(0, Number(left.solvedAt || 0));
  const rightAt = Math.max(0, Number(right.solvedAt || 0));
  const merged = rightAt >= leftAt ? { ...left, ...right } : { ...right, ...left };
  merged.solvedAt = Math.max(leftAt, rightAt);
  return merged;
}

function mergeDailyPuzzleHistories(leftHistory, rightHistory) {
  const left = normalizeDailyPuzzleHistory(leftHistory);
  const right = normalizeDailyPuzzleHistory(rightHistory);
  const solves = { ...left.solves };
  Object.entries(right.solves).forEach(([dateKey, entry]) => {
    solves[dateKey] = pickDailySolveEntry(solves[dateKey], entry);
  });
  return { solves };
}

function buildDailyCompletionResult(solvedPuzzle, history, elapsedMs, elapsedSec = 0) {
  const dateKey = getDailySolvedDateKey(solvedPuzzle);
  const nextHistory = buildDailySolvedHistory(history, solvedPuzzle);
  return {
    dateKey,
    titleKo: solvedPuzzle?.titleKo || "",
    titleEn: solvedPuzzle?.titleEn || "",
    sizeText: solvedPuzzle?.width && solvedPuzzle?.height ? `${solvedPuzzle.width}x${solvedPuzzle.height}` : "",
    elapsedMs: Math.max(0, Number(elapsedMs || 0)),
    elapsedSec: Math.max(0, Number(elapsedSec || 0)),
    streak: getDailyPuzzleStreak(nextHistory, dateKey),
    monthSolvedCount: getDailyMonthSolvedCount(nextHistory, dateKey),
  };
}

const DAILY_MISSION_DEFINITIONS = [
  {
    id: "daily-quiz",
    events: ["daily_solve"],
    target: 1,
    xp: 80,
    uniqueEvent: true,
    titleKo: "일일퀴즈 완료",
    titleEn: "Clear daily quiz",
    descKo: "오늘 퍼즐 1개",
    descEn: "1 daily puzzle",
  },
  {
    id: "daily-theme-3",
    events: ["theme_solve"],
    target: 3,
    xp: 90,
    titleKo: "테마 3개 풀기",
    titleEn: "Clear 3 themes",
    descKo: "스몰 테마 퍼즐",
    descEn: "Small theme puzzles",
  },
  {
    id: "daily-total-5",
    events: ["daily_solve", "theme_solve"],
    target: 5,
    xp: 120,
    uniqueEvent: true,
    titleKo: "퍼즐 5개 완료",
    titleEn: "Clear 5 puzzles",
    descKo: "짧게 자주 풀기",
    descEn: "Short play streak",
  },
];

const WEEKLY_MISSION_DEFINITIONS = [
  {
    id: "weekly-daily-5",
    events: ["daily_solve"],
    target: 5,
    xp: 300,
    uniqueEvent: true,
    titleKo: "일일퀴즈 5일",
    titleEn: "5 daily quizzes",
    descKo: "같은 날짜 중복 제외",
    descEn: "Distinct days only",
  },
  {
    id: "weekly-theme-15",
    events: ["theme_solve"],
    target: 15,
    xp: 360,
    titleKo: "테마 15개 완성",
    titleEn: "Clear 15 themes",
    descKo: "도감 채우기",
    descEn: "Fill the collection",
  },
  {
    id: "weekly-ranking",
    events: ["ranking_visit"],
    target: 1,
    xp: 120,
    uniqueEvent: true,
    titleKo: "랭킹 확인",
    titleEn: "Check ranking",
    descKo: "이번 주 위치 보기",
    descEn: "Check your weekly spot",
  },
];

function getMissionWeekKey(dateKey = getKstDateKey()) {
  const parts = parseDateKeyParts(dateKey) || parseDateKeyParts(getKstDateKey());
  const dateMs = Date.UTC(parts.year, parts.month - 1, parts.day);
  const weekday = new Date(dateMs).getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  const monday = new Date(dateMs - mondayOffset * DAY_MS);
  return makeDateKey(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

function formatMissionWeekLabel(weekKey, lang) {
  const start = parseDateKeyParts(weekKey) || parseDateKeyParts(getMissionWeekKey());
  const endKey = addDaysToDateKey(makeDateKey(start.year, start.month, start.day), 6);
  const end = parseDateKeyParts(endKey) || start;
  if (lang === "ko") return `${start.month}.${start.day}-${end.month}.${end.day}`;
  return `${start.month}/${start.day}-${end.month}/${end.day}`;
}

function createMissionBucket(periodKey) {
  return { periodKey, progress: {}, rewarded: {}, seen: {} };
}

function normalizeMissionBucket(bucket, periodKey) {
  if (!bucket || typeof bucket !== "object" || bucket.periodKey !== periodKey) {
    return createMissionBucket(periodKey);
  }
  return {
    periodKey,
    progress: bucket.progress && typeof bucket.progress === "object" ? { ...bucket.progress } : {},
    rewarded: bucket.rewarded && typeof bucket.rewarded === "object" ? { ...bucket.rewarded } : {},
    seen: bucket.seen && typeof bucket.seen === "object" ? { ...bucket.seen } : {},
  };
}

function normalizeMissionState(value, dateKey = getKstDateKey()) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: 1,
    totalXp: Math.max(0, Number(source.totalXp || 0)),
    daily: normalizeMissionBucket(source.daily, dateKey),
    weekly: normalizeMissionBucket(source.weekly, getMissionWeekKey(dateKey)),
  };
}

function readMissionState() {
  if (!SHOULD_PERSIST_MISSION_STATE) {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(MISSION_STATE_KEY);
      } catch {
        // Mission test state is disposable.
      }
    }
    return normalizeMissionState(null);
  }
  if (typeof window === "undefined") return normalizeMissionState(null);
  try {
    const raw = localStorage.getItem(MISSION_STATE_KEY);
    return normalizeMissionState(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeMissionState(null);
  }
}

function writeMissionState(value) {
  if (!SHOULD_PERSIST_MISSION_STATE) return;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MISSION_STATE_KEY, JSON.stringify(normalizeMissionState(value)));
  } catch {
    // Local cache is only a fallback; logged-in users are synced to the server.
  }
}

function mergeTruthyRecord(leftRecord, rightRecord) {
  const merged = {};
  [leftRecord, rightRecord].forEach((record) => {
    if (!record || typeof record !== "object") return;
    Object.entries(record).forEach(([key, value]) => {
      if (value) merged[key] = true;
    });
  });
  return merged;
}

function mergeMissionProgress(leftProgress, rightProgress) {
  const merged = {};
  [leftProgress, rightProgress].forEach((progress) => {
    if (!progress || typeof progress !== "object") return;
    Object.entries(progress).forEach(([key, value]) => {
      const next = Math.max(0, Number(value || 0));
      if (!Number.isFinite(next)) return;
      merged[key] = Math.max(Number(merged[key] || 0), next);
    });
  });
  return merged;
}

function mergeMissionBucket(leftBucket, rightBucket, periodKey) {
  const left = normalizeMissionBucket(leftBucket, periodKey);
  const right = normalizeMissionBucket(rightBucket, periodKey);
  return {
    periodKey,
    progress: mergeMissionProgress(left.progress, right.progress),
    rewarded: mergeTruthyRecord(left.rewarded, right.rewarded),
    seen: mergeTruthyRecord(left.seen, right.seen),
  };
}

function getRewardedMissionXp(bucket, definitions) {
  if (!bucket?.rewarded || typeof bucket.rewarded !== "object") return 0;
  return definitions.reduce((sum, mission) => (bucket.rewarded[mission.id] ? sum + mission.xp : sum), 0);
}

function getCurrentMissionRewardXp(state) {
  return (
    getRewardedMissionXp(state.daily, DAILY_MISSION_DEFINITIONS) +
    getRewardedMissionXp(state.weekly, WEEKLY_MISSION_DEFINITIONS)
  );
}

function mergeMissionStates(leftState, rightState, dateKey = getKstDateKey()) {
  const left = normalizeMissionState(leftState, dateKey);
  const right = normalizeMissionState(rightState, dateKey);
  const daily = mergeMissionBucket(left.daily, right.daily, dateKey);
  const weekly = mergeMissionBucket(left.weekly, right.weekly, getMissionWeekKey(dateKey));
  const leftBaseXp = Math.max(0, Number(left.totalXp || 0) - getCurrentMissionRewardXp(left));
  const rightBaseXp = Math.max(0, Number(right.totalXp || 0) - getCurrentMissionRewardXp(right));
  const mergedRewardXp = getCurrentMissionRewardXp({ daily, weekly });
  return {
    version: 1,
    totalXp: Math.max(leftBaseXp, rightBaseXp) + mergedRewardXp,
    daily,
    weekly,
  };
}

function getMissionLevelNeed(level) {
  return 180 + Math.max(0, Number(level || 1) - 1) * 70;
}

function getMissionLevelInfo(totalXp) {
  let remaining = Math.max(0, Number(totalXp || 0));
  let level = 1;
  let spentXp = 0;
  while (remaining >= getMissionLevelNeed(level) && level < 999) {
    const need = getMissionLevelNeed(level);
    remaining -= need;
    spentXp += need;
    level += 1;
  }
  const nextXp = getMissionLevelNeed(level);
  return {
    level,
    totalXp: Math.max(0, Number(totalXp || 0)),
    currentXp: remaining,
    nextXp,
    spentXp,
    progressPercent: nextXp ? Math.min(100, Math.round((remaining / nextXp) * 100)) : 0,
  };
}

function applyMissionDefinitions(bucket, definitions, eventName, amount, eventToken) {
  let xpGained = 0;
  let changed = false;
  const completed = [];
  const nextBucket = {
    ...bucket,
    progress: { ...bucket.progress },
    rewarded: { ...bucket.rewarded },
    seen: { ...bucket.seen },
  };

  definitions.forEach((mission) => {
    if (!mission.events.includes(eventName)) return;
    const seenKey = mission.uniqueEvent && eventToken ? `${mission.id}:${eventName}:${eventToken}` : "";
    if (seenKey && nextBucket.seen[seenKey]) return;
    const current = Math.min(mission.target, Math.max(0, Number(nextBucket.progress[mission.id] || 0)));
    if (current >= mission.target) {
      if (seenKey) nextBucket.seen[seenKey] = true;
      return;
    }
    const next = Math.min(mission.target, current + amount);
    if (next !== current) {
      nextBucket.progress[mission.id] = next;
      changed = true;
    }
    if (seenKey) {
      nextBucket.seen[seenKey] = true;
      changed = true;
    }
    if (next >= mission.target && !nextBucket.rewarded[mission.id]) {
      nextBucket.rewarded[mission.id] = true;
      xpGained += mission.xp;
      completed.push(mission);
      changed = true;
    }
  });

  return { bucket: nextBucket, xpGained, completed, changed };
}

function applyMissionEvent(state, eventName, options = {}) {
  const amount = Math.max(1, Number(options.amount || 1));
  const dateKey = options.dateKey || getKstDateKey();
  const eventToken = options.eventToken || "";
  const normalized = normalizeMissionState(state, dateKey);
  const levelBefore = getMissionLevelInfo(normalized.totalXp);
  const dailyResult = applyMissionDefinitions(normalized.daily, DAILY_MISSION_DEFINITIONS, eventName, amount, eventToken);
  const weeklyResult = applyMissionDefinitions(normalized.weekly, WEEKLY_MISSION_DEFINITIONS, eventName, amount, eventToken);
  const xpGained = dailyResult.xpGained + weeklyResult.xpGained;
  const nextState = {
    ...normalized,
    totalXp: normalized.totalXp + xpGained,
    daily: dailyResult.bucket,
    weekly: weeklyResult.bucket,
  };
  const levelAfter = getMissionLevelInfo(nextState.totalXp);
  return {
    state: nextState,
    xpGained,
    completed: [...dailyResult.completed, ...weeklyResult.completed],
    changed: dailyResult.changed || weeklyResult.changed || xpGained > 0,
    levelBefore,
    levelAfter,
  };
}

function buildMissionViewItems(definitions, bucket, lang) {
  return definitions.map((mission) => {
    const progress = Math.min(mission.target, Math.max(0, Number(bucket?.progress?.[mission.id] || 0)));
    const isComplete = progress >= mission.target;
    return {
      ...mission,
      title: lang === "ko" ? mission.titleKo : mission.titleEn,
      desc: lang === "ko" ? mission.descKo : mission.descEn,
      progress,
      isComplete,
      progressPercent: mission.target ? Math.min(100, Math.round((progress / mission.target) * 100)) : 0,
    };
  });
}

const CREATOR_SAMPLE_GROUP_ORDER = ["small", "medium", "large", "xlarge"];
const CREATOR_GROUP_LABELS = {
  small: { ko: "스몰", en: "Small" },
  medium: { ko: "미디엄", en: "Medium" },
  large: { ko: "라지", en: "Large" },
  xlarge: { ko: "엑스라지", en: "XLarge" },
};

const THEME_CATEGORY_DEFINITIONS = [
  { key: "all", ko: "전체", en: "All", keys: [] },
  {
    key: "animal",
    ko: "동물",
    en: "Animals",
    keys: ["cat", "dog", "rabbit", "horse", "bird", "fish", "ant", "bug", "butterfly", "paw", "cow", "turtle", "고양이", "개", "토끼", "말", "새", "물고기", "개미"],
  },
  {
    key: "food",
    ko: "음식",
    en: "Food",
    keys: ["cake", "pizza", "burger", "coffee", "beer", "bowl food", "cookie", "ice cream", "fork", "knife", "apple", "bread", "cake", "케이크", "피자", "커피", "맥주", "음식", "사과", "빵"],
  },
  {
    key: "nature",
    ko: "자연",
    en: "Nature",
    keys: ["flower", "tree", "leaf", "moon", "sun", "cloud", "star", "fire", "mountain", "snowflake", "rain", "umbrella", "planet", "달", "해", "구름", "별", "불", "꽃", "나무", "잎", "산", "눈"],
  },
  {
    key: "vehicle",
    ko: "탈것",
    en: "Vehicles",
    keys: ["car", "bus", "truck", "airplane", "rocket", "bicycle", "motorcycle", "train", "boat", "ambulance", "taxi", "scooter", "자동차", "버스", "트럭", "비행기", "로켓", "자전거", "기차", "배", "구급차"],
  },
  {
    key: "place",
    ko: "공간",
    en: "Places",
    keys: ["house", "castle", "building", "storefront", "bank", "map pin", "tent", "lighthouse", "city", "factory", "warehouse", "church", "집", "성", "건물", "가게", "지도", "핀", "도시"],
  },
  {
    key: "play",
    ko: "놀이",
    en: "Play",
    keys: ["basketball", "soccer", "baseball", "tennis", "game", "dice", "puzzle", "music", "guitar", "balloon", "confetti", "ticket", "농구", "축구", "야구", "게임", "주사위", "퍼즐", "음표", "티켓", "말풍선"],
  },
  {
    key: "object",
    ko: "생활",
    en: "Everyday",
    keys: ["gift", "book", "notebook", "camera", "bell", "key", "light bulb", "microphone", "phone", "watch", "wallet", "backpack", "basket", "computer", "photo", "bookmark", "cardholder", "hat", "선물", "책", "노트", "카메라", "종", "열쇠", "전구", "마이크", "사진", "북마크", "지갑", "배낭", "모자"],
  },
  {
    key: "symbol",
    ko: "상징",
    en: "Symbols",
    keys: ["heart", "shield", "badge", "medal", "trophy", "thumb", "check", "sparkles", "crown", "flag", "seal", "warning", "하트", "방패", "배지", "메달", "트로피", "좋아요", "반짝임", "왕관", "깃발"],
  },
];

function getThemeCategoryDefinition(categoryKey) {
  return THEME_CATEGORY_DEFINITIONS.find((category) => category.key === categoryKey) || THEME_CATEGORY_DEFINITIONS[0];
}

function getThemeCategoryLabel(categoryKey, lang) {
  const category = getThemeCategoryDefinition(categoryKey);
  return lang === "ko" ? category.ko : category.en;
}

function getThemePuzzleCategoryKey(sample) {
  const descriptor = getSolvedPaintDescriptor(sample);
  const category = THEME_CATEGORY_DEFINITIONS.find(
    (item) => item.key !== "all" && item.keys.some((key) => solvedPaintKeyMatches(descriptor, key))
  );
  return category?.key || "object";
}

async function parseJsonSafe(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  const text = await res.text();
  const url = String(res?.url || "");
  throw new Error(
    `Server returned non-JSON response (${res.status})${url ? ` [${url}]` : ""}: ${text.slice(0, 120)}`
  );
}

function isRaceOnlyStatusMessage(message) {
  if (!message) return false;
  return (
    message === "승리하였습니다." ||
    message === "패배하였습니다." ||
    message === "완주! 다른 플레이어 결과 대기중..." ||
    message === "5초 후 시작합니다." ||
    message === "Victory." ||
    message === "Defeat." ||
    message === "Finished! Waiting for other players..." ||
    message === "Starting in 5 seconds."
  );
}

function App() {
  const [playMode, setPlayMode] = useState(() => {
    if (typeof window === "undefined") return "menu";
    const initialMode = getModeFromPath(window.location.pathname);
    if (IS_APPS_IN_TOSS && !["menu", "single", "tutorial", "ranking"].includes(initialMode)) return "menu";
    return initialMode;
  }); // menu | single | create | multi | pvp | tutorial | auth | ranking | replay_hall
  const [selectedSize, setSelectedSize] = useState(IS_APPS_IN_TOSS ? APPS_IN_TOSS_DEFAULT_SIZE : "25x25");
  const [creatorWidthInput, setCreatorWidthInput] = useState(String(CREATOR_DEFAULT_SIZE));
  const [creatorHeightInput, setCreatorHeightInput] = useState(String(CREATOR_DEFAULT_SIZE));
  const [creatorTitleInput, setCreatorTitleInput] = useState("");
  const [creatorSamples, setCreatorSamples] = useState(DEFAULT_CREATOR_SAMPLE_PUZZLES);
  const [creatorSamplesLoading, setCreatorSamplesLoading] = useState(false);
  const [creatorSaving, setCreatorSaving] = useState(false);
  const [creatorMyPuzzles, setCreatorMyPuzzles] = useState([]);
  const [creatorMyPuzzlesLoading, setCreatorMyPuzzlesLoading] = useState(false);
  const [creatorMyPuzzlesOpen, setCreatorMyPuzzlesOpen] = useState(false);
  const [dailyPuzzleHistory, setDailyPuzzleHistory] = useState(() => readDailyPuzzleHistory());
  const [dailyPuzzleStampDate, setDailyPuzzleStampDate] = useState("");
  const [dailyCompletionResult, setDailyCompletionResult] = useState(null);
  const [missionState, setMissionState] = useState(() => readMissionState());
  const [missionToast, setMissionToast] = useState(null);
  const [missionRewardFx, setMissionRewardFx] = useState(null);
  const [showMissionSheet, setShowMissionSheet] = useState(false);
  const [customSizeGroup, setCustomSizeGroup] = useState("small");
  const [customThemeCategory, setCustomThemeCategory] = useState("all");
  const [communityPuzzles, setCommunityPuzzles] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communitySizeGroup, setCommunitySizeGroup] = useState("small");
  const [communitySelectedId, setCommunitySelectedId] = useState("");
  const [communityDiscussion, setCommunityDiscussion] = useState(null);
  const [communityDiscussionLoading, setCommunityDiscussionLoading] = useState(false);
  const [communityCommentInput, setCommunityCommentInput] = useState("");
  const [communityCommentSending, setCommunityCommentSending] = useState(false);
  const [communityReactionSending, setCommunityReactionSending] = useState(false);
  const [adminCreatorKey, setAdminCreatorKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(CREATOR_ADMIN_KEY) || "";
  });
  const [adminCreatorPuzzles, setAdminCreatorPuzzles] = useState([]);
  const [adminCreatorLoading, setAdminCreatorLoading] = useState(false);
  const [singleSection, setSingleSection] = useState("home");
  const [puzzle, setPuzzle] = useState(null);
  const [cells, setCells] = useState([]); // 0 empty, 1 filled, 2 marked(X)
  const [solvedRevealProgress, setSolvedRevealProgress] = useState(0);
  const [puzzleHp, setPuzzleHp] = useState(PUZZLE_MAX_HP);
  const [puzzleHpDamage, setPuzzleHpDamage] = useState(null);
  const [puzzleHints, setPuzzleHints] = useState(PUZZLE_MAX_HINTS);
  const [puzzleHintReveal, setPuzzleHintReveal] = useState(null);
  const [lineClearFx, setLineClearFx] = useState(null);
  const [cellInputFxList, setCellInputFxList] = useState([]);
  const [hintAdLoading, setHintAdLoading] = useState(false);
  const [reviveAdLoading, setReviveAdLoading] = useState(false);
  const [reviveAdError, setReviveAdError] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeHints, setActiveHints] = useState(new Set());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [raceRoomCode, setRaceRoomCode] = useState("");
  const [racePlayerId, setRacePlayerId] = useState("");
  const [raceState, setRaceState] = useState(null);
  const [raceSubmitting, setRaceSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createRoomTitle, setCreateRoomTitle] = useState("");
  const [createSize, setCreateSize] = useState("10x10");
  const [createMaxPlayers, setCreateMaxPlayers] = useState("2");
  const [createVisibility, setCreateVisibility] = useState("public");
  const [createPassword, setCreatePassword] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinRoomType, setJoinRoomType] = useState("unknown"); // unknown | public | private
  const [joinModalSource, setJoinModalSource] = useState("manual"); // manual | list
  const [publicRooms, setPublicRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [ratingUsers, setRatingUsers] = useState([]);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [myRatingRank, setMyRatingRank] = useState(null);
  const [ratingTotalUsers, setRatingTotalUsers] = useState(0);
  const [hallDataBySize, setHallDataBySize] = useState({});
  const [hallStreakTop, setHallStreakTop] = useState([]);
  const [hallActiveSizeKey, setHallActiveSizeKey] = useState("10x10");
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [isRematchLoading, setIsRematchLoading] = useState(false);
  const [menuTourIndex, setMenuTourIndex] = useState(0);
  const [isMenuTourActive, setIsMenuTourActive] = useState(false);
  const [activeMenuTopTab, setActiveMenuTopTab] = useState("");
  const [lang, setLang] = useState(() => {
    if (IS_APPS_IN_TOSS) return "ko";
    const saved = localStorage.getItem(LANG_KEY);
    return saved === "en" ? "en" : "ko";
  });
  const [uiStyleVariant, setUiStyleVariant] = useState(() =>
    normalizeUiStyleVariant(localStorage.getItem(STYLE_VARIANT_KEY))
  );
  const [authToken, setAuthToken] = useState(localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const [authUser, setAuthUser] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      return raw ? applyLocalProfileAvatarOverride(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  });
  const [authTab, setAuthTab] = useState("login"); // login | signup | reset
  const [authReturnMode, setAuthReturnMode] = useState("menu");
  const [boardStageTop, setBoardStageTop] = useState(0);
  const [showNeedLoginPopup, setShowNeedLoginPopup] = useState(false);
  const [needLoginReturnMode, setNeedLoginReturnMode] = useState("multi");
  const [tossLoginLoading, setTossLoginLoading] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth);
  const [viewportHeight, setViewportHeight] = useState(getViewportHeight);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [activeVote, setActiveVote] = useState(null);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [showPvpTierGuideModal, setShowPvpTierGuideModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginFieldErrors, setLoginFieldErrors] = useState({ username: "", password: "" });
  const [signupUsername, setSignupUsername] = useState("");
  const [signupNickname, setSignupNickname] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupFieldErrors, setSignupFieldErrors] = useState({
    username: "",
    nickname: "",
    password: "",
    terms: "",
    privacy: "",
  });
  const [signupAgreeTerms, setSignupAgreeTerms] = useState(false);
  const [signupAgreePrivacy, setSignupAgreePrivacy] = useState(false);
  const [signupPolicyModal, setSignupPolicyModal] = useState(""); // "" | terms | privacy
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mobilePaintMode, setMobilePaintMode] = useState("fill"); // fill | mark
  const [tutorialLessonIndex, setTutorialLessonIndex] = useState(0);
  const [tutorialTool, setTutorialTool] = useState("fill"); // fill | mark
  const [tutorialLessonCells, setTutorialLessonCells] = useState(() => createTutorialLessonCells(TUTORIAL_LESSONS[0]));
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [showMultiResultModal, setShowMultiResultModal] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem(SOUND_ENABLED_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const soundVolume = soundEnabled ? 100 : 0;
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalMode, setProfileModalMode] = useState("self"); // self | public
  const [profileModalLoading, setProfileModalLoading] = useState(false);
  const [profileModalSaving, setProfileModalSaving] = useState(false);
  const [profileModalError, setProfileModalError] = useState("");
  const [profileModalData, setProfileModalData] = useState(null);
  const [profileDraftAvatarKey, setProfileDraftAvatarKey] = useState(DEFAULT_PROFILE_AVATAR_KEY);
  const [profileDraftNickname, setProfileDraftNickname] = useState("");
  const [profileAvatarTab, setProfileAvatarTab] = useState("default"); // default | special
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);
  const [publicProfileAvatarCache, setPublicProfileAvatarCache] = useState({});
  const [pvpTicketId, setPvpTicketId] = useState("");
  const [pvpSearching, setPvpSearching] = useState(false);
  const [pvpQueueSize, setPvpQueueSize] = useState(0);
  const [pvpServerState, setPvpServerState] = useState("idle"); // idle | waiting | matching | ready | cancelled
  const [pvpMatch, setPvpMatch] = useState(null);
  const [pvpAcceptBusy, setPvpAcceptBusy] = useState(false);
  const [pvpBanBusy, setPvpBanBusy] = useState(false);
  const [pvpRevealIndex, setPvpRevealIndex] = useState(0);
  const [pvpRatingFx, setPvpRatingFx] = useState(null);
  const [pvpShowdownMatchId, setPvpShowdownMatchId] = useState("");
  const [pvpShowdownUntilMs, setPvpShowdownUntilMs] = useState(0);
  const [placementRunning, setPlacementRunning] = useState(false);
  const [placementLoading, setPlacementLoading] = useState(false);
  const [placementStartedAtMs, setPlacementStartedAtMs] = useState(0);
  const [placementStageIndex, setPlacementStageIndex] = useState(0);
  const [placementResults, setPlacementResults] = useState(() =>
    PLACEMENT_STAGES.map((s) => ({ ...s, status: "pending", solvedAtSec: null }))
  );
  const [placementResultCard, setPlacementResultCard] = useState(null);
  const [placementRevealOpen, setPlacementRevealOpen] = useState(false);
  const [placementRevealPhase, setPlacementRevealPhase] = useState("idle"); // idle | analyzing | counting | reveal
  const [placementRevealRating, setPlacementRevealRating] = useState(0);
  const [matchSimProfileKey, setMatchSimProfileKey] = useState("gold");
  const [matchSimRating, setMatchSimRating] = useState(() => MATCH_SIM_PROFILE_PRESETS.find((item) => item.key === "gold")?.rating || 1760);
  const [matchSimSearching, setMatchSimSearching] = useState(false);
  const [matchSimElapsedSec, setMatchSimElapsedSec] = useState(0);
  const [matchSimQueueSize, setMatchSimQueueSize] = useState(() => getMatchSimQueueSize(0, 1760));
  const [matchSimLogs, setMatchSimLogs] = useState([]);
  const [matchSimFound, setMatchSimFound] = useState(null);
  const [matchFlowTest, setMatchFlowTest] = useState(null);
  const boardStageRef = useRef(null);
  const boardRef = useRef(null);
  const canvasRef = useRef(null);
  const chatBodyRef = useRef(null);
  const emojiWrapRef = useRef(null);
  const creatorDraftRef = useRef(null);
  const dragRef = useRef(null); // { button: 'left'|'right', paintValue, ignoreButtons }
  const lastPaintIndexRef = useRef(null);
  const strokeBaseRef = useRef(null);
  const strokeChangedRef = useRef(false);
  const strokeMistakeChargedRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const puzzleHpRef = useRef(PUZZLE_MAX_HP);
  const cellValuesRef = useRef([]);
  const pendingPaintRef = useRef(new Map());
  const frameRef = useRef(0);
  const autoCompletedLinesRef = useRef({ key: "", rows: new Set(), cols: new Set(), silent: true });
  const lockedCellIndicesRef = useRef(new Set());
  const fixedMarkIndicesRef = useRef(new Set());
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const autoSolvedShownRef = useRef(false);
  const racePollRef = useRef(0);
  const raceHeartbeatBusyRef = useRef(false);
  const pvpPollRef = useRef(0);
  const pvpRevealAnimRef = useRef(0);
  const placementSessionRef = useRef(0);
  const matchSimSessionRef = useRef(0);
  const matchSimElapsedRef = useRef(0);
  const matchSimLastRuleKeyRef = useRef("");
  const matchFlowTimersRef = useRef([]);
  const matchFlowRevealRef = useRef(0);
  const raceRoomCodeRef = useRef("");
  const racePlayerIdRef = useRef("");
  const pvpTicketRef = useRef("");
  const pvpGuestStartSeqRef = useRef(0);
  const pvpMatchPhaseRef = useRef("");
  const pvpRevealSpinPrevRef = useRef(false);
  const pvpRatingAnimRef = useRef(0);
  const pvpRatingBaseRef = useRef(null);
  const pvpRatingBaseGamesRef = useRef(null);
  const pvpRatingFxDoneRoomRef = useRef("");
  const pvpAuthRefreshDoneRoomRef = useRef("");
  const pvpShowdownSeenRef = useRef("");
  const votePromptedTokenRef = useRef("");
  const raceFinishedSentRef = useRef(false);
  const raceResultShownRef = useRef(false);
  const raceProgressLastSentRef = useRef(0);
  const raceProgressBusyRef = useRef(false);
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const audioPausedByVisibilityRef = useRef(false);
  const exitConfirmedRef = useRef(false);
  const playModeRef = useRef(playMode);
  const countdownCueRef = useRef(-1);
  const inactivityWarnCueRef = useRef(-1);
  const prevRacePhaseRef = useRef("idle");
  const lastPaintSfxAtRef = useRef(0);
  const tutorialCompleteShownRef = useRef(false);
  const multiResultShownKeyRef = useRef("");
  const victoryConfettiTimersRef = useRef([]);
  const solvedRevealRafRef = useRef(0);
  const dailyStampTimerRef = useRef(0);
  const dailyResultCalendarTimerRef = useRef(0);
  const missionToastTimerRef = useRef(0);
  const missionRewardFxTimerRef = useRef(0);
  const dailyPuzzleHistoryRef = useRef(dailyPuzzleHistory);
  const missionStateRef = useRef(missionState);
  const appStateSaveTimerRef = useRef(0);
  const appStateHydratingRef = useRef(false);
  const appStateLastSavedJsonRef = useRef("");
  const puzzleStartedAtMsRef = useRef(0);
  const cellInputFxIdRef = useRef(0);
  const cellInputFxTimerRef = useRef(0);
  const createCellsForHints = playMode === "create" ? cells : null;

  const authHeaders = useMemo(() => {
    if (!authToken) return {};
    return { Authorization: `Bearer ${authToken}` };
  }, [authToken]);

  const adminCreatorHeaders = useMemo(() => {
    const key = String(adminCreatorKey || "").trim();
    if (!key) return { ...authHeaders };
    return { ...authHeaders, "x-admin-key": key };
  }, [adminCreatorKey, authHeaders]);
  const isLoggedIn = Boolean(authToken && authUser);

  useEffect(() => {
    dailyPuzzleHistoryRef.current = dailyPuzzleHistory;
  }, [dailyPuzzleHistory]);

  useEffect(() => {
    missionStateRef.current = missionState;
  }, [missionState]);

  const saveUserAppState = useCallback(async (dailyHistory, missions, { keepalive = false } = {}) => {
    const payload = {
      dailyPuzzleHistory: normalizeDailyPuzzleHistory(dailyHistory),
      missionState: normalizeMissionState(missions),
    };
    const payloadJson = JSON.stringify(payload);
    if (!authToken || !isLoggedIn) return false;
    if (!keepalive && payloadJson === appStateLastSavedJsonRef.current) return true;
    try {
      const res = await fetch(`${API_BASE}/app-state/me`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: payloadJson,
        keepalive,
      });
      if (!res.ok) return false;
      appStateLastSavedJsonRef.current = payloadJson;
      return true;
    } catch {
      return false;
    }
  }, [authToken, isLoggedIn]);

  const L = (ko, en) => (IS_APPS_IN_TOSS || lang === "ko" ? ko : en);
  const normalizeClientEmail = (value) => String(value || "").trim().toLowerCase();

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_ENABLED_KEY, soundEnabled ? "1" : "0");
    } catch {
      // Sound preference should never block play.
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (appStateSaveTimerRef.current) {
      window.clearTimeout(appStateSaveTimerRef.current);
      appStateSaveTimerRef.current = 0;
    }
    if (!isLoggedIn || !authToken) {
      appStateHydratingRef.current = false;
      appStateLastSavedJsonRef.current = "";
      return undefined;
    }

    let cancelled = false;
    appStateHydratingRef.current = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/app-state/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await parseJsonSafe(res);
        if (!res.ok || !data?.ok || cancelled) return;
        const remoteState = data.state || {};
        const mergedDailyHistory = mergeDailyPuzzleHistories(
          dailyPuzzleHistoryRef.current,
          remoteState.dailyPuzzleHistory
        );
        const mergedMissionState = mergeMissionStates(
          missionStateRef.current,
          remoteState.missionState,
          getKstDateKey()
        );
        setDailyPuzzleHistory(mergedDailyHistory);
        writeDailyPuzzleHistory(mergedDailyHistory);
        setMissionState(mergedMissionState);
        writeMissionState(mergedMissionState);
        appStateHydratingRef.current = false;
        void saveUserAppState(mergedDailyHistory, mergedMissionState);
      } catch {
        // Server state sync is best-effort; local cache keeps the app usable.
      } finally {
        if (!cancelled) appStateHydratingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      appStateHydratingRef.current = false;
    };
  }, [authToken, authUser?.id, isLoggedIn, saveUserAppState]);

  useEffect(() => {
    writeDailyPuzzleHistory(dailyPuzzleHistory);
    writeMissionState(missionState);
    if (typeof window === "undefined") return undefined;
    if (appStateSaveTimerRef.current) {
      window.clearTimeout(appStateSaveTimerRef.current);
      appStateSaveTimerRef.current = 0;
    }
    if (!isLoggedIn || !authToken || appStateHydratingRef.current) return undefined;
    appStateSaveTimerRef.current = window.setTimeout(() => {
      appStateSaveTimerRef.current = 0;
      void saveUserAppState(dailyPuzzleHistory, missionState);
    }, APP_STATE_SAVE_DEBOUNCE_MS);
    return () => {
      if (appStateSaveTimerRef.current) {
        window.clearTimeout(appStateSaveTimerRef.current);
        appStateSaveTimerRef.current = 0;
      }
    };
  }, [authToken, dailyPuzzleHistory, isLoggedIn, missionState, saveUserAppState]);

  useEffect(() => {
    if (typeof window === "undefined" || !isLoggedIn || !authToken) return undefined;
    const flushAppState = () => {
      if (appStateSaveTimerRef.current) {
        window.clearTimeout(appStateSaveTimerRef.current);
        appStateSaveTimerRef.current = 0;
      }
      void saveUserAppState(dailyPuzzleHistoryRef.current, missionStateRef.current, { keepalive: true });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushAppState();
    };
    window.addEventListener("pagehide", flushAppState);
    window.addEventListener("beforeunload", flushAppState);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushAppState);
      window.removeEventListener("beforeunload", flushAppState);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authToken, isLoggedIn, saveUserAppState]);

  const clearVictoryConfettiTimers = useCallback(() => {
    if (!victoryConfettiTimersRef.current.length) return;
    victoryConfettiTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    victoryConfettiTimersRef.current = [];
  }, []);

  const stopSolvedReveal = useCallback(() => {
    if (!solvedRevealRafRef.current) return;
    window.cancelAnimationFrame(solvedRevealRafRef.current);
    solvedRevealRafRef.current = 0;
  }, []);

  const startSolvedReveal = useCallback(() => {
    if (typeof window === "undefined") return;
    stopSolvedReveal();
    setSolvedRevealProgress(0);
    const startedAt = window.performance.now();

    const tick = (now) => {
      const next = Math.max(0, Math.min(1, (now - startedAt) / SOLVED_REVEAL_DURATION_MS));
      setSolvedRevealProgress(next);
      if (next < 1) {
        solvedRevealRafRef.current = window.requestAnimationFrame(tick);
      } else {
        solvedRevealRafRef.current = 0;
      }
    };

    solvedRevealRafRef.current = window.requestAnimationFrame(tick);
  }, [stopSolvedReveal]);

  const triggerVictoryFx = useCallback((mode = "single") => {
    if (typeof window === "undefined") return;
    clearVictoryConfettiTimers();

    const isMulti = mode === "multi";
    const colors = ["#ffca1f", "#1ecbff", "#ff3f86", "#63ff4f", "#7a4dff", "#ff6f1f"];
    const defaults = {
      zIndex: 1600,
      colors,
      ticks: isMulti ? 390 : 320,
      gravity: isMulti ? 0.9 : 0.95,
      startVelocity: isMulti ? 58 : 50,
      spread: isMulti ? 84 : 70,
      scalar: isMulti ? 1.24 : 1.1,
      drift: 0,
      disableForReducedMotion: true,
    };

    const bursts = isMulti
      ? [
          { delay: 0, origin: { x: 0.12, y: 0.82 }, angle: 62, particleCount: 135 },
          { delay: 0, origin: { x: 0.88, y: 0.82 }, angle: 118, particleCount: 135 },
          { delay: 110, origin: { x: 0.5, y: 0.2 }, angle: 90, particleCount: 115, spread: 108, startVelocity: 48, scalar: 1.1 },
          { delay: 230, origin: { x: 0.3, y: 0.1 }, angle: 76, particleCount: 84, spread: 98, startVelocity: 42, scalar: 1.06 },
          { delay: 230, origin: { x: 0.7, y: 0.1 }, angle: 104, particleCount: 84, spread: 98, startVelocity: 42, scalar: 1.06 },
          { delay: 360, origin: { x: 0.5, y: 0.72 }, angle: 90, particleCount: 76, spread: 76, startVelocity: 38, scalar: 1.02 },
        ]
      : [
          { delay: 0, origin: { x: 0.16, y: 0.82 }, angle: 62, particleCount: 96 },
          { delay: 0, origin: { x: 0.84, y: 0.82 }, angle: 118, particleCount: 96 },
          { delay: 130, origin: { x: 0.5, y: 0.18 }, angle: 90, particleCount: 76, spread: 96, startVelocity: 40, scalar: 1.04 },
          { delay: 260, origin: { x: 0.5, y: 0.74 }, angle: 90, particleCount: 44, spread: 74, startVelocity: 32, scalar: 0.96 },
        ];

    bursts.forEach((burst) => {
      const fire = () => {
        confetti({
          ...defaults,
          ...burst,
        });
      };
      if (burst.delay > 0) {
        const timerId = window.setTimeout(fire, burst.delay);
        victoryConfettiTimersRef.current.push(timerId);
      } else {
        fire();
      }
    });
  }, [clearVictoryConfettiTimers]);

  useEffect(() => () => stopSolvedReveal(), [stopSolvedReveal]);

  useEffect(() => {
    stopSolvedReveal();
    setSolvedRevealProgress(0);
  }, [puzzle?.id, playMode, stopSolvedReveal]);

  useEffect(() => () => {
    clearVictoryConfettiTimers();
  }, [clearVictoryConfettiTimers]);

  useEffect(() => () => {
    if (dailyStampTimerRef.current) window.clearTimeout(dailyStampTimerRef.current);
    if (dailyResultCalendarTimerRef.current) window.clearTimeout(dailyResultCalendarTimerRef.current);
    if (missionToastTimerRef.current) window.clearTimeout(missionToastTimerRef.current);
    if (missionRewardFxTimerRef.current) window.clearTimeout(missionRewardFxTimerRef.current);
    if (appStateSaveTimerRef.current) window.clearTimeout(appStateSaveTimerRef.current);
  }, []);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportWidth(getViewportWidth());
      setViewportHeight(getViewportHeight());
    };
    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    window.visualViewport?.addEventListener("resize", updateViewportSize);
    return () => {
      window.removeEventListener("resize", updateViewportSize);
      window.visualViewport?.removeEventListener("resize", updateViewportSize);
    };
  }, []);

  const applyUiPreferences = (prefUser) => {
    if (!prefUser || typeof prefUser !== "object") return;
    setLang(IS_APPS_IN_TOSS ? "ko" : normalizeUiLang(prefUser.ui_lang));
  };

  const cacheAuthUser = (user, { applyPrefs = false } = {}) => {
    const nextUser = applyLocalProfileAvatarOverride(user);
    setAuthUser(nextUser);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
    if (applyPrefs) applyUiPreferences(nextUser);
  };

  const mapHallBucketsFromResponse = (sizesRaw) => {
    const mapped = {};
    for (const key of PVP_SIZE_KEYS) mapped[key] = [];
    const sizes = Array.isArray(sizesRaw) ? sizesRaw : [];
    for (const bucket of sizes) {
      const sizeKey = String(bucket?.sizeKey || "");
      if (!sizeKey || !mapped[sizeKey]) continue;
      const top = Array.isArray(bucket?.top) ? bucket.top : [];
      mapped[sizeKey] = top.slice(0, 3).map((r, idx) => ({
        recordId: Number(r.recordId || 0),
        rank: Number(r.rank || idx + 1),
        userId: Number(r.userId || 0),
        nickname: String(r.nickname || ""),
        elapsedSec: Number(r.elapsedSec || 0),
        elapsedMs: Number(r.elapsedMs || 0),
        puzzleId: Number(r.puzzleId || 0),
        finishedAtMs: Number(r.finishedAtMs || 0),
        sizeKey,
      }));
    }
    return mapped;
  };

  const hasHallSnapshot = (snapshot) =>
    PVP_SIZE_KEYS.some((sizeKey) => Array.isArray(snapshot?.[sizeKey]) && snapshot[sizeKey].length > 0);
  const hasStreakSnapshot = (snapshot) => Array.isArray(snapshot) && snapshot.length > 0;
  const hasRatingSnapshot = (snapshot) => Array.isArray(snapshot) && snapshot.length > 0;

  const buildHallRewardsFromSnapshot = (snapshot, target) => {
    const targetUserId = Number(target?.id || target?.userId || 0);
    const targetNickname = String(target?.nickname || "").trim().toLowerCase();
    const rewards = [];
    for (const sizeKey of PVP_SIZE_KEYS) {
      const records = Array.isArray(snapshot?.[sizeKey]) ? snapshot[sizeKey] : [];
      for (const record of records) {
        const recordUserId = Number(record?.userId || 0);
        const recordNickname = String(record?.nickname || "").trim().toLowerCase();
        const matched =
          (targetUserId > 0 && recordUserId > 0 && targetUserId === recordUserId) ||
          (!!targetNickname && targetNickname === recordNickname);
        if (!matched) continue;
        const rank = Math.max(1, Math.min(3, Number(record?.rank || 0) || 1));
        rewards.push({
          key: `hall-${sizeKey}-${rank}`,
          sizeKey,
          rank,
          elapsedSec: Number(record?.elapsedSec || 0),
          finishedAtMs: Number(record?.finishedAtMs || 0),
        });
      }
    }
    const unique = new Map();
    for (const reward of rewards) {
      const prev = unique.get(reward.key);
      if (!prev || Number(reward.elapsedSec || 0) < Number(prev.elapsedSec || 0)) {
        unique.set(reward.key, reward);
      }
    }
    return Array.from(unique.values()).sort((a, b) => {
      const sizeDiff = PVP_SIZE_KEYS.indexOf(a.sizeKey) - PVP_SIZE_KEYS.indexOf(b.sizeKey);
      if (sizeDiff !== 0) return sizeDiff;
      return Number(a.rank || 0) - Number(b.rank || 0);
    });
  };

  const buildRatingRewardsFromSnapshot = (snapshot, target) => {
    const targetUserId = Number(target?.id || target?.userId || 0);
    const targetNickname = String(target?.nickname || "").trim().toLowerCase();
    return (Array.isArray(snapshot) ? snapshot : [])
      .slice(0, 3)
      .map((entry, idx) => ({
        rank: Number(entry?.rank || idx + 1),
        userId: Number(entry?.id || entry?.userId || 0),
        nickname: String(entry?.nickname || "").trim().toLowerCase(),
      }))
      .filter((entry) =>
        (targetUserId > 0 && entry.userId > 0 && targetUserId === entry.userId) ||
        (!!targetNickname && targetNickname === entry.nickname)
      )
      .map((entry) => ({
        key: `special-rating-${Math.max(1, Math.min(3, entry.rank))}`,
        group: "rating",
        rank: Math.max(1, Math.min(3, entry.rank)),
      }));
  };

  const buildStreakRewardsFromSnapshot = (snapshot, target) => {
    const targetUserId = Number(target?.id || target?.userId || 0);
    const targetNickname = String(target?.nickname || "").trim().toLowerCase();
    return (Array.isArray(snapshot) ? snapshot : [])
      .slice(0, 3)
      .map((entry, idx) => ({
        rank: Number(entry?.rank || idx + 1),
        userId: Number(entry?.userId || 0),
        nickname: String(entry?.nickname || "").trim().toLowerCase(),
        winStreakBest: Number(entry?.winStreakBest || 0),
      }))
      .filter((entry) =>
        ((targetUserId > 0 && entry.userId > 0 && targetUserId === entry.userId) ||
          (!!targetNickname && targetNickname === entry.nickname)) &&
        entry.winStreakBest > 0
      )
      .map((entry) => ({
        key: `special-streak-${Math.max(1, Math.min(3, entry.rank))}`,
        group: "streak",
        rank: Math.max(1, Math.min(3, entry.rank)),
        winStreakBest: entry.winStreakBest,
      }));
  };

  const buildTierRewardsFromSource = (target) => {
    const explicitTierKey = String(target?.placement_tier_key || "").trim().toLowerCase();
    const tierKey =
      Number.isFinite(Number(target?.rating))
        ? getTierInfoByRating(target?.rating).key
        : Object.prototype.hasOwnProperty.call(TIER_ORDER, explicitTierKey)
          ? explicitTierKey
          : "";
    const maxTierOrder = TIER_ORDER[tierKey];
    if (!Number.isInteger(maxTierOrder)) return [];
    return Object.entries(TIER_ORDER)
      .filter(([, order]) => order <= maxTierOrder)
      .map(([rewardTierKey]) => ({
        key: `special-tier-${rewardTierKey}`,
        group: "tier",
        tierKey: rewardTierKey,
      }));
  };

  const mergeSpecialRewards = (...groups) => {
    const unique = new Map();
    for (const reward of groups.flat().filter(Boolean)) {
      if (!reward?.key) continue;
      if (!unique.has(reward.key)) unique.set(reward.key, reward);
    }
    const orderedKeys = SPECIAL_PROFILE_AVATAR_OPTIONS.map((option) => option.key);
    return Array.from(unique.values()).sort((a, b) => orderedKeys.indexOf(a.key) - orderedKeys.indexOf(b.key));
  };

  const ensureHallSnapshotForProfile = async () => {
    if (hasHallSnapshot(hallDataBySize) || hasStreakSnapshot(hallStreakTop)) {
      return { sizes: hallDataBySize, streakTop: hallStreakTop };
    }
    try {
      const res = await fetch(`${API_BASE}/replays/hall`);
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load Hall of Fame records.");
      const mapped = mapHallBucketsFromResponse(data.sizes);
      const streakTopRaw = Array.isArray(data?.streakTop) ? data.streakTop : [];
      const streakTop = streakTopRaw
        .map((r, idx) => ({
          rank: Number(r.rank || idx + 1),
          userId: Number(r.userId || 0),
          nickname: String(r.nickname || ""),
          winStreakBest: Number(r.winStreakBest || 0),
        }))
        .filter((r) => r.winStreakBest > 0)
        .slice(0, 3);
      setHallDataBySize(mapped);
      setHallStreakTop(streakTop);
      return { sizes: mapped, streakTop };
    } catch {
      return { sizes: hallDataBySize, streakTop: hallStreakTop };
    }
  };

  const ensureRatingSnapshotForProfile = async () => {
    if (hasRatingSnapshot(ratingUsers)) return ratingUsers;
    try {
      const res = await fetch(`${API_BASE}/ratings/leaderboard?limit=200`, {
        headers: { ...authHeaders },
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load ranking");
      const users = Array.isArray(data.users) ? data.users : [];
      setRatingUsers(users);
      setMyRatingRank(Number.isInteger(Number(data.myRank)) ? Number(data.myRank) : null);
      setRatingTotalUsers(Number.isInteger(Number(data.totalUsers)) ? Number(data.totalUsers) : 0);
      return users;
    } catch {
      return ratingUsers;
    }
  };

  const buildSelfProfileFallback = (
    userOverride = null,
    rewardSnapshot = { sizes: hallDataBySize, streakTop: hallStreakTop },
    ratingSnapshot = ratingUsers
  ) => {
    const baseUser = applyLocalProfileAvatarOverride(userOverride || authUser || {});
    const wins = Number(baseUser?.rating_wins || 0);
    const losses = Number(baseUser?.rating_losses || 0);
    const games = Number(baseUser?.rating_games || wins + losses || 0);
    const hallRewards = buildHallRewardsFromSnapshot(rewardSnapshot?.sizes || {}, {
      id: baseUser?.id,
      nickname: baseUser?.nickname,
    });
    const specialRewards = mergeSpecialRewards(
      hallRewards,
      buildTierRewardsFromSource(baseUser),
      buildRatingRewardsFromSnapshot(ratingSnapshot, { id: baseUser?.id, nickname: baseUser?.nickname }),
      buildStreakRewardsFromSnapshot(rewardSnapshot?.streakTop || [], { id: baseUser?.id, nickname: baseUser?.nickname })
    );
    return {
      id: Number(baseUser?.id || 0),
      username: String(baseUser?.username || ""),
      nickname: String(baseUser?.nickname || L("플레이어", "Player")),
      isBot: false,
      rating: Number(baseUser?.rating || 0),
      ratingRank: Number.isInteger(Number(myRatingRank)) ? Number(myRatingRank) : null,
      rating_games: games,
      rating_wins: wins,
      rating_losses: losses,
      win_streak_current: Number(baseUser?.win_streak_current || 0),
      win_streak_best: Number(baseUser?.win_streak_best || 0),
      winRate: games > 0 ? (wins / games) * 100 : 0,
      profile_avatar_key: normalizeProfileAvatarKey(baseUser?.profile_avatar_key || DEFAULT_PROFILE_AVATAR_KEY),
      hallRewards,
      specialRewards,
      unlockedHallAvatarKeys: hallRewards.map((reward) => reward.key),
      unlockedSpecialAvatarKeys: specialRewards.map((reward) => reward.key),
    };
  };

  const buildPublicProfileFallback = (
    userId,
    rewardSnapshot = { sizes: hallDataBySize, streakTop: hallStreakTop },
    ratingSnapshot = ratingUsers,
    sourceOverride = null
  ) => {
    const targetUserId = Number(userId || sourceOverride?.userId || sourceOverride?.id || 0);
    const racePlayer =
      targetUserId > 0 ? (raceState?.players || []).find((player) => Number(player?.userId) === targetUserId) : null;
    const pvpPlayer =
      targetUserId > 0 ? (pvpMatch?.players || []).find((player) => Number(player?.userId) === targetUserId) : null;
    const ratingUser =
      targetUserId > 0 ? (ratingSnapshot || []).find((player) => Number(player?.id) === targetUserId) : null;
    const source = sourceOverride || ratingUser || pvpPlayer || racePlayer || null;
    if (!source) return null;
    const wins = Number(source?.rating_wins || 0);
    const losses = Number(source?.rating_losses || 0);
    const games = Number(source?.rating_games || wins + losses || 0);
    const hallRewards = buildHallRewardsFromSnapshot(rewardSnapshot?.sizes || {}, {
      id: targetUserId,
      nickname: source?.nickname,
    });
    const specialRewards = mergeSpecialRewards(
      hallRewards,
      buildTierRewardsFromSource(source),
      buildRatingRewardsFromSnapshot(ratingSnapshot, { id: targetUserId, nickname: source?.nickname }),
      buildStreakRewardsFromSnapshot(rewardSnapshot?.streakTop || [], { id: targetUserId, nickname: source?.nickname })
    );
    return {
      id: targetUserId > 0 ? targetUserId : Number(source?.id || source?.userId || 0),
      nickname: String(source?.nickname || L("플레이어", "Player")),
      isBot: Boolean(source?.isBot),
      rating: Number(source?.rating || 0),
      ratingRank:
        ratingUser && Array.isArray(ratingSnapshot) && ratingSnapshot.length > 0
          ? ratingSnapshot.findIndex((player) => Number(player?.id) === targetUserId) + 1 || null
          : Number.isInteger(Number(source?.ratingRank))
            ? Number(source?.ratingRank)
            : null,
      rating_games: games,
      rating_wins: wins,
      rating_losses: losses,
      win_streak_current: Number(source?.win_streak_current || 0),
      win_streak_best: Number(source?.win_streak_best || 0),
      winRate: games > 0 ? (wins / games) * 100 : 0,
      profile_avatar_key: normalizeProfileAvatarKey(source?.profileAvatarKey || source?.profile_avatar_key || DEFAULT_PROFILE_AVATAR_KEY),
      hallRewards,
      specialRewards,
      unlockedHallAvatarKeys: hallRewards.map((reward) => reward.key),
      unlockedSpecialAvatarKeys: specialRewards.map((reward) => reward.key),
    };
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setProfileModalLoading(false);
    setProfileModalSaving(false);
    setProfileModalError("");
    setProfileModalData(null);
    setProfileDraftAvatarKey(DEFAULT_PROFILE_AVATAR_KEY);
    setProfileDraftNickname("");
    setProfileAvatarTab("default");
    setProfilePickerOpen(false);
  };

  const openOwnProfile = async () => {
    if (!isLoggedIn) return;
    setShowProfileModal(true);
    setProfileModalMode("self");
    setProfileModalLoading(true);
    setProfileModalSaving(false);
    setProfileModalError("");
    setProfileModalData(null);
    const initialAvatarKey = normalizeProfileAvatarKey(authUser?.profile_avatar_key || DEFAULT_PROFILE_AVATAR_KEY);
    setProfileDraftAvatarKey(initialAvatarKey);
    setProfileDraftNickname(String(authUser?.nickname || "").slice(0, 24));
    setProfileAvatarTab(isSpecialProfileAvatarKey(initialAvatarKey) ? "special" : "default");
    setProfilePickerOpen(false);
    try {
      const res = await fetch(`${API_BASE}/profile/me`, { headers: { ...authHeaders } });
      if (res.status === 404) {
        const rewardSnapshot = await ensureHallSnapshotForProfile();
        const ratingSnapshot = await ensureRatingSnapshotForProfile();
        const fallbackProfile = buildSelfProfileFallback(null, rewardSnapshot, ratingSnapshot);
        setProfileModalData(fallbackProfile);
        setProfileDraftAvatarKey(normalizeProfileAvatarKey(fallbackProfile.profile_avatar_key));
        setProfileDraftNickname(String(fallbackProfile.nickname || "").slice(0, 24));
        if (fallbackProfile.unlockedSpecialAvatarKeys.length > 0) {
          setProfileAvatarTab("special");
        }
        return;
      }
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("프로필 정보를 불러오지 못했습니다.", "Failed to load profile."));
      const profile = data.profile || null;
      const nextAvatarKey = normalizeProfileAvatarKey(profile?.profile_avatar_key || authUser?.profile_avatar_key || DEFAULT_PROFILE_AVATAR_KEY);
      setProfileModalData(profile);
      setProfileDraftAvatarKey(nextAvatarKey);
      setProfileDraftNickname(String(profile?.nickname || authUser?.nickname || "").slice(0, 24));
      setProfileAvatarTab(isSpecialProfileAvatarKey(nextAvatarKey) ? "special" : "default");
    } catch (err) {
      const rewardSnapshot = await ensureHallSnapshotForProfile();
      const ratingSnapshot = await ensureRatingSnapshotForProfile();
      const fallbackProfile = buildSelfProfileFallback(null, rewardSnapshot, ratingSnapshot);
      setProfileModalData(fallbackProfile);
      const nextAvatarKey = normalizeProfileAvatarKey(fallbackProfile.profile_avatar_key);
      setProfileDraftAvatarKey(nextAvatarKey);
      setProfileDraftNickname(String(fallbackProfile.nickname || "").slice(0, 24));
      setProfileAvatarTab(
        isSpecialProfileAvatarKey(nextAvatarKey) || fallbackProfile.unlockedSpecialAvatarKeys.length > 0 ? "special" : "default"
      );
      setProfileModalError("");
    } finally {
      setProfileModalLoading(false);
    }
  };

  const openPublicProfile = async (userId, sourceOverride = null) => {
    const nextUserId = Number(userId || sourceOverride?.userId || sourceOverride?.id || 0);
    if (!Number.isInteger(nextUserId) || nextUserId <= 0) {
      if (sourceOverride) {
        const rewardSnapshot = await ensureHallSnapshotForProfile();
        const ratingSnapshot = await ensureRatingSnapshotForProfile();
        const fallbackProfile = buildPublicProfileFallback(0, rewardSnapshot, ratingSnapshot, sourceOverride);
        if (fallbackProfile) {
          setShowProfileModal(true);
          setProfileModalMode("public");
          setProfileModalLoading(false);
          setProfileModalSaving(false);
          setProfileModalError("");
          setProfileModalData(fallbackProfile);
          setProfileDraftAvatarKey(normalizeProfileAvatarKey(fallbackProfile.profile_avatar_key));
          setProfileDraftNickname("");
        }
      }
      return;
    }
    if (isLoggedIn && nextUserId === Number(authUser?.id)) {
      await openOwnProfile();
      return;
    }
    setShowProfileModal(true);
    setProfileModalMode("public");
    setProfileModalLoading(true);
    setProfileModalSaving(false);
    setProfileModalError("");
    setProfileModalData(null);
    setProfileDraftAvatarKey(DEFAULT_PROFILE_AVATAR_KEY);
    setProfileDraftNickname("");
    setProfileAvatarTab("default");
    setProfilePickerOpen(false);
    try {
      const res = await fetch(`${API_BASE}/profiles/${nextUserId}`, { headers: { ...authHeaders } });
      if (res.status === 404) {
        const rewardSnapshot = await ensureHallSnapshotForProfile();
        const ratingSnapshot = await ensureRatingSnapshotForProfile();
        const fallbackProfile = buildPublicProfileFallback(nextUserId, rewardSnapshot, ratingSnapshot, sourceOverride);
        if (!fallbackProfile) {
          throw new Error(L("프로필 정보를 불러오지 못했습니다.", "Failed to load profile."));
        }
        setProfileModalData(fallbackProfile);
        setProfileDraftAvatarKey(normalizeProfileAvatarKey(fallbackProfile.profile_avatar_key));
        return;
      }
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("프로필 정보를 불러오지 못했습니다.", "Failed to load profile."));
      const profile = data.profile || null;
      setProfileModalData(profile);
      setProfileDraftAvatarKey(normalizeProfileAvatarKey(profile?.profile_avatar_key || DEFAULT_PROFILE_AVATAR_KEY));
    } catch (err) {
      const rewardSnapshot = await ensureHallSnapshotForProfile();
      const ratingSnapshot = await ensureRatingSnapshotForProfile();
      const fallbackProfile = buildPublicProfileFallback(nextUserId, rewardSnapshot, ratingSnapshot, sourceOverride);
      if (fallbackProfile) {
        setProfileModalData(fallbackProfile);
        setProfileDraftAvatarKey(normalizeProfileAvatarKey(fallbackProfile.profile_avatar_key));
        setProfileModalError("");
      } else {
        setProfileModalError(String(err.message || L("프로필 정보를 불러오지 못했습니다.", "Failed to load profile.")));
      }
    } finally {
      setProfileModalLoading(false);
    }
  };

  const canOpenUserProfile = (userId) => Number.isInteger(Number(userId)) && Number(userId) > 0;

  const handleOpenUserProfile = (userId, sourceOverride = null) => {
    if (!canOpenUserProfile(userId) && !sourceOverride) return;
    void openPublicProfile(userId, sourceOverride);
  };

  const getDisplayedRaceProfileAvatarKey = (player) => {
    const serverKey = normalizeProfileAvatarKey(player?.profileAvatarKey || DEFAULT_PROFILE_AVATAR_KEY);
    const cachedKey = normalizeProfileAvatarKey(publicProfileAvatarCache[Number(player?.userId || 0)] || "");
    if (serverKey !== DEFAULT_PROFILE_AVATAR_KEY) return serverKey;
    return cachedKey || serverKey;
  };

  const saveProfileAvatarSelection = async () => {
    if (!isLoggedIn || profileModalMode !== "self") return;
    const nextNickname = String(profileDraftNickname || "").trim().slice(0, 24);
    if (!nextNickname) {
      setProfileModalError(L("닉네임을 입력해줘.", "Enter your nickname."));
      return;
    }
    setProfileModalSaving(true);
    setProfileModalError("");
    try {
      const res = await fetch(`${API_BASE}/profile/me`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ profileAvatarKey: profileDraftAvatarKey, nickname: nextNickname }),
      });
      if (res.status === 404) {
        throw new Error(L("프로필 저장 실패", "Failed to save profile."));
      }
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) {
        if (String(data.error || "").includes("nickname already exists")) {
          throw new Error(L("이미 사용 중인 닉네임입니다.", "Nickname is already in use."));
        }
        throw new Error(data.error || L("프로필 저장 실패", "Failed to save profile."));
      }
      const nextProfile = data.profile || null;
      const savedNickname = String(nextProfile?.nickname || nextNickname).slice(0, 24);
      if (data.user) {
        writeLocalProfileAvatarOverride(data.user, nextProfile?.profile_avatar_key || profileDraftAvatarKey);
        cacheAuthUser(data.user, { applyPrefs: false });
      }
      setProfileModalData(nextProfile);
      setProfileDraftAvatarKey(normalizeProfileAvatarKey(nextProfile?.profile_avatar_key || profileDraftAvatarKey));
      setProfileDraftNickname(savedNickname);
      setRaceState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: (prev.players || []).map((player) =>
            Number(player?.userId) === Number(authUser?.id)
              ? {
                  ...player,
                  nickname: savedNickname,
                  profileAvatarKey: normalizeProfileAvatarKey(nextProfile?.profile_avatar_key || profileDraftAvatarKey),
                }
              : player
          ),
        };
      });
      setPvpMatch((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: (prev.players || []).map((player) =>
            Number(player?.userId) === Number(authUser?.id)
              ? {
                  ...player,
                  nickname: savedNickname,
                  profileAvatarKey: normalizeProfileAvatarKey(nextProfile?.profile_avatar_key || profileDraftAvatarKey),
                }
              : player
          ),
          me:
            prev.me && Number(prev.me.userId) === Number(authUser?.id)
              ? {
                  ...prev.me,
                  nickname: savedNickname,
                  profileAvatarKey: normalizeProfileAvatarKey(nextProfile?.profile_avatar_key || profileDraftAvatarKey),
                }
              : prev.me,
        };
      });
      setStatus(L("프로필이 저장되었습니다.", "Profile saved."));
      closeProfileModal();
    } catch (err) {
      setProfileModalError(String(err?.message || L("프로필 저장 실패", "Failed to save profile.")));
      setStatus(L("프로필 저장에 실패했습니다.", "Failed to save profile."));
    } finally {
      setProfileModalSaving(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (IS_APPS_IN_TOSS) {
      const syncGuardState = () => {
        const guardedMode = playModeRef.current || "menu";
        window.history.pushState({ mode: guardedMode, appsInTossBackGuard: true }, "", getPathFromMode(guardedMode));
      };
      try {
        const guardedMode = playModeRef.current || "menu";
        window.history.replaceState({ mode: guardedMode, appsInTossBackGuard: true }, "", getPathFromMode(guardedMode));
        syncGuardState();
      } catch {
        // History may be locked by the host shell.
      }
      const onAppsBack = () => {
        try {
          syncGuardState();
        } catch {
          // ignore host history errors
        }
        setShowExitConfirmModal(true);
      };
      window.addEventListener("popstate", onAppsBack);
      return () => window.removeEventListener("popstate", onAppsBack);
    }
    const onPopState = () => {
      const modeFromPath = getModeFromPath(window.location.pathname);
      setPlayMode((prev) => (prev === modeFromPath ? prev : modeFromPath));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentPath = normalizePath(window.location.pathname);
    const redirectTarget = CONTENT_PAGE_REDIRECTS[currentPath];
    if (!redirectTarget) return;
    const normalizedCurrent = window.location.pathname.replace(/\/+$/, "");
    if (normalizedCurrent === redirectTarget) return;
    window.location.replace(redirectTarget);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const targetPath = getPathFromMode(playMode);
    const currentPath = normalizePath(window.location.pathname);
    if (CONTENT_PAGE_REDIRECTS[currentPath]) return;
    if (currentPath === targetPath) return;
    if (IS_APPS_IN_TOSS) {
      window.history.replaceState({ mode: playMode, appsInTossBackGuard: true }, "", targetPath);
      return;
    }
    window.history.pushState({ mode: playMode }, "", targetPath);
  }, [playMode]);

  useEffect(() => {
    if (!IS_APPS_IN_TOSS) return undefined;
    setIosSwipeGestureEnabled({ isEnabled: false }).catch(() => {});
    const onBeforeUnload = (event) => {
      if (exitConfirmedRef.current) return undefined;
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      setIosSwipeGestureEnabled({ isEnabled: true }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const players = Array.isArray(raceState?.players) ? raceState.players : [];
    if (!players.length) return;
    const targetIds = Array.from(
      new Set(
        players
          .map((player) => Number(player?.userId || 0))
          .filter((userId) => Number.isInteger(userId) && userId > 0 && userId !== Number(authUser?.id || 0))
      )
    ).filter((userId) => !publicProfileAvatarCache[userId]);
    if (!targetIds.length) return;

    let cancelled = false;
    void (async () => {
      const nextEntries = await Promise.all(
        targetIds.map(async (userId) => {
          try {
            const res = await fetch(`${API_BASE}/profiles/${userId}`, { headers: { ...authHeaders } });
            if (!res.ok) return null;
            const data = await parseJsonSafe(res);
            const avatarKey = normalizeProfileAvatarKey(data?.profile?.profile_avatar_key || "");
            if (!avatarKey) return null;
            return [userId, avatarKey];
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      setPublicProfileAvatarCache((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const entry of nextEntries) {
          if (!entry) continue;
          const [userId, avatarKey] = entry;
          if (next[userId] !== avatarKey) {
            next[userId] = avatarKey;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [raceState?.players, authToken, authUser?.id, publicProfileAvatarCache]);

  useEffect(() => {
    const nextLang = IS_APPS_IN_TOSS ? "ko" : lang;
    if (IS_APPS_IN_TOSS && lang !== "ko") {
      setLang("ko");
      return;
    }
    localStorage.setItem(LANG_KEY, nextLang);
  }, [lang]);

  useEffect(() => {
    if (!IS_APPS_IN_TOSS) return;
    if (!APPS_IN_TOSS_SIZE_KEYS.includes(selectedSize)) {
      setSelectedSize(APPS_IN_TOSS_DEFAULT_SIZE);
    }
  }, [selectedSize]);

  useEffect(() => {
    try {
      localStorage.removeItem(THEME_KEY);
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STYLE_VARIANT_KEY, uiStyleVariant);
    } catch {
      // ignore localStorage errors
    }
  }, [uiStyleVariant]);

  useEffect(() => {
    try {
      if (adminCreatorKey) {
        localStorage.setItem(CREATOR_ADMIN_KEY, adminCreatorKey);
      } else {
        localStorage.removeItem(CREATOR_ADMIN_KEY);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [adminCreatorKey]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setIsCoarsePointer(Boolean(mq.matches));
    apply();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
    if (typeof mq.addListener === "function") {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  useEffect(() => {
    cellValuesRef.current = cells;
  }, [cells]);

  useEffect(() => {
    raceRoomCodeRef.current = raceRoomCode;
    racePlayerIdRef.current = racePlayerId;
  }, [raceRoomCode, racePlayerId]);

  useEffect(() => {
    pvpTicketRef.current = pvpTicketId;
  }, [pvpTicketId]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (racePollRef.current) clearInterval(racePollRef.current);
      if (pvpPollRef.current) clearInterval(pvpPollRef.current);
      if (pvpRevealAnimRef.current) clearInterval(pvpRevealAnimRef.current);
      if (pvpRatingAnimRef.current) cancelAnimationFrame(pvpRatingAnimRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  useEffect(() => {
    const sendLeaveBeacon = () => {
      const roomCode = raceRoomCodeRef.current;
      const playerId = racePlayerIdRef.current;
      const ticketId = pvpTicketRef.current;

      if (roomCode && playerId) {
        const payload = JSON.stringify({ roomCode, playerId });
        try {
          if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: "application/json" });
            navigator.sendBeacon(`${API_BASE}/race/leave`, blob);
          } else {
            fetch(`${API_BASE}/race/leave`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payload,
              keepalive: true,
            }).catch(() => {});
          }
        } catch {
          // ignore beacon errors
        }
      }

      if (ticketId) {
        const payload = JSON.stringify({ ticketId });
        try {
          if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: "application/json" });
            navigator.sendBeacon(`${API_BASE}/pvp/queue/cancel`, blob);
          } else {
            fetch(`${API_BASE}/pvp/queue/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payload,
              keepalive: true,
            }).catch(() => {});
          }
        } catch {
          // ignore beacon errors
        }
      }
    };

    window.addEventListener("pagehide", sendLeaveBeacon);
    window.addEventListener("beforeunload", sendLeaveBeacon);
    return () => {
      window.removeEventListener("pagehide", sendLeaveBeacon);
      window.removeEventListener("beforeunload", sendLeaveBeacon);
    };
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { ...authHeaders } });
        const data = await parseJsonSafe(res);
        if (!res.ok || !data.ok || cancelled) {
          clearAuth();
          return;
        }
        cacheAuthUser(data.user, { applyPrefs: true });
      } catch {
        if (!cancelled) clearAuth();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    const unlock = () => {
      if (!soundEnabled) return;
      const ctx = ensureAudio();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [soundEnabled]);

  const rowHints = useMemo(() => {
    if (playMode === "create" && puzzle) {
      const sourceCells = createCellsForHints || [];
      return Array.from({ length: puzzle.height }, (_, y) =>
        getRuns(sourceCells.slice(y * puzzle.width, (y + 1) * puzzle.width).map((value) => (value === 1 ? 1 : 0)))
      );
    }
    if (!Array.isArray(puzzle?.row_hints)) return [];
    return puzzle.row_hints.map((hint) => (Array.isArray(hint) ? hint : []));
  }, [createCellsForHints, playMode, puzzle]);

  const colHints = useMemo(() => {
    if (playMode === "create" && puzzle) {
      const sourceCells = createCellsForHints || [];
      return Array.from({ length: puzzle.width }, (_, x) => {
        const col = [];
        for (let y = 0; y < puzzle.height; y += 1) col.push(sourceCells[y * puzzle.width + x] === 1 ? 1 : 0);
        return getRuns(col);
      });
    }
    if (!Array.isArray(puzzle?.col_hints)) return [];
    return puzzle.col_hints.map((hint) => (Array.isArray(hint) ? hint : []));
  }, [createCellsForHints, playMode, puzzle]);

  const maxRowHintDepth = useMemo(() => {
    if (!rowHints.length) return 0;
    return Math.max(...rowHints.map((h) => h.length), 1);
  }, [rowHints]);

  const maxColHintDepth = useMemo(() => {
    if (!colHints.length) return 0;
    return Math.max(...colHints.map((h) => h.length), 1);
  }, [colHints]);

  const cellSize = useMemo(() => {
    if (!puzzle) return IS_APPS_IN_TOSS ? 20 : 24;
    if (IS_APPS_IN_TOSS && playMode !== "create") {
      const totalColumns = puzzle.width + Math.max(maxRowHintDepth, 1);
      const totalRows = puzzle.height + Math.max(maxColHintDepth, 1);
      const usableWidth = Math.max(320, viewportWidth) - (viewportWidth >= 700 ? 132 : 20);
      const measuredStageTop = boardStageTop > 0 ? boardStageTop : raceRoomCode ? 180 : 300;
      const hpReserve = raceRoomCode ? 0 : viewportWidth <= 380 ? 44 : 48;
      const controlsReserve = viewportWidth <= 380 ? 72 : 76;
      const stageGapsReserve = raceRoomCode ? 16 : 26;
      const safeBottomReserve = viewportWidth <= 380 ? 10 : 14;
      const usableHeight = Math.max(
        220,
        viewportHeight - measuredStageTop - hpReserve - controlsReserve - stageGapsReserve - safeBottomReserve
      );
      const widthFit = Math.floor(usableWidth / Math.max(totalColumns, 1));
      const heightFit = Math.floor(usableHeight / Math.max(totalRows, 1));
      const comfortMax = puzzle.width <= 5 ? 44 : puzzle.width <= 10 ? 31 : 23;
      return Math.max(13, Math.min(comfortMax, widthFit || comfortMax, heightFit || comfortMax));
    }
    return puzzle.width >= 25 ? 20 : 24;
  }, [boardStageTop, maxColHintDepth, maxRowHintDepth, playMode, puzzle, raceRoomCode, viewportHeight, viewportWidth]);
  const excelSheetCols = useMemo(() => Array.from({ length: 40 }, (_, idx) => toSheetColumnLabel(idx)), []);
  const excelSheetRows = useMemo(() => Array.from({ length: 120 }, (_, idx) => idx + 1), []);
  const excelBoardCols = useMemo(() => {
    if (!puzzle) return [];
    return Array.from({ length: puzzle.width }, (_, idx) => toSheetColumnLabel(idx));
  }, [puzzle]);
  const excelBoardRows = useMemo(() => {
    if (!puzzle) return [];
    return Array.from({ length: puzzle.height }, (_, idx) => idx + 1);
  }, [puzzle]);

  const solvedLineSets = useMemo(() => {
    if (!puzzle || playMode === "create") return { rows: new Set(), cols: new Set() };
    return collectSolvedLineSets(cells, puzzle, rowHints, colHints);
  }, [cells, playMode, puzzle, rowHints, colHints]);
  const solvedRows = solvedLineSets.rows;
  const solvedCols = solvedLineSets.cols;

  useEffect(() => {
    if (!puzzle || playMode === "create") {
      fixedMarkIndicesRef.current = new Set();
      lockedCellIndicesRef.current = new Set();
      autoCompletedLinesRef.current = { key: "", rows: new Set(), cols: new Set(), silent: true };
      setLineClearFx(null);
      return;
    }

    const key = `${puzzle.id || "puzzle"}:${puzzle.width}x${puzzle.height}`;
    const tracker = autoCompletedLinesRef.current;
    if (tracker.key !== key) {
      autoCompletedLinesRef.current = { key, rows: new Set(), cols: new Set(), silent: true };
      setLineClearFx(null);
    }
  }, [playMode, puzzle?.id, puzzle?.width, puzzle?.height]);

  useEffect(() => {
    if (!puzzle || playMode === "create") {
      fixedMarkIndicesRef.current = new Set();
      lockedCellIndicesRef.current = new Set();
      return;
    }

    let tracker = autoCompletedLinesRef.current;
    const key = `${puzzle.id || "puzzle"}:${puzzle.width}x${puzzle.height}`;
    if (tracker.key !== key) {
      tracker = { key, rows: new Set(), cols: new Set(), silent: true };
      autoCompletedLinesRef.current = tracker;
    }
    const solvedRowSet = new Set(solvedRows);
    const solvedColSet = new Set(solvedCols);
    for (const row of Array.from(tracker.rows)) {
      if (!solvedRowSet.has(row)) tracker.rows.delete(row);
    }
    for (const col of Array.from(tracker.cols)) {
      if (!solvedColSet.has(col)) tracker.cols.delete(col);
    }

    const locked = new Set(fixedMarkIndicesRef.current);
    for (const row of solvedRowSet) {
      for (let x = 0; x < puzzle.width; x += 1) locked.add(row * puzzle.width + x);
    }
    for (const col of solvedColSet) {
      for (let y = 0; y < puzzle.height; y += 1) locked.add(y * puzzle.width + col);
    }
    lockedCellIndicesRef.current = locked;

    const current = cellValuesRef.current;
    if (!Array.isArray(current) || current.length !== puzzle.width * puzzle.height) return;
    const next = current.slice();
    let changed = false;
    const newRows = [];
    const newCols = [];

    for (const row of solvedRowSet) {
      if (!tracker.rows.has(row)) newRows.push(row);
      tracker.rows.add(row);
      for (let x = 0; x < puzzle.width; x += 1) {
        const index = row * puzzle.width + x;
        if (next[index] === 0) {
          next[index] = 2;
          changed = true;
        }
      }
    }

    for (const col of solvedColSet) {
      if (!tracker.cols.has(col)) newCols.push(col);
      tracker.cols.add(col);
      for (let y = 0; y < puzzle.height; y += 1) {
        const index = y * puzzle.width + col;
        if (next[index] === 0) {
          next[index] = 2;
          changed = true;
        }
      }
    }

    if (changed) {
      pendingPaintRef.current.clear();
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      cellValuesRef.current = next;
      setCells(next);
    }
    if ((newRows.length > 0 || newCols.length > 0) && !tracker.silent) {
      setLineClearFx({ id: Date.now(), rows: newRows, cols: newCols });
      playSfx("line-clear");
    }
    tracker.silent = false;
  }, [playMode, puzzle, solvedRows, solvedCols]);

  const formattedTime = useMemo(() => {
    const totalCs = Math.max(0, Math.floor(Number(elapsedMs || 0) / 10));
    const mm = String(Math.floor(totalCs / 6000)).padStart(2, "0");
    const ss = String(Math.floor((totalCs % 6000) / 100)).padStart(2, "0");
    const cc = String(totalCs % 100).padStart(2, "0");
    return `${mm}:${ss}.${cc}`;
  }, [elapsedMs]);
  const hallSizes = useMemo(
    () => PVP_SIZE_KEYS.map((sizeKey) => ({ sizeKey, records: Array.isArray(hallDataBySize[sizeKey]) ? hallDataBySize[sizeKey] : [] })),
    [hallDataBySize]
  );
  const hallActiveRecords = useMemo(() => {
    const list = hallDataBySize[hallActiveSizeKey];
    return Array.isArray(list) ? list : [];
  }, [hallDataBySize, hallActiveSizeKey]);

  const isBoardCompleteByHints = useMemo(() => {
    if (!puzzle || playMode === "create") return false;
    return solvedRows.size === puzzle.height && solvedCols.size === puzzle.width;
  }, [playMode, puzzle, solvedRows, solvedCols]);
  const isModeMenu = playMode === "menu";
  const isModeSingle = playMode === "single";
  const isModeCreate = playMode === "create";
  const isModeMulti = playMode === "multi";
  const isModePvp = playMode === "pvp";
  const isModePlacementTest = playMode === "placement_test";
  const isModeAuth = playMode === "auth";
  const isModeTutorial = playMode === "tutorial";
  const isModeRanking = playMode === "ranking";
  const isModeLegacyRanking = playMode === "legacy_ranking";
  const isModeReplayHall = playMode === "replay_hall";
  const isCustomPreviewPuzzle = Boolean(puzzle?.isCustomPreview);
  const isCreatorAdminUser = String(authUser?.username || "").trim().toLowerCase() === "kyurea";
  const placementAssignedRating = Number(authUser?.placement_rating || 0);
  const hasPlacementQualification = isLoggedIn && Boolean(authUser?.placement_done) && Number.isFinite(placementAssignedRating) && placementAssignedRating >= 0;
  const placementAssignedTier = hasPlacementQualification
    ? getTierInfoByRating(placementAssignedRating, myRatingRank)
    : null;
  const myTierInfo = isLoggedIn ? getRankingTierInfoByRating(authUser?.rating, myRatingRank) : null;
  const isInRaceRoom = Boolean(raceRoomCode);
  const isSingleSoloMode = (isModeSingle || isModeTutorial || isModePlacementTest) && !isInRaceRoom;
  const shouldShowPuzzleBoard = Boolean(
    puzzle &&
      ((((isModeSingle || isModePlacementTest) && !isInRaceRoom) || (isModeCreate && !isInRaceRoom)) ||
        ((isModeMulti || isModePvp) && isInRaceRoom))
  );
  const isHpPuzzleMode = shouldShowPuzzleBoard && !isModeCreate && !isInRaceRoom;
  const shouldStopSoloElapsedTimer = !isInRaceRoom && (isModeSingle || isModeTutorial);
  const shouldShowSingleTimer = shouldShowPuzzleBoard && isModePlacementTest && !isInRaceRoom;
  const shouldReserveStatusSlot = shouldShowPuzzleBoard && !isInRaceRoom && !isModeAuth;
  const isPuzzleHpGameOver = isHpPuzzleMode && puzzleHp <= 0 && !isBoardCompleteByHints;
  const puzzleSolutionCells = useMemo(() => getPuzzleSolutionCells(puzzle), [puzzle]);
  const canUsePuzzleHint = isHpPuzzleMode && !isPuzzleHpGameOver && !isBoardCompleteByHints;
  const canRequestRewardAd =
    !IS_APPS_IN_TOSS || Boolean(REVIVE_AD_GROUP_ID) || REVIVE_AD_TEST_FALLBACK || isLocalNativeRuntime();

  useEffect(() => {
    puzzleHpRef.current = puzzleHp;
  }, [puzzleHp]);

  useEffect(() => {
    if (!IS_APPS_IN_TOSS || !shouldShowPuzzleBoard || isModeCreate) {
      setBoardStageTop(0);
      return undefined;
    }

    let frameId = 0;
    const measureBoardStage = () => {
      frameId = 0;
      const rect = boardStageRef.current?.getBoundingClientRect?.();
      if (!rect) return;
      const nextTop = Math.max(0, Math.round(rect.top));
      setBoardStageTop((prev) => (Math.abs(prev - nextTop) <= 1 ? prev : nextTop));
    };
    const scheduleMeasure = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measureBoardStage);
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [
    isModeCreate,
    playMode,
    puzzle?.id,
    puzzle?.width,
    puzzle?.height,
    raceRoomCode,
    shouldShowPuzzleBoard,
    singleSection,
    status,
    viewportHeight,
    viewportWidth,
  ]);

  const racePhase = raceState?.state || "idle";
  const isRaceLobby = isInRaceRoom && racePhase === "lobby";
  const isRaceCountdown = isInRaceRoom && racePhase === "countdown";
  const isRacePlaying = isInRaceRoom && racePhase === "playing";
  const isRaceFinished = isInRaceRoom && racePhase === "finished";
  const isRacePreStartMasked = isInRaceRoom && (isRaceLobby || isRaceCountdown);
  const canAutoOpenVoteModal = false;

  useEffect(() => {
    if (!isModeCreate || !puzzle) return;
    creatorDraftRef.current = {
      width: puzzle.width,
      height: puzzle.height,
      cells: cells.map((value) => (value === 1 ? 1 : 0)),
    };
  }, [cells, isModeCreate, puzzle]);

  const releaseActivePointerCapture = () => {
    const pointerId = activePointerIdRef.current;
    activePointerIdRef.current = null;
    if (pointerId == null) return;
    try {
      const target = boardRef.current;
      if (target?.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId);
      } else {
        target?.releasePointerCapture?.(pointerId);
      }
    } catch {
      // Pointer capture can already be released by the browser.
    }
  };

  const finishActiveStroke = () => {
    if (dragRef.current && strokeChangedRef.current && strokeBaseRef.current) {
      pushUndo(strokeBaseRef.current);
    }
    dragRef.current = null;
    lastPaintIndexRef.current = null;
    strokeBaseRef.current = null;
    strokeChangedRef.current = false;
    strokeMistakeChargedRef.current = false;
    releaseActivePointerCapture();
  };

  useEffect(() => {
    setActiveVote(null);
    setShowVoteModal(false);
    setVoteError("");
    votePromptedTokenRef.current = "";
  }, [authToken, authUser?.id, canAutoOpenVoteModal]);
  const racePhaseLabel = useMemo(() => {
    if (racePhase === "lobby") return L("로비", "Lobby");
    if (racePhase === "countdown") return L("카운트다운", "Countdown");
    if (racePhase === "playing") return L("진행 중", "Playing");
    if (racePhase === "finished") return L("경기 종료", "Finished");
    return L("대기 중", "Idle");
  }, [racePhase, lang]);
  const tutorialSolved = isModeTutorial && isBoardCompleteByHints;
  const tutorialStepDone = (step) => {
    if (!step) return false;
    if (step.requireSolved) return tutorialSolved;
    if (!Array.isArray(cells) || !cells.length) return false;
    if (Array.isArray(step.fill) && step.fill.some((idx) => cells[idx] !== 1)) return false;
    if (Array.isArray(step.mark) && step.mark.some((idx) => cells[idx] !== 2)) return false;
    return true;
  };
  const tutorialCurrentTaskIndex = useMemo(() => {
    if (!isModeTutorial) return 0;
    const idx = TUTORIAL_GUIDE_STEPS.findIndex((step) => !tutorialStepDone(step));
    return idx === -1 ? TUTORIAL_GUIDE_STEPS.length : idx;
  }, [isModeTutorial, cells, tutorialSolved]);
  const tutorialCurrentTask = TUTORIAL_GUIDE_STEPS[tutorialCurrentTaskIndex] || null;
  const tutorialAllDone = tutorialCurrentTaskIndex >= TUTORIAL_GUIDE_STEPS.length;
  const tutorialHighlightRows = isModeTutorial && tutorialCurrentTask?.rowHighlights ? tutorialCurrentTask.rowHighlights : [];
  const tutorialHighlightCells =
    isModeTutorial && tutorialCurrentTask?.cellHighlights ? tutorialCurrentTask.cellHighlights : [];
  const tutorialLesson = TUTORIAL_LESSONS[tutorialLessonIndex] || TUTORIAL_LESSONS[0];
  const tutorialLessonCellsNormalized = normalizeTutorialLessonCells(tutorialLesson, tutorialLessonCells);
  const tutorialLessonSolved = isTutorialLessonSolved(tutorialLesson, tutorialLessonCellsNormalized);
  const tutorialLessonIsFinal = tutorialLessonIndex >= TUTORIAL_LESSONS.length - 1;
  const tutorialLessonProgress = Math.round(((tutorialLessonIndex + 1) / TUTORIAL_LESSONS.length) * 100);

  const myRacePlayer = useMemo(() => {
    if (!raceState || !racePlayerId) return null;
    return raceState.players?.find((p) => p.playerId === racePlayerId) || null;
  }, [raceState, racePlayerId]);
  const raceTotalAnswerCells = Math.max(0, Number(raceState?.totalAnswerCells || 0));
  const getRaceProgressPercent = (player) =>
    raceTotalAnswerCells
      ? Math.max(0, Math.min(100, Math.round(((Number(player?.correctAnswerCells) || 0) / raceTotalAnswerCells) * 100)))
      : 0;
  const myRaceProgressPercent = getRaceProgressPercent(myRacePlayer);
  const isMyRaceFinished = isInRaceRoom && Number.isInteger(myRacePlayer?.elapsedSec);
  const canInteractBoard =
    (!isInRaceRoom || (isRacePlaying && !isMyRaceFinished)) &&
    (!isHpPuzzleMode || puzzleHp > 0 || isBoardCompleteByHints);
  const canResetBoard = Boolean(puzzle) && (!isInRaceRoom || (isRacePlaying && !isMyRaceFinished));

  const raceResultText = useMemo(() => {
    if (!raceState?.winner) return "";
    if (raceState.winner.playerId === racePlayerId) {
      return L("승리하였습니다", "Victory");
    }
    return L("패배하였습니다", "Defeat");
  }, [raceState, racePlayerId, lang]);
  const raceResultKey = useMemo(() => {
    if (!isModeMulti || !isInRaceRoom || !raceRoomCode || !raceState?.gameStartAt) return "";
    return `${raceRoomCode}:${raceState.gameStartAt}`;
  }, [isModeMulti, isInRaceRoom, raceRoomCode, raceState?.gameStartAt]);
  const raceResultRows = useMemo(() => {
    if (!isModeMulti || !raceState) return [];
    const rankings = Array.isArray(raceState.rankings) ? raceState.rankings : [];
    const rankingByPlayerId = new Map(rankings.map((r) => [String(r.playerId || ""), r]));
    const players = Array.isArray(raceState.players) ? raceState.players : [];
    return players
      .map((p) => {
        const rankInfo = rankingByPlayerId.get(String(p.playerId || "")) || null;
        const rank = Number.isInteger(Number(rankInfo?.rank)) ? Number(rankInfo.rank) : null;
        const elapsedSec = Number.isInteger(Number(p.elapsedSec))
          ? Number(p.elapsedSec)
          : Number.isInteger(Number(rankInfo?.elapsedSec))
            ? Number(rankInfo.elapsedSec)
            : null;
        const elapsedMs = Number.isFinite(Number(p.elapsedMs))
          ? Number(p.elapsedMs)
          : Number.isFinite(Number(rankInfo?.elapsedMs))
            ? Number(rankInfo.elapsedMs)
            : null;
        const status = String(rankInfo?.status || (p.disconnectedAt ? "left" : "dnf"));
        return {
          playerId: p.playerId,
          userId: Number.isInteger(Number(p.userId)) ? Number(p.userId) : null,
          nickname: p.nickname,
          rank,
          elapsedSec,
          elapsedMs,
          status,
          isMe: p.playerId === racePlayerId,
        };
      })
      .sort((a, b) => {
        const ar = Number.isInteger(a.rank) ? a.rank : Number.MAX_SAFE_INTEGER;
        const br = Number.isInteger(b.rank) ? b.rank : Number.MAX_SAFE_INTEGER;
        if (ar !== br) return ar - br;
        return String(a.nickname || "").localeCompare(String(b.nickname || ""));
      });
  }, [isModeMulti, raceState, racePlayerId]);
  const roomTitleText = raceState?.roomTitle || "";
  const chatMessages = Array.isArray(raceState?.chatMessages) ? raceState.chatMessages : [];

  const formatRaceElapsedSec = (sec) => {
    if (!Number.isInteger(Number(sec))) return "-";
    const mm = String(Math.floor(Number(sec) / 60)).padStart(2, "0");
    const ss = String(Number(sec) % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const formatRaceElapsedMs = (elapsedMs, fallbackSec = null) => {
    let ms = Number(elapsedMs || 0);
    if (!Number.isFinite(ms) || ms <= 0) {
      const sec = Number(fallbackSec);
      if (!Number.isFinite(sec) || sec <= 0) return "-";
      ms = sec * 1000;
    }
    const totalCs = Math.max(0, Math.floor(ms / 10));
    const mm = String(Math.floor(totalCs / 6000)).padStart(2, "0");
    const ss = String(Math.floor((totalCs % 6000) / 100)).padStart(2, "0");
    const cc = String(totalCs % 100).padStart(2, "0");
    return `${mm}:${ss}.${cc}`;
  };

  const formatHallElapsedMs = (elapsedMs, fallbackSec = null) => {
    let ms = Number(elapsedMs || 0);
    if (!Number.isFinite(ms) || ms <= 0) {
      const sec = Number(fallbackSec);
      if (!Number.isFinite(sec) || sec <= 0) return "-";
      ms = sec * 1000;
    }
    if (ms < 60000) {
      return (ms / 1000).toFixed(2);
    }
    return formatRaceElapsedMs(ms, fallbackSec);
  };

  const formatRaceStatusLabel = (status) => {
    if (status === "finished") return L("완주", "Finished");
    if (status === "timeout") return L("타임아웃", "Timeout");
    if (status === "left") return L("중도 이탈", "Left");
    if (status === "dnf") return L("미완주", "DNF");
    return status || "-";
  };

  const formatKstDate = (ms) => {
    const t = Number(ms || 0);
    if (!Number.isFinite(t) || t <= 0) return "-";
    const kst = new Date(t + 9 * 60 * 60 * 1000);
    const y = String(kst.getUTCFullYear());
    const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(kst.getUTCDate()).padStart(2, "0");
    return `${y}.${m}.${d}`;
  };

  const formatRankLabel = (rank) => {
    const n = Number(rank || 0);
    if (!Number.isInteger(n) || n <= 0) return "-";
    if (lang === "ko") return `${n}위`;
    if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
    if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
    if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
    return `${n}th`;
  };

  const countdownLeft = useMemo(() => {
    if (!isRaceCountdown || !raceState?.gameStartAt) return null;
    const ms = new Date(raceState.gameStartAt).getTime() - nowMs;
    return Math.max(0, Math.ceil(ms / 1000));
  }, [isRaceCountdown, raceState, nowMs]);
  const inactivityTimeoutMs = useMemo(() => {
    const raw = Number(raceState?.inactivityTimeoutMs || 60000);
    if (!Number.isFinite(raw)) return 60000;
    return Math.max(5000, raw);
  }, [raceState?.inactivityTimeoutMs]);
  const inactivityWarnLeadMs = useMemo(() => {
    return 5000;
  }, []);
  const myLastMoveAtMs = useMemo(() => {
    const fromPlayer = Number(myRacePlayer?.lastMoveAt || 0);
    if (Number.isFinite(fromPlayer) && fromPlayer > 0) return fromPlayer;
    const gameStart = Number(new Date(raceState?.gameStartAt || 0).getTime() || 0);
    return gameStart > 0 ? gameStart : 0;
  }, [myRacePlayer?.lastMoveAt, raceState?.gameStartAt]);
  const inactivityLeftMs = useMemo(() => {
    if (!isModePvp || !isRacePlaying || !myRacePlayer || isMyRaceFinished) return 0;
    if (myRacePlayer.disconnectedAt) return 0;
    if (myRacePlayer.loseReason === "inactive_timeout") return 0;
    if (!myLastMoveAtMs) return inactivityTimeoutMs;
    return Math.max(0, inactivityTimeoutMs - (nowMs - myLastMoveAtMs));
  }, [isModePvp, isRacePlaying, myRacePlayer, isMyRaceFinished, myLastMoveAtMs, inactivityTimeoutMs, nowMs]);
  const showInactivityWarning = inactivityLeftMs > 0 && inactivityLeftMs <= inactivityWarnLeadMs;
  const inactivityLeftSec = Math.max(0, Math.ceil(inactivityLeftMs / 1000));
  const inactivityWarnPercent = Math.max(0, Math.min(100, (inactivityLeftMs / inactivityWarnLeadMs) * 100));
  const pvpMatchState = pvpMatch?.state || "";
  const pvpOptions = Array.isArray(pvpMatch?.options) ? pvpMatch.options : [];
  const pvpPlayers = Array.isArray(pvpMatch?.players) ? pvpMatch.players : [];
  const pvpAllowedSizeKeys = useMemo(
    () => getAllowedPvpSizeKeys(pvpPlayers, authUser),
    [
      pvpPlayers,
      authUser?.placement_tier_key,
      authUser?.placement_rating,
      authUser?.rating,
      authUser?.ratingRank,
    ]
  );
  const pvpDisplayOptions = useMemo(() => {
    if (pvpOptions.length > 0) {
      const filteredOptions = pvpOptions.filter((option) => {
        const sizeKey = option?.sizeKey || `${option?.width}x${option?.height}`;
        return pvpAllowedSizeKeys.includes(sizeKey);
      });
      return filteredOptions.length > 0 ? filteredOptions : pvpOptions;
    }
    return pvpAllowedSizeKeys.map((sizeKey) => ({
      sizeKey,
      bannedByNicknames: [],
      banned: false,
    }));
  }, [pvpOptions, pvpAllowedSizeKeys]);
  const pvpAllAccepted = pvpPlayers.length >= 2 && pvpPlayers.every((p) => p.accepted === true);
  const pvpShowdownPlayers = useMemo(() => {
    if (!pvpPlayers.length) return [];
    const myId = Number(authUser?.id || 0);
    const list = [...pvpPlayers];
    list.sort((a, b) => {
      const am = Number(a.userId) === myId ? 0 : 1;
      const bm = Number(b.userId) === myId ? 0 : 1;
      if (am !== bm) return am - bm;
      return Number(a.userId) - Number(b.userId);
    });
    return list.slice(0, 2);
  }, [pvpPlayers, authUser?.id]);
  const isPvpShowdownActive =
    isModePvp &&
    pvpSearching &&
    !isInRaceRoom &&
    pvpShowdownMatchId &&
    pvpShowdownMatchId === String(pvpMatch?.matchId || "") &&
    nowMs < pvpShowdownUntilMs;
  const pvpAcceptLeftMs = useMemo(() => {
    if (pvpMatchState !== "accept") return 0;
    const deadlineAt = Number(pvpMatch?.acceptDeadlineAt || 0);
    if (!deadlineAt) return 0;
    return Math.max(0, deadlineAt - nowMs);
  }, [pvpMatchState, pvpMatch, nowMs]);
  const pvpBanLeftMs = useMemo(() => {
    if (pvpMatchState !== "ban") return 0;
    const deadlineAt = Number(pvpMatch?.banDeadlineAt || 0);
    const banStartAt = Number(pvpMatch?.banStartAt || 0);
    if (!deadlineAt) return 0;
    const effectiveNow = banStartAt > 0 ? Math.max(nowMs, banStartAt) : nowMs;
    return Math.max(0, deadlineAt - effectiveNow);
  }, [pvpMatchState, pvpMatch, nowMs]);
  const pvpAcceptPercent = pvpMatchState === "accept" ? Math.max(0, Math.min(100, (pvpAcceptLeftMs / 12000) * 100)) : 0;
  const pvpAcceptLeftSec = Math.max(0, Math.ceil(pvpAcceptLeftMs / 1000));
  const pvpBanPercent = pvpMatchState === "ban" ? Math.max(0, Math.min(100, (pvpBanLeftMs / 10000) * 100)) : 0;
  const pvpRevealLeftMs = useMemo(() => {
    if (pvpMatchState !== "reveal") return 0;
    const endAt = Number(pvpMatch?.revealEndAt || 0);
    if (!endAt) return 0;
    return Math.max(0, endAt - nowMs);
  }, [pvpMatchState, pvpMatch, nowMs]);
  const isPvpRevealSpinning =
    pvpMatchState === "reveal" && pvpRevealLeftMs > PVP_REVEAL_RESULT_HOLD_MS;
  const shouldRunPvpRevealRoulette =
    isModePvp &&
    pvpSearching &&
    !isInRaceRoom &&
    pvpMatchState === "reveal" &&
    !isPvpShowdownActive &&
    isPvpRevealSpinning;
  const isPvpCancelHomeLocked =
    isModePvp &&
    pvpSearching &&
    (
      pvpMatchState === "reveal" ||
      (pvpMatchState === "accept" && pvpMatch?.me?.accepted === true)
    );
  const pvpFlowStepIndex = isPvpShowdownActive
    ? 2
    : pvpMatchState === "reveal"
      ? 3
      : pvpMatchState === "accept"
        ? pvpAllAccepted
          ? 2
          : 1
        : pvpSearching
          ? 0
          : -1;
  const placementElapsedSec = useMemo(() => {
    if (!placementStartedAtMs) return 0;
    if (!placementRunning && placementResultCard?.elapsedSec != null) {
      return Number(placementResultCard.elapsedSec);
    }
    return Math.max(0, Math.min(PLACEMENT_TIME_LIMIT_SEC, Math.floor((nowMs - placementStartedAtMs) / 1000)));
  }, [placementRunning, placementStartedAtMs, placementResultCard?.elapsedSec, nowMs]);
  const placementLeftSec = Math.max(0, PLACEMENT_TIME_LIMIT_SEC - placementElapsedSec);
  const placementStageProgress = useMemo(() => {
    if (!isModePlacementTest || !placementRunning || !puzzle) return 0;
    const totalUnits = Number(puzzle.width || 0) + Number(puzzle.height || 0);
    if (!Number.isFinite(totalUnits) || totalUnits <= 0) return 0;
    const solvedUnits = solvedRows.size + solvedCols.size;
    return Math.max(0, Math.min(1, solvedUnits / totalUnits));
  }, [isModePlacementTest, placementRunning, puzzle, solvedRows, solvedCols]);
  const placementCurrentStage = placementResults[Math.max(0, Math.min(PLACEMENT_STAGES.length - 1, placementStageIndex))] || null;
  const placementTimerText = `${String(Math.floor(placementLeftSec / 60)).padStart(2, "0")}:${String(
    placementLeftSec % 60
  ).padStart(2, "0")}`;
  const matchSimResolvedSec = matchSimFound?.matchedAtSec ?? matchSimElapsedSec;
  const matchSimCurrentRule = useMemo(() => getMatchSimRule(matchSimResolvedSec), [matchSimResolvedSec]);
  const matchSimCurrentTier = useMemo(() => getTierInfoByRating(matchSimRating), [matchSimRating]);
  const matchSimProgressPercent = Math.max(0, Math.min(100, (matchSimResolvedSec / MATCH_SIM_MAX_WAIT_SEC) * 100));
  const matchFlowLeftMs = useMemo(() => {
    if (!matchFlowTest?.phaseEndsAtMs) return 0;
    return Math.max(0, Number(matchFlowTest.phaseEndsAtMs) - nowMs);
  }, [matchFlowTest?.phaseEndsAtMs, nowMs]);
  const matchFlowAcceptPercent =
    matchFlowTest?.phase === "accept" ? Math.max(0, Math.min(100, (matchFlowLeftMs / 3200) * 100)) : 0;
  const matchFlowBanPercent =
    matchFlowTest?.phase === "ban" ? Math.max(0, Math.min(100, (matchFlowLeftMs / 3200) * 100)) : 0;
  const matchFlowShowdownActive = Boolean(matchFlowTest?.showdown);
  const matchFlowRevealSpinning = Boolean(matchFlowTest?.phase === "reveal" && matchFlowTest?.revealSpinning);

  const ensureAudio = () => {
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") return audioCtxRef.current;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = SOUND_MASTER_GAIN_MAX * (soundVolume / 100);
    master.connect(ctx.destination);
    audioCtxRef.current = ctx;
    masterGainRef.current = master;
    return ctx;
  };

  useEffect(() => {
    const master = masterGainRef.current;
    if (!master) return;
    master.gain.value = SOUND_MASTER_GAIN_MAX * (soundVolume / 100);
  }, [soundVolume]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!soundEnabled && ctx && ctx.state === "running") {
      ctx.suspend().catch(() => {});
    } else if (soundEnabled && ctx && ctx.state === "suspended" && document.visibilityState !== "hidden") {
      ctx.resume().catch(() => {});
    }
  }, [soundEnabled]);

  useEffect(() => {
    const pauseAudio = () => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "running") {
        audioPausedByVisibilityRef.current = true;
        ctx.suspend().catch(() => {});
      }
    };
    const resumeAudio = () => {
      if (!soundEnabled) return;
      const ctx = audioCtxRef.current;
      if (audioPausedByVisibilityRef.current && ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      audioPausedByVisibilityRef.current = false;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") pauseAudio();
      else resumeAudio();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", pauseAudio);
    window.addEventListener("blur", pauseAudio);
    window.addEventListener("focus", resumeAudio);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", pauseAudio);
      window.removeEventListener("blur", pauseAudio);
      window.removeEventListener("focus", resumeAudio);
    };
  }, [soundEnabled]);

  const getVoteOptionImageSrc = (option) => {
    const optionKey = String(option?.key || "");
    if (optionKey === "vote-1") return "/votes/vote1.png";
    if (optionKey === "vote-2") return "/votes/vote2.png";
    return String(option?.imagePath || "");
  };

  const refreshActiveVote = async ({ autoOpen = false } = {}) => {
    if (!authToken) {
      setActiveVote(null);
      setShowVoteModal(false);
      setVoteError("");
      return null;
    }
    try {
      const res = await fetch(`${API_BASE}/vote/current`, { headers: { ...authHeaders } });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.ok || !data?.vote) {
        throw new Error(data?.error || "vote_load_failed");
      }
      setActiveVote(data.vote);
      setVoteError("");
      if (!data.vote.pending) {
        setShowVoteModal(false);
      } else if (autoOpen && canAutoOpenVoteModal && votePromptedTokenRef.current !== authToken) {
        votePromptedTokenRef.current = authToken;
        setShowVoteModal(true);
      }
      return data.vote;
    } catch (err) {
      setActiveVote(null);
      setVoteError(String(err.message || "Vote load failed"));
      return null;
    }
  };

  const tone = (freq, durMs, { type = "square", gain = 0.1, slideTo = null } = {}) => {
    if (soundVolume <= 0) return;
    const ctx = ensureAudio();
    const master = masterGainRef.current;
    if (!ctx || !master) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, ctx.currentTime + durMs / 1000);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durMs / 1000);

    osc.connect(g);
    g.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + durMs / 1000 + 0.02);
  };

  const playSfx = (kind) => {
    if (soundVolume <= 0) return;
    if (kind === "ui") {
      tone(620, 50, { type: "triangle", gain: 0.05 });
      return;
    }
    if (kind === "paint-fill") {
      tone(360, 35, { type: "square", gain: 0.04 });
      return;
    }
    if (kind === "paint-x") {
      tone(220, 40, { type: "sawtooth", gain: 0.035, slideTo: 170 });
      return;
    }
    if (kind === "ready") {
      tone(520, 55, { type: "square", gain: 0.06 });
      setTimeout(() => tone(700, 55, { type: "square", gain: 0.05 }), 65);
      return;
    }
    if (kind === "countdown") {
      tone(780, 90, { type: "square", gain: 0.08 });
      return;
    }
    if (kind === "roulette-tick") {
      tone(930, 35, { type: "square", gain: 0.03 });
      return;
    }
    if (kind === "roulette-stop") {
      tone(620, 60, { type: "triangle", gain: 0.06 });
      setTimeout(() => tone(840, 80, { type: "triangle", gain: 0.065 }), 60);
      return;
    }
    if (kind === "line-clear") {
      tone(660, 55, { type: "triangle", gain: 0.055 });
      setTimeout(() => tone(880, 70, { type: "triangle", gain: 0.06 }), 58);
      setTimeout(() => tone(1180, 90, { type: "triangle", gain: 0.052 }), 126);
      return;
    }
    if (kind === "rank-up") {
      tone(560, 80, { type: "triangle", gain: 0.075 });
      setTimeout(() => tone(770, 90, { type: "triangle", gain: 0.08 }), 75);
      setTimeout(() => tone(1040, 120, { type: "triangle", gain: 0.085 }), 160);
      return;
    }
    if (kind === "rank-down") {
      tone(560, 90, { type: "sawtooth", gain: 0.06, slideTo: 460 });
      setTimeout(() => tone(430, 110, { type: "sawtooth", gain: 0.055, slideTo: 320 }), 90);
      setTimeout(() => tone(300, 130, { type: "sawtooth", gain: 0.05, slideTo: 220 }), 200);
      return;
    }
    if (kind === "go") {
      tone(560, 70, { type: "square", gain: 0.07 });
      setTimeout(() => tone(780, 80, { type: "square", gain: 0.07 }), 70);
      setTimeout(() => tone(980, 95, { type: "square", gain: 0.075 }), 140);
      return;
    }
    if (kind === "win") {
      tone(700, 120, { type: "triangle", gain: 0.08 });
      setTimeout(() => tone(930, 140, { type: "triangle", gain: 0.08 }), 110);
      setTimeout(() => tone(1240, 180, { type: "triangle", gain: 0.09 }), 230);
      return;
    }
    if (kind === "lose") {
      tone(500, 120, { type: "sawtooth", gain: 0.05, slideTo: 430 });
      setTimeout(() => tone(410, 130, { type: "sawtooth", gain: 0.05, slideTo: 340 }), 120);
      setTimeout(() => tone(330, 150, { type: "sawtooth", gain: 0.045, slideTo: 250 }), 240);
      return;
    }
    if (kind === "clear") {
      tone(280, 80, { type: "triangle", gain: 0.05, slideTo: 200 });
      return;
    }
    tone(500, 60, { type: "triangle", gain: 0.05 });
  };

  useEffect(() => {
    if (!placementResultCard) {
      setPlacementRevealOpen(false);
      setPlacementRevealPhase("idle");
      setPlacementRevealRating(0);
      return;
    }
    const target = Math.max(0, Math.round(Number(placementResultCard.rating || 0)));
    const start = 0;
    const analyzingMs = 980;
    const countMs = 940;
    let analyzingTimer = 0;
    let raf = 0;
    let cancelled = false;

    setPlacementRevealOpen(true);
    setPlacementRevealPhase("analyzing");
    setPlacementRevealRating(start);
    playSfx("ready");

    analyzingTimer = window.setTimeout(() => {
      if (cancelled) return;
      setPlacementRevealPhase("counting");
      playSfx("ui");
      const startTs = performance.now();
      const tick = (ts) => {
        if (cancelled) return;
        const t = Math.max(0, Math.min(1, (ts - startTs) / countMs));
        const eased = 1 - (1 - t) ** 3;
        const now = Math.round(start + (target - start) * eased);
        setPlacementRevealRating(now);
        if (t < 1) {
          raf = requestAnimationFrame(tick);
          return;
        }
        setPlacementRevealPhase("reveal");
        playSfx(target >= 2000 ? "rank-up" : "win");
      };
      raf = requestAnimationFrame(tick);
    }, analyzingMs);

    return () => {
      cancelled = true;
      if (analyzingTimer) window.clearTimeout(analyzingTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [placementResultCard?.rating, placementResultCard?.tier?.key]);

  const markTutorialSeen = () => {
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
    } catch {
      // ignore localStorage errors
    }
  };

  const resetTutorialLesson = (nextIndex = tutorialLessonIndex) => {
    const safeIndex = Math.max(0, Math.min(TUTORIAL_LESSONS.length - 1, Number(nextIndex) || 0));
    const lesson = TUTORIAL_LESSONS[safeIndex] || TUTORIAL_LESSONS[0];
    setTutorialLessonIndex(safeIndex);
    setTutorialTool("fill");
    setTutorialLessonCells(createTutorialLessonCells(lesson));
  };

  const startTutorialMode = () => {
    if (isInRaceRoom) {
      setStatus(L("방 대전 중에는 튜토리얼을 시작할 수 없습니다.", "Tutorial is unavailable during a live match."));
      return;
    }
    setStatus("");
    clearPuzzleViewState();
    tutorialCompleteShownRef.current = false;
    setSelectedSize("5x5");
    setPlayMode("tutorial");
    resetTutorialLesson(0);
    playSfx("ui");
  };

  const skipTutorial = async () => {
    markTutorialSeen();
    tutorialCompleteShownRef.current = false;
    await backToMenu();
    playSfx("ui");
  };

  const setTutorialToolMode = (tool) => {
    setTutorialTool(tool === "mark" ? "mark" : "fill");
    playSfx("ui");
  };

  const tapTutorialCell = (index) => {
    const total = Number(tutorialLesson?.width || 0) * Number(tutorialLesson?.height || 0);
    if (!Number.isInteger(index) || index < 0 || index >= total) return;
    const current = normalizeTutorialLessonCells(tutorialLesson, tutorialLessonCells);
    const wasSolved = isTutorialLessonSolved(tutorialLesson, current);
    const nextValue = tutorialTool === "mark" ? 2 : 1;
    const next = current.slice();
    next[index] = next[index] === nextValue ? 0 : nextValue;
    const solved = isTutorialLessonSolved(tutorialLesson, next);
    setTutorialLessonCells(next);
    if (solved && !wasSolved) {
      playSfx(tutorialLessonIsFinal ? "win" : "ui");
      if (tutorialLessonIsFinal) {
        triggerVictoryFx("single");
      } else if (typeof window !== "undefined") {
        confetti({
          particleCount: 46,
          spread: 58,
          startVelocity: 28,
          scalar: 0.82,
          origin: { x: 0.5, y: 0.62 },
          zIndex: 1400,
          disableForReducedMotion: true,
        });
      }
    } else {
      playSfx("ui");
    }
  };

  const goNextTutorialLesson = () => {
    if (!tutorialLessonSolved) {
      setStatus(L("현재 단계의 정답을 먼저 완성해 주세요.", "Complete this step first."));
      playSfx("lose");
      return;
    }
    setStatus("");
    if (tutorialLessonIsFinal) {
      markTutorialSeen();
      goSingleMode();
      playSfx("ui");
      return;
    }
    resetTutorialLesson(tutorialLessonIndex + 1);
    playSfx("ui");
  };

  const resetHistory = () => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  };

  const pushUndo = (snapshot) => {
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const enforceFixedMarks = (sourceCells) => {
    const next = Array.isArray(sourceCells) ? sourceCells.slice() : [];
    fixedMarkIndicesRef.current.forEach((index) => {
      if (Number.isInteger(index) && index >= 0 && index < next.length) {
        next[index] = 2;
      }
    });
    return next;
  };

  const applySnapshot = (nextCells) => {
    const normalized = enforceFixedMarks(nextCells);
    setCells(normalized);
    cellValuesRef.current = normalized;
  };

  const undo = () => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(cellValuesRef.current.slice());
    applySnapshot(prev.slice());
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
    playSfx("ui");
  };

  const redo = () => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(cellValuesRef.current.slice());
    applySnapshot(next.slice());
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
    playSfx("ui");
  };

  const initializePuzzle = (
    p,
    { resume = true, message = "", startTimer = true, suppressStatus = false, fixedMarks = [] } = {}
  ) => {
    const saveKey = `nonogram-progress-${p.id}`;
    let initial = new Array(p.width * p.height).fill(0);
    if (resume) {
      const saved = localStorage.getItem(saveKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === initial.length) {
            initial = parsed.map((v) => (v === 1 ? 1 : v === 2 ? 2 : 0));
          }
        } catch {
          // ignore malformed local save
        }
      }
    }
    const total = p.width * p.height;
    const nextFixedMarks = Array.isArray(fixedMarks)
      ? fixedMarks.filter((index) => Number.isInteger(index) && index >= 0 && index < total)
      : [];
    fixedMarkIndicesRef.current = new Set(nextFixedMarks);
    lockedCellIndicesRef.current = new Set(nextFixedMarks);
    setPuzzle(p);
    applySnapshot(initial);
    setActiveHints(new Set());
    puzzleHpRef.current = PUZZLE_MAX_HP;
    setPuzzleHp(PUZZLE_MAX_HP);
    setPuzzleHpDamage(null);
    setPuzzleHints(PUZZLE_MAX_HINTS);
    setPuzzleHintReveal(null);
    setLineClearFx(null);
    setCellInputFxList([]);
    setHintAdLoading(false);
    setReviveAdLoading(false);
    setReviveAdError("");
    strokeMistakeChargedRef.current = false;
    resetHistory();
    autoSolvedShownRef.current = false;
    raceFinishedSentRef.current = false;
    raceResultShownRef.current = false;
    raceProgressLastSentRef.current = 0;
    const shouldStartElapsedTimer = startTimer && !shouldStopSoloElapsedTimer;
    puzzleStartedAtMsRef.current = shouldStartElapsedTimer ? Date.now() : 0;
    setElapsedMs(0);
    setElapsedSec(0);
    setTimerRunning(shouldStartElapsedTimer);
    setStatus(suppressStatus ? "" : message || `Puzzle ${p.id} loaded.`);
  };

  const fetchRandomPuzzleBySize = async (width, height) => {
    let res = await fetch(`${API_BASE}/puzzles-random?width=${width}&height=${height}`);
    if (res.status === 404) {
      res = await fetch(`${API_BASE}/puzzles/random?width=${width}&height=${height}`);
    }
    const data = await parseJsonSafe(res);
    if (!res.ok || !data.ok || !data.puzzle) {
      throw new Error(data.error || "Failed to load random puzzle.");
    }
    return data.puzzle;
  };

  const fetchBattlePracticePuzzleBySize = async (width, height) => {
    const res = await fetch(`${API_BASE}/pvp/practice-puzzle?width=${width}&height=${height}`);
    const data = await parseJsonSafe(res);
    if (!res.ok || !data.ok || !data.puzzle) {
      throw new Error(data.error || "Failed to load battle puzzle.");
    }
    return data.puzzle;
  };

  const loadRandomBySizeKey = async (sizeKey = selectedSize) => {
    if (isInRaceRoom) {
      setStatus(L("방 플레이 중에는 퍼즐을 바꿀 수 없습니다.", "You cannot change puzzle while in a race room."));
      return;
    }
    const safeSizeKey = IS_APPS_IN_TOSS && !APPS_IN_TOSS_SIZE_KEYS.includes(sizeKey)
      ? APPS_IN_TOSS_DEFAULT_SIZE
      : sizeKey;
    const [wStr, hStr] = safeSizeKey.split("x");
    const width = Number(wStr);
    const height = Number(hStr);
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      setStatus(L("퍼즐 크기를 다시 선택해 주세요.", "Invalid size selection."));
      return;
    }

    setIsLoading(true);
    setStatus("");
    try {
      const puzzleData = IS_APPS_IN_TOSS
        ? await fetchBattlePracticePuzzleBySize(width, height)
        : await fetchRandomPuzzleBySize(width, height);
      setSelectedSize(safeSizeKey);
      initializePuzzle(puzzleData, {
        resume: true,
        message: L(
          IS_APPS_IN_TOSS
            ? `${puzzleData.width}x${puzzleData.height} 배틀 퍼즐을 불러왔습니다.`
            : `${puzzleData.width}x${puzzleData.height} 퍼즐을 불러왔습니다.`,
          IS_APPS_IN_TOSS
            ? `Battle puzzle ${puzzleData.width}x${puzzleData.height} loaded.`
            : `Puzzle ${puzzleData.id} (${puzzleData.width}x${puzzleData.height}) loaded.`
        ),
      });
      playSfx("ui");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRandomBySize = async () => {
    await loadRandomBySizeKey(selectedSize);
  };

  const clearPuzzleViewState = () => {
    fixedMarkIndicesRef.current = new Set();
    lockedCellIndicesRef.current = new Set();
    setPuzzle(null);
    applySnapshot([]);
    setActiveHints(new Set());
    resetHistory();
    puzzleStartedAtMsRef.current = 0;
    setElapsedMs(0);
    setElapsedSec(0);
    setTimerRunning(false);
    tutorialCompleteShownRef.current = false;
  };

  const loadCreatorCanvas = useCallback((width, height, nextCells = null, message = "") => {
    const safeWidth = clampCreatorSize(width);
    const safeHeight = clampCreatorSize(height);
    const total = safeWidth * safeHeight;
    const normalized = normalizeCreatorCells(nextCells, total);
    const creatorPuzzle = buildCreatorPuzzle(safeWidth, safeHeight, normalized, {
      id: `custom-editor-${safeWidth}x${safeHeight}`,
    });
    fixedMarkIndicesRef.current = new Set();
    lockedCellIndicesRef.current = new Set();
    setCreatorWidthInput(String(safeWidth));
    setCreatorHeightInput(String(safeHeight));
    setPuzzle(creatorPuzzle);
    applySnapshot(normalized.slice());
    setActiveHints(new Set());
    resetHistory();
    autoSolvedShownRef.current = false;
    raceFinishedSentRef.current = false;
    raceResultShownRef.current = false;
    raceProgressLastSentRef.current = 0;
    puzzleStartedAtMsRef.current = 0;
    setElapsedMs(0);
    setElapsedSec(0);
    setTimerRunning(false);
    if (message) setStatus(message);
  }, []);

  const goCreateMode = (options = {}) => {
    const showSubmissions = options?.submissions === true;
    if (pvpSearching && !isInRaceRoom) {
      void cancelPvpQueue({ silent: true });
    }
    if (isInRaceRoom) {
      setStatus(L("방 플레이 중에는 제작기를 열 수 없습니다.", "The creator is unavailable during a live room."));
      return;
    }
    if (IS_APPS_IN_TOSS) {
      setPlayMode("single");
      setSingleSection("community");
      setStatus(L("앱에서는 만들기 없이 승인된 유저 퍼즐과 댓글 중심으로 운영합니다.", "Create Puzzle is removed from the app flow."));
      return;
    }
    setPlayMode("create");
    setCreatorMyPuzzlesOpen(showSubmissions);
    setStatus("");
    if (isLoggedIn && showSubmissions) {
      void loadMyCreatorPuzzles({ silent: true });
    }
    const draft = creatorDraftRef.current;
    if (draft) {
      loadCreatorCanvas(draft.width, draft.height, draft.cells);
      return;
    }
    clearPuzzleViewState();
  };

  const generateCreatorCanvas = () => {
    loadCreatorCanvas(
      clampCreatorSize(creatorWidthInput),
      clampCreatorSize(creatorHeightInput),
      null,
      L("새 캔버스를 생성했습니다.", "Created a new canvas.")
    );
    setCreatorTitleInput("");
    playSfx("ui");
  };

  const loadCreatorSamples = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setCreatorSamplesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/creator-samples`, { headers: { ...authHeaders } });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok || !Array.isArray(data.samples)) {
        throw new Error(data.error || "Failed to load creator samples.");
      }
      const nextSamples = data.samples.map((sample) => ({
        ...createCreatorSample(sample.id, sample.titleKo, sample.titleEn, sample.rows || []),
        sizeGroup: sample.sizeGroup || "medium",
        groupTitleKo: sample.groupTitleKo || "미디엄",
        groupTitleEn: sample.groupTitleEn || "Medium",
        license: sample.license || "",
        targetSize: sample.targetSize || sample.width || 0,
        sourceUrl: sample.sourceUrl || "",
        unique: sample.unique === true,
        needsGuess: sample.needsGuess === true,
        isSolved: sample.isSolved === true,
        solvedAt: sample.solvedAt || "",
        bestElapsedSec: Number(sample.bestElapsedSec || 0),
        lastElapsedSec: Number(sample.lastElapsedSec || 0),
        solveCount: Number(sample.solveCount || 0),
        sourceType: sample.sourceType || "sample",
      }));
      if (IS_APPS_IN_TOSS) {
        const serverById = new Map(nextSamples.map((sample) => [String(sample.id || ""), sample]));
        setCreatorSamples(
          DEFAULT_CREATOR_SAMPLE_PUZZLES.map((sample) => {
            const serverSample = serverById.get(String(sample.id || ""));
            if (!serverSample) return sample;
            return {
              ...sample,
              isSolved: serverSample.isSolved === true,
              solvedAt: serverSample.solvedAt || "",
              bestElapsedSec: Number(serverSample.bestElapsedSec || 0),
              lastElapsedSec: Number(serverSample.lastElapsedSec || 0),
              solveCount: Number(serverSample.solveCount || 0),
            };
          })
        );
        return;
      }
      if (nextSamples.length) setCreatorSamples(nextSamples);
      else setCreatorSamples([]);
    } catch (err) {
      if (!silent) {
        setStatus(err.message || L("샘플 퍼즐을 불러오지 못했습니다.", "Failed to load sample puzzles."));
      }
      setCreatorSamples(DEFAULT_CREATOR_SAMPLE_PUZZLES);
    } finally {
      if (!silent) setCreatorSamplesLoading(false);
    }
  }, [authHeaders, lang]);

  const loadCommunityPuzzles = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setCommunityLoading(true);
    try {
      const res = await fetch(`${API_BASE}/creator-community-puzzles`, { headers: { ...authHeaders } });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok || !Array.isArray(data.puzzles)) {
        throw new Error(data.error || "Failed to load community puzzles.");
      }
      const nextPuzzles = data.puzzles.map((puzzle) => ({
          ...createCreatorSample(puzzle.id, puzzle.titleKo, puzzle.titleEn, puzzle.rows || []),
          sizeGroup: puzzle.sizeGroup || "medium",
          groupTitleKo: puzzle.groupTitleKo || "미디엄",
          groupTitleEn: puzzle.groupTitleEn || "Medium",
          createdAt: puzzle.createdAt || "",
          createdByNickname: puzzle.createdByNickname || "",
          approvalStatus: puzzle.approvalStatus || "approved",
          commentCount: Number(puzzle.commentCount || 0),
          reactionCounts: puzzle.reactionCounts || { like: 0, love: 0, wow: 0 },
          viewerReaction: puzzle.viewerReaction || "",
          isSolved: puzzle.isSolved === true,
        }));
      setCommunityPuzzles(nextPuzzles);
      setCommunitySelectedId((prev) => {
        if (prev && nextPuzzles.some((puzzle) => puzzle.id === prev)) return prev;
        return nextPuzzles[0]?.id || "";
      });
    } catch (err) {
      if (!silent) {
        setStatus(err.message || L("유저 퍼즐을 불러오지 못했습니다.", "Failed to load user puzzles."));
      }
      setCommunityPuzzles([]);
      setCommunitySelectedId("");
    } finally {
      if (!silent) setCommunityLoading(false);
    }
  }, [authHeaders, lang]);

  const loadCommunityDiscussion = useCallback(async (puzzleId, { silent = false } = {}) => {
    const targetId = String(puzzleId || "").trim();
    if (!targetId) {
      setCommunityDiscussion(null);
      return;
    }
    if (!silent) setCommunityDiscussionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/creator-community-puzzles/${encodeURIComponent(targetId)}/discussion`, {
        headers: { ...authHeaders },
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok || !data.puzzle) {
        throw new Error(data.error || "Failed to load puzzle discussion.");
      }
      const basePuzzle = createCreatorSample(data.puzzle.id, data.puzzle.titleKo, data.puzzle.titleEn, data.puzzle.rows || []);
      setCommunityDiscussion({
        ...basePuzzle,
        ...data.puzzle,
        isSolved: data.puzzle.isSolved === true,
        comments: Array.isArray(data.comments) ? data.comments : [],
      });
    } catch (err) {
      if (!silent) {
        setStatus(err.message || L("댓글 정보를 불러오지 못했습니다.", "Failed to load discussion."));
      }
      setCommunityDiscussion(null);
    } finally {
      if (!silent) setCommunityDiscussionLoading(false);
    }
  }, [authHeaders, lang]);

  const loadAdminCreatorPuzzles = useCallback(async ({ silent = false } = {}) => {
    if (!isCreatorAdminUser) {
      setAdminCreatorPuzzles([]);
      if (!silent) {
        setStatus(L("관리자 계정으로만 접근할 수 있습니다.", "This section is only available to the admin account."));
      }
      return;
    }
    if (!silent) setAdminCreatorLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/creator-puzzles`, { headers: { ...adminCreatorHeaders } });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok || !Array.isArray(data.puzzles)) {
        throw new Error(data.error || "Failed to load admin creator puzzles.");
      }
      setAdminCreatorPuzzles(data.puzzles);
    } catch (err) {
      if (!silent) {
        setStatus(err.message || L("관리자 검수 목록을 불러오지 못했습니다.", "Failed to load admin review list."));
      }
      setAdminCreatorPuzzles([]);
    } finally {
      if (!silent) setAdminCreatorLoading(false);
    }
  }, [adminCreatorHeaders, isCreatorAdminUser, lang]);

  const loadMyCreatorPuzzles = useCallback(async ({ silent = false } = {}) => {
    if (!isLoggedIn) {
      setCreatorMyPuzzles([]);
      return;
    }
    if (!silent) setCreatorMyPuzzlesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/creator-puzzles/mine`, { headers: { ...authHeaders } });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok || !Array.isArray(data.puzzles)) {
        throw new Error(data.error || "Failed to load submitted puzzles.");
      }
      setCreatorMyPuzzles(data.puzzles);
    } catch (err) {
      if (!silent) {
        setStatus(err.message || L("내 제출 퍼즐을 불러오지 못했습니다.", "Failed to load your submissions."));
      }
      setCreatorMyPuzzles([]);
    } finally {
      if (!silent) setCreatorMyPuzzlesLoading(false);
    }
  }, [API_BASE, authHeaders, isLoggedIn, lang]);

  const trackMissionEvent = useCallback((eventName, options = {}) => {
    const result = applyMissionEvent(missionState, eventName, options);
    if (!result.changed) return;
    setMissionState(result.state);
    writeMissionState(result.state);
    if (result.xpGained > 0) {
      const primaryMission = result.completed[0];
      const leveledUp = result.levelAfter.level > result.levelBefore.level;
      const missionTitle = primaryMission
        ? lang === "ko"
          ? primaryMission.titleKo
          : primaryMission.titleEn
        : L("미션 완료", "Mission Complete");
      const rewardFx = {
        key: `${Date.now()}-${eventName}`,
        title: missionTitle,
        xpGained: result.xpGained,
        fromLevel: result.levelBefore.level,
        level: result.levelAfter.level,
        fromPercent: result.levelBefore.progressPercent,
        toPercent: result.levelAfter.progressPercent,
        gaugeToPercent: leveledUp ? 100 : result.levelAfter.progressPercent,
        currentXp: result.levelAfter.currentXp,
        nextXp: result.levelAfter.nextXp,
        leveledUp,
      };
      setMissionToast(rewardFx);
      setMissionRewardFx(rewardFx);
      if (typeof window !== "undefined") {
        if (missionToastTimerRef.current) window.clearTimeout(missionToastTimerRef.current);
        missionToastTimerRef.current = window.setTimeout(() => {
          setMissionToast(null);
          missionToastTimerRef.current = 0;
        }, 4400);
        if (missionRewardFxTimerRef.current) window.clearTimeout(missionRewardFxTimerRef.current);
        missionRewardFxTimerRef.current = window.setTimeout(() => {
          setMissionRewardFx(null);
          missionRewardFxTimerRef.current = 0;
        }, leveledUp ? 3600 : 1900);
      }
    }
  }, [L, lang, missionState]);

  const markCommunityPuzzleSolved = useCallback((puzzleId) => {
    const targetId = String(puzzleId || "").trim();
    if (!targetId) return;
    setCommunityPuzzles((prev) =>
      prev.map((puzzle) => (String(puzzle.id || "") === targetId ? { ...puzzle, isSolved: true } : puzzle))
    );
    setCommunityDiscussion((prev) =>
      prev && String(prev.id || "") === targetId ? { ...prev, isSolved: true } : prev
    );
  }, []);

  const markCustomSampleSolved = useCallback((sampleId) => {
    const targetId = String(sampleId || "").trim();
    if (!targetId) return;
    const solvedAt = new Date().toISOString();
    setCreatorSamples((prev) =>
      prev.map((sample) =>
        String(sample.id || "") === targetId
          ? {
              ...sample,
              isSolved: true,
              solvedAt: sample.solvedAt || solvedAt,
              lastElapsedSec: Math.max(0, Math.floor(Number(elapsedSec || 0))),
              bestElapsedSec:
                Number(sample.bestElapsedSec || 0) > 0 && Number(elapsedSec || 0) > 0
                  ? Math.min(Number(sample.bestElapsedSec || 0), Math.floor(Number(elapsedSec || 0)))
                  : Math.max(Number(sample.bestElapsedSec || 0), Math.floor(Number(elapsedSec || 0))),
              solveCount: Math.max(1, Number(sample.solveCount || 0) + 1),
            }
          : sample
      )
    );
  }, [elapsedSec]);

  const markDailyPuzzleSolved = useCallback((solvedPuzzle) => {
    const dateKey = getDailySolvedDateKey(solvedPuzzle);
    if (typeof window !== "undefined") {
      if (dailyStampTimerRef.current) window.clearTimeout(dailyStampTimerRef.current);
      setDailyPuzzleStampDate(dateKey);
      dailyStampTimerRef.current = window.setTimeout(() => {
        setDailyPuzzleStampDate((current) => (current === dateKey ? "" : current));
        dailyStampTimerRef.current = 0;
      }, SOLVED_REVEAL_DURATION_MS + 5200);
    }
    setDailyPuzzleHistory((prev) => {
      const next = buildDailySolvedHistory(prev, solvedPuzzle);
      writeDailyPuzzleHistory(next);
      return next;
    });
  }, []);

  const loadSingleCustomSample = (sample) => {
    if (!sample) return;
    const samplePuzzle = buildCreatorPuzzle(sample.width, sample.height, sample.cells, {
      id: `custom-library-${sample.id}`,
      isLibrary: true,
      isThemePuzzle: true,
      creatorPuzzleId: sample.id,
      titleKo: sample.titleKo || "",
      titleEn: sample.titleEn || "",
    });
    initializePuzzle(samplePuzzle, {
      resume: false,
      startTimer: true,
      fixedMarks: buildThemeStarterMarkIndices(samplePuzzle),
      message:
        lang === "ko"
          ? `테마 퍼즐 "${sample.titleKo || sample.id}"을 불러왔습니다.`
          : `Loaded themed puzzle "${sample.titleEn || sample.id}".`,
    });
    playSfx("ui");
  };

  const loadCommunityPuzzle = (sample) => {
    if (!sample) return;
    const communityPuzzle = buildCreatorPuzzle(sample.width, sample.height, sample.cells, {
      id: `community-${sample.id}`,
      isCommunity: true,
      creatorPuzzleId: sample.id,
      titleKo: sample.titleKo || "",
      titleEn: sample.titleEn || "",
      createdByNickname: sample.createdByNickname || "",
    });
    initializePuzzle(communityPuzzle, {
      resume: true,
      startTimer: true,
      message:
        lang === "ko"
          ? `유저 퍼즐 "${sample.titleKo || sample.id}"을 불러왔습니다.`
          : `Loaded user puzzle "${sample.titleEn || sample.id}".`,
    });
    setSingleSection("community");
    void loadCommunityDiscussion(sample.id, { silent: true });
    playSfx("ui");
  };

  const saveCreatorPuzzle = async () => {
    if (!puzzle || !isModeCreate) return;
    if (!isLoggedIn) {
      setStatus(L("퍼즐 제출은 로그인 후 가능합니다.", "Please log in before submitting a puzzle."));
      return;
    }
    const title = String(creatorTitleInput || "").trim();
    if (!title) {
      setStatus(L("퍼즐 이름을 입력해주세요.", "Please enter a puzzle title."));
      return;
    }
    const width = puzzle.width;
    const height = puzzle.height;
    const cells = cellValuesRef.current.map((value) => (value === 1 ? 1 : 0));
    if (!cells.some((value) => value === 1)) {
      setStatus(L("먼저 그림을 그려주세요.", "Draw something first."));
      return;
    }

    setCreatorSaving(true);
    try {
      const res = await fetch(`${API_BASE}/creator-puzzles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ title, width, height, cells }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) {
        if (data?.error === "Puzzle validation failed") {
          throw new Error(
            L(
              "자동 검증을 통과하지 못했습니다. 유일한 해답이 있고 귀류법 없이 풀리도록 조금 더 다듬어주세요.",
              "Automatic validation failed. Please make sure the puzzle has a unique solution and can be solved without guessing."
            )
          );
        }
        throw new Error(data.error || L("퍼즐 저장에 실패했습니다.", "Failed to save the puzzle."));
      }
      setStatus(
        L(
          `유효성 확인이 완료되었고 "${title}" 퍼즐은 관리자 승인 대기중입니다.`,
          `"${title}" passed validation and is now waiting for admin approval.`
        )
      );
      setCreatorMyPuzzlesOpen(true);
      void loadMyCreatorPuzzles({ silent: true });
      playSfx("ui");
    } catch (err) {
      setStatus(err.message || L("퍼즐 저장에 실패했습니다.", "Failed to save the puzzle."));
    } finally {
      setCreatorSaving(false);
    }
  };

  const submitCommunityComment = async () => {
    const puzzleId = String(communitySelectedId || "").trim();
    const body = String(communityCommentInput || "").trim();
    if (!puzzleId || !body) return;
    if (!isLoggedIn) {
      setStatus(L("댓글은 로그인 후 남길 수 있습니다.", "Please log in to leave a comment."));
      return;
    }
    setCommunityCommentSending(true);
    try {
      const res = await fetch(`${API_BASE}/creator-puzzles/${encodeURIComponent(puzzleId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ body }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to post comment.");
      }
      setCommunityCommentInput("");
      await loadCommunityDiscussion(puzzleId, { silent: true });
      await loadCommunityPuzzles({ silent: true });
      playSfx("ui");
    } catch (err) {
      setStatus(err.message || L("댓글 등록에 실패했습니다.", "Failed to post comment."));
    } finally {
      setCommunityCommentSending(false);
    }
  };

  const submitCommunityReaction = async (reactionKey) => {
    const puzzleId = String(communitySelectedId || "").trim();
    if (!puzzleId) return;
    if (!isLoggedIn) {
      setStatus(L("리액션은 로그인 후 남길 수 있습니다.", "Please log in to leave a reaction."));
      return;
    }
    const currentReaction = String(communityDiscussion?.viewerReaction || "");
    const nextReaction = currentReaction === reactionKey ? "" : reactionKey;
    setCommunityReactionSending(true);
    try {
      const res = await fetch(`${API_BASE}/creator-puzzles/${encodeURIComponent(puzzleId)}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ reactionKey: nextReaction }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok || !data.puzzle) {
        throw new Error(data.error || "Failed to save reaction.");
      }
      setCommunityDiscussion((prev) =>
        prev && String(prev.id || "") === puzzleId
          ? {
              ...prev,
              reactionCounts: data.puzzle.reactionCounts || prev.reactionCounts,
              viewerReaction: data.puzzle.viewerReaction || "",
            }
          : prev
      );
      setCommunityPuzzles((prev) =>
        prev.map((puzzle) =>
          String(puzzle.id || "") === puzzleId
            ? {
                ...puzzle,
                reactionCounts: data.puzzle.reactionCounts || puzzle.reactionCounts,
                viewerReaction: data.puzzle.viewerReaction || "",
              }
            : puzzle
        )
      );
      playSfx("ui");
    } catch (err) {
      setStatus(err.message || L("리액션 저장에 실패했습니다.", "Failed to save reaction."));
    } finally {
      setCommunityReactionSending(false);
    }
  };

  const reviewCreatorPuzzle = async (puzzleId, decision) => {
    const targetId = String(puzzleId || "").trim();
    if (!targetId) return;
    if (!isCreatorAdminUser) {
      setStatus(L("관리자 계정으로만 접근할 수 있습니다.", "This section is only available to the admin account."));
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/creator-puzzles/${encodeURIComponent(targetId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminCreatorHeaders },
        body: JSON.stringify({ decision }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to review puzzle.");
      }
      await loadAdminCreatorPuzzles({ silent: true });
      await loadCommunityPuzzles({ silent: true });
      setStatus(
        decision === "approve"
          ? L("퍼즐을 승인했습니다.", "The puzzle has been approved.")
          : L("퍼즐을 반려했습니다.", "The puzzle has been rejected.")
      );
    } catch (err) {
      setStatus(err.message || L("검수 처리에 실패했습니다.", "Failed to review puzzle."));
    }
  };

  const submitCustomSampleSolve = async (sampleId) => {
    const targetId = String(sampleId || "").trim();
    if (!targetId || !isLoggedIn) return;
    try {
      const res = await fetch(`${API_BASE}/creator-samples/${encodeURIComponent(targetId)}/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ elapsedSec }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save custom solve.");
      }
      await loadCreatorSamples({ silent: true });
    } catch (err) {
      setStatus(err.message || L("테마 퍼즐 해제 저장에 실패했습니다.", "Failed to save themed puzzle unlock."));
    }
  };

  const submitCommunityPuzzleSolve = async () => {
    const puzzleId = String(puzzle?.creatorPuzzleId || "").trim();
    if (!puzzleId || !puzzle?.isCommunityPuzzle) return;
    markCommunityPuzzleSolved(puzzleId);
    if (!isLoggedIn) return;
    try {
      const res = await fetch(`${API_BASE}/creator-puzzles/${encodeURIComponent(puzzleId)}/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ elapsedSec }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save community solve.");
      }
      await loadCommunityPuzzles({ silent: true });
      await loadCommunityDiscussion(puzzleId, { silent: true });
    } catch {
      // local solve unlock is enough for immediate UX
    }
  };

  const shiftCreatorCanvas = (dx, dy) => {
    if (!puzzle || !isModeCreate) return;
    const width = puzzle.width;
    const height = puzzle.height;
    const next = new Array(width * height).fill(0);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const targetX = x + dx;
        const targetY = y + dy;
        if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;
        next[targetY * width + targetX] = cellValuesRef.current[y * width + x] === 1 ? 1 : 0;
      }
    }
    pushUndo(cellValuesRef.current.slice());
    applySnapshot(next);
    playSfx("ui");
  };

  const startCreatorSingleTest = () => {
    if (!puzzle || !isModeCreate) return;
    const width = puzzle.width;
    const height = puzzle.height;
    const draftCells = cellValuesRef.current.map((value) => (value === 1 ? 1 : 0));
    if (!draftCells.some((value) => value === 1)) {
      setStatus(L("먼저 그림을 그려주세요.", "Draw something first."));
      return;
    }
    creatorDraftRef.current = { width, height, cells: draftCells.slice() };
    const previewPuzzle = buildCreatorPuzzle(width, height, draftCells, {
      id: `custom-preview-${width}x${height}`,
      isPreview: true,
    });
    setPlayMode("single");
    initializePuzzle(previewPuzzle, {
      resume: false,
      startTimer: true,
      message: L("제작한 퍼즐을 테스트 중입니다.", "Testing your custom puzzle."),
    });
    playSfx("ui");
  };

  const backToCreateMode = () => {
    const draft = creatorDraftRef.current;
    setPlayMode("create");
    if (draft) {
      loadCreatorCanvas(draft.width, draft.height, draft.cells, L("편집 화면으로 돌아왔습니다.", "Returned to the editor."));
    } else {
      loadCreatorCanvas(CREATOR_DEFAULT_SIZE, CREATOR_DEFAULT_SIZE);
    }
    playSfx("ui");
  };

  useEffect(() => {
    void loadCreatorSamples({ silent: true });
  }, [loadCreatorSamples, authToken, authUser?.id]);

  useEffect(() => {
    if (!creatorMyPuzzlesOpen) return;
    if (!isLoggedIn) {
      setCreatorMyPuzzles([]);
      return;
    }
    void loadMyCreatorPuzzles({ silent: true });
  }, [creatorMyPuzzlesOpen, isLoggedIn, loadMyCreatorPuzzles, authUser?.id]);

  useEffect(() => {
    void loadCommunityPuzzles({ silent: true });
  }, [loadCommunityPuzzles]);

  useEffect(() => {
    if (!communitySelectedId) {
      setCommunityDiscussion(null);
      return;
    }
    void loadCommunityDiscussion(communitySelectedId, { silent: true });
  }, [communitySelectedId, loadCommunityDiscussion]);

  useEffect(() => {
    const visibleCommunityIds = new Set(
      communityPuzzles.filter((sample) => sample.sizeGroup === communitySizeGroup).map((sample) => sample.id)
    );
    if (!visibleCommunityIds.size) {
      if (communitySelectedId) setCommunitySelectedId("");
      return;
    }
    if (!communitySelectedId || !visibleCommunityIds.has(communitySelectedId)) {
      setCommunitySelectedId(communityPuzzles.find((sample) => sample.sizeGroup === communitySizeGroup)?.id || "");
    }
  }, [communityPuzzles, communitySelectedId, communitySizeGroup]);

  const goSingleMode = () => {
    if (pvpSearching && !isInRaceRoom) {
      void cancelPvpQueue({ silent: true });
    }
    if (!isInRaceRoom) clearPuzzleViewState();
    setSingleSection("home");
    setPlayMode("single");
    setStatus("");
  };

  const goDailyMode = () => {
    if (pvpSearching && !isInRaceRoom) {
      void cancelPvpQueue({ silent: true });
    }
    if (!isInRaceRoom) clearPuzzleViewState();
    setSingleSection("daily");
    setPlayMode("single");
    setStatus("");
    playSfx("ui");
  };

  const goSingleSection = (section, { clear = true } = {}) => {
    if (section === "admin" && !isCreatorAdminUser) {
      setStatus(L("관리자 계정으로만 접근할 수 있습니다.", "This section is only available to the admin account."));
      setSingleSection("home");
      setPlayMode("single");
      playSfx("ui");
      return;
    }
    if (!isInRaceRoom && clear) {
      clearPuzzleViewState();
    }
    setSingleSection(section);
    setPlayMode("single");
    setStatus("");
    if (section === "community") {
      void loadCommunityPuzzles({ silent: true });
    }
    if (section === "admin") {
      void loadAdminCreatorPuzzles({ silent: true });
    }
    playSfx("ui");
  };

  useEffect(() => {
    if (singleSection === "admin" && !isCreatorAdminUser) {
      setSingleSection("home");
    }
  }, [isCreatorAdminUser, singleSection]);

  const openAuthScreen = (tab = "login", returnMode = "menu") => {
    if (IS_APPS_IN_TOSS) {
      void loginWithTossGame(returnMode);
      return;
    }
    setAuthTab(tab);
    setAuthReturnMode(returnMode);
    setLoginError("");
    setSignupError("");
    setLoginFieldErrors({ username: "", password: "" });
    setSignupFieldErrors({ username: "", nickname: "", password: "", terms: "", privacy: "" });
    setSignupAgreeTerms(false);
    setSignupAgreePrivacy(false);
    setSignupPolicyModal("");
    setStatus("");
    setPlayMode("auth");
  };

  const goMultiMode = () => {
    if (IS_APPS_IN_TOSS && !isLoggedIn) {
      void loginWithTossGame("multi");
      return;
    }
    if (!isLoggedIn) {
      setNeedLoginReturnMode("multi");
      setShowNeedLoginPopup(true);
      return;
    }
    if (pvpSearching && !isInRaceRoom) {
      void cancelPvpQueue({ silent: true });
    }
    if (!isInRaceRoom) clearPuzzleViewState();
    setPlayMode("multi");
    setStatus("");
  };

  const goPvpMode = () => {
    if (!isLoggedIn) {
      if (!isInRaceRoom) clearPuzzleViewState();
      setPlayMode("pvp");
      setStatus(L("상대를 찾고 같은 퍼즐로 대결합니다.", "Find an opponent and race on the same puzzle."));
      return;
    }
    if (!isInRaceRoom) clearPuzzleViewState();
    setPlayMode("pvp");
    setStatus("");
  };

  const goRankingMode = () => {
    if (pvpSearching && !isInRaceRoom) {
      void cancelPvpQueue({ silent: true });
    }
    if (!isInRaceRoom) clearPuzzleViewState();
    setPlayMode("ranking");
    setStatus("");
    trackMissionEvent("ranking_visit", {
      eventToken: getMissionWeekKey(getKstDateKey()),
    });
  };

  const goReplayHallMode = () => {
    if (IS_APPS_IN_TOSS) {
      setPlayMode("ranking");
      return;
    }
    if (pvpSearching && !isInRaceRoom) {
      void cancelPvpQueue({ silent: true });
    }
    if (!isInRaceRoom) clearPuzzleViewState();
    setHallActiveSizeKey("10x10");
    setPlayMode("replay_hall");
    setStatus("");
  };

  const closeMenuTourTransientUi = () => {
    setShowCreateModal(false);
    setShowJoinModal(false);
    setShowNeedLoginPopup(false);
    setShowPvpTierGuideModal(false);
    setSignupPolicyModal("");
    setCreatorMyPuzzlesOpen(false);
  };

  const moveMenuTourTo = (targetIndex) => {
    const nextIndex = Math.max(0, Math.min(MENU_TOUR_STEPS.length - 1, targetIndex));
    const step = MENU_TOUR_STEPS[nextIndex] || MENU_TOUR_STEPS[0];
    closeMenuTourTransientUi();
    if (pvpSearching && !isInRaceRoom) {
      void cancelPvpQueue({ silent: true });
    }
    if (!isInRaceRoom) {
      clearPuzzleViewState();
    }
    setStatus("");
    setMenuTourIndex(nextIndex);
    setIsMenuTourActive(true);

    switch (step.action) {
      case "auth":
        openAuthScreen("login", "menu");
        return;
      case "tutorial":
        startTutorialMode();
        return;
      case "single":
        setSingleSection("home");
        setPlayMode("single");
        return;
      case "multi":
        setPlayMode("multi");
        return;
      case "pvp":
        setPlayMode("pvp");
        return;
      case "ranking":
        setPlayMode("ranking");
        return;
      case "hall":
        setHallActiveSizeKey("10x10");
        setPlayMode("replay_hall");
        return;
      case "create":
        setPlayMode("create");
        return;
      default:
        setPlayMode("menu");
    }
  };

  const startMenuTour = () => {
    moveMenuTourTo(0);
  };

  const closeMenuTour = () => {
    setIsMenuTourActive(false);
  };

  const clearMatchSimState = () => {
    matchSimSessionRef.current += 1;
    matchSimElapsedRef.current = 0;
    matchSimLastRuleKeyRef.current = "";
    setMatchSimSearching(false);
    setMatchSimElapsedSec(0);
    setMatchSimQueueSize(getMatchSimQueueSize(0, matchSimRating));
    setMatchSimLogs([]);
    setMatchSimFound(null);
  };

  const resetPlacementTest = () => {
    placementSessionRef.current += 1;
    clearMatchSimState();
    resetMatchFlowTest();
    clearPuzzleViewState();
    setPlacementRunning(false);
    setPlacementLoading(false);
    setPlacementRevealOpen(false);
    setPlacementRevealPhase("idle");
    setPlacementRevealRating(0);
    setPlacementStartedAtMs(0);
    setPlacementStageIndex(0);
    setPlacementResults(PLACEMENT_STAGES.map((s) => ({ ...s, status: "pending", solvedAtSec: null })));
    setPlacementResultCard(null);
  };

  const goPlacementTestMode = () => {
    goPvpMode();
  };

  const applyPlacementResultToCurrentUser = async (results, elapsedSec, currentStageProgress, fallbackEvaluated = null) => {
    if (!isLoggedIn || !authUser) {
      throw new Error(L("배치고사는 로그인 후 저장됩니다.", "Login is required to save placement."));
    }
    const res = await fetch(`${API_BASE}/placement/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        results,
        elapsedSec,
        currentStageProgress,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok || !data.ok) {
      throw new Error(data.error || L("배치고사 저장 실패", "Failed to save placement result"));
    }
    if (data.user) {
      cacheAuthUser(data.user, { applyPrefs: false });
    }
    if (data.placement) {
      const rating = Number(data.placement.rating || fallbackEvaluated?.rating || 0);
      return {
        rating,
        tier: getTierInfoByRating(rating),
        solvedSequential: Number(data.placement.solvedSequential || fallbackEvaluated?.solvedSequential || 0),
        elapsedSec: Number(data.placement.elapsedSec || fallbackEvaluated?.elapsedSec || 0),
        completedAtMs: Number(data.placement.completedAtMs || Date.now()),
      };
    }
    return fallbackEvaluated;
  };

  const finishPlacementTest = async (fromTimeout = false, overrideResults = null, stageProgressOverride = null) => {
    placementSessionRef.current += 1;
    const elapsed = placementStartedAtMs
      ? Math.max(0, Math.min(PLACEMENT_TIME_LIMIT_SEC, Math.floor((Date.now() - placementStartedAtMs) / 1000)))
      : placementElapsedSec;
    let finalResults = Array.isArray(overrideResults)
      ? overrideResults.map((row) => ({ ...row }))
      : placementResults.map((row) => ({ ...row }));
    if (fromTimeout && placementRunning && finalResults.length > 0) {
      const idx = Math.max(0, Math.min(finalResults.length - 1, placementStageIndex));
      if (finalResults[idx]?.status === "pending") {
        finalResults[idx] = {
          ...finalResults[idx],
          status: "failed",
          solvedAtSec: null,
        };
      }
    }
    const stageProgress = Number.isFinite(Number(stageProgressOverride))
      ? Number(stageProgressOverride)
      : placementStageProgress;
    const evaluated = evaluatePlacementResult(finalResults, elapsed, stageProgress);
    setPlacementRunning(false);
    setPlacementLoading(false);
    setTimerRunning(false);
    setPlacementResults(finalResults);
    try {
      const assigned = await applyPlacementResultToCurrentUser(finalResults, elapsed, stageProgress, evaluated);
      const resolved = assigned || evaluated;
      setPlacementResultCard(resolved);
      setStatus(
        L(
          `배치고사 완료. 초기 레이팅 R ${resolved.rating}이 계정에 반영되었습니다.`,
          `Placement complete. Initial rating R ${resolved.rating} has been assigned to your account.`
        )
      );
    } catch (err) {
      setPlacementResultCard(evaluated);
      setStatus(
        err.message
          || (fromTimeout
            ? L("시간 종료! 배치고사 결과 저장에 실패했습니다.", "Time over! Failed to save placement result.")
            : L("배치고사 결과 저장에 실패했습니다.", "Failed to save placement result."))
      );
    }
  };

  const loadPlacementStage = async (stageIdx, sessionId = placementSessionRef.current) => {
    const stage = PLACEMENT_STAGES[stageIdx];
    if (!stage) return;
    const [wStr, hStr] = String(stage.sizeKey || "").split("x");
    const width = Number(wStr);
    const height = Number(hStr);
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error("Invalid placement stage size.");
    }
    setPlacementLoading(true);
    try {
      const stagePuzzle = await fetchRandomPuzzleBySize(width, height);
      if (placementSessionRef.current !== sessionId || playMode !== "placement_test") return;
      initializePuzzle(stagePuzzle, {
        resume: false,
        message: "",
        startTimer: false,
        suppressStatus: true,
      });
      setStatus(
        L(
          `${stageIdx + 1}단계 진행 중 (${stage.sizeKey})`,
          `Stage ${stageIdx + 1} in progress (${stage.sizeKey})`
        )
      );
    } finally {
      if (placementSessionRef.current === sessionId) {
        setPlacementLoading(false);
      }
    }
  };

  const startPlacementTest = async () => {
    if (!isLoggedIn) {
      setNeedLoginReturnMode("placement_test");
      setShowNeedLoginPopup(true);
      return;
    }
    if (hasPlacementQualification) {
      setStatus(L("배치고사가 이미 완료되었습니다.", "Placement has already been completed."));
      return;
    }
    const sessionId = Date.now();
    placementSessionRef.current = sessionId;
    clearMatchSimState();
    resetMatchFlowTest();
    setPlacementRunning(true);
    setPlacementLoading(true);
    setPlacementStartedAtMs(Date.now());
    setPlacementStageIndex(0);
    setPlacementResultCard(null);
    setPlacementResults(PLACEMENT_STAGES.map((s) => ({ ...s, status: "pending", solvedAtSec: null })));
    setStatus(L("배치고사 시작! 1단계 퍼즐 로딩 중...", "Placement started! Loading stage 1..."));
    try {
      await loadPlacementStage(0, sessionId);
      playSfx("ui");
    } catch (err) {
      if (placementSessionRef.current !== sessionId) return;
      setStatus(err.message || "Failed to start placement test.");
      void finishPlacementTest(false);
    }
  };

  const runPlacementRevealTest = (tierKey = "") => {
    const preset = PLACEMENT_REVEAL_TEST_PRESETS.find((p) => p.key === tierKey) || null;
    const randomRating = 1950 + Math.floor(Math.random() * 420);
    const rating = preset ? Number(preset.rating) : randomRating;
    const boundedRating = Math.max(0, Math.min(5000, rating));
    const tier = getTierInfoByRating(boundedRating);
    const solvedSequential = preset
      ? Number(preset.solvedSequential || 3)
      : boundedRating >= 2000
        ? 4
        : 3;
    const elapsedSec = preset ? Number(preset.elapsedSec || 238) : 238;
    setPlacementRunning(false);
    setPlacementLoading(false);
    setPlacementRevealOpen(false);
    setPlacementRevealPhase("idle");
    setPlacementRevealRating(0);
    setPlacementResultCard({
      rating: boundedRating,
      tier,
      solvedSequential,
      elapsedSec,
    });
    setStatus(
      preset
        ? L(`${tier.labelKo} 연출 테스트 실행`, `${tier.labelEn} reveal test started`)
        : L("연출 테스트 실행", "Reveal animation test started")
    );
    playSfx("ui");
  };

  const handlePlacementStageSolved = async () => {
    if (!placementRunning) return;
    const sessionId = placementSessionRef.current;
    const idx = Math.max(0, Math.min(PLACEMENT_STAGES.length - 1, placementStageIndex));
    const solvedAtSec = placementElapsedSec;
    let nextResults = placementResults;
    setPlacementResults((prev) => {
      nextResults = prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              status: "solved",
              solvedAtSec,
            }
          : row
      );
      return nextResults;
    });
    if (idx >= PLACEMENT_STAGES.length - 1) {
      setPlacementStageIndex(idx);
      void finishPlacementTest(false, nextResults, 0);
      return;
    }
    const nextIdx = idx + 1;
    setPlacementStageIndex(nextIdx);
    setStatus(L(`${idx + 1}단계 완료! 다음 퍼즐 로딩 중...`, `Stage ${idx + 1} cleared! Loading next puzzle...`));
    try {
      await loadPlacementStage(nextIdx, sessionId);
      playSfx("ui");
    } catch (err) {
      if (placementSessionRef.current !== sessionId) return;
      let failResults = nextResults;
      setPlacementResults((prev) => {
        failResults = prev.map((row, i) =>
          i === nextIdx && row.status === "pending"
            ? {
                ...row,
                status: "failed",
                solvedAtSec: null,
              }
            : row
        );
        return failResults;
      });
      setStatus(err.message || "Failed to load next stage.");
      void finishPlacementTest(false, failResults, 0);
    }
  };

  const backToMenu = async () => {
    if (isInRaceRoom) {
      setStatus(L("진행 중인 경기에서는 먼저 Leave를 눌러줘.", "Leave the current match first."));
      return;
    }
    if (pvpSearching) {
      await cancelPvpQueue({ silent: true });
    }
    clearPuzzleViewState();
    setPlayMode("menu");
    setStatus("");
  };

  const toggleSoundEnabled = () => {
    setSoundEnabled((value) => !value);
  };

  const requestMiniAppExit = () => {
    playSfx("ui");
    setShowExitConfirmModal(true);
  };

  const confirmMiniAppExit = async () => {
    exitConfirmedRef.current = true;
    setShowExitConfirmModal(false);
    try {
      await closeView();
    } catch {
      try {
        window.close();
      } catch {
        setStatus(L("상단 닫기 버튼으로 앱을 종료해줘.", "Use the top close button to exit."));
      }
    }
  };

  const storeAuth = (token, user) => {
    setAuthToken(token);
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    cacheAuthUser(user, { applyPrefs: true });
  };

  const routeAfterAuth = (_user, returnMode = "menu") => {
    if (returnMode === "multi") {
      setPlayMode("multi");
      return;
    }
    if (returnMode === "placement_test") {
      setPlayMode("pvp");
      return;
    }
    if (returnMode === "pvp") {
      setPlayMode("pvp");
      return;
    }
    setPlayMode("menu");
  };

  const clearAuth = () => {
    setAuthToken("");
    setAuthUser(null);
    setActiveVote(null);
    setShowVoteModal(false);
    setVoteError("");
    votePromptedTokenRef.current = "";
    closeProfileModal();
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  };

  const loginWithTossGame = async (returnMode = "menu") => {
    if (!IS_APPS_IN_TOSS || tossLoginLoading) return;
    setTossLoginLoading(true);
    setStatus(L("토스 계정으로 연결 중...", "Connecting with Toss..."));
    try {
      const keyResult = await getAnonymousKey();
      if (!keyResult || keyResult === "ERROR" || typeof keyResult !== "object" || !keyResult.hash) {
        throw new Error(
          keyResult === "INVALID_CATEGORY"
            ? "invalid_category"
            : keyResult ? "toss_key_error" : "unsupported_toss_version"
        );
      }

      const payload = await buildTossGameAuthPayload(keyResult.hash);
      let res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = await parseJsonSafe(res);

      if (!res.ok || !data.ok) {
        const shouldLoginExisting =
          res.status === 409 ||
          String(data.error || "").includes("username already exists") ||
          String(data.error || "").includes("nickname already exists");
        if (!shouldLoginExisting) {
          throw new Error(data.error || "toss_signup_failed");
        }
        res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: payload.username, password: payload.password }),
        });
        data = await parseJsonSafe(res);
      }

      if (!res.ok || !data.ok || !data.token || !data.user) {
        throw new Error(data.error || "toss_login_failed");
      }

      storeAuth(data.token, data.user);
      setStatus(L(`토스 계정 연결 완료: ${data.user.nickname}`, `Connected with Toss: ${data.user.nickname}`));
      routeAfterAuth(data.user, returnMode);
    } catch (err) {
      const code = String(err?.message || "");
      const message =
        code === "invalid_category"
          ? L("앱 카테고리가 게임으로 설정되어야 토스 게임 로그인을 쓸 수 있어요.", "The app category must be Game to use game login.")
          : code === "unsupported_toss_version"
            ? L("토스 앱을 최신 버전으로 업데이트한 뒤 다시 시도해줘.", "Update the Toss app and try again.")
            : code === "crypto_not_supported"
              ? L("이 실행 환경에서는 토스 로그인 키를 만들 수 없어요.", "This environment cannot create the Toss login key.")
              : L("토스 계정 연결에 실패했어요. 콘솔 QR로 토스 앱에서 다시 열어줘.", "Could not connect with Toss. Open it from the console QR in the Toss app.");
      setStatus(message);
    } finally {
      setTossLoginLoading(false);
    }
  };

  const signup = async () => {
    const username = signupUsername.trim().toLowerCase();
    const nickname = signupNickname.trim();
    const password = signupPassword;
    const fieldErrors = { username: "", nickname: "", password: "", terms: "", privacy: "" };
    if (!username || !nickname || !password) {
      setSignupError(L("아이디, 닉네임, 비밀번호를 모두 입력해줘.", "Please fill in username, nickname, and password."));
      if (!username) fieldErrors.username = L("아이디를 입력해줘.", "Enter your username.");
      if (!nickname) fieldErrors.nickname = L("닉네임을 입력해줘.", "Enter your nickname.");
      if (!password) fieldErrors.password = L("비밀번호를 입력해줘.", "Enter your password.");
      setSignupFieldErrors(fieldErrors);
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password) || password.length < 8) {
      fieldErrors.password = L("영문+숫자 포함 8자 이상", "At least 8 chars with letters and numbers");
      setSignupFieldErrors(fieldErrors);
      return;
    }
    if (!signupAgreeTerms || !signupAgreePrivacy) {
      if (!signupAgreeTerms) {
        fieldErrors.terms = L("이용약관 동의가 필요합니다.", "You must agree to the Terms of Service.");
      }
      if (!signupAgreePrivacy) {
        fieldErrors.privacy = L("개인정보처리방침 동의가 필요합니다.", "You must agree to the Privacy Policy.");
      }
      setSignupFieldErrors(fieldErrors);
      setSignupError(L("필수 약관 동의가 필요합니다.", "Required agreements are missing."));
      return;
    }
    setSignupError("");
    setSignupFieldErrors({ username: "", nickname: "", password: "", terms: "", privacy: "" });
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, nickname, password }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("회원가입 실패", "Sign-up failed"));
      storeAuth(data.token, data.user);
      setSignupUsername("");
      setSignupNickname("");
      setSignupPassword("");
      setSignupAgreeTerms(false);
      setSignupAgreePrivacy(false);
      setStatus(L(`환영합니다, ${data.user.nickname}!`, `Welcome, ${data.user.nickname}!`));
      routeAfterAuth(data.user, authReturnMode);
    } catch (err) {
      const msg = String(err.message || "");
      if (msg.includes("password must be 8+ chars")) {
        setSignupFieldErrors((prev) => ({ ...prev, password: L("영문+숫자 포함 8자 이상", "At least 8 chars with letters and numbers") }));
      } else if (msg.includes("username must be 3-24 chars")) {
        setSignupFieldErrors((prev) => ({ ...prev, username: L("아이디는 3~24자", "Username must be 3-24 chars") }));
      } else {
        setSignupError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    const username = loginUsername.trim().toLowerCase();
    const password = loginPassword;
    const fieldErrors = { username: "", password: "" };
    if (!username || !password) {
      setLoginError(L("아이디와 비밀번호를 입력해줘.", "Please enter username and password."));
      if (!username) fieldErrors.username = L("아이디를 입력해줘.", "Enter your username.");
      if (!password) fieldErrors.password = L("비밀번호를 입력해줘.", "Enter your password.");
      setLoginFieldErrors(fieldErrors);
      return;
    }
    setLoginFieldErrors({ username: "", password: "" });
    setLoginError("");
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("로그인 실패", "Login failed"));
      storeAuth(data.token, data.user);
      setLoginUsername("");
      setLoginPassword("");
      setStatus(L(`로그인 완료: ${data.user.nickname}`, `Logged in: ${data.user.nickname}`));
      routeAfterAuth(data.user, authReturnMode);
    } catch (err) {
      const msg = String(err.message || "");
      if (msg.includes("Invalid credentials")) {
        setLoginError(L("아이디 또는 비밀번호가 올바르지 않습니다.", "Invalid username or password."));
      } else {
        setLoginError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (authToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: { ...authHeaders },
        });
      }
    } catch {
      // ignore logout api errors
    }
    await leaveRace();
    clearAuth();
    setStatus(L("로그아웃 되었습니다.", "Logged out."));
  };

  const submitVote = async (optionKey) => {
    if (!authToken || voteSubmitting) return;
    setVoteSubmitting(true);
    setVoteError("");
    try {
      const res = await fetch(`${API_BASE}/vote/current`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ optionKey }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.ok || !data?.vote) {
        throw new Error(data?.error || L("투표 저장 실패", "Vote submission failed"));
      }
      setActiveVote(data.vote);
      setShowVoteModal(false);
      setStatus(L("투표가 반영되었습니다.", "Your vote has been recorded."));
    } catch (err) {
      setVoteError(String(err.message || L("투표 저장 실패", "Vote submission failed")));
    } finally {
      setVoteSubmitting(false);
    }
  };

  const fetchPublicRooms = async () => {
    if (isInRaceRoom) return;
    setRoomsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/race-rooms`);
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load room list.");
      setPublicRooms(Array.isArray(data.rooms) ? data.rooms : []);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setRoomsLoading(false);
    }
  };

  const fetchRatingUsers = async (view = "current") => {
    setRatingLoading(true);
    try {
      const q = view === "legacy" ? "?limit=200&view=legacy" : "?limit=200";
      const res = await fetch(`${API_BASE}/ratings/leaderboard${q}`, {
        headers: { ...authHeaders },
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("랭킹 조회 실패", "Failed to load ranking"));
      setRatingUsers(Array.isArray(data.users) ? data.users : []);
      setMyRatingRank(Number.isInteger(Number(data.myRank)) ? Number(data.myRank) : null);
      setRatingTotalUsers(Number.isInteger(Number(data.totalUsers)) ? Number(data.totalUsers) : 0);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setRatingLoading(false);
    }
  };

  const fetchBestReplayRecords = async () => {
    setReplayLoading(true);
    setReplayError("");
    try {
      const res = await fetch(`${API_BASE}/replays/hall`);
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("명예의 전당 조회 실패", "Failed to load Hall of Fame records"));
      const sizes = Array.isArray(data.sizes) ? data.sizes : [];
      const mapped = {};
      for (const key of PVP_SIZE_KEYS) mapped[key] = [];
      for (const bucket of sizes) {
        const sizeKey = String(bucket?.sizeKey || "");
        if (!sizeKey || !mapped[sizeKey]) continue;
        const top = Array.isArray(bucket?.top) ? bucket.top : [];
        mapped[sizeKey] = top.slice(0, 3).map((r, idx) => ({
          recordId: Number(r.recordId),
          rank: Number(r.rank || idx + 1),
          userId: Number(r.userId),
          nickname: String(r.nickname || ""),
          elapsedSec: Number(r.elapsedSec || 0),
          elapsedMs: Number(r.elapsedMs || 0),
          puzzleId: Number(r.puzzleId),
          finishedAtMs: Number(r.finishedAtMs || 0),
          sizeKey,
        }));
      }
      const streakTopRaw = Array.isArray(data?.streakTop) ? data.streakTop : [];
      const streakTop = streakTopRaw
        .map((r, idx) => ({
          rank: Number(r.rank || idx + 1),
          userId: Number(r.userId || 0),
          nickname: String(r.nickname || ""),
          winStreakBest: Number(r.winStreakBest || 0),
        }))
        .filter((r) => r.winStreakBest > 0)
        .slice(0, 3);
      setHallDataBySize(mapped);
      setHallStreakTop(streakTop);
      const fallbackSize = PVP_SIZE_KEYS.includes(hallActiveSizeKey)
        ? hallActiveSizeKey
        : PVP_SIZE_KEYS[0];
      setHallActiveSizeKey(fallbackSize);
    } catch (err) {
      setReplayError(err.message);
      setStatus(err.message);
      setHallDataBySize({});
      setHallStreakTop([]);
    } finally {
      setReplayLoading(false);
    }
  };

  const stopPvpPolling = () => {
    if (pvpPollRef.current) {
      clearInterval(pvpPollRef.current);
      pvpPollRef.current = 0;
    }
  };

  const stopPvpRevealAnimation = () => {
    if (pvpRevealAnimRef.current) {
      clearInterval(pvpRevealAnimRef.current);
      pvpRevealAnimRef.current = 0;
    }
  };

  const stopPvpRatingAnimation = () => {
    if (pvpRatingAnimRef.current) {
      cancelAnimationFrame(pvpRatingAnimRef.current);
      pvpRatingAnimRef.current = 0;
    }
  };

  const dismissPvpRatingFx = () => {
    stopPvpRatingAnimation();
    setPvpRatingFx(null);
  };

  const confirmPvpRatingFx = () => {
    const shouldReturnHome = Boolean(pvpRatingFx && !pvpRatingFx.isTest);
    stopPvpRatingAnimation();
    setPvpRatingFx(null);
    if (!shouldReturnHome) return;
    if (raceRoomCode || racePlayerId) {
      void leaveRace();
    } else {
      resetPvpQueueState();
    }
    clearPuzzleViewState();
    setRaceRoomCode("");
    setRacePlayerId("");
    setRaceState(null);
    setRaceSubmitting(false);
    setChatInput("");
    setShowEmojiPicker(false);
    setShowMultiResultModal(false);
    setPublicRooms([]);
    raceFinishedSentRef.current = false;
    raceResultShownRef.current = false;
    raceProgressLastSentRef.current = 0;
    setTimerRunning(false);
    setPlayMode("menu");
    setStatus("");
  };

  const startPvpRatingAnimation = (fromRating, toRating, roomCode, options = {}) => {
    stopPvpRatingAnimation();
    const from = Number(fromRating);
    const to = Number(toRating);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;
    const delta = to - from;
    const result = options.result === "loss" ? "loss" : "win";
    const fromRank = Number.isFinite(Number(options.fromRank)) ? Number(options.fromRank) : null;
    const toRank = Number.isFinite(Number(options.toRank)) ? Number(options.toRank) : null;
    const fromTier = getTierBracketInfo(from, fromRank).tier;
    const toTier = getTierBracketInfo(to, toRank).tier;
    const tierShift =
      (TIER_ORDER[toTier.key] || 0) > (TIER_ORDER[fromTier.key] || 0)
        ? "promoted"
        : (TIER_ORDER[toTier.key] || 0) < (TIER_ORDER[fromTier.key] || 0)
          ? "demoted"
          : "steady";
    const duration = 1850;
    const startAt = performance.now();

    setPvpRatingFx({
      roomCode,
      from,
      to,
      delta,
      ratingNow: from,
      deltaNow: 0,
      result,
      fromRank,
      toRank,
      fromTier,
      toTier,
      tierShift,
      isTest: Boolean(options.isTest),
      done: false,
    });
    playSfx(result === "win" ? "win" : "rank-down");

    const tick = (now) => {
      const t = Math.max(0, Math.min(1, (now - startAt) / duration));
      const eased = 1 - (1 - t) ** 3;
      const ratingNow = Math.round(from + (to - from) * eased);
      const deltaNow = Math.round(delta * eased);
      setPvpRatingFx((prev) =>
        prev
          ? {
              ...prev,
              ratingNow,
              deltaNow,
              done: t >= 1,
            }
          : prev
      );

      if (t < 1) {
        pvpRatingAnimRef.current = requestAnimationFrame(tick);
      } else {
        pvpRatingAnimRef.current = 0;
        playSfx(tierShift === "promoted" || delta >= 0 ? "rank-up" : "rank-down");
      }
    };

    pvpRatingAnimRef.current = requestAnimationFrame(tick);
  };

  const runPvpResultFxTest = (presetKey) => {
    const preset = PVP_RESULT_FX_TEST_PRESETS.find((item) => item.key === presetKey);
    if (!preset) return;
    startPvpRatingAnimation(preset.from, preset.to, `pvp-fx-test:${preset.key}:${Date.now()}`, {
      result: preset.outcome,
      isTest: true,
    });
  };

  const pushMatchSimLog = (textKo, textEn, tone = "neutral") => {
    setMatchSimLogs((prev) => {
      const next = [...prev, { id: `${Date.now()}-${Math.random()}`, textKo, textEn, tone }];
      return next.slice(-8);
    });
  };

  const resetMatchSim = ({ clearFx = false, keepProfile = true } = {}) => {
    clearMatchSimState();
    if (!keepProfile) {
      const preset = MATCH_SIM_PROFILE_PRESETS.find((item) => item.key === "gold");
      setMatchSimProfileKey("gold");
      setMatchSimRating(preset?.rating || 1760);
    }
    if (clearFx) dismissPvpRatingFx();
  };

  const selectMatchSimProfile = (profileKey) => {
    const preset = MATCH_SIM_PROFILE_PRESETS.find((item) => item.key === profileKey);
    if (!preset) return;
    clearMatchSimState();
    setMatchSimProfileKey(profileKey);
    setMatchSimRating(preset.rating);
    setMatchSimQueueSize(getMatchSimQueueSize(0, preset.rating));
  };

  const startMatchSim = () => {
    const tier = getTierInfoByRating(matchSimRating);
    const firstRule = getMatchSimRule(0);
    clearMatchSimState();
    matchSimLastRuleKeyRef.current = firstRule.key;
    setMatchSimSearching(true);
    setMatchSimQueueSize(getMatchSimQueueSize(0, matchSimRating));
    pushMatchSimLog(
      `${tier.labelKo} 구간 R ${matchSimRating} 기준으로 탐색 시작`,
      `Starting search around ${tier.labelEn} at R ${matchSimRating}`,
      "info"
    );
    pushMatchSimLog(
      `1단계 규칙 적용: ${firstRule.labelKo}`,
      `Stage 1 rule: ${firstRule.labelEn}`,
      "info"
    );
    playSfx("ui");
  };

  const runMatchSimResultFx = (mode) => {
    const outcome = getMatchSimOutcomeTarget(matchSimRating, mode);
    startPvpRatingAnimation(matchSimRating, outcome.to, `match-sim:${mode}:${Date.now()}`, {
      result: outcome.result,
      isTest: true,
    });
    pushMatchSimLog(
      mode === "promotion"
        ? "승급 결과 연출 실행"
        : mode === "demotion"
          ? "강등 결과 연출 실행"
          : mode === "loss"
            ? "패배 결과 연출 실행"
            : "승리 결과 연출 실행",
      mode === "promotion"
        ? "Promotion result FX triggered"
        : mode === "demotion"
          ? "Demotion result FX triggered"
          : mode === "loss"
            ? "Defeat result FX triggered"
            : "Victory result FX triggered",
      "accent"
    );
  };

  const clearMatchFlowTimers = () => {
    if (matchFlowRevealRef.current) {
      clearInterval(matchFlowRevealRef.current);
      matchFlowRevealRef.current = 0;
    }
    if (matchFlowTimersRef.current.length) {
      matchFlowTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      matchFlowTimersRef.current = [];
    }
  };

  const resetMatchFlowTest = ({ clearFx = false } = {}) => {
    clearMatchFlowTimers();
    setMatchFlowTest(null);
    if (clearFx) dismissPvpRatingFx();
  };

  const startMatchFlowTest = (outcome = "win") => {
    clearMatchFlowTimers();
    dismissPvpRatingFx();
    const myNickname = authUser?.nickname || L("테스터", "Tester");
    const scriptedOptions = PVP_BATTLE_SIZE_KEYS.map((sizeKey) => ({
      sizeKey,
      bannedByNicknames: [],
      banned: false,
    }));
    const chosenSizeKey = "10x10";
    const roomCode = `flow-test:${outcome}:${Date.now()}`;

    setMatchFlowTest({
      active: true,
      outcome,
      phase: "search",
      queueSize: 4,
      meAccepted: false,
      opponentAccepted: false,
      showdown: false,
      revealIndex: 0,
      revealSpinning: false,
      chosenSizeKey,
      options: scriptedOptions,
      phaseEndsAtMs: Date.now() + 2200,
      roomCode,
      me: {
        nickname: myNickname,
        rating: MATCH_FLOW_TEST_BASE_RATING,
        ratingRank: null,
      },
      opponent: MATCH_FLOW_TEST_OPPONENT,
    });
    setStatus(L("풀 시퀀스 테스트 시작", "Full flow test started"));
    playSfx("ui");

    const schedule = (delay, callback) => {
      const timerId = setTimeout(callback, delay);
      matchFlowTimersRef.current.push(timerId);
    };

    schedule(650, () => {
      setMatchFlowTest((prev) => (prev ? { ...prev, queueSize: 3 } : prev));
    });
    schedule(1450, () => {
      setMatchFlowTest((prev) => (prev ? { ...prev, queueSize: 2 } : prev));
    });
    schedule(2200, () => {
      setMatchFlowTest((prev) =>
        prev
          ? {
              ...prev,
              phase: "accept",
              phaseEndsAtMs: Date.now() + 3200,
              meAccepted: false,
              opponentAccepted: false,
            }
          : prev
      );
      playSfx("ready");
    });
    schedule(3300, () => {
      setMatchFlowTest((prev) => (prev ? { ...prev, meAccepted: true } : prev));
      playSfx("ui");
    });
    schedule(4300, () => {
      setMatchFlowTest((prev) =>
        prev
          ? {
              ...prev,
              meAccepted: true,
              opponentAccepted: true,
              showdown: true,
              phaseEndsAtMs: Date.now() + 1700,
            }
          : prev
      );
      playSfx("countdown");
    });
    schedule(6000, () => {
      setMatchFlowTest((prev) =>
        prev
          ? {
              ...prev,
              phase: "reveal",
              showdown: false,
              revealIndex: 0,
              revealSpinning: true,
              phaseEndsAtMs: Date.now() + 4200,
              options: scriptedOptions,
            }
          : prev
      );
      playSfx("countdown");
      let revealIdx = 0;
      if (matchFlowRevealRef.current) clearInterval(matchFlowRevealRef.current);
      matchFlowRevealRef.current = window.setInterval(() => {
        revealIdx = (revealIdx + 1) % PVP_BATTLE_SIZE_KEYS.length;
        setMatchFlowTest((prev) => (prev ? { ...prev, revealIndex: revealIdx } : prev));
        playSfx("roulette-tick");
      }, 150);
    });
    schedule(10200, () => {
      if (matchFlowRevealRef.current) {
        clearInterval(matchFlowRevealRef.current);
        matchFlowRevealRef.current = 0;
      }
      const finalIndex = PVP_BATTLE_SIZE_KEYS.indexOf(chosenSizeKey);
      setMatchFlowTest((prev) =>
        prev
          ? {
              ...prev,
              revealIndex: finalIndex >= 0 ? finalIndex : 0,
              revealSpinning: false,
            }
          : prev
      );
      playSfx("roulette-stop");
    });
    schedule(12100, () => {
      setMatchFlowTest((prev) =>
        prev
          ? {
              ...prev,
              phase: "game",
              phaseEndsAtMs: Date.now() + 1800,
            }
          : prev
      );
      playSfx("countdown");
    });
    schedule(14100, () => {
      const result = outcome === "loss" ? "loss" : "win";
      const toRating = result === "loss" ? 563 : 621;
      startPvpRatingAnimation(MATCH_FLOW_TEST_BASE_RATING, toRating, roomCode, {
        result,
        isTest: true,
      });
      setMatchFlowTest((prev) =>
        prev
          ? {
              ...prev,
              phase: "done",
              active: false,
              phaseEndsAtMs: 0,
            }
          : prev
      );
    });
  };

  const pvpCancelReasonText = (reason) => {
    if (reason === "accept_timeout") return L("매칭 수락 시간이 지나 자동 취소되었습니다.", "Match cancelled: accept timeout.");
    if (reason === "cancelled_by_user") return L("상대가 수락을 취소해 매칭이 종료되었습니다.", "Match cancelled: opponent declined.");
    if (reason === "no_puzzle_for_selected_size") return L("선택 가능한 퍼즐이 없어 매칭이 취소되었습니다.", "Match cancelled: no puzzle available.");
    if (reason === "puzzle_solution_missing") return L("퍼즐 데이터 오류로 매칭이 취소되었습니다.", "Match cancelled: puzzle data error.");
    if (reason === "invalid_selected_size") return L("매칭 설정 오류로 매칭이 취소되었습니다.", "Match cancelled: invalid match settings.");
    return L("매칭이 취소되었습니다.", "Match cancelled.");
  };

  const resetPvpQueueState = () => {
    pvpGuestStartSeqRef.current += 1;
    stopPvpPolling();
    stopPvpRevealAnimation();
    stopPvpRatingAnimation();
    setPvpSearching(false);
    setPvpTicketId("");
    setPvpQueueSize(0);
    setPvpServerState("idle");
    setPvpMatch(null);
    setPvpAcceptBusy(false);
    setPvpBanBusy(false);
    setPvpRevealIndex(0);
    setPvpRatingFx(null);
    setPvpShowdownMatchId("");
    setPvpShowdownUntilMs(0);
    pvpMatchPhaseRef.current = "";
    pvpRatingBaseRef.current = null;
    pvpRatingBaseGamesRef.current = null;
    pvpRatingFxDoneRoomRef.current = "";
    pvpAuthRefreshDoneRoomRef.current = "";
    pvpShowdownSeenRef.current = "";
  };

  const applyPvpMatch = (data) => {
    stopPvpPolling();
    stopPvpRevealAnimation();
    stopPvpRatingAnimation();
    setPvpSearching(false);
    setPvpQueueSize(0);
    setPvpServerState("ready");
    setPvpMatch(null);
    setPvpAcceptBusy(false);
    setPvpBanBusy(false);
    setPvpRevealIndex(0);
    setPvpRatingFx(null);
    setPvpShowdownMatchId("");
    setPvpShowdownUntilMs(0);
    pvpMatchPhaseRef.current = "";
    pvpRatingBaseRef.current = Number(authUser?.rating ?? 1500);
    pvpRatingBaseGamesRef.current = Number(authUser?.rating_games ?? 0);
    pvpRatingFxDoneRoomRef.current = "";
    pvpAuthRefreshDoneRoomRef.current = "";
    pvpShowdownSeenRef.current = "";
    if (data.ticketId) setPvpTicketId(data.ticketId);
    setRaceRoomCode(data.roomCode);
    setRacePlayerId(data.playerId);
    applyRaceRoomState(data.room, data.playerId);
    initializePuzzle(data.puzzle, {
      resume: false,
      startTimer: false,
      message: L("5초 카운트다운 후 시작됩니다.", "Starting after a 5-second countdown."),
    });
    setPlayMode("pvp");
    startRacePolling(data.roomCode, data.playerId);
    playSfx("ui");
  };

  const applyPvpStatusPayload = (data) => {
    const state = String(data?.state || (data?.matched ? "ready" : "waiting"));
    const queueSize = Number(data?.queueSize || 0);
    const match = data?.match || null;

    if (data?.ticketId) setPvpTicketId(String(data.ticketId));
    setPvpServerState(state);
    setPvpQueueSize(queueSize);
    setPvpMatch(match);

    if (state === "ready" || data?.matched) {
      applyPvpMatch(data);
      return "ready";
    }

    if (state === "cancelled") {
      stopPvpPolling();
      stopPvpRevealAnimation();
      setPvpSearching(false);
      setPvpAcceptBusy(false);
      setPvpBanBusy(false);
      setPvpRevealIndex(0);
      setStatus(pvpCancelReasonText(String(data?.cancelReason || match?.cancelReason || "")));
      return "cancelled";
    }

    setPvpSearching(state === "waiting" || state === "matching");
    return state;
  };

  const pollPvpQueueStatus = async (ticketIdArg = pvpTicketRef.current) => {
    const ticketId = String(ticketIdArg || "").trim();
    if (!ticketId || !isLoggedIn) return;
    try {
      const res = await fetch(`${API_BASE}/pvp/queue/status?ticketId=${encodeURIComponent(ticketId)}`, {
        headers: { ...authHeaders },
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) {
        if (res.status === 404) resetPvpQueueState();
        return;
      }
      applyPvpStatusPayload(data);
    } catch {
      // ignore transient matchmaking poll errors
    }
  };

  const startPvpPolling = (ticketId) => {
    const normalized = String(ticketId || "").trim();
    if (!normalized) return;
    stopPvpPolling();
    pollPvpQueueStatus(normalized);
    pvpPollRef.current = window.setInterval(() => {
      pollPvpQueueStatus(normalized);
    }, 900);
  };

  const startGuestPvpBattle = async () => {
    if (isInRaceRoom) {
      setStatus(L("이미 배틀에 참여 중입니다.", "You are already in a battle."));
      return;
    }
    if (pvpSearching) return;
    setIsLoading(true);
    resetPvpQueueState();
    const startSeq = pvpGuestStartSeqRef.current;
    setPlayMode("pvp");
    setPvpSearching(true);
    setPvpServerState("waiting");
    setPvpQueueSize(1);
    setStatus(L("상대를 찾는 중...", "Searching for opponent..."));
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1400 + Math.floor(Math.random() * 1800)));
      if (pvpGuestStartSeqRef.current !== startSeq) return;
      const res = await fetch(`${API_BASE}/pvp/guest/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: authUser?.nickname || "테스터",
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("매칭 시작 실패", "Failed to start matchmaking"));
      applyPvpMatch(data);
      setStatus(IS_APPS_IN_TOSS ? "" : L("상대와 같은 퍼즐로 대결합니다.", "Battle started on the same puzzle."));
    } catch (err) {
      setStatus(err.message || L("매칭을 시작하지 못했습니다.", "Could not start matchmaking."));
      resetPvpQueueState();
    } finally {
      setIsLoading(false);
    }
  };

  const joinPvpQueue = async () => {
    if (!isLoggedIn) {
      await startGuestPvpBattle();
      return;
    }
    if (isInRaceRoom) {
      setStatus(L("이미 배틀에 참여 중입니다.", "You are already in a battle."));
      return;
    }
    if (pvpSearching) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/pvp/queue/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({}),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("매칭 대기열 참가 실패", "Failed to join matchmaking queue"));
      const nextState = applyPvpStatusPayload(data);
      if (nextState === "ready" || nextState === "cancelled") {
        return;
      }
      setStatus(
        nextState === "matching"
          ? L("상대가 잡혔습니다. 시작하기를 눌러주세요.", "Opponent found. Press start.")
          : L("상대를 찾는 중...", "Searching for opponent...")
      );
      setPlayMode("pvp");
      startPvpPolling(String(data.ticketId || ""));
      playSfx("ui");
    } catch (err) {
      const message = String(err.message || "");
      setStatus(message);
      resetPvpQueueState();
    } finally {
      setIsLoading(false);
    }
  };

  const cancelPvpQueue = async ({ silent = false } = {}) => {
    const ticketId = String(pvpTicketRef.current || pvpTicketId || "").trim();
    if (!ticketId) {
      resetPvpQueueState();
      return;
    }
    try {
      await fetch(`${API_BASE}/pvp/queue/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ ticketId }),
      });
    } catch {
      // ignore cancellation errors
    }
    resetPvpQueueState();
    if (!silent) setStatus(L("매칭 대기를 취소했습니다.", "Matchmaking cancelled."));
  };

  const acceptPvpMatch = async () => {
    const ticketId = String(pvpTicketRef.current || pvpTicketId || "").trim();
    if (!ticketId || !isLoggedIn || pvpAcceptBusy) return;
    setPvpAcceptBusy(true);
    try {
      const res = await fetch(`${API_BASE}/pvp/match/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ ticketId }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("수락 처리 실패", "Failed to accept match"));
      applyPvpStatusPayload(data);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setPvpAcceptBusy(false);
    }
  };

  const submitPvpBan = async (sizeKey = "") => {
    const ticketId = String(pvpTicketRef.current || pvpTicketId || "").trim();
    if (!ticketId || !isLoggedIn || pvpBanBusy) return;
    setPvpBanBusy(true);
    try {
      const body = sizeKey
        ? { ticketId, sizeKey }
        : { ticketId, skip: true };
      const res = await fetch(`${API_BASE}/pvp/match/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("밴 처리 실패", "Failed to submit ban"));
      applyPvpStatusPayload(data);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setPvpBanBusy(false);
    }
  };

  const leaveRace = async () => {
    const willLeaveDuringMatch =
      Boolean(raceRoomCode && racePlayerId) &&
      isModePvp &&
      (racePhase === "countdown" || racePhase === "playing");
    if (willLeaveDuringMatch) {
      const ok = window.confirm(
        L(
          "게임 종료 전에 나가면 즉시 패배 처리됩니다. 정말 나갈까요?",
          "Leaving before the match ends counts as an immediate defeat. Leave anyway?"
        )
      );
      if (!ok) return;
    }
    let leaveStatusMessage = "";
    if (pvpSearching && !raceRoomCode && !racePlayerId) {
      await cancelPvpQueue({ silent: true });
    }
    const ticketId = String(pvpTicketRef.current || pvpTicketId || "").trim();
    if (ticketId) {
      try {
        await fetch(`${API_BASE}/pvp/queue/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId }),
        });
      } catch {
        // ignore pvp ticket cleanup errors
      }
    }
    if (raceRoomCode && racePlayerId) {
      try {
        const res = await fetch(`${API_BASE}/race/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: raceRoomCode, playerId: racePlayerId }),
        });
        const data = await parseJsonSafe(res);
        if (willLeaveDuringMatch && data?.ok) {
          leaveStatusMessage = L(
            "게임 종료 전에 방을 나가 즉시 패배 처리되었습니다.",
            "You left before the match ended and were marked as defeated."
          );
        }
      } catch {
        // ignore leave API errors
      }
    }
    if (racePollRef.current) {
      clearInterval(racePollRef.current);
      racePollRef.current = 0;
    }
    resetPvpQueueState();
    setRaceRoomCode("");
    setRacePlayerId("");
    setRaceState(null);
    setRaceSubmitting(false);
    setChatInput("");
    setShowEmojiPicker(false);
    setShowMultiResultModal(false);
    setPublicRooms([]);
    setStatus(leaveStatusMessage);
    raceFinishedSentRef.current = false;
    raceResultShownRef.current = false;
    raceProgressLastSentRef.current = 0;
    setTimerRunning(false);
    playSfx("ui");
  };

  const applyRaceRoomState = (room, playerIdOverride = racePlayerId) => {
    setRaceState(room);
    const me = room?.players?.find((p) => p.playerId === playerIdOverride);
    if (me && Number.isInteger(me.elapsedSec)) {
      const nextElapsedMs =
        Number.isFinite(Number(me.elapsedMs)) && Number(me.elapsedMs) > 0
          ? Number(me.elapsedMs)
          : Number(me.elapsedSec) * 1000;
      setElapsedMs(nextElapsedMs);
      setElapsedSec(me.elapsedSec);
    }
  };

  const pollRaceRoom = async (roomCode, playerId = racePlayerId) => {
    if (!roomCode) return;
    try {
      const qs = playerId ? `?playerId=${encodeURIComponent(playerId)}` : "";
      const res = await fetch(`${API_BASE}/race/${roomCode}${qs}`);
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) return;
      applyRaceRoomState(data.room);
    } catch {
      // ignore intermittent poll errors
    }
  };

  const sendRaceHeartbeat = async (roomCode = raceRoomCode, playerId = racePlayerId, { keepalive = false } = {}) => {
    if (!roomCode || !playerId) return;
    if (raceHeartbeatBusyRef.current && !keepalive) return;
    if (!keepalive) raceHeartbeatBusyRef.current = true;
    try {
      await fetch(`${API_BASE}/race/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, playerId }),
        keepalive,
      });
    } catch {
      // ignore heartbeat failures
    } finally {
      if (!keepalive) raceHeartbeatBusyRef.current = false;
    }
  };

  const startRacePolling = (roomCode, playerId) => {
    if (racePollRef.current) clearInterval(racePollRef.current);
    pollRaceRoom(roomCode, playerId);
    racePollRef.current = window.setInterval(() => {
      pollRaceRoom(roomCode, playerId);
    }, 700);
  };

  useEffect(() => {
    if (!raceRoomCode || !racePlayerId) return undefined;
    sendRaceHeartbeat(raceRoomCode, racePlayerId);
    const heartbeatId = window.setInterval(() => {
      sendRaceHeartbeat(raceRoomCode, racePlayerId);
    }, 5000);

    const flushHeartbeat = () => {
      sendRaceHeartbeat(raceRoomCode, racePlayerId, { keepalive: true });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushHeartbeat();
    };

    window.addEventListener("pagehide", flushHeartbeat);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(heartbeatId);
      window.removeEventListener("pagehide", flushHeartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [raceRoomCode, racePlayerId]);

  const createRaceRoom = async () => {
    const roomTitle = createRoomTitle.trim();
    const maxPlayers = Number(createMaxPlayers);
    const visibility = createVisibility === "private" ? "private" : "public";
    const password = createPassword.trim();
    if (!isLoggedIn) {
      setStatus(L("멀티플레이는 로그인 후 이용 가능해.", "Multiplayer is available after login."));
      return;
    }
    const [wStr, hStr] = createSize.split("x");
    const width = Number(wStr);
    const height = Number(hStr);
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      setStatus("Invalid size selection.");
      return;
    }
    if (visibility === "private" && !password) {
      setStatus(L("비밀방 비밀번호를 입력해줘.", "Enter a password for the private room."));
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/race/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          roomTitle,
          width,
          height,
          maxPlayers,
          visibility,
          password: visibility === "private" ? password : "",
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to create room.");
      setRaceRoomCode(data.roomCode);
      setRacePlayerId(data.playerId);
      applyRaceRoomState(data.room, data.playerId);
      setSelectedSize(createSize);
      setCreatePassword("");
      setShowCreateModal(false);
      initializePuzzle(data.puzzle, {
        resume: false,
        startTimer: false,
        message: `Room ${data.roomCode} created. Wait for ready.`,
      });
      startRacePolling(data.roomCode, data.playerId);
      playSfx("ui");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const joinRaceRoomWith = async (roomCodeArg, passwordArg = "") => {
    const code = String(roomCodeArg || "").trim().toUpperCase();
    const password = String(passwordArg || "").trim();
    if (!isLoggedIn) {
      setStatus(L("멀티플레이는 로그인 후 이용 가능해.", "Multiplayer is available after login."));
      return;
    }
    if (!code) {
      setStatus(L("방 코드를 입력해줘.", "Enter a room code."));
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/race/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ roomCode: code, password }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to join room.");
      setRaceRoomCode(data.roomCode);
      setRacePlayerId(data.playerId);
      applyRaceRoomState(data.room, data.playerId);
      initializePuzzle(data.puzzle, {
        resume: false,
        startTimer: false,
        message: `Joined room ${data.roomCode}. Press ready.`,
      });
      startRacePolling(data.roomCode, data.playerId);
      setJoinPassword("");
      setShowJoinModal(false);
      playSfx("ui");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const joinRaceRoom = async () => {
    await joinRaceRoomWith(joinRoomCode, joinPassword);
  };

  const setReady = async (ready) => {
    if (!raceRoomCode || !racePlayerId) return;
    try {
      const res = await fetch(`${API_BASE}/race/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: raceRoomCode, playerId: racePlayerId, ready }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to update ready.");
      applyRaceRoomState(data.room);
      playSfx("ready");
    } catch (err) {
      setStatus(err.message);
    }
  };

  const startRace = async () => {
    if (!raceRoomCode || !racePlayerId) return;
    try {
      const res = await fetch(`${API_BASE}/race/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: raceRoomCode, playerId: racePlayerId }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to start race.");
      applyRaceRoomState(data.room);
      playSfx("ui");
      setStatus(L("5초 후 시작합니다.", "Starting in 5 seconds."));
    } catch (err) {
      setStatus(err.message);
    }
  };

  const requestRematch = async () => {
    if (!raceRoomCode || !racePlayerId) return;
    setIsRematchLoading(true);
    try {
      const res = await fetch(`${API_BASE}/race/rematch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: raceRoomCode, playerId: racePlayerId }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to rematch.");
      applyRaceRoomState(data.room);
      if (data.puzzle) {
        initializePuzzle(data.puzzle, {
          resume: false,
          startTimer: false,
          message: L("새 게임 준비 완료. 다시 Ready를 눌러 시작해.", "New game is ready. Press Ready again."),
        });
        playSfx("ui");
      }
    } catch (err) {
      setStatus(err.message);
    } finally {
      setIsRematchLoading(false);
    }
  };

  const submitRaceProgress = async () => {
    if (!raceRoomCode || !racePlayerId) return;
    if (raceProgressBusyRef.current) return;
    raceProgressBusyRef.current = true;
    try {
      if (!puzzle) return;
      const userBitsBase64 = toBase64Bits(cellValuesRef.current, puzzle.width, puzzle.height);
      await fetch(`${API_BASE}/race/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: raceRoomCode, playerId: racePlayerId, userBitsBase64 }),
      });
    } catch {
      // ignore transient progress errors
    } finally {
      raceProgressBusyRef.current = false;
    }
  };

  const submitRaceFinish = async () => {
    if (!raceRoomCode || !racePlayerId || raceFinishedSentRef.current || !isRacePlaying) return;
    raceFinishedSentRef.current = true;
    setRaceSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/race/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: raceRoomCode,
          playerId: racePlayerId,
          elapsedSec,
          elapsedMs,
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to submit finish.");
      applyRaceRoomState(data.room);
    } catch (err) {
      raceFinishedSentRef.current = false;
      setStatus(err.message);
    } finally {
      setRaceSubmitting(false);
    }
  };

  const submitSingleFinish = async () => {
    if (!puzzle || puzzle.isCustom || isInRaceRoom || isModeTutorial) return;
    try {
      const res = await fetch(`${API_BASE}/single/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          puzzleId: Number(puzzle.id),
          width: Number(puzzle.width),
          height: Number(puzzle.height),
          elapsedSec,
          elapsedMs,
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save single log.");
      }
    } catch {
      // ignore logging errors in solo play UX
    }
  };

  const sendRaceChat = async () => {
    if (!raceRoomCode || !racePlayerId) return;
    const text = chatInput.trim();
    if (!text || chatSending) return;
    setChatSending(true);
    try {
      const res = await fetch(`${API_BASE}/race/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ roomCode: raceRoomCode, playerId: racePlayerId, text }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.error || L("채팅 전송 실패", "Failed to send chat"));
      applyRaceRoomState(data.room);
      setChatInput("");
      setShowEmojiPicker(false);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setChatSending(false);
    }
  };

  const isWrongPuzzleInput = (index, value, current) => {
    if (!isHpPuzzleMode || isBoardCompleteByHints || value === 0 || current === value) return false;
    if (!Array.isArray(puzzleSolutionCells)) return false;
    const answer = puzzleSolutionCells[index];
    if (value === 1) return answer !== 1;
    if (value === 2) return answer === 1;
    return false;
  };

  const triggerPuzzleMistake = (index) => {
    if (!isHpPuzzleMode || isBoardCompleteByHints) return;
    const currentHp = puzzleHpRef.current;
    if (currentHp <= 0) return;
    const nextHp = Math.max(0, currentHp - 1);
    puzzleHpRef.current = nextHp;
    setPuzzleHp(nextHp);
    setPuzzleHpDamage({ id: Date.now(), index, hpAfter: nextHp });
    setStatus("");
    if (nextHp <= 0) {
      setTimerRunning(false);
      playSfx("lose");
      return;
    }
    playSfx("rank-down");
  };

  const revivePuzzleFromAdReward = () => {
    puzzleHpRef.current = 1;
    setPuzzleHp(1);
    setPuzzleHpDamage(null);
    setReviveAdError("");
    setStatus("");
    strokeMistakeChargedRef.current = false;
    playSfx("ready");
  };

  const shouldUseReviveAdFallback = () =>
    !IS_APPS_IN_TOSS || REVIVE_AD_TEST_FALLBACK || isLocalNativeRuntime();

  const canUseRealReviveAd = () =>
    Boolean(REVIVE_AD_GROUP_ID) && isBridgeMethodSupported(GoogleAdMob.showAppsInTossAdMob);

  const showRealReviveAd = () =>
    new Promise((resolve, reject) => {
      let cleanup = null;
      let settled = false;
      const timeoutId = window.setTimeout(() => finish(false, new Error("ad_timeout")), REVIVE_AD_TIMEOUT_MS);

      function finish(rewarded, error = null) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        cleanupBridgeListener(cleanup);
        if (error) reject(error);
        else resolve(rewarded);
      }

      try {
        const nextCleanup = GoogleAdMob.showAppsInTossAdMob({
          options: { adGroupId: REVIVE_AD_GROUP_ID },
          onEvent: (event) => {
            if (event?.type === "userEarnedReward") finish(true);
            if (event?.type === "failedToShow") finish(false, new Error("ad_failed"));
            if (event?.type === "dismissed") window.setTimeout(() => finish(false), 80);
          },
          onError: (error) => finish(false, error instanceof Error ? error : new Error("ad_error")),
        });
        cleanup = nextCleanup;
        if (settled) cleanupBridgeListener(cleanup);
      } catch (error) {
        finish(false, error instanceof Error ? error : new Error("ad_error"));
      }
    });

  const requestPuzzleRewardAd = async () => {
    const useFallback = shouldUseReviveAdFallback();
    const useRealAd = canUseRealReviveAd();

    try {
      if (useRealAd) {
        const rewarded = await showRealReviveAd();
        return { rewarded, reason: rewarded ? "rewarded" : "dismissed" };
      }
      if (useFallback) {
        await delay(REVIVE_AD_TEST_MS);
        return { rewarded: true, reason: "fallback" };
      }
      return { rewarded: false, reason: "unavailable" };
    } catch {
      if (useFallback) {
        await delay(REVIVE_AD_TEST_MS);
        return { rewarded: true, reason: "fallback" };
      }
      return { rewarded: false, reason: "failed" };
    }
  };

  const handleReviveWithAd = async () => {
    if (!isPuzzleHpGameOver || reviveAdLoading) return;
    if (!canRequestRewardAd) {
      setReviveAdError(L("광고가 아직 연결되지 않았어요.", "Reward ads are not configured yet."));
      return;
    }
    setReviveAdLoading(true);
    setReviveAdError("");

    try {
      const result = await requestPuzzleRewardAd();
      if (!result.rewarded) {
        if (result.reason === "dismissed") {
          setReviveAdError(L("광고를 끝까지 보면 이어서 할 수 있어요.", "Watch the full ad to revive."));
          return;
        }
        setReviveAdError(L("광고를 아직 불러올 수 없어요. 잠시 후 다시 시도해줘.", "The ad is not ready yet. Try again shortly."));
        return;
      }

      revivePuzzleFromAdReward();
    } catch {
      setReviveAdError(L("광고 재생에 실패했어요. 잠시 후 다시 시도해줘.", "Could not play the ad. Try again shortly."));
    } finally {
      setReviveAdLoading(false);
    }
  };

  const revealPuzzleHintCell = () => {
    if (!canUsePuzzleHint || hintAdLoading) return;
    if (puzzleHints <= 0) {
      setStatus(L("광고를 보면 힌트를 더 쓸 수 있어요.", "Watch an ad to get another hint."));
      return;
    }
    if (!puzzle || !Array.isArray(puzzleSolutionCells)) {
      setStatus(L("이 퍼즐은 힌트를 사용할 수 없어요.", "Hints are not available for this puzzle."));
      return;
    }

    const current = cellValuesRef.current;
    const candidates = [];
    for (let index = 0; index < puzzleSolutionCells.length; index += 1) {
      if (puzzleSolutionCells[index] === 1 && current[index] !== 1) {
        candidates.push(index);
      }
    }

    if (!candidates.length) {
      setStatus(L("공개할 정답 칸이 없습니다.", "No answer cell to reveal."));
      return;
    }

    const targetIndex = candidates[Math.floor(Math.random() * candidates.length)];
    const next = current.slice();
    next[targetIndex] = 1;
    pushUndo(current.slice());
    applySnapshot(next);
    setPuzzleHints((value) => Math.max(0, value - 1));
    setPuzzleHintReveal({ id: Date.now(), index: targetIndex });
    setStatus("");
    playSfx("ready");
  };

  const handleHintAd = async () => {
    if (!canUsePuzzleHint || hintAdLoading) return;
    if (!canRequestRewardAd) {
      setStatus(L("광고가 아직 연결되지 않았어요.", "Reward ads are not configured yet."));
      return;
    }
    setHintAdLoading(true);
    setStatus("");

    try {
      const result = await requestPuzzleRewardAd();
      if (!result.rewarded) {
        setStatus(
          result.reason === "dismissed"
            ? L("광고를 끝까지 보면 힌트가 추가돼요.", "Watch the full ad to get a hint.")
            : L("광고를 아직 불러올 수 없어요. 잠시 후 다시 시도해줘.", "The ad is not ready yet. Try again shortly.")
        );
        return;
      }
      setPuzzleHints((value) => value + PUZZLE_HINT_REWARD_AMOUNT);
      playSfx("ready");
    } catch {
      setStatus(L("광고 재생에 실패했어요. 잠시 후 다시 시도해줘.", "Could not play the ad. Try again shortly."));
    } finally {
      setHintAdLoading(false);
    }
  };

  const triggerCellInputFx = (items) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const nextItems = items.slice(-18).map((item) => ({
      id: `${Date.now()}-${cellInputFxIdRef.current += 1}`,
      index: item.index,
      value: item.value,
    }));
    setCellInputFxList((prev) => [...prev.slice(-18), ...nextItems]);
    if (cellInputFxTimerRef.current) window.clearTimeout(cellInputFxTimerRef.current);
    cellInputFxTimerRef.current = window.setTimeout(() => {
      setCellInputFxList([]);
      cellInputFxTimerRef.current = 0;
    }, 420);
  };

  const completeSolvedLinesInSnapshot = (sourceCells) => {
    if (!puzzle || playMode === "create") return sourceCells;
    const { rows: solvedRowSet, cols: solvedColSet } = collectSolvedLineSets(sourceCells, puzzle, rowHints, colHints);

    let tracker = autoCompletedLinesRef.current;
    const key = `${puzzle.id || "puzzle"}:${puzzle.width}x${puzzle.height}`;
    if (tracker.key !== key) {
      tracker = { key, rows: new Set(), cols: new Set(), silent: true };
      autoCompletedLinesRef.current = tracker;
    }
    for (const row of Array.from(tracker.rows)) {
      if (!solvedRowSet.has(row)) tracker.rows.delete(row);
    }
    for (const col of Array.from(tracker.cols)) {
      if (!solvedColSet.has(col)) tracker.cols.delete(col);
    }

    const next = sourceCells.slice();
    const locked = new Set(fixedMarkIndicesRef.current);
    const newRows = [];
    const newCols = [];
    let changed = false;

    for (const row of solvedRowSet) {
      if (!tracker.rows.has(row)) newRows.push(row);
      tracker.rows.add(row);
      for (let x = 0; x < puzzle.width; x += 1) {
        const index = row * puzzle.width + x;
        locked.add(index);
        if (next[index] === 0) {
          next[index] = 2;
          changed = true;
        }
      }
    }
    for (const col of solvedColSet) {
      if (!tracker.cols.has(col)) newCols.push(col);
      tracker.cols.add(col);
      for (let y = 0; y < puzzle.height; y += 1) {
        const index = y * puzzle.width + col;
        locked.add(index);
        if (next[index] === 0) {
          next[index] = 2;
          changed = true;
        }
      }
    }

    lockedCellIndicesRef.current = locked;
    const hasNewLine = newRows.length > 0 || newCols.length > 0;
    if (hasNewLine && !tracker.silent) {
      setLineClearFx({ id: Date.now(), rows: newRows, cols: newCols });
      playSfx("line-clear");
    }
    tracker.silent = false;
    return changed ? next : sourceCells;
  };

  const flushQueuedPaint = () => {
    frameRef.current = 0;
    const pending = pendingPaintRef.current;
    if (pending.size === 0) return;
    const prev = cellValuesRef.current;
    const next = [...prev];
    let changed = false;
    const paintedFx = [];
    for (const [index, value] of pending.entries()) {
      if (next[index] !== value) {
        next[index] = value;
        changed = true;
        paintedFx.push({ index, value });
      }
    }
    pending.clear();
    if (!changed) return;
    const completedNext = completeSolvedLinesInSnapshot(next);
    triggerCellInputFx(paintedFx);
    strokeChangedRef.current = true;
    cellValuesRef.current = completedNext;
    setCells(completedNext);
  };

  const stopActivePaintAfterMistake = () => {
    if (dragRef.current && strokeBaseRef.current) {
      pushUndo(strokeBaseRef.current);
    }
    dragRef.current = null;
    lastPaintIndexRef.current = null;
    strokeBaseRef.current = null;
    strokeChangedRef.current = false;
    strokeMistakeChargedRef.current = false;
    releaseActivePointerCapture();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const queueCellPaint = (index, value) => {
    if (!isModeCreate && lockedCellIndicesRef.current.has(index)) return true;
    const pending = pendingPaintRef.current;
    const current = pending.has(index) ? pending.get(index) : (cellValuesRef.current[index] ?? 0);
    // Keep filled cells and X marks from overwriting each other during drag paint.
    if (value === 1 && current === 2) return true;
    if (value === 2 && current === 1) return true;
    const isMistake = isWrongPuzzleInput(index, value, current);
    const nextValue = isMistake ? 2 : value;
    if (!strokeMistakeChargedRef.current && isMistake) {
      strokeMistakeChargedRef.current = true;
      triggerPuzzleMistake(index);
    }
    pendingPaintRef.current.set(index, nextValue);
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(flushQueuedPaint);
    }
    if (isMistake) {
      stopActivePaintAfterMistake();
      return false;
    }
    return true;
  };

  const paintLine = (fromIndex, toIndex, value) => {
    if (!puzzle) return;
    const width = puzzle.width;
    const x0 = fromIndex % width;
    const y0 = Math.floor(fromIndex / width);
    const x1 = toIndex % width;
    const y1 = Math.floor(toIndex / width);

    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      const shouldContinue = queueCellPaint(y * width + x, value);
      if (shouldContinue === false || !dragRef.current) break;
      if (x === x1 && y === y1) break;
      const e2 = err * 2;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  };

  const paintToIndex = (index) => {
    const dragState = dragRef.current;
    if (!dragState) return;
    const last = lastPaintIndexRef.current;
    let shouldContinue = true;
    if (last == null) {
      shouldContinue = queueCellPaint(index, dragState.paintValue);
    } else {
      paintLine(last, index, dragState.paintValue);
    }
    if (shouldContinue !== false && dragRef.current) {
      lastPaintIndexRef.current = index;
    }
  };

  const startPaint = (index, buttonType, options = {}) => {
    if (!isModeCreate && lockedCellIndicesRef.current.has(index)) return;
    const current = cellValuesRef.current[index] ?? 0;
    const paintValue =
      isModeCreate
        ? current === 1
          ? 0
          : 1
        : buttonType === "left"
          ? current === 1
            ? 0
            : 1
          : current === 2
            ? 0
            : 2;

    if (!dragRef.current) {
      strokeBaseRef.current = cellValuesRef.current.slice();
      strokeChangedRef.current = false;
      strokeMistakeChargedRef.current = false;
    }
    dragRef.current = { button: buttonType, paintValue, ignoreButtons: options.ignoreButtons === true };
    lastPaintIndexRef.current = index;
    const mistakeChargedBeforePaint = strokeMistakeChargedRef.current;
    const shouldContinue = queueCellPaint(index, paintValue);
    if (shouldContinue === false) return;
    const now = Date.now();
    if ((mistakeChargedBeforePaint || !strokeMistakeChargedRef.current) && now - lastPaintSfxAtRef.current > 30) {
      playSfx(paintValue === 2 ? "paint-x" : "paint-fill");
      lastPaintSfxAtRef.current = now;
    }
  };

  const onCellPointerDown = (event, index) => {
    event.preventDefault();
    activePointerIdRef.current = event.pointerId;
    boardRef.current?.setPointerCapture?.(event.pointerId);
    const pointerType = String(event.pointerType || "").toLowerCase();
    const isTouchLike =
      pointerType === "touch" ||
      pointerType === "pen" ||
      (isCoarsePointer && pointerType !== "mouse");
    if (!isModeCreate && event.button !== 2) {
      const modeButton = mobilePaintMode === "mark" ? "right" : "left";
      startPaint(index, modeButton, { ignoreButtons: true });
      return;
    }
    if (event.button === 0) startPaint(index, "left");
    if (event.button === 2) startPaint(index, "right");
  };

  const onBoardPointerDown = (event) => {
    if (!canInteractBoard) return;
    const index = getIndexFromClientPoint(event.clientX, event.clientY);
    if (index == null) return;
    onCellPointerDown(event, index);
  };

  const getIndexFromClientPoint = (clientX, clientY) => {
    if (!puzzle || !boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) {
      return null;
    }
    const xRatio = (clientX - rect.left) / rect.width;
    const yRatio = (clientY - rect.top) / rect.height;
    const col = Math.min(puzzle.width - 1, Math.max(0, Math.floor(xRatio * puzzle.width)));
    const row = Math.min(puzzle.height - 1, Math.max(0, Math.floor(yRatio * puzzle.height)));
    return row * puzzle.width + col;
  };

  useEffect(() => {
    if (!puzzle || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, IS_APPS_IN_TOSS ? 2 : 2.5);
    const w = puzzle.width * cellSize;
    const h = puzzle.height * cellSize;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const revealProgress = clamp01(solvedRevealProgress);
    const revealEase = easeOutCubic(revealProgress);
    const solvedPaintPalette = getSolvedPaintPalette(puzzle);

    const palette = uiStyleVariant === "excel" || IS_APPS_IN_TOSS
      ? {
          empty: "#ffffff",
          filled: "#34445c",
          filledBorder: "#27364c",
          mark: "#34445c",
          grid: "#c9ced8",
          gridStrong: "#111827",
          border: "#111827",
        }
      : {
          empty: "#e6e6e6",
          filled: "#1d1d1d",
          filledBorder: "#7f8d9b",
          mark: "#8f0000",
          grid: "#444",
          gridStrong: "#111",
          border: "#111",
        };

    ctx.fillStyle = palette.empty;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < puzzle.height; y += 1) {
      for (let x = 0; x < puzzle.width; x += 1) {
        const v = cells[y * puzzle.width + x];
        const px = x * cellSize;
        const py = y * cellSize;
        if (v === 1) {
          ctx.fillStyle = palette.filled;
          ctx.fillRect(px, py, cellSize, cellSize);
          // Filled cells keep a subtle border so adjacent blacks remain distinguishable.
          const filledBorderAlpha = 1 - revealEase * 0.72;
          if (filledBorderAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = filledBorderAlpha;
            ctx.strokeStyle = palette.filledBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
            ctx.restore();
          }
          if (revealProgress > 0.01) {
            const denominator = Math.max(1, puzzle.width + puzzle.height - 2);
            const waveDelay = ((x + y) / denominator) * 0.56;
            const cellProgress = clamp01((revealProgress - waveDelay) / 0.44);
            if (cellProgress > 0) {
              const paintEase = easeOutCubic(cellProgress);
              const inset = (1 - paintEase) * Math.min(cellSize * 0.46, 9);
              ctx.save();
              ctx.globalAlpha = 0.28 + paintEase * 0.72;
              ctx.fillStyle = getSolvedPaintColor(puzzle, x, y, solvedPaintPalette);
              ctx.fillRect(
                px + inset,
                py + inset,
                Math.max(0, cellSize - inset * 2),
                Math.max(0, cellSize - inset * 2)
              );
              if (cellProgress < 1) {
                ctx.globalAlpha = 0.32 * (1 - cellProgress);
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(px + inset, py + inset, Math.max(0, cellSize - inset * 2), Math.max(1, cellSize * 0.18));
              }
              ctx.restore();
            }
          }
          if (revealEase > 0.02) {
            ctx.save();
            ctx.globalAlpha = 0.12 * revealEase;
            ctx.fillStyle = "#fffef8";
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.restore();
          }
        } else if (v === 2) {
          const markAlpha = 1 - revealEase;
          if (markAlpha > 0.01) {
            const inset = 4 + revealEase * Math.min(6, cellSize * 0.18);
            ctx.save();
            ctx.globalAlpha = markAlpha;
            ctx.strokeStyle = palette.mark;
            ctx.lineWidth = Math.max(1.1, 1.8 - revealEase * 0.6);
            ctx.beginPath();
            ctx.moveTo(px + inset, py + inset);
            ctx.lineTo(px + cellSize - inset, py + cellSize - inset);
            ctx.moveTo(px + cellSize - inset, py + inset);
            ctx.lineTo(px + inset, py + cellSize - inset);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = uiStyleVariant === "excel" ? 1.15 : 1;
    for (let x = 0; x <= puzzle.width; x += 1) {
      const px = x * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
    for (let y = 0; y <= puzzle.height; y += 1) {
      const py = y * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }

    ctx.strokeStyle = palette.gridStrong;
    ctx.lineWidth = uiStyleVariant === "excel" ? 1.9 : 2;
    for (let x = 5; x < puzzle.width; x += 5) {
      const px = x * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
    for (let y = 5; y < puzzle.height; y += 5) {
      const py = y * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }

    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }, [puzzle, cells, cellSize, uiStyleVariant, solvedRevealProgress]);

  useEffect(() => {
    const onWindowPointerMove = (event) => {
      const dragState = dragRef.current;
      if (!dragState) return;

      if (!dragState.ignoreButtons) {
        const leftPressed = (event.buttons & 1) === 1;
        const rightPressed = (event.buttons & 2) === 2;
        if (dragState.button === "left" && !leftPressed) return;
        if (dragState.button === "right" && !rightPressed) return;
      }

      const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
      for (const e of events) {
        const idx = getIndexFromClientPoint(e.clientX, e.clientY);
        if (idx != null) paintToIndex(idx);
      }
    };

    window.addEventListener("pointermove", onWindowPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onWindowPointerMove);
  }, [puzzle]);

  useEffect(() => {
    const endDrag = () => {
      finishActiveStroke();
    };
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("pointerup", endDrag);
    return () => {
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("pointerup", endDrag);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cellInputFxTimerRef.current) window.clearTimeout(cellInputFxTimerRef.current);
    };
  }, []);

  const resetGrid = () => {
    if (!puzzle) return;
    pushUndo(cellValuesRef.current.slice());
    autoCompletedLinesRef.current = { key: `${puzzle.id || "puzzle"}:${puzzle.width}x${puzzle.height}`, rows: new Set(), cols: new Set(), silent: true };
    lockedCellIndicesRef.current = new Set(fixedMarkIndicesRef.current);
    applySnapshot(new Array(puzzle.width * puzzle.height).fill(0));
    setActiveHints(new Set());
    puzzleHpRef.current = PUZZLE_MAX_HP;
    setPuzzleHp(PUZZLE_MAX_HP);
    setPuzzleHpDamage(null);
    setPuzzleHints(PUZZLE_MAX_HINTS);
    setPuzzleHintReveal(null);
    setHintAdLoading(false);
    strokeMistakeChargedRef.current = false;
    autoSolvedShownRef.current = false;
    const shouldRestartElapsedTimer = !isModeCreate && !shouldStopSoloElapsedTimer;
    puzzleStartedAtMsRef.current = shouldRestartElapsedTimer ? Date.now() : 0;
    setElapsedMs(0);
    setElapsedSec(0);
    setTimerRunning(shouldRestartElapsedTimer);
    setStatus(isModeCreate ? L("캔버스를 비웠습니다.", "Cleared the canvas.") : "Grid cleared.");
    playSfx("clear");
  };

  useEffect(() => {
    if (!puzzleHpDamage) return undefined;
    const timer = window.setTimeout(() => setPuzzleHpDamage(null), PUZZLE_HP_DAMAGE_MS);
    return () => window.clearTimeout(timer);
  }, [puzzleHpDamage?.id]);

  useEffect(() => {
    if (!puzzleHintReveal) return undefined;
    const timer = window.setTimeout(() => setPuzzleHintReveal(null), PUZZLE_HINT_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [puzzleHintReveal?.id]);

  useEffect(() => {
    if (!lineClearFx) return undefined;
    const timer = window.setTimeout(() => setLineClearFx(null), 520);
    return () => window.clearTimeout(timer);
  }, [lineClearFx?.id]);

  useEffect(() => {
    if (!isPuzzleHpGameOver) {
      setReviveAdError("");
      setReviveAdLoading(false);
    }
  }, [isPuzzleHpGameOver]);

  useEffect(() => {
    if (canUsePuzzleHint) return;
    setHintAdLoading(false);
  }, [canUsePuzzleHint]);

  useEffect(() => {
    if (!isHpPuzzleMode || !puzzle || isBoardCompleteByHints || !REVIVE_AD_GROUP_ID) return undefined;
    if (!isBridgeMethodSupported(GoogleAdMob.loadAppsInTossAdMob)) return undefined;
    let cleanup = null;
    try {
      cleanup = GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: REVIVE_AD_GROUP_ID },
        onEvent: () => {},
        onError: () => {},
      });
    } catch {
      return undefined;
    }
    return () => cleanupBridgeListener(cleanup);
  }, [isHpPuzzleMode, isBoardCompleteByHints, puzzle?.id, puzzle?.width, puzzle?.height]);

  const toggleHint = (hintId) => {
    setActiveHints((prev) => {
      const next = new Set(prev);
      if (next.has(hintId)) next.delete(hintId);
      else next.add(hintId);
      return next;
    });
  };

  useEffect(() => {
    if (!puzzle) return;
    if (isInRaceRoom) return;
    if (puzzle?.isDailyPuzzle) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`nonogram-progress-${puzzle.id}`, JSON.stringify(cells));
    }, 250);
    return () => clearTimeout(timer);
  }, [cells, isInRaceRoom, puzzle]);

  useEffect(() => {
    if (!puzzle || !timerRunning) return undefined;
    if (isInRaceRoom) return undefined;
    if (shouldStopSoloElapsedTimer) return undefined;
    if (!puzzleStartedAtMsRef.current) {
      puzzleStartedAtMsRef.current = Date.now() - Math.max(0, Number(elapsedMs || 0));
    }
    const id = setInterval(() => {
      const nextElapsedMs = Math.max(0, Date.now() - puzzleStartedAtMsRef.current);
      setElapsedMs(nextElapsedMs);
      setElapsedSec(Math.floor(nextElapsedMs / 1000));
    }, 50);
    return () => clearInterval(id);
  }, [puzzle?.id, timerRunning, isInRaceRoom, shouldStopSoloElapsedTimer]);

  useEffect(() => {
    if (!timerRunning || !shouldStopSoloElapsedTimer) return;
    puzzleStartedAtMsRef.current = 0;
    setElapsedMs(0);
    setElapsedSec(0);
    setTimerRunning(false);
  }, [timerRunning, shouldStopSoloElapsedTimer]);

  useEffect(() => {
    if (!isRacePlaying || !raceRoomCode || !racePlayerId) return;
    const now = Date.now();
    if (now - raceProgressLastSentRef.current < 520) return;
    raceProgressLastSentRef.current = now;
    submitRaceProgress();
  }, [isRacePlaying, raceRoomCode, racePlayerId, cells, puzzle]);

  useEffect(() => {
    const shouldTickRace = isInRaceRoom && (isRaceCountdown || isRacePlaying);
    const shouldTickPvp =
      isModePvp &&
      !isInRaceRoom &&
      pvpSearching &&
      (pvpMatchState === "accept" || pvpMatchState === "reveal");
    const shouldTickPlacement = isModePlacementTest && (placementRunning || Boolean(matchFlowTest?.active));
    if (!shouldTickRace && !shouldTickPvp && !shouldTickPlacement) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(id);
  }, [isInRaceRoom, isRaceCountdown, isRacePlaying, isModePvp, pvpSearching, pvpMatchState, isModePlacementTest, placementRunning, matchFlowTest?.active]);

  useEffect(() => {
    if (!isInRaceRoom || !raceState?.gameStartAt) return;
    if (isRacePlaying) {
      const nextElapsedMs = Math.max(0, nowMs - new Date(raceState.gameStartAt).getTime());
      setElapsedMs(nextElapsedMs);
      setElapsedSec(Math.floor(nextElapsedMs / 1000));
    } else if (isRaceCountdown || isRaceLobby) {
      setElapsedMs(0);
      setElapsedSec(0);
    }
  }, [isInRaceRoom, isRacePlaying, isRaceCountdown, isRaceLobby, raceState, nowMs]);

  useEffect(() => {
    if (!isModePlacementTest || !placementRunning) return;
    if (placementLeftSec > 0) return;
    void finishPlacementTest(true);
  }, [isModePlacementTest, placementRunning, placementLeftSec]);

  useEffect(() => {
    if (!isModePlacementTest || !matchSimSearching || matchSimFound) return undefined;
    const sessionId = matchSimSessionRef.current;
    const id = setInterval(() => {
      if (matchSimSessionRef.current !== sessionId) return;
      const nextSec = Math.min(MATCH_SIM_MAX_WAIT_SEC, matchSimElapsedRef.current + 1);
      matchSimElapsedRef.current = nextSec;
      setMatchSimElapsedSec(nextSec);
      const nextRule = getMatchSimRule(nextSec);
      const nextQueueSize = getMatchSimQueueSize(nextSec, matchSimRating);
      setMatchSimQueueSize(nextQueueSize);

      if (nextRule.key !== matchSimLastRuleKeyRef.current) {
        matchSimLastRuleKeyRef.current = nextRule.key;
        pushMatchSimLog(
          `탐색 단계 전환: ${nextRule.labelKo}`,
          `Search stage changed: ${nextRule.labelEn}`,
          "info"
        );
        if (nextRule.key === "adjacent") {
          pushMatchSimLog(
            "최근 상대한 상대는 우선순위를 낮추고 다음 후보를 확인합니다.",
            "Recent opponents are deprioritized while the queue widens.",
            "muted"
          );
        }
      } else if (nextSec === 14 || nextSec === 29 || nextSec === 43) {
        pushMatchSimLog(
          `대기열 변동 감지: 현재 후보 ${nextQueueSize}명`,
          `Queue updated: ${nextQueueSize} candidates visible`,
          "muted"
        );
      }

      const foundCandidate = pickMatchSimCandidate(matchSimRating, nextSec);
      if (foundCandidate) {
        setMatchSimFound(foundCandidate);
        setMatchSimSearching(false);
        pushMatchSimLog(
          `${foundCandidate.nickname} 매칭 완료 · ${foundCandidate.matchedAtSec}초`,
          `${foundCandidate.nickname} matched in ${foundCandidate.matchedAtSec}s`,
          "success"
        );
        pushMatchSimLog(foundCandidate.reasonKo, foundCandidate.reasonEn, foundCandidate.source === "bot" ? "warn" : "accent");
        setStatus(
          L(
            `${foundCandidate.nickname}와 매칭되었습니다.`,
            `Matched with ${foundCandidate.nickname}.`
          )
        );
        playSfx("ui");
      }
    }, 180);
    return () => clearInterval(id);
  }, [isModePlacementTest, matchSimSearching, matchSimFound, matchSimRating]);

  useEffect(() => () => clearMatchFlowTimers(), []);

  useEffect(() => {
    if (!puzzle) {
      autoSolvedShownRef.current = false;
      return;
    }
    if (isModeCreate) {
      autoSolvedShownRef.current = false;
      return;
    }
    if (isBoardCompleteByHints && !autoSolvedShownRef.current) {
      autoSolvedShownRef.current = true;
      startSolvedReveal();
      setTimerRunning(false);
      if (isModePlacementTest && !isInRaceRoom && placementRunning) {
        setStatus(L("단계 완료! 다음 퍼즐로 이동합니다.", "Stage cleared! Moving to next puzzle."));
        void handlePlacementStageSolved();
      } else if (isModeTutorial) {
        // Tutorial completion status is handled by tutorial progress effect.
      } else if (isInRaceRoom && isRacePlaying) {
        setStatus(L("완주! 다른 플레이어 결과 대기중...", "Finished! Waiting for other players..."));
        submitRaceFinish();
      } else {
        setStatus(puzzle?.isDailyPuzzle ? L("오늘의 퍼즐 완료! 달력에 표시했어요.", "Daily puzzle cleared and marked on the calendar.") : "Success! Puzzle solved.");
        if (isModeSingle && !isInRaceRoom) {
          if (puzzle?.isCustom) {
            triggerVictoryFx("single");
          }
          if (puzzle?.isDailyPuzzle) {
            setDailyCompletionResult(buildDailyCompletionResult(puzzle, dailyPuzzleHistory, elapsedMs, elapsedSec));
            trackMissionEvent("daily_solve", {
              dateKey: getDailySolvedDateKey(puzzle),
              eventToken: getDailySolvedDateKey(puzzle),
            });
            markDailyPuzzleSolved(puzzle);
            if (typeof window !== "undefined") {
              if (dailyResultCalendarTimerRef.current) window.clearTimeout(dailyResultCalendarTimerRef.current);
              dailyResultCalendarTimerRef.current = window.setTimeout(() => {
                clearPuzzleViewState();
                setSingleSection("daily");
                setPlayMode("single");
                dailyResultCalendarTimerRef.current = 0;
              }, SOLVED_REVEAL_DURATION_MS + 900);
            }
          }
          if (puzzle?.isCustomLibrary && !puzzle?.isDailyPuzzle) {
            trackMissionEvent("theme_solve");
            markCustomSampleSolved(puzzle?.creatorPuzzleId || puzzle?.id);
            void submitCustomSampleSolve(puzzle?.creatorPuzzleId || puzzle?.id);
          }
          if (puzzle?.isCommunityPuzzle) {
            void submitCommunityPuzzleSolve();
          } else if (!puzzle?.isDailyPuzzle) {
            void submitSingleFinish();
          }
        }
      }
    }
    if (!isBoardCompleteByHints) {
      autoSolvedShownRef.current = false;
      stopSolvedReveal();
      setSolvedRevealProgress(0);
    }
  }, [
    isBoardCompleteByHints,
    puzzle,
    isInRaceRoom,
    isRacePlaying,
    isModePlacementTest,
    placementRunning,
    isModeTutorial,
    isModeSingle,
    isModeCreate,
    dailyPuzzleHistory,
    elapsedMs,
    elapsedSec,
    markDailyPuzzleSolved,
    markCustomSampleSolved,
    submitCommunityPuzzleSolve,
    submitCustomSampleSolve,
    startSolvedReveal,
    stopSolvedReveal,
    trackMissionEvent,
    triggerVictoryFx,
  ]);

  useEffect(() => {
    if (!isInRaceRoom || racePhase !== "finished" || !raceState?.winnerPlayerId || raceResultShownRef.current) return;
    raceResultShownRef.current = true;
    if (raceState.winnerPlayerId === racePlayerId) {
      setStatus(L("승리하였습니다.", "Victory."));
      playSfx("win");
    } else {
      if (myRacePlayer?.loseReason === "inactive_timeout") {
        setStatus(
          L(
            "경고: 1분 동안 움직임이 없어 자동 패배 처리되었습니다.",
            "Warning: You were inactive for 60 seconds and lost automatically."
          )
        );
      } else {
        setStatus(L("패배하였습니다.", "Defeat."));
      }
      setTimerRunning(false);
      playSfx("lose");
    }
  }, [isInRaceRoom, racePhase, raceState, racePlayerId, myRacePlayer, L]);

  useEffect(() => {
    if (!showMultiResultModal) return;
    if (!isModeMulti || !isInRaceRoom || racePhase !== "finished") {
      setShowMultiResultModal(false);
    }
  }, [showMultiResultModal, isModeMulti, isInRaceRoom, racePhase]);

  useEffect(() => {
    if (!isModeMulti || !isInRaceRoom || racePhase !== "finished" || !raceResultKey) return;
    if (multiResultShownKeyRef.current === raceResultKey) return;
    multiResultShownKeyRef.current = raceResultKey;
    setShowMultiResultModal(true);
  }, [isModeMulti, isInRaceRoom, racePhase, raceResultKey]);

  useEffect(() => {
    if (!isLoggedIn || !isModePvp || !isInRaceRoom || racePhase !== "finished" || !raceRoomCode) return;
    if (pvpAuthRefreshDoneRoomRef.current === raceRoomCode) return;
    if (raceState?.ratedResultApplied !== true) return;

    let cancelled = false;
    let retryTimer = 0;

    const refreshAuth = async (attempt = 0) => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { ...authHeaders } });
        const data = await parseJsonSafe(res);
        if (cancelled) return;
        if (!res.ok || !data?.ok || !data?.user) throw new Error("auth_refresh_failed");
        cacheAuthUser(data.user, { applyPrefs: true });
        pvpAuthRefreshDoneRoomRef.current = raceRoomCode;
      } catch {
        if (cancelled || attempt >= 4) return;
        retryTimer = window.setTimeout(() => {
          refreshAuth(attempt + 1);
        }, 350);
      }
    };

    refreshAuth(0);
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [
    isLoggedIn,
    isModePvp,
    isInRaceRoom,
    racePhase,
    raceRoomCode,
    raceState?.ratedResultApplied,
    authHeaders,
  ]);

  useEffect(() => {
    if (!isLoggedIn || !isModePvp || !isInRaceRoom || racePhase !== "finished" || !raceRoomCode) return;
    if (pvpRatingFxDoneRoomRef.current === raceRoomCode) return;
    const ratedResult = raceState?.ratedResult || null;
    const myUserId = Number(authUser?.id);
    if (ratedResult && Number.isInteger(myUserId)) {
      const didWin = Number(ratedResult.winnerUserId) === myUserId;
      const didLose = Number(ratedResult.loserUserId) === myUserId;
      if (didWin || didLose) {
        const fromRating = didWin
          ? Number(ratedResult.winnerRatingBefore)
          : Number(ratedResult.loserRatingBefore);
        const toRating = didWin
          ? Number(ratedResult.winnerRatingAfter)
          : Number(ratedResult.loserRatingAfter);
        if (Number.isFinite(fromRating) && Number.isFinite(toRating)) {
          pvpRatingFxDoneRoomRef.current = raceRoomCode;
          startPvpRatingAnimation(fromRating, toRating, raceRoomCode, {
            result: didWin ? "win" : "loss",
          });
          return;
        }
      }
    }
    const fromRating = Number(pvpRatingBaseRef.current);
    const fromGames = Number(pvpRatingBaseGamesRef.current);
    const toRating = Number(authUser?.rating);
    const toGames = Number(authUser?.rating_games);
    const didWin = raceState?.winnerPlayerId === racePlayerId;
    if (!Number.isFinite(fromRating) || !Number.isFinite(fromGames)) return;
    if (!Number.isFinite(toRating) || !Number.isFinite(toGames)) return;
    if (toGames <= fromGames) return;
    pvpRatingFxDoneRoomRef.current = raceRoomCode;
    startPvpRatingAnimation(fromRating, toRating, raceRoomCode, {
      result: didWin ? "win" : "loss",
    });
  }, [
    isLoggedIn,
    isModePvp,
    isInRaceRoom,
    racePhase,
    raceRoomCode,
    authUser?.id,
    authUser?.rating,
    authUser?.rating_games,
    raceState?.ratedResult,
    raceState?.winnerPlayerId,
    racePlayerId,
  ]);

  useEffect(() => {
    if (isLoggedIn || !isModePvp || !isInRaceRoom || racePhase !== "finished" || !raceRoomCode) return;
    if (pvpRatingFxDoneRoomRef.current === raceRoomCode) return;
    const fromRating = Number.isFinite(Number(pvpRatingBaseRef.current)) ? Number(pvpRatingBaseRef.current) : 1500;
    const didWin = raceState?.winnerPlayerId === racePlayerId;
    const toRating = Math.max(0, fromRating + (didWin ? 24 : -18));
    pvpRatingFxDoneRoomRef.current = raceRoomCode;
    startPvpRatingAnimation(fromRating, toRating, raceRoomCode, {
      result: didWin ? "win" : "loss",
    });
  }, [isLoggedIn, isModePvp, isInRaceRoom, racePhase, raceRoomCode, raceState?.winnerPlayerId, racePlayerId]);

  useEffect(() => {
    if (!isRaceCountdown || countdownLeft == null) {
      countdownCueRef.current = -1;
      return;
    }
    if (countdownLeft !== countdownCueRef.current) {
      countdownCueRef.current = countdownLeft;
      playSfx("countdown");
    }
  }, [isRaceCountdown, countdownLeft]);

  useEffect(() => {
    if (!showInactivityWarning) {
      inactivityWarnCueRef.current = -1;
      return;
    }
    if (inactivityLeftSec === inactivityWarnCueRef.current) return;
    inactivityWarnCueRef.current = inactivityLeftSec;
    if (inactivityLeftSec <= 3) playSfx("ready");
    else playSfx("countdown");
  }, [showInactivityWarning, inactivityLeftSec]);

  useEffect(() => {
    const prev = prevRacePhaseRef.current;
    if (prev === "countdown" && racePhase === "playing") {
      playSfx("go");
    }
    prevRacePhaseRef.current = racePhase;
  }, [racePhase]);

  useEffect(() => {
    const phase = pvpMatchState || "";
    const prev = pvpMatchPhaseRef.current;
    if (phase !== prev) {
      if (phase === "accept") playSfx("ready");
      else if (phase === "ban") playSfx("ui");
      else if (phase === "reveal") playSfx("countdown");
      else if (phase === "cancelled") playSfx("lose");
    }
    pvpMatchPhaseRef.current = phase;
  }, [pvpMatchState]);

  useEffect(() => {
    if (!isModePvp || isInRaceRoom || !pvpSearching) return;
    const matchId = String(pvpMatch?.matchId || "").trim();
    if (!matchId) return;
    const shouldShow = pvpMatchState === "reveal" || (pvpMatchState === "accept" && pvpAllAccepted);
    if (!shouldShow) return;
    if (pvpShowdownSeenRef.current === matchId) return;
    pvpShowdownSeenRef.current = matchId;
    setPvpShowdownMatchId(matchId);
    setPvpShowdownUntilMs(Date.now() + 5200);
    playSfx("go");
  }, [isModePvp, isInRaceRoom, pvpSearching, pvpMatch?.matchId, pvpMatchState, pvpAllAccepted]);

  useEffect(() => {
    if (!isModePvp || !pvpSearching || isInRaceRoom || pvpMatchState !== "reveal" || pvpDisplayOptions.length === 0) {
      stopPvpRevealAnimation();
      return;
    }
    if (!shouldRunPvpRevealRoulette) {
      stopPvpRevealAnimation();
      const chosenIdx = pvpDisplayOptions.findIndex((o) => o.sizeKey === pvpMatch?.chosenSizeKey);
      if (chosenIdx >= 0) setPvpRevealIndex(chosenIdx);
      return;
    }

    stopPvpRevealAnimation();
    let idx = Math.floor(Math.random() * pvpDisplayOptions.length);
    setPvpRevealIndex(idx);
    pvpRevealAnimRef.current = window.setInterval(() => {
      idx = (idx + 1) % pvpDisplayOptions.length;
      setPvpRevealIndex(idx);
      playSfx("roulette-tick");
    }, 95);
    return () => {
      stopPvpRevealAnimation();
    };
  }, [
    isModePvp,
    pvpSearching,
    isInRaceRoom,
    pvpMatchState,
    pvpDisplayOptions,
    pvpMatch?.chosenSizeKey,
    shouldRunPvpRevealRoulette,
  ]);

  useEffect(() => {
    if (pvpMatchState !== "reveal") {
      pvpRevealSpinPrevRef.current = false;
      return;
    }
    if (pvpRevealSpinPrevRef.current && !shouldRunPvpRevealRoulette && !isPvpShowdownActive) {
      playSfx("roulette-stop");
    }
    pvpRevealSpinPrevRef.current = shouldRunPvpRevealRoulette;
  }, [pvpMatchState, shouldRunPvpRevealRoulette, isPvpShowdownActive]);

  useEffect(() => {
    if (!isInRaceRoom || !raceState?.puzzleId) return;
    if (puzzle?.id === raceState.puzzleId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/puzzles/${raceState.puzzleId}`);
        const data = await parseJsonSafe(res);
        if (!res.ok || !data.ok || cancelled) return;
        initializePuzzle(data.puzzle, {
          resume: false,
          startTimer: false,
          message: L(`방 퍼즐이 변경됨: ${data.puzzle.id}`, `Room puzzle changed: ${data.puzzle.id}`),
        });
      } catch {
        // ignore transient sync errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isInRaceRoom, raceState?.puzzleId, puzzle?.id]);

  useEffect(() => {
    if (isInRaceRoom || !isModeMulti) return;
    fetchPublicRooms();
  }, [isInRaceRoom, isModeMulti]);

  useEffect(() => {
    if ((!isModeRanking && !isModeLegacyRanking) || isInRaceRoom) return;
    void fetchRatingUsers(isModeLegacyRanking ? "legacy" : "current");
  }, [isModeRanking, isModeLegacyRanking, isInRaceRoom]);

  useEffect(() => {
    if (!isModeReplayHall || isInRaceRoom) return;
    fetchBestReplayRecords();
  }, [isModeReplayHall, isInRaceRoom]);

  useEffect(() => {
    if (isLoggedIn) return;
    resetPvpQueueState();
  }, [isLoggedIn]);

  useEffect(() => {
    if (isInRaceRoom) return;
    if (isRaceOnlyStatusMessage(status)) {
      setStatus("");
    }
  }, [isInRaceRoom, status]);

  useEffect(() => {
    if (!isModeTutorial) return;
    if (tutorialAllDone) {
      if (!tutorialCompleteShownRef.current) {
        tutorialCompleteShownRef.current = true;
        markTutorialSeen();
        playSfx("win");
      }
    }
  }, [isModeTutorial, tutorialAllDone]);

  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages.length, isInRaceRoom]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const onDocPointerDown = (event) => {
      if (!emojiWrapRef.current) return;
      if (!emojiWrapRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [showEmojiPicker]);

  const isExcelMode = uiStyleVariant === "excel";
  const brandTitle = IS_APPS_IN_TOSS ? "노노그램 아레나" : "Nonogram Arena";
  const modeTagText = IS_APPS_IN_TOSS ? L("토스 로그인", "Toss Login") : L("로그인 필요", "Login Required");
  const excelMainStyle = isExcelMode ? { "--excel-cell-size": `${cellSize}px` } : undefined;
  const placementDisplayCard = placementResultCard
    || (hasPlacementQualification && placementAssignedTier
      ? {
          rating: placementAssignedRating,
          tier: placementAssignedTier,
          solvedSequential: Number(authUser?.placement_solved_sequential || 0),
          elapsedSec: Number(authUser?.placement_elapsed_sec || 0),
        }
      : null);
  const placementResultTierKey = placementDisplayCard?.tier?.key || "bronze";
  const placementResultTierClass = placementDisplayCard ? `tier-${placementResultTierKey}` : "";
  const placementResultElapsedText = (() => {
    const totalSec = Math.max(0, Number(placementDisplayCard?.elapsedSec || 0));
    const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  })();
  const placementResultTierLabel = placementDisplayCard
    ? lang === "ko"
      ? placementDisplayCard.tier.labelKo
      : placementDisplayCard.tier.labelEn
    : "";
  const pvpModeTagText = IS_APPS_IN_TOSS
    ? ""
    : !isLoggedIn
    ? modeTagText
    : "";
  const displayedCustomGroupKeys = IS_APPS_IN_TOSS ? ["small"] : CREATOR_SAMPLE_GROUP_ORDER;
  const activeCustomSizeGroup = IS_APPS_IN_TOSS ? "small" : customSizeGroup;
  const visibleCreatorSamples = creatorSamples.filter((sample) => sample.sizeGroup === activeCustomSizeGroup);
  const visibleCreatorSampleCount = IS_APPS_IN_TOSS ? visibleCreatorSamples.length : creatorSamples.length;
  const themeCategoryStats = THEME_CATEGORY_DEFINITIONS.map((category) => {
    const samples = category.key === "all"
      ? visibleCreatorSamples
      : visibleCreatorSamples.filter((sample) => getThemePuzzleCategoryKey(sample) === category.key);
    const solvedCount = samples.filter((sample) => sample.isSolved).length;
    return {
      key: category.key,
      label: getThemeCategoryLabel(category.key, lang),
      count: samples.length,
      solvedCount,
    };
  }).filter((category) => category.key === "all" || category.count > 0);
  const activeThemeCategoryKey = themeCategoryStats.some((category) => category.key === customThemeCategory)
    ? customThemeCategory
    : "all";
  const activeThemeCategoryStat = themeCategoryStats.find((category) => category.key === activeThemeCategoryKey) || themeCategoryStats[0];
  const visibleThemeSamples = activeThemeCategoryKey === "all"
    ? visibleCreatorSamples
    : visibleCreatorSamples.filter((sample) => getThemePuzzleCategoryKey(sample) === activeThemeCategoryKey);
  const themeSolvedCount = visibleCreatorSamples.filter((sample) => sample.isSolved).length;
  const themeProgressPercent = visibleCreatorSamples.length
    ? Math.min(100, Math.round((themeSolvedCount / visibleCreatorSamples.length) * 100))
    : 0;
  const todayDailyDateKey = getKstDateKey(new Date(nowMs));
  const dailyPuzzleHistorySafe = normalizeDailyPuzzleHistory(dailyPuzzleHistory);
  const dailyPuzzleSample = getDailyPuzzleForDate(DEFAULT_DAILY_SAMPLE_PUZZLES, todayDailyDateKey);
  const dailyPuzzleTitle = dailyPuzzleSample ? L("오늘의 퍼즐", "Daily Puzzle") : L("준비 중", "Preparing");
  const dailyPuzzleSizeText = dailyPuzzleSample ? `${dailyPuzzleSample.width}x${dailyPuzzleSample.height}` : "";
  const isDailyPuzzleSolvedToday = Boolean(dailyPuzzleHistorySafe.solves[todayDailyDateKey]);
  const dailyPuzzleStreak = getDailyPuzzleStreak(dailyPuzzleHistorySafe, todayDailyDateKey);
  const dailyMonthSolvedCount = getDailyMonthSolvedCount(dailyPuzzleHistorySafe, todayDailyDateKey);
  const dailyMonthCells = getDailyMonthCells(todayDailyDateKey, dailyPuzzleHistorySafe);
  const dailyMonthElapsedDays = dailyMonthCells.filter((cell) => !cell.isBlank && !cell.isFuture).length;
  const dailyMonthProgressPercent = dailyMonthElapsedDays
    ? Math.min(100, Math.round((dailyMonthSolvedCount / dailyMonthElapsedDays) * 100))
    : 0;
  const dailyMonthLabel = formatDailyMonthLabel(todayDailyDateKey, lang);
  const dailyWeekdayLabels = lang === "ko" ? DAILY_WEEKDAY_LABELS_KO : DAILY_WEEKDAY_LABELS_EN;
  const missionStateSafe = normalizeMissionState(missionState, todayDailyDateKey);
  const missionLevelInfo = getMissionLevelInfo(missionStateSafe.totalXp);
  const profileLevelLabel = `Lv.${missionLevelInfo.level}`;
  const profileLevelXpText = `${missionLevelInfo.currentXp}/${missionLevelInfo.nextXp} XP`;
  const dailyMissionItems = buildMissionViewItems(DAILY_MISSION_DEFINITIONS, missionStateSafe.daily, lang);
  const weeklyMissionItems = buildMissionViewItems(WEEKLY_MISSION_DEFINITIONS, missionStateSafe.weekly, lang);
  const dailyMissionDoneCount = dailyMissionItems.filter((mission) => mission.isComplete).length;
  const weeklyMissionDoneCount = weeklyMissionItems.filter((mission) => mission.isComplete).length;
  const missionWeekLabel = formatMissionWeekLabel(missionStateSafe.weekly.periodKey, lang);
  const renderMissionItem = (mission, scope) => (
    <div key={`mission-${scope}-${mission.id}`} className={`appsMissionItem ${mission.isComplete ? "complete" : ""}`}>
      <span className="appsMissionCheck">
        {mission.isComplete ? <CheckCircle2 size={15} /> : <span>{mission.progress}</span>}
      </span>
      <span className="appsMissionCopy">
        <strong>{mission.title}</strong>
        <em>{mission.desc}</em>
      </span>
      <span className="appsMissionReward">+{mission.xp}</span>
      <span className="appsMissionBar" aria-hidden="true">
        <i style={{ width: `${mission.progressPercent}%` }} />
      </span>
      <span className="appsMissionCount">{mission.progress}/{mission.target}</span>
    </div>
  );
  const renderMissionPanel = (variant = "main") => (
    <section className={[
      "appsMissionPanel",
      variant === "compact" ? "compact" : "",
      missionRewardFx ? "rewardPulse" : "",
      missionRewardFx?.leveledUp ? "levelUpPulse" : "",
    ].filter(Boolean).join(" ")}>
      <div className="appsMissionLevelCard">
        <div className="appsMissionLevelBadge">Lv.{missionLevelInfo.level}</div>
        <div className="appsMissionLevelCopy">
          <strong>{L("오늘의 성장", "Today's Growth")}</strong>
          <span>{missionLevelInfo.currentXp}/{missionLevelInfo.nextXp} XP</span>
          <b aria-hidden="true">
            <i style={{ width: `${missionLevelInfo.progressPercent}%` }} />
          </b>
        </div>
      </div>

      <div className="appsMissionColumns">
        <div className="appsMissionGroup">
          <div className="appsMissionGroupHead">
            <span>{L("일일 미션", "Daily Missions")}</span>
            <strong>{dailyMissionDoneCount}/{dailyMissionItems.length}</strong>
          </div>
          <div className="appsMissionList">
            {dailyMissionItems.map((mission) => renderMissionItem(mission, "daily"))}
          </div>
        </div>
        <div className="appsMissionGroup">
          <div className="appsMissionGroupHead">
            <span>{L("주간 미션", "Weekly Missions")}</span>
            <strong>{missionWeekLabel} · {weeklyMissionDoneCount}/{weeklyMissionItems.length}</strong>
          </div>
          <div className="appsMissionList">
            {weeklyMissionItems.map((mission) => renderMissionItem(mission, "weekly"))}
          </div>
        </div>
      </div>
    </section>
  );
  const openMissionSheet = () => {
    setShowMissionSheet(true);
    playSfx("ui");
  };
  const closeMissionSheet = () => {
    setShowMissionSheet(false);
    playSfx("ui");
  };
  const loadDailyPuzzle = () => {
    if (isInRaceRoom) {
      setStatus(L("방 플레이 중에는 오늘의 퍼즐로 이동할 수 없습니다.", "You cannot open the daily puzzle while in a room."));
      return;
    }
    if (!dailyPuzzleSample) {
      setStatus(L("오늘의 퍼즐을 준비 중입니다.", "Daily puzzle is preparing."));
      return;
    }
    if (pvpSearching && !isInRaceRoom) {
      void cancelPvpQueue({ silent: true });
    }
    if (typeof window !== "undefined" && dailyResultCalendarTimerRef.current) {
      window.clearTimeout(dailyResultCalendarTimerRef.current);
      dailyResultCalendarTimerRef.current = 0;
    }
    const dailyPuzzle = buildCreatorPuzzle(dailyPuzzleSample.width, dailyPuzzleSample.height, dailyPuzzleSample.cells, {
      id: `daily-${todayDailyDateKey}-${dailyPuzzleSample.id}`,
      isLibrary: true,
      isDailyPuzzle: true,
      dailyDate: todayDailyDateKey,
      creatorPuzzleId: dailyPuzzleSample.id,
      titleKo: dailyPuzzleSample.titleKo || "",
      titleEn: dailyPuzzleSample.titleEn || "",
    });
    if (typeof window !== "undefined") {
      clearStoredDailyPuzzleState();
    }
    setDailyCompletionResult(null);
    initializePuzzle(dailyPuzzle, {
      resume: false,
      startTimer: true,
      fixedMarks: buildThemeStarterMarkIndices(dailyPuzzle),
      message:
        lang === "ko"
          ? "오늘의 퍼즐을 불러왔습니다."
          : "Loaded daily puzzle.",
    });
    setSingleSection("daily");
    setPlayMode("single");
    playSfx("ui");
  };
  const renderDailyPanel = () => (
    <div className={`appsDailyPanel ${isDailyPuzzleSolvedToday ? "solved" : ""}`}>
      {dailyCompletionResult && (
        <div className="appsDailyResultCard">
          <div className="appsDailyResultBadge">
            <Trophy size={18} />
            <span>{L("오늘 완료", "Cleared Today")}</span>
          </div>
          <div className="appsDailyResultTitle">
            <small>{dailyCompletionResult.sizeText || dailyPuzzleSizeText}</small>
            <strong>{L("오늘의 퍼즐", "Daily Puzzle")}</strong>
          </div>
          <div className="appsDailyResultStats">
            <span>
              <CheckCircle2 size={15} />
              {formatRaceElapsedMs(dailyCompletionResult.elapsedMs, dailyCompletionResult.elapsedSec)}
            </span>
            <span>
              <Flame size={15} />
              {L(`연속 ${dailyCompletionResult.streak}일`, `${dailyCompletionResult.streak} day streak`)}
            </span>
            <span>
              <CalendarDays size={15} />
              {L(`${dailyCompletionResult.monthSolvedCount}일 완료`, `${dailyCompletionResult.monthSolvedCount} days cleared`)}
            </span>
          </div>
          <div className="appsDailyResultActions">
            <button type="button" onClick={loadDailyPuzzle}>
              <Shuffle size={15} />
              <span>{L("다시 테스트", "Test Again")}</span>
            </button>
            <button type="button" onClick={() => setDailyCompletionResult(null)}>
              <CheckCircle2 size={15} />
              <span>{L("확인", "OK")}</span>
            </button>
          </div>
        </div>
      )}

      <button type="button" className="appsDailyCard" onClick={loadDailyPuzzle}>
        <span className="appsDailyIcon">
          {isDailyPuzzleSolvedToday ? <CheckCircle2 size={28} /> : <CalendarDays size={28} />}
        </span>
        <span className="appsDailyCopy">
          <small>{L("일일퀴즈", "Daily Quiz")}</small>
          <strong>{dailyPuzzleTitle}</strong>
          <em>
            {dailyPuzzleSizeText}
            {dailyPuzzleSizeText ? " · " : ""}
            {isDailyPuzzleSolvedToday ? L("오늘 완료", "Cleared today") : L("오늘 도전", "Play today")}
          </em>
        </span>
        <span className="appsDailyBadge">{isDailyPuzzleSolvedToday ? L("완료", "Done") : L("도전", "Play")}</span>
      </button>

      <div className="appsDailyStats">
        <span>
          <Flame size={15} />
          {L(`연속 ${dailyPuzzleStreak}일`, `${dailyPuzzleStreak} day streak`)}
        </span>
        <span>
          <CalendarDays size={15} />
          {L(`${dailyMonthLabel} ${dailyMonthSolvedCount}일 완료`, `${dailyMonthSolvedCount} days in ${dailyMonthLabel}`)}
        </span>
      </div>

      <div className="appsDailyCalendar" aria-label={L("일일 퍼즐 달력", "Daily puzzle calendar")}>
        <div className="appsDailyCalendarTop">
          <strong>{dailyMonthLabel}</strong>
          <div className="appsDailyCalendarProgress">
            <span>
              {L(
                `이번 달 ${dailyMonthSolvedCount}/${dailyMonthElapsedDays}`,
                `${dailyMonthSolvedCount}/${dailyMonthElapsedDays} this month`
              )}
            </span>
            <b aria-hidden="true">
              <i style={{ width: `${dailyMonthProgressPercent}%` }} />
            </b>
          </div>
        </div>
        <div className="appsDailyWeekdays">
          {dailyWeekdayLabels.map((label, index) => (
            <span key={`daily-weekday-${label}-${index}`}>{label}</span>
          ))}
        </div>
        <div className="appsDailyCalendarGrid">
          {dailyMonthCells.map((cell) => (
            <span
              key={cell.key}
              className={[
                "appsDailyDay",
                cell.isBlank ? "blank" : "",
                cell.isSolved ? "solved" : "",
                cell.isToday ? "today" : "",
                cell.isFuture ? "future" : "",
                cell.dateKey === dailyPuzzleStampDate ? "justSolved" : "",
              ].filter(Boolean).join(" ")}
              style={!cell.isBlank ? { "--daily-day-delay": `${Math.min(cell.day || 0, 31) * 20}ms` } : undefined}
            >
              {!cell.isBlank && (
                <>
                  <span className="appsDailyDayNumber">{cell.day}</span>
                  {cell.isSolved && <span className="appsDailyDayStamp" aria-hidden="true" />}
                  {cell.isToday && <span className="appsDailyTodayDot" aria-hidden="true" />}
                </>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
  const displayedCommunityGroupKeys = IS_APPS_IN_TOSS ? ["small"] : CREATOR_SAMPLE_GROUP_ORDER;
  const activeCommunitySizeGroup = IS_APPS_IN_TOSS ? "small" : communitySizeGroup;
  const visibleCommunityPuzzles = communityPuzzles.filter((sample) => sample.sizeGroup === activeCommunitySizeGroup);
  const visibleCommunityPuzzleCount = IS_APPS_IN_TOSS ? visibleCommunityPuzzles.length : communityPuzzles.length;
  const getCommunityReactionTotal = (sample) =>
    CREATOR_REACTION_OPTIONS.reduce((sum, reaction) => sum + Number(sample?.reactionCounts?.[reaction.key] || 0), 0);
  const pvpFxBracketNow = pvpRatingFx ? getTierBracketInfo(pvpRatingFx.ratingNow, pvpRatingFx.done ? pvpRatingFx.toRank : pvpRatingFx.fromRank) : null;
  const pvpFxTierNow = pvpFxBracketNow?.tier || pvpRatingFx?.toTier || null;
  const pvpFxTierClass = pvpFxTierNow ? `tier-${pvpFxTierNow.key}` : "";
  const pvpFxTierLabel = pvpFxTierNow ? (lang === "ko" ? pvpFxTierNow.labelKo : pvpFxTierNow.labelEn) : "";
  const pvpFxFromTierLabel = pvpRatingFx?.fromTier
    ? lang === "ko"
      ? pvpRatingFx.fromTier.labelKo
      : pvpRatingFx.fromTier.labelEn
    : "";
  const pvpFxToTierLabel = pvpRatingFx?.toTier
    ? lang === "ko"
      ? pvpRatingFx.toTier.labelKo
      : pvpRatingFx.toTier.labelEn
    : "";
  const pvpFxOutcomeLabel = pvpRatingFx?.result === "loss" ? L("패배", "Defeat") : L("승리", "Victory");
  const pvpFxOutcomeSub = pvpRatingFx?.result === "loss" ? L("레이팅 하락", "Rating Lost") : L("레이팅 상승", "Rating Gained");
  const pvpFxShiftLabel =
    pvpRatingFx?.tierShift === "promoted"
      ? L("티어 승급", "Promotion")
      : pvpRatingFx?.tierShift === "demoted"
        ? L("티어 강등", "Demotion")
        : "";
  const pvpFxGaugePercent = Math.max(0, Math.min(100, Number(pvpFxBracketNow?.progress || 0)));
  const pvpFxNextTierLabel = pvpFxBracketNow?.nextTier
    ? lang === "ko"
      ? pvpFxBracketNow.nextTier.labelKo
      : pvpFxBracketNow.nextTier.labelEn
    : "MAX";
  const pvpFxDeltaText = pvpRatingFx
    ? pvpRatingFx.deltaNow > 0
      ? `+${pvpRatingFx.deltaNow}`
      : String(pvpRatingFx.deltaNow)
    : "";
  const pvpFxRouteChanged = pvpRatingFx && pvpFxFromTierLabel && pvpFxToTierLabel && pvpFxFromTierLabel !== pvpFxToTierLabel;
  const matchSimTierLabel = lang === "ko" ? matchSimCurrentTier.labelKo : matchSimCurrentTier.labelEn;
  const matchSimRuleLabel = lang === "ko" ? matchSimCurrentRule.labelKo : matchSimCurrentRule.labelEn;
  const matchSimStageIndex = MATCH_SIM_STAGE_FLOW.findIndex((stage) => stage.key === matchSimCurrentRule.key);
  const matchSimFoundTierLabel = matchSimFound?.tier ? (lang === "ko" ? matchSimFound.tier.labelKo : matchSimFound.tier.labelEn) : "";
  const matchSimFoundSourceLabel = matchSimFound
    ? matchSimFound.source === "bot"
      ? L("봇 후보", "Bot Candidate")
      : L("유저 풀", "Human Pool")
    : "";
  const matchFlowPlayers = matchFlowTest
    ? [
        matchFlowTest.me || { nickname: L("테스터", "Tester"), rating: MATCH_FLOW_TEST_BASE_RATING, ratingRank: null },
        matchFlowTest.opponent || MATCH_FLOW_TEST_OPPONENT,
      ]
    : [];
  const profileModalTier = profileModalData
    ? getTierInfoByRating(profileModalData.rating, profileModalData.ratingRank)
    : null;
  const profileModalTierLabel = profileModalTier ? (lang === "ko" ? profileModalTier.labelKo : profileModalTier.labelEn) : "";
  const profileModalAvatarKey = normalizeProfileAvatarKey(
    profileModalMode === "self" ? profileDraftAvatarKey : profileModalData?.profile_avatar_key || DEFAULT_PROFILE_AVATAR_KEY
  );
  const profileModalRankText =
    Number.isInteger(Number(profileModalData?.ratingRank)) && Number(profileModalData?.ratingRank) > 0
      ? lang === "ko"
        ? `${Number(profileModalData.ratingRank)}등`
        : `#${Number(profileModalData.ratingRank)}`
      : "";
  const profileUnlockedSpecialKeys = new Set(
    Array.isArray(profileModalData?.unlockedSpecialAvatarKeys)
      ? profileModalData.unlockedSpecialAvatarKeys.map((key) => normalizeProfileAvatarKey(key))
      : []
  );
  const profileModalHallRewards = Array.isArray(profileModalData?.hallRewards) ? profileModalData.hallRewards : [];
  const profileAvatarDirty =
    profileModalMode === "self" &&
    normalizeProfileAvatarKey(profileModalData?.profile_avatar_key || DEFAULT_PROFILE_AVATAR_KEY) !==
      normalizeProfileAvatarKey(profileDraftAvatarKey);
  const profileNicknameDirty =
    profileModalMode === "self" &&
    String(profileModalData?.nickname || "").trim() !== String(profileDraftNickname || "").trim();
  const profileDirty = profileAvatarDirty || profileNicknameDirty;
  const activeMenuTourStep = MENU_TOUR_STEPS[menuTourIndex % MENU_TOUR_STEPS.length] || MENU_TOUR_STEPS[0];
  const activeMenuTourPoints = lang === "ko" ? activeMenuTourStep.pointsKo : activeMenuTourStep.pointsEn;
  const aboutPageLink = CONTENT_PAGE_LINKS[0];
  const howToPlayPageLink = CONTENT_PAGE_LINKS[1];
  const pvpGuidePageLink = CONTENT_PAGE_LINKS[2];
  const rankingGuidePageLink = CONTENT_PAGE_LINKS[3];
  const updatesPageLink = CONTENT_PAGE_LINKS[4];
  const faqPageLink = CONTENT_PAGE_LINKS[5];
  const renderTutorialHint = (hints, className = "") => {
    const safeHints = Array.isArray(hints) && hints.length ? hints : [0];
    return (
      <span className={`tutorialLessonHint ${className}`}>
        {safeHints.map((hint, index) => (
          <b key={`${hint}-${index}`}>{hint}</b>
        ))}
      </span>
    );
  };
  const renderTutorialMiniBoard = () => {
    const width = Math.max(1, Number(tutorialLesson?.width || 1));
    const height = Math.max(1, Number(tutorialLesson?.height || 1));
    return (
      <div
        className={`tutorialLessonBoard tutorialLessonBoard-${tutorialLesson.key}`}
        style={{ "--tutorial-cols": width, "--tutorial-rows": height }}
      >
        <div className="tutorialLessonCorner" aria-hidden="true" />
        {Array.from({ length: width }).map((_, col) => (
          <div key={`col-${col}`} className="tutorialLessonColHint">
            {renderTutorialHint(tutorialLesson.colHints?.[col], "vertical")}
          </div>
        ))}
        {Array.from({ length: height }).map((_, row) => (
          <div key={`row-${row}`} className="tutorialLessonRow">
            <div className="tutorialLessonRowHint">{renderTutorialHint(tutorialLesson.rowHints?.[row])}</div>
            {Array.from({ length: width }).map((_, col) => {
              const index = row * width + col;
              const value = tutorialLessonCellsNormalized[index] || 0;
              return (
                <button
                  key={`cell-${index}`}
                  type="button"
                  className={`tutorialLessonCell ${value === 1 ? "filled" : ""} ${value === 2 ? "marked" : ""}`}
                  onClick={() => tapTutorialCell(index)}
                  aria-label={L(`${row + 1}행 ${col + 1}열`, `Row ${row + 1}, column ${col + 1}`)}
                >
                  {value === 2 ? <span aria-hidden="true">×</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };
  const renderTutorialLessons = () => (
    <section className="tutorialStage tutorialLessonStage">
      <div className="tutorialLessonHero">
        <div className="tutorialLessonTitleRow">
          <BookOpen size={24} />
          <div>
            <strong>{L("노노그램 튜토리얼", "Nonogram Tutorial")}</strong>
            <span>{L("퍼즐의 규칙을 하나씩 배워봅니다", "Learn the puzzle rules one step at a time.")}</span>
          </div>
        </div>
        <div className="tutorialLessonProgressTrack" aria-hidden="true">
          <span style={{ width: `${tutorialLessonProgress}%` }} />
        </div>
        <div className="tutorialLessonProgressText">
          {L(
            `진행도 ${tutorialLessonIndex + 1} / ${TUTORIAL_LESSONS.length}`,
            `Progress ${tutorialLessonIndex + 1} / ${TUTORIAL_LESSONS.length}`
          )}
        </div>
      </div>

      <div className="tutorialLessonTools" role="toolbar" aria-label={L("튜토리얼 도구", "Tutorial tools")}>
        <button
          type="button"
          className={`tutorialLessonTool ${tutorialTool === "fill" ? "active" : ""}`}
          onClick={() => setTutorialToolMode("fill")}
        >
          <span className="tutorialToolSwatch" aria-hidden="true" />
          {L("채우기", "Fill")}
        </button>
        <button
          type="button"
          className={`tutorialLessonTool ${tutorialTool === "mark" ? "active" : ""}`}
          onClick={() => setTutorialToolMode("mark")}
        >
          <X size={16} />
          {L("X 표시", "X Mark")}
        </button>
      </div>

      <div className="tutorialLessonControlHint">
        {L("모바일: 원하는 도구를 고른 뒤 칸을 터치하세요.", "Mobile: choose a tool, then tap cells.")}
      </div>

      <div className={`tutorialLessonCard ${tutorialLessonSolved ? "solved" : ""}`}>
        <span className={`tutorialLessonBadge ${tutorialLessonIsFinal ? "final" : ""}`}>{tutorialLesson.badge}</span>
        <h2>{L(tutorialLesson.titleKo, tutorialLesson.titleEn)}</h2>
        <div className="tutorialLessonBody">
          {(lang === "ko" || IS_APPS_IN_TOSS ? tutorialLesson.bodyKo : tutorialLesson.bodyEn).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {renderTutorialMiniBoard()}
        <div className={`tutorialLessonResult ${tutorialLessonSolved ? "show" : ""}`}>
          <CheckCircle2 size={18} />
          {L("정답입니다!", "Correct!")}
        </div>
        <div className="tutorialLessonActions">
          <button type="button" className="tutorialLessonSubBtn" onClick={() => resetTutorialLesson(tutorialLessonIndex)}>
            {L("다시 풀기", "Reset")}
          </button>
          <button
            type="button"
            className="tutorialLessonNextBtn"
            onClick={goNextTutorialLesson}
            disabled={!tutorialLessonSolved}
          >
            {tutorialLessonIsFinal ? L("게임 시작하기", "Start Game") : L("다음 단계", "Next Step")}
            {tutorialLessonIsFinal ? null : <ArrowRight size={17} />}
          </button>
        </div>
      </div>

      <div className="tutorialLessonFooterActions">
        <button type="button" onClick={backToMenu}>
          <Home size={16} />
          {L("메인", "Home")}
        </button>
        <button type="button" onClick={skipTutorial}>
          {L("튜토리얼 종료", "Exit Tutorial")}
        </button>
      </div>
    </section>
  );
  const renderPuzzleHpCellFx = () => {
    if (!isHpPuzzleMode || !puzzle || !puzzleHpDamage) return null;
    const index = Number(puzzleHpDamage.index);
    if (!Number.isInteger(index) || index < 0 || index >= puzzle.width * puzzle.height) return null;
    const x = index % puzzle.width;
    const y = Math.floor(index / puzzle.width);
    return (
      <span
        key={puzzleHpDamage.id}
        className="puzzleHpCellFx"
        style={{
          left: `${x * cellSize}px`,
          top: `${y * cellSize}px`,
          width: `${cellSize}px`,
          height: `${cellSize}px`,
        }}
        aria-hidden="true"
      />
    );
  };
  const renderPuzzleHintCellFx = () => {
    if (!isHpPuzzleMode || !puzzle || !puzzleHintReveal) return null;
    const index = Number(puzzleHintReveal.index);
    if (!Number.isInteger(index) || index < 0 || index >= puzzle.width * puzzle.height) return null;
    const x = index % puzzle.width;
    const y = Math.floor(index / puzzle.width);
    return (
      <span
        key={puzzleHintReveal.id}
        className="puzzleHintCellFx"
        style={{
          left: `${x * cellSize}px`,
          top: `${y * cellSize}px`,
          width: `${cellSize}px`,
          height: `${cellSize}px`,
        }}
        aria-hidden="true"
      />
    );
  };
  const renderLineClearFx = () => {
    if (!puzzle || !lineClearFx) return null;
    const rowItems = Array.isArray(lineClearFx.rows) ? lineClearFx.rows : [];
    const colItems = Array.isArray(lineClearFx.cols) ? lineClearFx.cols : [];
    if (!rowItems.length && !colItems.length) return null;
    return (
      <>
        {rowItems.map((row) => (
          <span
            key={`line-clear-row-${lineClearFx.id}-${row}`}
            className="lineClearFx row"
            style={{
              left: 0,
              top: `${row * cellSize}px`,
              width: `${puzzle.width * cellSize}px`,
              height: `${cellSize}px`,
            }}
            aria-hidden="true"
          />
        ))}
        {colItems.map((col) => (
          <span
            key={`line-clear-col-${lineClearFx.id}-${col}`}
            className="lineClearFx col"
            style={{
              left: `${col * cellSize}px`,
              top: 0,
              width: `${cellSize}px`,
              height: `${puzzle.height * cellSize}px`,
            }}
            aria-hidden="true"
          />
        ))}
      </>
    );
  };
  const renderCellInputFx = () => {
    if (!puzzle || cellInputFxList.length === 0) return null;
    return (
      <>
        {cellInputFxList.map((fx) => {
          const index = Number(fx.index);
          if (!Number.isInteger(index) || index < 0 || index >= puzzle.width * puzzle.height) return null;
          const x = index % puzzle.width;
          const y = Math.floor(index / puzzle.width);
          return (
            <span
              key={fx.id}
              className={`cellInputFx ${fx.value === 1 ? "fill" : fx.value === 2 ? "mark" : "erase"}`}
              style={{
                left: `${x * cellSize}px`,
                top: `${y * cellSize}px`,
                width: `${cellSize}px`,
                height: `${cellSize}px`,
              }}
              aria-hidden="true"
            />
          );
        })}
      </>
    );
  };
  const renderBoardTopToolbar = () => {
    if (!shouldShowPuzzleBoard || isModeCreate) return null;
    const hintButtonLabel =
      puzzleHints > 0
        ? L(`힌트 ${puzzleHints}`, `${puzzleHints} hints`)
        : hintAdLoading
          ? L("광고", "Ad")
          : canRequestRewardAd
            ? L("광고 힌트", "Ad hint")
            : L("광고 준비 중", "Ad unavailable");
    const hintButtonDisabled =
      !canUsePuzzleHint ||
      hintAdLoading ||
      (puzzleHints <= 0 && !canRequestRewardAd) ||
      (puzzleHints > 0 && !Array.isArray(puzzleSolutionCells));
    return (
      <div className="boardControlLayer">
        {isHpPuzzleMode && (
          <div
            className={`puzzleHpMeter ${puzzleHpDamage ? "damage" : ""}`}
            aria-label={L(`남은 HP ${puzzleHp}/${PUZZLE_MAX_HP}`, `HP ${puzzleHp}/${PUZZLE_MAX_HP}`)}
          >
            {Array.from({ length: PUZZLE_MAX_HP }).map((_, index) => {
              const active = index < puzzleHp;
              const lost = Boolean(puzzleHpDamage && index === puzzleHpDamage.hpAfter);
              return (
                <span
                  key={`${index}-${lost ? puzzleHpDamage.id : "steady"}`}
                  className={`puzzleHpHeart ${active ? "active" : "empty"} ${lost ? "lost" : ""}`}
                  aria-hidden="true"
                >
                  {active ? "♥" : "♡"}
                </span>
              );
            })}
          </div>
        )}
        <div className="boardTopToolbar" role="toolbar" aria-label={L("퍼즐 도구", "Puzzle tools")}>
          <div className={`boardModeGroup ${mobilePaintMode === "mark" ? "markActive" : "fillActive"}`} role="group" aria-label={L("입력 모드", "Input mode")}>
            <button
              type="button"
              className={`boardModeBtn mark ${mobilePaintMode === "mark" ? "active" : ""}`}
              onClick={() => {
                setMobilePaintMode("mark");
                playSfx("ui");
              }}
              aria-label={L("X 표시 모드", "Mark X mode")}
              title={L("X 표시", "Mark X")}
            >
              <X size={18} />
            </button>
            <button
              type="button"
              className={`boardModeBtn fill ${mobilePaintMode === "fill" ? "active" : ""}`}
              onClick={() => {
                setMobilePaintMode("fill");
                playSfx("ui");
              }}
              aria-label={L("색칠 모드", "Fill mode")}
              title={L("색칠", "Fill")}
            >
              <Square size={18} fill="currentColor" />
            </button>
          </div>
          {isHpPuzzleMode && (
            <div className="boardHintGroup" role="group" aria-label={L("힌트", "Hints")}>
              <button
                type="button"
                className={`boardHintBtn ${puzzleHints <= 0 ? "ad" : ""}`}
                onClick={puzzleHints > 0 ? revealPuzzleHintCell : handleHintAd}
                disabled={hintButtonDisabled}
                aria-label={hintButtonLabel}
                title={hintButtonLabel}
              >
                <Lightbulb size={17} />
                <span>{hintAdLoading ? "..." : puzzleHints > 0 ? puzzleHints : canRequestRewardAd ? "AD" : "-"}</span>
              </button>
            </div>
          )}
          <div className="boardActionGroup" role="group" aria-label={L("편집 도구", "Edit tools")}>
            <button
              type="button"
              className="boardToolIconBtn"
              onClick={undo}
              disabled={!canUndo || !canInteractBoard}
              aria-label={L("되돌리기", "Undo")}
              title={L("되돌리기", "Undo")}
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              className="boardToolIconBtn"
              onClick={redo}
              disabled={!canRedo || !canInteractBoard}
              aria-label={L("다시하기", "Redo")}
              title={L("다시하기", "Redo")}
            >
              <Redo2 size={18} />
            </button>
            <button
              type="button"
              className="boardToolIconBtn danger"
              onClick={resetGrid}
              disabled={!canResetBoard}
              aria-label={L("초기화", "Clear")}
              title={L("초기화", "Clear")}
            >
              <Eraser size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className={`page ${IS_APPS_IN_TOSS ? "appsInToss" : ""} ${isExcelMode ? "excelSkin" : ""} ${isModeCreate ? "pageCreateMode" : ""}`} style={excelMainStyle}>
      <div className="bgGlow bgGlowA" />
      <div className="bgGlow bgGlowB" />
      {missionToast && (
        <div
          key={missionToast.key}
          className={`appsMissionToast ${missionToast.leveledUp ? "levelUp" : ""}`}
          style={{
            "--xp-from": `${missionToast.fromPercent}%`,
            "--xp-to": `${missionToast.gaugeToPercent}%`,
          }}
        >
          <Trophy size={17} />
          <div className="appsMissionToastCopy">
            <span className="appsMissionToastTop">
              <strong>{missionToast.leveledUp ? L(`레벨 ${missionToast.level} 달성`, `Level ${missionToast.level}`) : missionToast.title}</strong>
              <em>+{missionToast.xpGained} XP</em>
            </span>
            <span className="appsMissionToastGauge" aria-hidden="true">
              <i />
            </span>
            <span className="appsMissionToastMeta">
              {missionToast.leveledUp
                ? L(`Lv.${missionToast.fromLevel} → Lv.${missionToast.level}`, `Lv.${missionToast.fromLevel} → Lv.${missionToast.level}`)
                : L(`Lv.${missionToast.level} · ${missionToast.currentXp}/${missionToast.nextXp} XP`, `Lv.${missionToast.level} · ${missionToast.currentXp}/${missionToast.nextXp} XP`)}
            </span>
          </div>
        </div>
      )}
      {missionRewardFx?.leveledUp && (
        <div key={`level-fx-${missionRewardFx.key}`} className="appsLevelUpFx" aria-hidden="true">
          <span className="appsLevelUpRing primary" />
          <span className="appsLevelUpRing secondary" />
          <div className="appsLevelUpParticles">
            {Array.from({ length: 12 }).map((_, index) => (
              <i
                key={`level-particle-${index}`}
                style={{
                  "--particle-angle": `${index * 30}deg`,
                  "--particle-delay": `${(index % 4) * 70}ms`,
                }}
              />
            ))}
          </div>
          <div className="appsLevelUpCard">
            <Trophy size={26} />
            <span>{L("레벨업", "LEVEL UP")}</span>
            <strong>Lv.{missionRewardFx.level}</strong>
          </div>
        </div>
      )}
      {showMissionSheet && (
        <div className="appsMissionSheetBackdrop" role="presentation" onClick={closeMissionSheet}>
          <motion.div
            className="appsMissionSheet"
            role="dialog"
            aria-modal="true"
            aria-label={L("미션", "Missions")}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="appsMissionSheetHandle" aria-hidden="true" />
            <div className="appsMissionSheetTop">
              <div>
                <span>{L("미션", "Missions")}</span>
                <strong>Lv.{missionLevelInfo.level}</strong>
              </div>
              <button type="button" onClick={closeMissionSheet}>{L("닫기", "Close")}</button>
            </div>
            {renderMissionPanel()}
          </motion.div>
        </div>
      )}
      {showExitConfirmModal && (
        <div className="modalBackdrop appsExitConfirmBackdrop" role="presentation" onClick={() => setShowExitConfirmModal(false)}>
          <div
            className="modalCard appsExitConfirmCard"
            role="dialog"
            aria-modal="true"
            aria-label={L("미니앱 종료 확인", "Exit app confirmation")}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{L("앱을 종료할까요?", "Exit this app?")}</h2>
            <p>{L("진행 중인 퍼즐은 저장 가능한 상태로 보관됩니다.", "Your current puzzle progress will be kept when possible.")}</p>
            <div className="modalActions appsExitConfirmActions">
              <button type="button" onClick={() => setShowExitConfirmModal(false)}>
                {L("계속하기", "Stay")}
              </button>
              <button type="button" onClick={confirmMiniAppExit}>
                {L("종료하기", "Exit")}
              </button>
            </div>
          </div>
        </div>
      )}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={`panel ${isModeMenu || isModeAuth ? "panelMenu" : ""} ${shouldShowPuzzleBoard && !isInRaceRoom ? "panelPuzzleFixed" : ""} ${isModeCreate ? "panelCreateMode" : ""} ${lang === "en" ? "langEn" : "langKo"}`}
      >
        <div className="topBar">
          <button type="button" className="brandWrap" onClick={backToMenu}>
            <div className="logoPixel" aria-hidden="true" />
            <h1 className="title">{brandTitle}</h1>
          </button>
          {!isModeAuth && (
            <div className="topAuth">
              {isLoggedIn ? (
                <>
                  <button type="button" className="userChip userChipBtn" onClick={openOwnProfile}>
                    <ProfileAvatar avatarKey={authUser?.profile_avatar_key} nickname={authUser?.nickname} size="sm" />
                    <span className="userChipText">
                      <strong>{authUser.nickname}</strong>
                      <span>R {Number.isFinite(Number(authUser?.rating)) ? Number(authUser.rating) : 0}</span>
                    </span>
                  </button>
                  <button onClick={logout}>{L("로그아웃", "Logout")}</button>
                </>
              ) : IS_APPS_IN_TOSS ? (
                <button
                  type="button"
                  className="userChip userChipBtn"
                  onClick={() => loginWithTossGame("menu")}
                  disabled={tossLoginLoading}
                >
                  <User size={15} />
                  {tossLoginLoading ? L("연결 중", "Connecting") : L("토스 로그인", "Toss Login")}
                </button>
              ) : (
                <>
                  <span className="guestIcon" aria-hidden="true">
                    <User size={18} />
                    <ChevronDown size={16} />
                  </span>
                  <button className="ghostBtn" onClick={() => openAuthScreen("login", "menu")}>
                    <LogIn size={15} /> Login
                  </button>
                  <button className="primaryBtn" onClick={() => openAuthScreen("signup", "menu")}>
                    <UserPlus size={15} /> Sign Up
                  </button>
                </>
              )}
              {IS_APPS_IN_TOSS && (
                <>
                  <button
                    type="button"
                    className={`appSoundToggleBtn ${soundEnabled ? "on" : "off"}`}
                    onClick={toggleSoundEnabled}
                    aria-label={soundEnabled ? L("사운드 끄기", "Turn sound off") : L("사운드 켜기", "Turn sound on")}
                    title={soundEnabled ? L("사운드 끄기", "Turn sound off") : L("사운드 켜기", "Turn sound on")}
                  >
                    {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                  <button
                    type="button"
                    className="appExitBtn"
                    onClick={requestMiniAppExit}
                    aria-label={L("앱 종료", "Exit app")}
                    title={L("앱 종료", "Exit app")}
                  >
                    <X size={19} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {isExcelMode && (
          <div className="excelSheetFrame" aria-hidden="true">
            <div className="excelSheetCols">
              {excelSheetCols.map((col) => (
                <span key={`sheet-col-${col}`}>{col}</span>
              ))}
            </div>
            <div className="excelSheetRows">
              {excelSheetRows.map((row) => (
                <span key={`sheet-row-${row}`}>{row}</span>
              ))}
            </div>
          </div>
        )}

        {isModeMenu && (
          <section className="menuStage">
            {!IS_APPS_IN_TOSS && (
            <div className="menuTopMeta">
              <div className="menuTopTabs" role="tablist" aria-label={L("상단 메뉴", "Top menu")}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeMenuTopTab === "start"}
                  className={`menuTopTab ${activeMenuTopTab === "start" ? "active" : ""}`}
                  onClick={() => setActiveMenuTopTab((prev) => (prev === "start" ? "" : "start"))}
                >
                  {L("시작하기", "Start here")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeMenuTopTab === "guide"}
                  className={`menuTopTab ${activeMenuTopTab === "guide" ? "active" : ""}`}
                  onClick={() => setActiveMenuTopTab((prev) => (prev === "guide" ? "" : "guide"))}
                >
                  {L("가이드", "Guides")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeMenuTopTab === "community"}
                  className={`menuTopTab ${activeMenuTopTab === "community" ? "active" : ""}`}
                  onClick={() => setActiveMenuTopTab((prev) => (prev === "community" ? "" : "community"))}
                >
                  {L("참여", "Community")}
                </button>
              </div>

              {activeMenuTopTab ? (
                <motion.div
                  key={activeMenuTopTab}
                  className="menuTopPanel"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {activeMenuTopTab === "start" && (
                    <div className="menuTopPanelGrid">
                      <button type="button" className="menuTopLinkRow" onClick={startTutorialMode}>
                        <span className="menuTopLinkCopy">
                          <strong>{L("튜토리얼", "Tutorial")}</strong>
                          <span>{L("조작과 규칙을 먼저 익히는 입문 화면", "Learn controls and rules first.")}</span>
                        </span>
                      </button>
                      <a className="menuTopLinkRow" href={howToPlayPageLink.href}>
                        <span className="menuTopLinkCopy">
                          <strong>{lang === "ko" ? howToPlayPageLink.labelKo : howToPlayPageLink.labelEn}</strong>
                          <span>{L("규칙과 기본 풀이 흐름 정리", "Read the rules and solving basics.")}</span>
                        </span>
                      </a>
                      <a className="menuTopLinkRow" href={faqPageLink.href}>
                        <span className="menuTopLinkCopy">
                          <strong>{lang === "ko" ? faqPageLink.labelKo : faqPageLink.labelEn}</strong>
                          <span>{L("자주 묻는 질문과 이용 팁 확인", "Check common questions and quick tips.")}</span>
                        </span>
                      </a>
                    </div>
                  )}

                  {activeMenuTopTab === "guide" && (
                    <div className="menuTopPanelGrid">
                      {[aboutPageLink, pvpGuidePageLink, rankingGuidePageLink].map((link) => (
                        <a key={link.href} className="menuTopLinkRow" href={link.href}>
                          <span className="menuTopLinkCopy">
                            <strong>{lang === "ko" ? link.labelKo : link.labelEn}</strong>
                            <span>
                              {link.href === aboutPageLink.href
                                ? L("사이트 구조와 모드 차이를 한눈에 정리", "See the full site structure and mode overview.")
                                : link.href === pvpGuidePageLink.href
                                  ? L("등급전 규칙과 매칭 흐름 확인", "Read ranked rules and matchmaking flow.")
                                  : L("랭킹과 명예의 전당 기록 체계 확인", "Understand rankings and hall records.")}
                            </span>
                          </span>
                        </a>
                      ))}
                    </div>
                  )}

                  {activeMenuTopTab === "community" && (
                    <div className="menuTopPanelGrid">
                      {!IS_APPS_IN_TOSS && (
                        <button type="button" className="menuTopLinkRow" onClick={goCreateMode}>
                          <span className="menuTopLinkCopy">
                            <strong>{L("퍼즐 만들기", "Create Puzzle")}</strong>
                            <span>{L("직접 만든 퍼즐을 테스트하고 제출", "Build, test, and submit your own board.")}</span>
                          </span>
                        </button>
                      )}
                      {!IS_APPS_IN_TOSS && (
                        <a
                          className="menuTopLinkRow"
                          href="https://discord.gg/42Mqmy9Ka"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="menuTopLinkCopy">
                            <strong>{L("디스코드", "Discord")}</strong>
                            <span>{L("공지, 피드백, 커뮤니티 소식을 확인", "Join the server for updates and feedback.")}</span>
                          </span>
                        </a>
                      )}
                      <a className="menuTopLinkRow" href={updatesPageLink.href}>
                        <span className="menuTopLinkCopy">
                          <strong>{lang === "ko" ? updatesPageLink.labelKo : updatesPageLink.labelEn}</strong>
                          <span>{L("패치 노트와 최근 변경 사항 모아보기", "Browse patch notes and recent changes.")}</span>
                        </span>
                      </a>
                    </div>
                  )}
                </motion.div>
              ) : null}
            </div>
            )}

            {IS_APPS_IN_TOSS ? (
              <div className="appsMiniMenu appsModeMenu">
                <div className="appsMiniSubActions appsMiniTopActions">
                  <button type="button" className="appsMiniTutorialBtn appsMiniMissionBtn" onClick={openMissionSheet}>
                    <Trophy size={16} />
                    <span>{L("미션", "Missions")}</span>
                    <strong>{dailyMissionDoneCount}/{dailyMissionItems.length}</strong>
                  </button>
                  <button type="button" className="appsMiniTutorialBtn" onClick={startTutorialMode} data-tutorial="menu-tutorial">
                    <BookOpen size={16} />
                    <span>{L("튜토리얼", "Tutorial")}</span>
                  </button>
                </div>
                <div className="modeChooser appsModeChooser">
                  <motion.button
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    className="modeBtn modeSingle"
                    onClick={goSingleMode}
                    data-tutorial="menu-single"
                  >
                    <span className="modeName">혼자 풀기</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    className={`modeBtn modeDaily ${isDailyPuzzleSolvedToday ? "solved" : ""}`}
                    onClick={goDailyMode}
                    data-tutorial="menu-daily"
                  >
                    <span className="modeTag">{isDailyPuzzleSolvedToday ? "완료" : "미완료"}</span>
                    <span className="modeName">일일퀴즈</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    className="modeBtn modePvp"
                    onClick={goPvpMode}
                  >
                    {pvpModeTagText && <span className="modeTag">{pvpModeTagText}</span>}
                    <span className="modeName">배틀</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    className="modeBtn modeRank"
                    onClick={goRankingMode}
                  >
                    <span className="modeName">랭킹</span>
                  </motion.button>
                </div>
              </div>
            ) : (
            <div className="modeChooser">
              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                className="modeBtn modeSingle"
                onClick={goSingleMode}
                data-tutorial="menu-single"
              >
                <span className="modeName">SINGLE PLAYER</span>
              </motion.button>
              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                className="modeBtn modeMulti"
                onClick={goMultiMode}
                data-tutorial="menu-multi"
              >
                {!isLoggedIn && <span className="modeTag">{modeTagText}</span>}
                <span className="modeName">MULTI PLAYER</span>
              </motion.button>
              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                className="modeBtn modePvp"
                onClick={goPvpMode}
              >
                {pvpModeTagText && <span className="modeTag">{pvpModeTagText}</span>}
                <span className="modeName">PVP MATCH</span>
              </motion.button>
              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                className="modeBtn modeRank"
                onClick={goRankingMode}
              >
                <span className="modeName">RANKING</span>
              </motion.button>
            </div>
            )}

            {!IS_APPS_IN_TOSS && (
              <div className="menuAdfitSection">
                <div className="menuAdfitShell" />
              </div>
            )}

            <div className="menuDust menuDustA" />
            <div className="menuDust menuDustB" />
            <div className="menuDust menuDustC" />
          </section>
        )}

        {isModeAuth && (
          <div className="authScreen">
            <div className="authTabs">
              <button
                className={authTab === "login" ? "active" : ""}
                onClick={() => {
                  setAuthTab("login");
                  setLoginError("");
                  setLoginFieldErrors({ username: "", password: "" });
                  setSignupPolicyModal("");
                }}
              >
                {L("로그인", "Login")}
              </button>
              <button
                className={authTab === "signup" ? "active" : ""}
                onClick={() => {
                  setAuthTab("signup");
                  setSignupError("");
                  setSignupFieldErrors({ username: "", nickname: "", password: "", terms: "", privacy: "" });
                }}
              >
                {L("회원가입", "Sign Up")}
              </button>
              <button onClick={backToMenu}>{L("메인으로", "Home")}</button>
            </div>

            {authTab === "login" && (
              <form
                className="authCard"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isLoading || !loginUsername.trim() || !loginPassword) return;
                  login();
                }}
              >
                <label>
                  {L("아이디", "Username")}
                  <input
                    type="text"
                    className={loginFieldErrors.username ? "fieldError" : ""}
                    value={loginUsername}
                    onChange={(e) => {
                      setLoginUsername(e.target.value);
                      setLoginFieldErrors((prev) => ({ ...prev, username: "" }));
                      if (loginError) setLoginError("");
                    }}
                    placeholder={L("아이디", "Username")}
                  />
                  {loginFieldErrors.username && <span className="fieldErrorText">{loginFieldErrors.username}</span>}
                </label>
                <label>
                  {L("비밀번호", "Password")}
                  <input
                    type="password"
                    className={loginFieldErrors.password ? "fieldError" : ""}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginFieldErrors((prev) => ({ ...prev, password: "" }));
                      if (loginError) setLoginError("");
                    }}
                    placeholder={L("비밀번호", "Password")}
                  />
                  {loginFieldErrors.password && <span className="fieldErrorText">{loginFieldErrors.password}</span>}
                </label>
                {loginError && <div className="modalError">{loginError}</div>}
                <div className="modalActions">
                  <button type="button" onClick={backToMenu}>{L("취소", "Cancel")}</button>
                  <button type="submit" disabled={isLoading || !loginUsername.trim() || !loginPassword}>
                    {isLoading ? L("로그인 중...", "Logging in...") : L("로그인", "Login")}
                  </button>
                </div>
              </form>
            )}

            {authTab === "signup" && (
              <div className="authCard">
                <label>
                  {L("아이디", "Username")}
                  <input
                    type="text"
                    className={signupFieldErrors.username ? "fieldError" : ""}
                    value={signupUsername}
                    onChange={(e) => {
                      setSignupUsername(e.target.value);
                      setSignupFieldErrors((prev) => ({ ...prev, username: "" }));
                      if (signupError) setSignupError("");
                    }}
                    placeholder={L("아이디(3~24자)", "Username (3-24 chars)")}
                  />
                  {signupFieldErrors.username && (
                    <span className="fieldErrorText">{signupFieldErrors.username}</span>
                  )}
                </label>
                <label>
                  {L("닉네임", "Nickname")}
                  <input
                    type="text"
                    className={signupFieldErrors.nickname ? "fieldError" : ""}
                    value={signupNickname}
                    onChange={(e) => {
                      setSignupNickname(e.target.value);
                      setSignupFieldErrors((prev) => ({ ...prev, nickname: "" }));
                      if (signupError) setSignupError("");
                    }}
                    placeholder={L("닉네임", "Nickname")}
                  />
                  {signupFieldErrors.nickname && (
                    <span className="fieldErrorText">{signupFieldErrors.nickname}</span>
                  )}
                </label>
                <label>
                  {L("비밀번호", "Password")}
                  <input
                    type="password"
                    className={signupFieldErrors.password ? "fieldError" : ""}
                    value={signupPassword}
                    onChange={(e) => {
                      setSignupPassword(e.target.value);
                      setSignupFieldErrors((prev) => ({ ...prev, password: "" }));
                      if (signupError) setSignupError("");
                    }}
                    placeholder={L("영문+숫자 포함 8자 이상", "At least 8 chars with letters and numbers")}
                  />
                  {signupFieldErrors.password && (
                    <span className="fieldErrorText">{signupFieldErrors.password}</span>
                  )}
                </label>
                <div className="signupAgreements">
                  <label className={`agreementRow ${signupFieldErrors.terms ? "error" : ""}`}>
                    <input
                      type="checkbox"
                      checked={signupAgreeTerms}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSignupAgreeTerms(checked);
                        setSignupFieldErrors((prev) => ({ ...prev, terms: "" }));
                        if (signupError && checked && signupAgreePrivacy) setSignupError("");
                      }}
                    />
                    <span>{L("[필수] 이용약관 동의", "[Required] Agree to Terms of Service")}</span>
                    <button
                      type="button"
                      className="agreementLinkBtn"
                      onClick={() => setSignupPolicyModal("terms")}
                    >
                      {L("보기", "View")}
                    </button>
                  </label>
                  {signupFieldErrors.terms && <span className="fieldErrorText">{signupFieldErrors.terms}</span>}

                  <label className={`agreementRow ${signupFieldErrors.privacy ? "error" : ""}`}>
                    <input
                      type="checkbox"
                      checked={signupAgreePrivacy}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSignupAgreePrivacy(checked);
                        setSignupFieldErrors((prev) => ({ ...prev, privacy: "" }));
                        if (signupError && checked && signupAgreeTerms) setSignupError("");
                      }}
                    />
                    <span>{L("[필수] 개인정보처리방침 동의", "[Required] Agree to Privacy Policy")}</span>
                    <button
                      type="button"
                      className="agreementLinkBtn"
                      onClick={() => setSignupPolicyModal("privacy")}
                    >
                      {L("보기", "View")}
                    </button>
                  </label>
                  {signupFieldErrors.privacy && <span className="fieldErrorText">{signupFieldErrors.privacy}</span>}
                </div>
                {signupError && <div className="modalError">{signupError}</div>}
                <div className="modalActions">
                  <button onClick={backToMenu}>{L("취소", "Cancel")}</button>
                  <button
                    onClick={signup}
                    disabled={
                      isLoading ||
                      !signupUsername.trim() ||
                      !signupNickname.trim() ||
                      !signupPassword ||
                      !signupAgreeTerms ||
                      !signupAgreePrivacy
                    }
                  >
                    {isLoading ? L("가입 중...", "Signing up...") : L("회원가입", "Sign Up")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isModeAuth && signupPolicyModal && (
          <div className="modalBackdrop" onClick={() => setSignupPolicyModal("")}>
            <div className="modalCard policyModal" onClick={(e) => e.stopPropagation()}>
              <h2>
                {signupPolicyModal === "terms"
                  ? L("이용약관", "Terms of Service")
                  : L("개인정보처리방침", "Privacy Policy")}
              </h2>
              <div className="policyBody">
                {signupPolicyModal === "terms" ? (
                  <>
                    <h3>{L("1. 서비스 이용", "1. Service Use")}</h3>
                    <p>
                      {L(
                        "본 서비스는 노노그램 게임 이용을 위한 서비스이며, 관련 법령과 운영 정책을 준수해야 합니다.",
                        "This service provides nonogram gameplay and must be used in compliance with laws and service rules."
                      )}
                    </p>
                    <h3>{L("2. 계정", "2. Account")}</h3>
                    <p>
                      {L(
                        "회원은 본인 계정 정보를 안전하게 관리해야 하며, 타인 명의 도용이나 비정상 이용은 제한될 수 있습니다.",
                        "Users must keep account credentials secure. Impersonation or abusive use may be restricted."
                      )}
                    </p>
                    <h3>{L("3. 제재", "3. Restrictions")}</h3>
                    <p>
                      {L(
                        "서비스 운영을 방해하거나 치팅, 욕설, 불법 행위가 확인될 경우 이용이 제한될 수 있습니다.",
                        "Use may be limited for cheating, abuse, illegal actions, or disruption of service operations."
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <h3>{L("1. 수집 항목", "1. Data Collected")}</h3>
                    <p>
                      {L(
                        "회원가입 시 아이디, 닉네임, 비밀번호(해시 처리)를 수집하며, 경기 기록이 저장될 수 있습니다.",
                        "At sign-up, username, nickname, and hashed password are collected. Match records may be stored."
                      )}
                    </p>
                    <h3>{L("2. 이용 목적", "2. Purpose of Use")}</h3>
                    <p>
                      {L(
                        "회원 인증, 멀티플레이 매칭, 랭킹 제공, 서비스 안정화 및 부정 이용 방지 목적으로 이용됩니다.",
                        "Data is used for authentication, multiplayer matchmaking, ranking, service stability, and abuse prevention."
                      )}
                    </p>
                    <h3>{L("3. 보관 및 보호", "3. Retention & Security")}</h3>
                    <p>
                      {L(
                        "관련 법령 또는 서비스 운영에 필요한 기간 동안 보관하며, 안전한 방식으로 보호합니다.",
                        "Data is retained as required by law or service operation and protected with appropriate safeguards."
                      )}
                    </p>
                  </>
                )}
              </div>
              <div className="modalActions">
                <button onClick={() => setSignupPolicyModal("")}>{L("닫기", "Close")}</button>
              </div>
            </div>
          </div>
        )}

        {(isModeRanking || isModeLegacyRanking) && (
          <section className="rankingScreen">
            <div className="rankingTopBar">
              <div className="rankingTitleBlock">
                <div className="rankingTitle">
                  <Trophy size={18} /> {isModeLegacyRanking ? L("이전 레이팅 랭킹", "Legacy Rating Ranking") : L("PvP 랭킹", "PvP Ranking")}
                </div>
                {isLoggedIn && (
                  <div className="rankingMeBadge">
                    <span>
                      {myRatingRank
                        ? isModeLegacyRanking
                          ? L(
                              `내 순위 ${myRatingRank}등${ratingTotalUsers > 0 ? ` / ${ratingTotalUsers}` : ""}`,
                              `My Rank #${myRatingRank}${ratingTotalUsers > 0 ? ` / ${ratingTotalUsers}` : ""}`
                            )
                          : L(
                              `내 순위 ${myRatingRank}등${ratingTotalUsers > 0 ? ` / ${ratingTotalUsers}` : ""} · ${myTierInfo?.labelKo || "브론즈"}`,
                              `My Rank #${myRatingRank}${ratingTotalUsers > 0 ? ` / ${ratingTotalUsers}` : ""} · ${myTierInfo?.labelEn || "Bronze"}`
                            )
                        : L("내 순위: 집계 중", "My Rank: calculating")}
                    </span>
                    <strong className="rankingLevelMini">{profileLevelLabel}</strong>
                  </div>
                )}
              </div>
              <div className="rankingActions">
                <button
                  className="singleActionBtn"
                  onClick={() => void fetchRatingUsers(isModeLegacyRanking ? "legacy" : "current")}
                  disabled={ratingLoading}
                >
                  {ratingLoading ? L("불러오는 중...", "LOADING...") : L("새로고침", "REFRESH")}
                </button>
                {!IS_APPS_IN_TOSS && (
                  <button className="singleSfxBtn replayOpenBtn" onClick={goReplayHallMode} disabled={replayLoading}>
                    {replayLoading ? L("로딩 중...", "Loading...") : L("명예의 전당", "HALL OF FAME")}
                  </button>
                )}
                <button className="singleHomeBtn" onClick={backToMenu}>
                  {L("홈", "HOME")}
                </button>
              </div>
            </div>
            <div className="rankingTableWrap">
              <table className="rankingTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{L("닉네임", "Nickname")}</th>
                    <th>{L("레벨", "Level")}</th>
                    <th>{L("티어", "Tier")}</th>
                    <th>{isModeLegacyRanking ? L("레이팅", "Rating") : L("점수", "Score")}</th>
                    {isModeLegacyRanking && <th>{L("전적", "Record")}</th>}
                    {isModeLegacyRanking && <th>{L("승률", "Win Rate")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {ratingUsers.length === 0 ? (
                    <tr>
                      <td colSpan={isModeLegacyRanking ? 7 : 5} className="rankingEmpty">
                        {ratingLoading ? L("불러오는 중...", "Loading...") : L("표시할 유저가 없습니다.", "No users to display.")}
                      </td>
                    </tr>
                  ) : (
                    ratingUsers.map((u, idx) => {
                      const games = Number(u.rating_games || 0);
                      const wins = Number(u.rating_wins || 0);
                      const losses = Number(u.rating_losses || 0);
                      const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;
                      const tierInfo = isModeLegacyRanking
                        ? getTierInfoByRating(u.rating, idx + 1)
                        : getRankingTierInfoByRating(u.rating, idx + 1);
                      const isMeRow = isLoggedIn && Number(u.id) > 0 && Number(u.id) === Number(authUser?.id || 0);
                      const rawUserLevel = Number(u.mission_level || u.level || 0);
                      const rowLevel = Number.isFinite(rawUserLevel) && rawUserLevel > 0
                        ? Math.round(rawUserLevel)
                        : isMeRow
                          ? missionLevelInfo.level
                          : 0;
                      return (
                        <tr key={u.id} className={isMeRow ? "me" : ""}>
                          <td>{idx + 1}</td>
                          <td>{u.nickname}</td>
                          <td>
                            {rowLevel > 0 ? (
                              <span className={`rankingLevelBadge ${isMeRow ? "me" : ""}`}>Lv.{rowLevel}</span>
                            ) : (
                              <span className="rankingLevelMuted">-</span>
                            )}
                          </td>
                          <td>
                            <span className={`tierBadge tier-${tierInfo.key}`}>
                              {lang === "ko" ? tierInfo.labelKo : tierInfo.labelEn}
                            </span>
                          </td>
                          <td className="ratingScore">{Number.isFinite(Number(u?.rating)) ? Number(u.rating) : 0}</td>
                          {isModeLegacyRanking && (
                            <td>
                              {wins}W {losses}L ({games})
                            </td>
                          )}
                          {isModeLegacyRanking && <td>{winRate}%</td>}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {isModeReplayHall && (
          <section className="hallScreen">
            <div className="hallHero">
              <div className="hallHeroGlint" />
              <div className="hallHeroTop">
                <div className="hallHeroTag">HALL OF FAME</div>
              </div>
              <h2>{L("사이즈별 최고 기록", "Best Records By Size")}</h2>
              <p>
                {L(
                  "각 퍼즐 유형의 TOP 3 기록만 집계됩니다.",
                  "Only Top 3 records are tracked for each puzzle size."
                )}
              </p>
            </div>

            {replayError && <div className="replayError hallError">{replayError}</div>}

            <div className="hallActions">
              <button className="singleActionBtn" onClick={fetchBestReplayRecords} disabled={replayLoading}>
                {replayLoading ? L("새로고침 중...", "Refreshing...") : L("기록 새로고침", "Refresh Records")}
              </button>
              <button className="singleSfxBtn" onClick={goRankingMode}>
                {L("랭킹으로", "Go Ranking")}
              </button>
              <button className="singleHomeBtn" onClick={backToMenu}>
                {L("홈", "HOME")}
              </button>
            </div>

            <div className="hallTabs" role="tablist" aria-label={L("퍼즐 유형 탭", "Puzzle size tabs")}>
              {hallSizes.map((size) => (
                <button
                  key={`hall-tab-${size.sizeKey}`}
                  className={`hallTab ${hallActiveSizeKey === size.sizeKey ? "active" : ""}`}
                  onClick={() => setHallActiveSizeKey(size.sizeKey)}
                  role="tab"
                  aria-selected={hallActiveSizeKey === size.sizeKey}
                >
                  <span>{size.sizeKey}</span>
                  <small>TOP {Math.min(3, size.records.length)}</small>
                </button>
              ))}
            </div>

            <div className="hallTableWrap">
              <table className="hallTable">
                <thead>
                  <tr>
                    <th>{L("순위", "Rank")}</th>
                    <th>{L("플레이어 이름", "Player")}</th>
                    <th>{L("풀이 시간", "Solve Time")}</th>
                    <th>{L("해결 날짜", "Date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {hallActiveRecords.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="hallTableEmpty">
                        {replayLoading
                          ? L("불러오는 중...", "Loading...")
                          : L("이 유형에는 아직 기록이 없습니다.", "No records for this size yet.")}
                      </td>
                    </tr>
                ) : (
                  hallActiveRecords.map((record, idx) => {
                    const rank = Number(record.rank || idx + 1);
                    const medalClass = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "plain";
                    return (
                        <tr key={`hall-row-${record.recordId}`} className="hallTableRow">
                          <td className="hallRankCell">
                            <span className={`hallMedal ${medalClass}`}>{formatRankLabel(rank)}</span>
                          </td>
                          <td>{record.nickname || "-"}</td>
                          <td>{formatHallElapsedMs(record.elapsedMs, record.elapsedSec)}</td>
                          <td>{formatKstDate(record.finishedAtMs)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {hallStreakTop.length > 0 && (
              <div className="hallStreakWrap">
                <div className="hallStreakTitle">{L("최대 연승 TOP 3", "Best Win Streak TOP 3")}</div>
                <table className="hallStreakTable">
                  <thead>
                    <tr>
                      <th>{L("순위", "Rank")}</th>
                      <th>{L("플레이어 이름", "Player")}</th>
                      <th>{L("최대 연승", "Best Streak")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hallStreakTop.map((row, idx) => {
                      const rank = Number(row.rank || idx + 1);
                      const medalClass = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "plain";
                      return (
                        <tr key={`hall-streak-${row.userId || idx}`}>
                          <td className="hallRankCell">
                            <span className={`hallMedal ${medalClass}`}>{formatRankLabel(rank)}</span>
                          </td>
                          <td>{row.nickname || "-"}</td>
                          <td className="hallStreakValue">{Number(row.winStreakBest)} {L("연승", "wins")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {isModeSingle && (
          <div
            className={`controls singleTopControls ${
              IS_APPS_IN_TOSS && !isInRaceRoom && !isCustomPreviewPuzzle && !shouldShowPuzzleBoard && singleSection !== "home"
                ? "appsSingleNavControls"
                : ""
            }`}
            data-tutorial="single-controls"
          >
            {!isInRaceRoom && (
              isCustomPreviewPuzzle ? (
                <button className="singleActionBtn" onClick={backToCreateMode}>
                  {L("제작기로 돌아가기", "BACK TO CREATE")}
                </button>
              ) : shouldShowPuzzleBoard && singleSection === "official" ? (
                <>
                  <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} disabled={isLoading}>
                    {SINGLE_SIZE_KEYS.map((sizeKey) => (
                      <option key={`top-size-${sizeKey}`} value={sizeKey}>{sizeKey}</option>
                    ))}
                  </select>
                  <button className="singleActionBtn" onClick={loadRandomBySize} disabled={isLoading}>
                    {isLoading ? L("불러오는 중...", "Loading...") : L("퍼즐 바꾸기", "Change Puzzle")}
                  </button>
                </>
              ) : singleSection !== "home" ? (
                <button className="singleSfxBtn" onClick={() => goSingleSection("home")}>
                  {IS_APPS_IN_TOSS ? (
                    <>
                      <ArrowLeft size={15} />
                      <span>{L("퍼즐 홈", "Puzzle Home")}</span>
                    </>
                  ) : (
                    L("싱글 홈", "SINGLE HOME")
                  )}
                </button>
              ) : (
                <>
                  <span className="singleModeBadge">{L("싱글 플레이", "Single Play")}</span>
                </>
              )
            )}
            <button className="singleHomeBtn" onClick={backToMenu} disabled={isInRaceRoom}>
              {IS_APPS_IN_TOSS ? (
                <>
                  <Home size={15} />
                  <span>{L("메인", "Main")}</span>
                </>
              ) : (
                L("홈", "HOME")
              )}
            </button>
          </div>
        )}

        {isModeSingle && !isInRaceRoom && !isCustomPreviewPuzzle && !shouldShowPuzzleBoard && singleSection === "home" && (
          IS_APPS_IN_TOSS ? (
          <section className="singleMenuHub appsSingleHub appsSingleHubV2 appsSingleChoiceHub">
            <button type="button" className="appsSinglePuzzleCard theme" onClick={() => goSingleSection("custom")}>
              <span className="appsSinglePuzzleIcon"><Palette size={30} /></span>
              <span className="appsSinglePuzzleCopy">
                <small>{L("스몰 테마", "Small themes")}</small>
                <strong>{L("테마퍼즐", "Theme Puzzle")}</strong>
                <em>{L(`${themeSolvedCount}/${visibleCreatorSamples.length} 완료`, `${themeSolvedCount}/${visibleCreatorSamples.length} cleared`)}</em>
              </span>
            </button>

            <button type="button" className="appsSinglePuzzleCard battle" onClick={() => goSingleSection("official")}>
              <span className="appsSinglePuzzleIcon"><Flame size={30} /></span>
              <span className="appsSinglePuzzleCopy">
                <small>{L("혼자 연습", "Solo practice")}</small>
                <strong>{L("배틀 퍼즐", "Battle Puzzle")}</strong>
                <em>5x5 · 10x10 · 15x15</em>
              </span>
            </button>
          </section>
          ) : (
          <section className="singleMenuHub">
            <div className="singleMenuGrid">
              <button type="button" className="singleMenuCard official" onClick={() => goSingleSection("official")}>
                <span className="singleMenuCardTitle">{L("공식 퍼즐", "Official")}</span>
              </button>

              <button type="button" className="singleMenuCard custom" onClick={() => goSingleSection("custom")}>
                <span className="singleMenuCardTitle">{L("테마 퍼즐", "Theme Puzzles")}</span>
              </button>

              <button type="button" className="singleMenuCard community" onClick={() => goSingleSection("community")}>
                <span className="singleMenuCardTitle">{L("유저 퍼즐", "User Puzzles")}</span>
              </button>

              <button type="button" className="singleMenuCard create" onClick={goCreateMode}>
                <span className="singleMenuCardTitle">{L("퍼즐 만들기", "Create Puzzle")}</span>
              </button>

              {isCreatorAdminUser && (
                <button type="button" className="singleMenuCard admin" onClick={() => goSingleSection("admin")}>
                  <span className="singleMenuCardEyebrow">{L("관리 전용", "Admin")}</span>
                  <span className="singleMenuCardTitle">{L("관리자 검수", "Admin Review")}</span>
                </button>
              )}
            </div>
          </section>
          )
        )}

        {IS_APPS_IN_TOSS && isModeSingle && !isInRaceRoom && !isCustomPreviewPuzzle && !shouldShowPuzzleBoard && singleSection === "daily" && (
          <section className="singleMenuHub appsSingleHub appsSingleHubV2 appsDailyPage">
            {renderDailyPanel()}
          </section>
        )}

        {isModeSingle && !isInRaceRoom && !isCustomPreviewPuzzle && !shouldShowPuzzleBoard && singleSection === "official" && (
          <section className="singleSourcePanel">
            <div className="singleSourceHeader">
              <div>
                <div className="singleSourceTitle">{IS_APPS_IN_TOSS ? L("배틀 퍼즐", "Battle Puzzle") : L("공식 퍼즐", "Official")}</div>
              </div>
            </div>
            <div className="singleSourceBody">
              <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)}>
                {SINGLE_SIZE_KEYS.map((sizeKey) => (
                  <option key={`official-size-${sizeKey}`} value={sizeKey}>{sizeKey}</option>
                ))}
              </select>
              <button className="singleActionBtn" onClick={loadRandomBySize} disabled={isLoading}>
                {isLoading
                  ? L("불러오는 중...", "Loading...")
                  : IS_APPS_IN_TOSS
                    ? L("배틀 퍼즐 불러오기", "Load Battle Puzzle")
                    : L("랜덤 불러오기", "Load Random")}
              </button>
            </div>
          </section>
        )}

        {isModeSingle && !isInRaceRoom && !isCustomPreviewPuzzle && !shouldShowPuzzleBoard && singleSection === "custom" && (
          <section className="singleSourcePanel singleCustomSourcePanel">
            <div className="singleSourceHeader">
              <div>
                <div className="singleSourceTitle">{L("테마 퍼즐", "Theme Puzzles")}</div>
              </div>
              <span className="singleSourceCount">{visibleCreatorSampleCount}</span>
            </div>

            {!IS_APPS_IN_TOSS && (
              <div className="singleGroupTabs">
                {displayedCustomGroupKeys.map((groupKey) => {
                  const label = lang === "ko" ? CREATOR_GROUP_LABELS[groupKey]?.ko || groupKey : CREATOR_GROUP_LABELS[groupKey]?.en || groupKey;
                  const count = creatorSamples.filter((sample) => sample.sizeGroup === groupKey).length;
                  return (
                    <button
                      key={`custom-tab-${groupKey}`}
                      type="button"
                      className={`singleGroupTab ${activeCustomSizeGroup === groupKey ? "active" : ""}`}
                      onClick={() => {
                        setCustomSizeGroup(groupKey);
                        setCustomThemeCategory("all");
                      }}
                    >
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="themeProgressPanel">
              <div className="themeProgressHeader">
                <span>{L("테마 진행률", "Theme Progress")}</span>
                <strong>{themeSolvedCount}/{visibleCreatorSamples.length}</strong>
              </div>
              <div className="themeProgressTrack" aria-hidden="true">
                <span style={{ width: `${themeProgressPercent}%` }} />
              </div>
              <div className="themeProgressMeta">
                <span>{L("풀어둔 테마가 여기 쌓입니다.", "Solved themes stack up here.")}</span>
                <em>{themeProgressPercent}%</em>
              </div>
            </div>

            <div className="themeCategoryTabs" role="tablist" aria-label={L("테마 카테고리", "Theme categories")}>
              {themeCategoryStats.map((category) => (
                <button
                  key={`theme-category-${category.key}`}
                  type="button"
                  role="tab"
                  aria-selected={activeThemeCategoryKey === category.key}
                  className={`themeCategoryTab ${activeThemeCategoryKey === category.key ? "active" : ""}`}
                  onClick={() => setCustomThemeCategory(category.key)}
                >
                  <span>{category.label}</span>
                  <strong>{category.solvedCount}/{category.count}</strong>
                </button>
              ))}
            </div>

            <div className="singleCustomSections">
              {(() => {
                const groupSamples = visibleThemeSamples;
                if (!groupSamples.length) {
                  return (
                    <div className="singleCommunityEmpty">
                      {L("이 카테고리에는 아직 퍼즐이 없습니다.", "There are no puzzles in this category yet.")}
                    </div>
                  );
                }
                return (
                  <section className="createSampleSection singleSelectedGroupSection">
                    <div className="createSampleSectionTitle">
                      <span>{activeThemeCategoryStat?.label || L("전체", "All")}</span>
                      <span className="createSampleSectionCount">{activeThemeCategoryStat?.count || groupSamples.length}</span>
                    </div>
                    <div className="createSamplesGrid singleCustomGrid">
                      {groupSamples.map((sample) => {
                        const isThemeSolved = sample.isSolved === true;
                        const previewPalette = getSolvedPaintPalette(sample);
                        return (
                          <div key={`single-${sample.id}`} className="createSampleCard singleSampleCard singleSampleCardLarge">
                            <button
                              type="button"
                              className="createSampleLoadBtn singleCustomListBtn singleCustomListBtnLarge"
                              onClick={() => loadSingleCustomSample(sample)}
                            >
                              <div
                                className={`createSamplePreview singleCustomThumbPreview singleCustomThumbPreviewLarge ${isThemeSolved ? "solved" : "locked"}`}
                                style={{
                                  gridTemplateColumns: `repeat(${sample.width}, 1fr)`,
                                  gridTemplateRows: `repeat(${sample.height}, 1fr)`,
                                }}
                              >
                                {isThemeSolved ? (
                                  sample.cells.map((value, idx) => (
                                    <span
                                      key={`single-preview-${sample.id}-${idx}`}
                                      className={`createSamplePixel ${value === 1 ? "filled" : ""}`}
                                      style={getSolvedPreviewPixelStyle(sample, idx, value, previewPalette)}
                                    />
                                  ))
                                ) : (
                                  <span className="themePreviewLock" aria-hidden="true">
                                    <Lock size={22} />
                                  </span>
                                )}
                              </div>
                              <div className="createSampleMeta singleCustomMetaLarge">
                                <div className="createSampleLabel">{lang === "ko" ? sample.titleKo : sample.titleEn}</div>
                                <div className="createSampleSize">
                                  {sample.width}x{sample.height}
                                  {!isThemeSolved && <span>{L("미리보기 잠김", "Preview locked")}</span>}
                                </div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}
            </div>
          </section>
        )}

        {isModeSingle && !isInRaceRoom && !isCustomPreviewPuzzle && !shouldShowPuzzleBoard && singleSection === "community" && (
          <section className="singleSourcePanel singleCommunityPanel">
            <div className="singleSourceHeader">
              <div>
                <div className="singleSourceTitle">{L("유저 퍼즐", "User Puzzles")}</div>
              </div>
              <div className="singleSourceHeaderActions">
                <span className="singleSourceCount">{visibleCommunityPuzzleCount}</span>
              </div>
            </div>

            <div className="singleGroupTabs">
              {displayedCommunityGroupKeys.map((groupKey) => {
                const label = lang === "ko" ? CREATOR_GROUP_LABELS[groupKey]?.ko || groupKey : CREATOR_GROUP_LABELS[groupKey]?.en || groupKey;
                const count = communityPuzzles.filter((sample) => sample.sizeGroup === groupKey).length;
                return (
                  <button
                    key={`community-tab-${groupKey}`}
                    type="button"
                    className={`singleGroupTab ${activeCommunitySizeGroup === groupKey ? "active" : ""}`}
                    onClick={() => setCommunitySizeGroup(groupKey)}
                  >
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>

            {!visibleCommunityPuzzles.length ? (
              <div className="singleCommunityEmpty">
                {communityLoading
                  ? L("유저 퍼즐을 불러오는 중입니다...", "Loading user puzzles...")
                  : L("아직 앱용 유저 퍼즐이 없습니다.", "There are no app-sized user puzzles yet.")}
              </div>
            ) : (
              <div className="communityHub">
                <div className="communityBrowserPanel">
                  {(() => {
                    const groupPuzzles = visibleCommunityPuzzles;
                    if (!groupPuzzles.length) {
                      return (
                        <div className="singleCommunityEmpty">
                          {L("이 사이즈에는 아직 유저 퍼즐이 없습니다.", "There are no user puzzles in this size yet.")}
                        </div>
                      );
                    }
                    const groupLabel =
                      lang === "ko"
                        ? groupPuzzles[0].groupTitleKo || CREATOR_GROUP_LABELS[activeCommunitySizeGroup]?.ko || activeCommunitySizeGroup
                        : groupPuzzles[0].groupTitleEn || CREATOR_GROUP_LABELS[activeCommunitySizeGroup]?.en || activeCommunitySizeGroup;
                    return (
                      <section className="communityGroupSection communitySelectedGroupSection">
                        <div className="communityGroupTitle">
                          <span>{groupLabel}</span>
                          <span className="createSampleSectionCount">{groupPuzzles.length}</span>
                        </div>
                        <div className="communityGroupList communityGroupListLarge">
                          {groupPuzzles.map((sample) => {
                            const isSelected = communitySelectedId === sample.id;
                            const previewPalette = getSolvedPaintPalette(sample);
                            return (
                              <button
                                key={`community-${sample.id}`}
                                type="button"
                                className={`communityListCard communityListCardLarge ${isSelected ? "selected" : ""}`}
                                onClick={() => setCommunitySelectedId(sample.id)}
                              >
                                <div
                                  className="createSamplePreview communitySamplePreview communityListPreview communityListPreviewLarge"
                                  style={{
                                    gridTemplateColumns: `repeat(${sample.width}, 1fr)`,
                                    gridTemplateRows: `repeat(${sample.height}, 1fr)`,
                                  }}
                                >
                                  {sample.cells.map((value, idx) => (
                                    <span
                                      key={`community-${sample.id}-${idx}`}
                                      className={`createSamplePixel ${value === 1 ? "filled" : ""}`}
                                      style={getSolvedPreviewPixelStyle(sample, idx, value, previewPalette)}
                                    />
                                  ))}
                                </div>
                                <div className="communityListCardBody communityListCardBodyLarge">
                                  <div className="createSampleLabel">{lang === "ko" ? sample.titleKo : sample.titleEn}</div>
                                  <div className="createSampleSize">{sample.width}x{sample.height}</div>
                                  <div className="communitySampleMetaRow">
                                    <span>{sample.createdByNickname || L("익명", "Anonymous")}</span>
                                    <span>{L(`댓글 ${sample.commentCount || 0}`, `${sample.commentCount || 0} comments`)}</span>
                                    <span>{L(`반응 ${getCommunityReactionTotal(sample)}`, `${getCommunityReactionTotal(sample)} reactions`)}</span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })()}
                </div>

                <div className="communityDetailColumn">
                  {communityDiscussion ? (
                    <section className="communityDiscussionPanel">
                      <div className="communityDetailHero">
                        <div
                          className="createSamplePreview communitySamplePreview communityDetailPreview"
                          style={{
                            gridTemplateColumns: `repeat(${communityDiscussion.width}, 1fr)`,
                            gridTemplateRows: `repeat(${communityDiscussion.height}, 1fr)`,
                          }}
                        >
                          {(() => {
                            const previewPalette = getSolvedPaintPalette(communityDiscussion);
                            return communityDiscussion.cells.map((value, idx) => (
                              <span
                                key={`community-detail-${communityDiscussion.id}-${idx}`}
                                className={`createSamplePixel ${value === 1 ? "filled" : ""}`}
                                style={getSolvedPreviewPixelStyle(communityDiscussion, idx, value, previewPalette)}
                              />
                            ));
                          })()}
                        </div>

                        <div className="communityDetailInfo">
                          <div className="singleSourceTitle">
                            {lang === "ko" ? communityDiscussion.titleKo : communityDiscussion.titleEn}
                          </div>
                          <div className="communityDetailMetaRow">
                            <span className="communityMetaChip">{communityDiscussion.width}x{communityDiscussion.height}</span>
                            <span className="communityMetaChip">
                              {L("제작자", "Creator")}: {communityDiscussion.createdByNickname || L("익명", "Anonymous")}
                            </span>
                            <span className="communityMetaChip">
                              {L(`댓글 ${(communityDiscussion.comments || []).length}`, `${(communityDiscussion.comments || []).length} comments`)}
                            </span>
                            <span className="communityMetaChip">
                              {L(`반응 ${getCommunityReactionTotal(communityDiscussion)}`, `${getCommunityReactionTotal(communityDiscussion)} reactions`)}
                            </span>
                          </div>
                          <button className="singleActionBtn communityPlayBtn" onClick={() => loadCommunityPuzzle(communityDiscussion)}>
                            {L("퍼즐 풀기", "Play")}
                          </button>
                        </div>
                      </div>

                      <div className="communityReactionRow">
                        {CREATOR_REACTION_OPTIONS.map((reaction) => {
                          const count = Number(communityDiscussion.reactionCounts?.[reaction.key] || 0);
                          const active = communityDiscussion.viewerReaction === reaction.key;
                          return (
                            <button
                              key={reaction.key}
                              type="button"
                              className={`communityReactionBtn ${active ? "active" : ""}`}
                              onClick={() => submitCommunityReaction(reaction.key)}
                              disabled={communityReactionSending}
                            >
                              <span>{reaction.emoji}</span>
                              <span>{lang === "ko" ? reaction.labelKo : reaction.labelEn}</span>
                              <strong>{count}</strong>
                            </button>
                          );
                        })}
                      </div>

                      <div className="communityCommentComposer">
                        <textarea
                          value={communityCommentInput}
                          onChange={(e) => setCommunityCommentInput(e.target.value)}
                          placeholder={L("퍼즐을 풀어본 느낌이나 힌트를 남겨보세요.", "Leave a comment or a hint for this puzzle.")}
                          maxLength={500}
                        />
                        <button className="singleActionBtn" onClick={submitCommunityComment} disabled={communityCommentSending}>
                          {communityCommentSending ? L("등록 중...", "Posting...") : L("댓글 남기기", "Comment")}
                        </button>
                      </div>

                      <div className="communityCommentsList">
                        {(communityDiscussion.comments || []).length ? (
                          communityDiscussion.comments.map((comment) => (
                            <article key={`community-comment-${comment.id}`} className="communityCommentItem">
                              <div className="communityCommentHead">
                                <strong>{comment.nickname}</strong>
                                <span>{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ""}</span>
                              </div>
                              <p>{comment.body}</p>
                            </article>
                          ))
                        ) : (
                          <div className="singleCommunityEmpty">
                            {L("아직 댓글이 없습니다.", "No comments yet.")}
                          </div>
                        )}
                      </div>
                    </section>
                  ) : (
                    <div className="singleCommunityEmpty">
                      {L("왼쪽 목록에서 퍼즐을 하나 선택해보세요.", "Pick a puzzle from the list on the left.")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {isModeSingle && !isInRaceRoom && !isCustomPreviewPuzzle && !shouldShowPuzzleBoard && isCreatorAdminUser && singleSection === "admin" && (
          <section className="singleSourcePanel singleAdminPanel">
            <div className="singleSourceHeader">
              <div>
                <div className="singleSourceTitle">{L("관리자 검수", "Admin Review")}</div>
                <div className="singleSourceSubtitle">
                  {L("자동 검증을 통과한 제출 퍼즐을 승인하거나 반려합니다.", "Approve or reject submitted puzzles after automatic validation.")}
                </div>
              </div>
            </div>
            <div className="adminCreatorControls">
              <input
                type="password"
                value={adminCreatorKey}
                onChange={(e) => setAdminCreatorKey(e.target.value)}
                placeholder={L("관리자 키 입력", "Enter admin key")}
              />
              <button className="singleActionBtn" onClick={() => loadAdminCreatorPuzzles()} disabled={adminCreatorLoading}>
                {adminCreatorLoading ? L("불러오는 중...", "Loading...") : L("검수 목록 불러오기", "Load List")}
              </button>
            </div>
            <div className="adminCreatorList">
              {adminCreatorPuzzles.length ? (
                adminCreatorPuzzles.map((puzzleItem) => {
                  const previewPalette = getSolvedPaintPalette(puzzleItem);
                  return (
                    <article key={`admin-creator-${puzzleItem.id}`} className="adminCreatorCard">
                      <div className="adminCreatorCardBody">
                        <div
                          className="createSamplePreview adminCreatorPreview"
                          style={{
                            gridTemplateColumns: `repeat(${puzzleItem.width}, 1fr)`,
                            gridTemplateRows: `repeat(${puzzleItem.height}, 1fr)`,
                          }}
                        >
                          {(Array.isArray(puzzleItem.rows) ? puzzleItem.rows : []).flatMap((row, rowIndex) =>
                            Array.from(String(row || "")).map((cell, colIndex) => {
                              const cellIndex = rowIndex * Number(puzzleItem.width || 1) + colIndex;
                              return (
                                <span
                                  key={`admin-preview-${puzzleItem.id}-${rowIndex}-${colIndex}`}
                                  className={`createSamplePixel ${cell === "#" ? "filled" : ""}`}
                                  style={getSolvedPreviewPixelStyle(puzzleItem, cellIndex, cell, previewPalette)}
                                />
                              );
                            })
                          )}
                        </div>

                        <div className="adminCreatorCardContent">
                          <div className="adminCreatorCardTop">
                            <div>
                              <strong>{lang === "ko" ? puzzleItem.titleKo : puzzleItem.titleEn}</strong>
                              <div className="adminCreatorMeta">
                                <span>{puzzleItem.width}x{puzzleItem.height}</span>
                                <span>{puzzleItem.createdByNickname || L("익명", "Anonymous")}</span>
                                <span>{puzzleItem.approvalStatus}</span>
                              </div>
                            </div>
                            <div className="adminCreatorActions">
                              <button className="singleActionBtn" onClick={() => reviewCreatorPuzzle(puzzleItem.id, "approve")}>
                                {L("승인", "Approve")}
                              </button>
                              <button className="singleActionBtn danger" onClick={() => reviewCreatorPuzzle(puzzleItem.id, "reject")}>
                                {L("반려", "Reject")}
                              </button>
                            </div>
                          </div>

                          <div className="adminCreatorValidation">
                            <span className={puzzleItem.unique ? "ok" : "bad"}>{L("유일해", "Unique")}: {puzzleItem.unique ? "OK" : "NO"}</span>
                            <span className={!puzzleItem.needsGuess ? "ok" : "bad"}>{L("귀류법", "Guessing")}: {puzzleItem.needsGuess ? "Yes" : "No"}</span>
                            <span>{L("해답 수", "Solutions")}: {puzzleItem.validationSolutionCount}</span>
                            <span>{L("논리 풀이", "Logical solve")}: {puzzleItem.validationLogicalSolved ? "OK" : "NO"}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="singleCommunityEmpty">
                  {L("검수할 퍼즐이 없습니다. 관리자 키를 입력하고 불러오기를 눌러주세요.", "There are no submissions to review yet. Enter the admin key and load the list.")}
                </div>
              )}
            </div>
          </section>
        )}

        {isModeCreate && (
          <section className="createPuzzleScreen">
            {creatorMyPuzzlesOpen && (
              <section className="creatorSubmissionsScreen">
                <div className="controls singleTopControls createTopControls createSubmissionsTopControls">
                  <div className="createSubmissionsTitleWrap">
                    <div className="singleSourceTitle">{L("내 제출 퍼즐", "My Submitted Puzzles")}</div>
                    <div className="singleSourceSubtitle">
                      {L("승인 대기 상태와 검증 결과를 여기서 확인할 수 있습니다.", "You can check approval status and validation results here.")}
                    </div>
                  </div>
                  <button className="singleSfxBtn" onClick={() => setCreatorMyPuzzlesOpen(false)}>
                    {L("퍼즐 만들기로", "Back to Creator")}
                  </button>
                  <button className="singleActionBtn" onClick={() => loadMyCreatorPuzzles()} disabled={creatorMyPuzzlesLoading}>
                    {creatorMyPuzzlesLoading ? L("불러오는 중...", "Loading...") : L("새로고침", "Refresh")}
                  </button>
                  <button className="singleHomeBtn" onClick={backToMenu}>
                    {L("홈", "HOME")}
                  </button>
                </div>

                <div className="creatorSubmissionsList creatorSubmissionsListLarge">
                  {!isLoggedIn ? (
                    <div className="singleCommunityEmpty">
                      {L("로그인 후 제출 목록을 확인할 수 있습니다.", "Log in to view your submissions.")}
                    </div>
                  ) : creatorMyPuzzles.length ? (
                    creatorMyPuzzles.map((item) => {
                      const approvalStatus = String(item.approvalStatus || "pending");
                      const previewPalette = getSolvedPaintPalette(item);
                      const approvalLabel =
                        approvalStatus === "approved"
                          ? L("승인됨", "Approved")
                          : approvalStatus === "rejected"
                            ? L("반려됨", "Rejected")
                            : L("승인 대기", "Pending");
                      const approvalClass =
                        approvalStatus === "approved"
                          ? "approved"
                          : approvalStatus === "rejected"
                            ? "rejected"
                            : "pending";
                      return (
                        <article key={`creator-mine-${item.id}`} className="creatorSubmissionCard creatorSubmissionCardLarge">
                          <div
                            className="createSamplePreview creatorSubmissionPreviewLarge"
                            style={{
                              gridTemplateColumns: `repeat(${item.width}, 1fr)`,
                              gridTemplateRows: `repeat(${item.height}, 1fr)`,
                            }}
                          >
                            {(Array.isArray(item.rows) ? item.rows : []).flatMap((row, rowIndex) =>
                              Array.from(String(row || "")).map((cell, colIndex) => {
                                const cellIndex = rowIndex * Number(item.width || 1) + colIndex;
                                return (
                                  <span
                                    key={`creator-mine-preview-${item.id}-${rowIndex}-${colIndex}`}
                                    className={`createSamplePixel ${cell === "#" ? "filled" : ""}`}
                                    style={getSolvedPreviewPixelStyle(item, cellIndex, cell, previewPalette)}
                                  />
                                );
                              })
                            )}
                          </div>
                          <div className="creatorSubmissionTop">
                            <div>
                              <strong>{lang === "ko" ? item.titleKo : item.titleEn}</strong>
                              <div className="creatorSubmissionMeta">
                                <span>{item.width}x{item.height}</span>
                                <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</span>
                              </div>
                            </div>
                            <span className={`creatorSubmissionStatus ${approvalClass}`}>{approvalLabel}</span>
                          </div>
                          {item.approvalNote ? (
                            <div className="creatorSubmissionNote">
                              {L("메모", "Note")}: {item.approvalNote}
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  ) : (
                    <div className="singleCommunityEmpty">
                      {L("아직 제출한 퍼즐이 없습니다.", "You have not submitted any puzzles yet.")}
                    </div>
                  )}
                </div>
              </section>
            )}

            {!creatorMyPuzzlesOpen && (
            <div className="controls singleTopControls createTopControls">
              <label className="createTitleField">
                <span>{L("퍼즐 이름", "Puzzle Title")}</span>
                <input
                  type="text"
                  maxLength={60}
                  value={creatorTitleInput}
                  onChange={(e) => setCreatorTitleInput(e.target.value)}
                />
              </label>
              <div className="createSizeInputs">
                <label className="createSizeField">
                  <span>{L("가로", "Width")}</span>
                  <input
                    type="number"
                    min="5"
                    max={CREATOR_MAX_SIZE}
                    value={creatorWidthInput}
                    onChange={(e) => setCreatorWidthInput(e.target.value)}
                  />
                </label>
                <label className="createSizeField">
                  <span>{L("세로", "Height")}</span>
                  <input
                    type="number"
                    min="5"
                    max={CREATOR_MAX_SIZE}
                    value={creatorHeightInput}
                    onChange={(e) => setCreatorHeightInput(e.target.value)}
                  />
                </label>
              </div>
              <div className="createValidationNote">
                {L(
                  "제출후 검증을 거쳐, 실제로 풀 수 있는 퍼즐만 등록됩니다.",
                  "After submission, only puzzles that pass validation and can actually be solved will be listed."
                )}
              </div>
              <button className="singleSfxBtn" onClick={generateCreatorCanvas}>
                {L("생성", "Create")}
              </button>
              <button className="singleActionBtn" onClick={saveCreatorPuzzle} disabled={creatorSaving || !puzzle}>
                {creatorSaving ? L("제출 중...", "Submitting...") : L("제출", "Submit")}
              </button>
              <button
                className="singleSfxBtn"
                onClick={() => {
                  if (!isLoggedIn) {
                    setStatus(L("로그인 후 제출 목록을 볼 수 있습니다.", "Please log in to view your submissions."));
                    return;
                  }
                  setCreatorMyPuzzlesOpen(true);
                  void loadMyCreatorPuzzles();
                }}
              >
                {L("내 제출 퍼즐", "My Submissions")}
              </button>
              <button className="singleActionBtn" onClick={startCreatorSingleTest} disabled={!puzzle}>
                {L("싱글 테스트", "Test Play")}
              </button>
              <button className="singleHomeBtn" onClick={backToMenu}>
                {L("홈", "HOME")}
              </button>
            </div>
            )}

            {!creatorMyPuzzlesOpen && !puzzle && (
              <div className="createBlankState">
                <div className="createBlankArt" aria-hidden="true" />
                <div className="createBlankText">
                  <strong>{L("새 퍼즐 캔버스를 만들어 시작하세요.", "Create a puzzle canvas to start.")}</strong>
                  <span>{L("가로와 세로를 정한 뒤 생성하면 바로 그릴 수 있습니다.", "Set the width and height, then create the board.")}</span>
                </div>
              </div>
            )}

            {!creatorMyPuzzlesOpen && puzzle && (
              <div className="createEditorToolbar">
                <div className="createIconGroup">
                  <button type="button" className="createIconBtn" onClick={undo} disabled={!canUndo} aria-label={L("되돌리기", "Undo")} title={L("되돌리기", "Undo")}>
                    <Undo2 size={18} />
                  </button>
                  <button type="button" className="createIconBtn" onClick={redo} disabled={!canRedo} aria-label={L("다시하기", "Redo")} title={L("다시하기", "Redo")}>
                    <Redo2 size={18} />
                  </button>
                </div>
                <div className="createIconGroup">
                  <button type="button" className="createIconBtn" onClick={() => shiftCreatorCanvas(0, -1)} aria-label={L("위로 1칸", "Move Up")} title={L("위로 1칸", "Move Up")}>
                    <ArrowUp size={18} />
                  </button>
                  <button type="button" className="createIconBtn" onClick={() => shiftCreatorCanvas(0, 1)} aria-label={L("아래로 1칸", "Move Down")} title={L("아래로 1칸", "Move Down")}>
                    <ArrowDown size={18} />
                  </button>
                  <button type="button" className="createIconBtn" onClick={() => shiftCreatorCanvas(-1, 0)} aria-label={L("왼쪽으로 1칸", "Move Left")} title={L("왼쪽으로 1칸", "Move Left")}>
                    <ArrowLeft size={18} />
                  </button>
                  <button type="button" className="createIconBtn" onClick={() => shiftCreatorCanvas(1, 0)} aria-label={L("오른쪽으로 1칸", "Move Right")} title={L("오른쪽으로 1칸", "Move Right")}>
                    <ArrowRight size={18} />
                  </button>
                </div>
                <button type="button" className="singleSfxBtn" onClick={resetGrid}>
                  {L("전체 지우기", "Clear")}
                </button>
              </div>
            )}
          </section>
        )}

        {isModeTutorial && renderTutorialLessons()}

        {isModePvp && (
          <>
            {!isInRaceRoom && (
              <section className="pvpQueuePanel">
                <div className="pvpQueueTitle">{L("배틀", "Battle")}</div>
                <div className="pvpQueueDescRow">
                  <div className="pvpQueueDesc">
                    {L(
                      "5x5·10x10·15x15 중 하나가 뽑히고, 같은 퍼즐을 먼저 완성하면 승리합니다.",
                      "One of 5x5, 10x10, or 15x15 is picked. Finish the same puzzle first to win."
                    )}
                  </div>
                  {!IS_APPS_IN_TOSS && (
                    <button
                      type="button"
                      className="pvpTierGuideTrigger"
                      onClick={() => setShowPvpTierGuideModal(true)}
                      aria-label={L("티어 안내 보기", "Open tier guide")}
                      title={L("티어 안내", "Tier guide")}
                    >
                      <span className="pvpTierGuideTriggerGlyph">i</span>
                    </button>
                  )}
                </div>
                <div className="pvpQueueState">
                  {pvpServerState === "matching" && pvpMatchState === "accept" && L("수락 확인 단계", "Acceptance check")}
                  {pvpServerState === "matching" && pvpMatchState === "reveal" && L("퍼즐 추첨 중", "Picking puzzle")}
                  {pvpServerState === "matching" && !pvpMatchState && L("상대 탐색 중", "Searching opponent")}
                  {pvpServerState === "waiting" && L(`매칭 중... 대기열 ${pvpQueueSize}명`, `Matching... queue ${pvpQueueSize}`)}
                  {pvpServerState === "cancelled" && L("매칭 취소됨", "Match cancelled")}
                  {pvpServerState === "idle" && L("대기 중", "Idle")}
                </div>

                {pvpSearching && pvpFlowStepIndex >= 0 && (
                  <div className="pvpFlowSteps" aria-label={L("배틀 시작 단계", "Battle start flow")}>
                    {[L("탐색", "Search"), L("수락", "Accept"), L("상대", "Opponent"), L("퍼즐", "Puzzle")].map((label, idx) => (
                      <span
                        key={`pvp-flow-${idx}`}
                        className={`${idx < pvpFlowStepIndex ? "done" : ""} ${idx === pvpFlowStepIndex ? "active" : ""}`}
                      >
                        <i>{idx + 1}</i>
                        <b>{label}</b>
                      </span>
                    ))}
                  </div>
                )}

                {isPvpShowdownActive && (
                  <div className="pvpShowdownCard">
                    <div className="pvpShowdownKicker">{L("상대 매칭 완료", "Opponent Found")}</div>
                    <div className="pvpShowdownDuel">
                      {pvpShowdownPlayers.slice(0, 1).map((player, idx) => {
                        const playerTier = getTierInfoByRating(player?.rating, player?.ratingRank);
                        const playerRank =
                          Number.isInteger(Number(player?.ratingRank)) && Number(player.ratingRank) > 0
                            ? Number(player.ratingRank)
                            : null;
                        return (
                          <div key={`showdown-${player?.userId || idx}`} className="pvpShowdownPlayer left">
                            <ProfileAvatar
                              avatarKey={player?.profileAvatarKey || DEFAULT_PROFILE_AVATAR_KEY}
                              nickname={player?.nickname}
                              size="lg"
                            />
                            <span className="pvpShowdownName">{player?.nickname || "Player A"}</span>
                            <span className="pvpShowdownStat">
                              {Number.isFinite(Number(player?.rating)) ? `R ${Math.round(Number(player.rating))}` : "R -"}
                            </span>
                            <span className="pvpShowdownStat">{lang === "ko" ? playerTier.labelKo : playerTier.labelEn}</span>
                            <span className="pvpShowdownStat">
                              {playerRank ? L(`${playerRank}등`, `Rank #${playerRank}`) : L("랭킹 집계 중", "Ranking soon")}
                            </span>
                          </div>
                        );
                      })}
                      <div className="pvpShowdownVs"><span>VS</span></div>
                      {pvpShowdownPlayers.slice(1, 2).map((player, idx) => {
                        const playerTier = getTierInfoByRating(player?.rating, player?.ratingRank);
                        const playerRank =
                          Number.isInteger(Number(player?.ratingRank)) && Number(player.ratingRank) > 0
                            ? Number(player.ratingRank)
                            : null;
                        return (
                          <div key={`showdown-${player?.userId || idx + 1}`} className="pvpShowdownPlayer right">
                            <ProfileAvatar
                              avatarKey={player?.profileAvatarKey || DEFAULT_PROFILE_AVATAR_KEY}
                              nickname={player?.nickname}
                              size="lg"
                            />
                            <span className="pvpShowdownName">{player?.nickname || "Player B"}</span>
                            <span className="pvpShowdownStat">
                              {Number.isFinite(Number(player?.rating)) ? `R ${Math.round(Number(player.rating))}` : "R -"}
                            </span>
                            <span className="pvpShowdownStat">{lang === "ko" ? playerTier.labelKo : playerTier.labelEn}</span>
                            <span className="pvpShowdownStat">
                              {playerRank ? L(`${playerRank}등`, `Rank #${playerRank}`) : L("랭킹 집계 중", "Ranking soon")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!isPvpShowdownActive && pvpMatchState === "accept" && (
                  <div className="pvpStageCard pvpAppStage pvpAcceptStage">
                    <div className="pvpAppStageHead">
                      <span>{L("매치 발견", "MATCH FOUND")}</span>
                      <strong>{L("배틀 입장 확인", "Confirm Battle Entry")}</strong>
                      <p>{L("둘 다 수락하면 상대 공개 후 퍼즐을 뽑습니다.", "When both players accept, opponent reveal and puzzle draw begin.")}</p>
                    </div>
                    <div className="pvpAcceptLayout">
                      <div className="pvpCountdownDial" style={{ "--pvp-accept-left": `${pvpAcceptPercent}%` }}>
                        <span>{pvpAcceptLeftSec}</span>
                        <small>{L("초", "sec")}</small>
                      </div>
                      <div className="pvpAcceptPlayers">
                        {(pvpMatch?.players || []).map((p) => {
                          const isMe = Number(p.userId) > 0 && Number(p.userId) === Number(authUser?.id || 0);
                          const tier = getTierInfoByRating(p.rating, p.ratingRank);
                          return (
                            <div key={p.userId} className={`pvpAcceptPlayer ${p.accepted ? "accepted" : ""} ${isMe ? "me" : ""}`}>
                              <ProfileAvatar
                                avatarKey={p.profileAvatarKey || DEFAULT_PROFILE_AVATAR_KEY}
                                nickname={p.nickname}
                                size="sm"
                              />
                              <span>
                                <strong>{p.nickname}</strong>
                                <em>{Number.isFinite(Number(p.rating)) ? `R ${Math.round(Number(p.rating))}` : "R -"} · {lang === "ko" ? tier.labelKo : tier.labelEn}</em>
                              </span>
                              <b>{p.accepted ? L("준비 완료", "Ready") : L("대기", "Waiting")}</b>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      className="pvpAcceptButton"
                      onClick={acceptPvpMatch}
                      disabled={pvpAcceptBusy || pvpMatch?.me?.accepted === true}
                    >
                      {pvpMatch?.me?.accepted ? L("수락 완료", "Ready") : pvpAcceptBusy ? L("처리중...", "Processing...") : L("수락하고 시작", "Accept and Start")}
                    </button>
                  </div>
                )}

                {!isPvpShowdownActive && pvpMatchState === "reveal" && (
                  <div className="pvpStageCard pvpAppStage pvpRevealStage">
                    <div className="pvpAppStageHead">
                      <span>{L("퍼즐 추첨", "PUZZLE DRAW")}</span>
                      <strong>{L("이번 판 크기를 뽑는 중", "Picking this battle size")}</strong>
                      <p>{L("같은 퍼즐로 동시에 시작합니다.", "Both players start on the same puzzle.")}</p>
                    </div>
                    <div
                      className={`pvpRevealTrack pvpAppRevealTrack count-${Math.max(1, pvpDisplayOptions.length)}`}
                      style={{ "--pvp-option-count": Math.max(1, pvpDisplayOptions.length) }}
                    >
                      {pvpDisplayOptions.map((option, idx) => {
                        const sizeKey = option.sizeKey || `${option.width}x${option.height}`;
                        const isActive = idx === pvpRevealIndex;
                        const isChosen = !isPvpRevealSpinning && pvpMatch?.chosenSizeKey === sizeKey;
                        return (
                          <div
                            key={`reveal-${sizeKey}`}
                            className={`pvpRevealItem ${isActive ? "active" : ""} ${
                              isChosen ? "chosen" : ""
                            }`}
                          >
                            <small>{L("퍼즐", "Puzzle")}</small>
                            <span>{sizeKey}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className={`pvpRevealResult ${!isPvpRevealSpinning && pvpMatch?.chosenSizeKey ? "chosen" : ""}`}>
                      <span>
                        {!isPvpRevealSpinning && pvpMatch?.chosenSizeKey
                          ? L(`${pvpMatch.chosenSizeKey} 확정`, `${pvpMatch.chosenSizeKey} selected`)
                          : L("랜덤 추첨 중...", "Drawing randomly...")}
                      </span>
                    </div>
                  </div>
                )}

                {pvpServerState === "cancelled" && (
                  <div className="pvpStageCard">
                    <div className="pvpStageTitle">
                      {pvpCancelReasonText(String(pvpMatch?.cancelReason || ""))}
                    </div>
                  </div>
                )}

                <div className="pvpQueueActions">
                  <button className="singleActionBtn" onClick={joinPvpQueue} disabled={isLoading || pvpSearching}>
                    {isLoading ? L("준비 중...", "Preparing...") : pvpSearching ? L("찾는 중...", "Searching...") : L("배틀 시작", "Start Battle")}
                  </button>
                  <button className="singleHomeBtn" onClick={() => cancelPvpQueue()} disabled={!pvpSearching || isPvpCancelHomeLocked || isPvpShowdownActive}>
                    {L("취소", "CANCEL")}
                  </button>
                  <button className="singleSfxBtn" onClick={backToMenu} disabled={isPvpCancelHomeLocked || isPvpShowdownActive}>
                    {L("홈", "HOME")}
                  </button>
                </div>
              </section>
            )}
            {isInRaceRoom && (
              <div className="racePanel">
                <button onClick={leaveRace} disabled={!raceRoomCode}>
                  {L("배틀 나가기", "Leave Battle")}
                </button>
              </div>
            )}
          </>
        )}

        {isModeMulti && (
          <>
            {!isInRaceRoom && (
              <div className="multiLobbyShell">
                <div className="lobbyQuick">
                  <button className="lobbyQuickBtn" onClick={backToMenu}>
                    <Home size={18} /> {L("메인", "HOME")}
                  </button>
                </div>
                <div className="lobbyActions" data-tutorial="lobby-actions">
                  <button
                    className="lobbyCardBtn create"
                    onClick={() => {
                      setCreateRoomTitle("");
                      setCreateSize(selectedSize);
                      setCreateMaxPlayers("2");
                      setCreateVisibility("public");
                      setCreatePassword("");
                      setShowCreateModal(true);
                    }}
                    disabled={isLoading}
                  >
                    {L("방 만들기", "CREATE ROOM")}
                  </button>

                  <div className="lobbyCardBtn join">
                    <div className="lobbyJoinTitle">{L("방 참가", "JOIN ROOM")}</div>
                    <div className="lobbyJoinRow">
                      <input
                        type="text"
                        value={joinRoomCode}
                        onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                        placeholder={L("방 코드를 입력하세요", "Enter room code")}
                      />
                      <button
                        onClick={() => {
                          setJoinRoomType("unknown");
                          setJoinPassword("");
                          setJoinModalSource("manual");
                          setShowJoinModal(true);
                        }}
                        disabled={!joinRoomCode.trim()}
                      >
                        {L("참가", "JOIN")}
                      </button>
                    </div>
                  </div>

                  <button className="lobbyCardBtn refresh" onClick={fetchPublicRooms} disabled={roomsLoading}>
                    {roomsLoading ? L("새로고침 중...", "REFRESHING...") : L("목록 새로고침", "REFRESH LIST")}
                  </button>
                </div>
              </div>
            )}

            {!isLoggedIn && (
              <div className="raceStateBox">
                <div>{L("오른쪽 상단에서 로그인 후 멀티플레이를 이용하세요.", "Log in from the top-right to use multiplayer.")}</div>
              </div>
            )}

            {isLoggedIn && isInRaceRoom && (
              <div className="racePanel">
                <button onClick={leaveRace} disabled={!raceRoomCode}>
                  {L("방 나가기", "Leave Room")}
                </button>
              </div>
            )}
          </>
        )}

        {isModeMulti && isLoggedIn && !isInRaceRoom && (
          <div className="lobbyTableWrap" data-tutorial="lobby-table">
            <div className="lobbyTableTitle">{L("방 목록", "ROOM LIST")}</div>
            {publicRooms.length === 0 ? (
              <div className="lobbyEmpty">{L("입장 가능한 방이 없습니다.", "No rooms available to join.")}</div>
            ) : (
              <table className="lobbyTable">
                <thead>
                  <tr>
                    <th>{L("방 코드", "Room Code")}</th>
                    <th>{L("제목", "Title")}</th>
                    <th>{L("크기", "Size")}</th>
                    <th>{L("인원", "Players")}</th>
                    <th>{L("상태", "Status")}</th>
                    <th>{L("입장", "Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {publicRooms.map((room) => (
                    <tr key={room.roomCode}>
                      <td>{room.roomCode}</td>
                      <td>{room.roomTitle}</td>
                      <td>
                        {room.width}x{room.height}
                      </td>
                      <td>
                        {room.currentPlayers}/{room.maxPlayers}
                      </td>
                      <td className={room.isPrivate ? "private" : "open"}>
                        {room.isPrivate ? (
                          <span>
                            {L("비밀방", "Private")} <Lock size={14} />
                          </span>
                        ) : (
                          L("오픈방", "Open")
                        )}
                      </td>
                      <td>
                        <button
                          className="joinActionBtn"
                          onClick={async () => {
                            if (room.isPrivate) {
                              setJoinRoomCode(room.roomCode);
                              setJoinRoomType("private");
                              setJoinPassword("");
                              setJoinModalSource("list");
                              setShowJoinModal(true);
                              return;
                            }
                            await joinRaceRoomWith(room.roomCode, "");
                          }}
                        >
                          {L("참가", "Join")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {((isModeMulti && isLoggedIn) || isModePvp) && raceRoomCode && shouldShowPuzzleBoard && (
          <section className={`raceMatchLayout ${isModePvp ? "pvpRaceLayout" : ""}`}>
            <aside className="raceInfoPane">
              <div className="raceInfoTitle">
                {isModePvp ? L("배틀 상태", "Battle Status") : L("경기 상태", "Match Status")}: {racePhaseLabel}
              </div>
              {isModeMulti && (
                <>
                  <div>{L("방", "Room")}: <b>{roomTitleText || raceRoomCode}</b></div>
                  <div>{L("코드", "Code")}: <b>{raceRoomCode}</b></div>
                  <div>{L("인원", "Players")}: {(raceState?.players || []).length}/{raceState?.maxPlayers || 2}</div>
                </>
              )}
              {isModePvp && (
                <div className="raceInfoGoal">{L("상대보다 먼저 완성하면 승리", "Finish before the opponent to win")}</div>
              )}
              {myRacePlayer && (
                <div className="raceInfoMe">
                  <span className="raceInfoMeLabel">{L("플레이어", "Player")}</span>
                  <strong>{myRacePlayer.nickname}</strong>
                  {isModePvp && <em>{myRaceProgressPercent}%</em>}
                </div>
              )}
              <div className="timerBar">{L("시간", "TIME")} {formattedTime}</div>
              <div className="raceActions">
                {isModeMulti && isRaceLobby && (
                  <>
                    <button onClick={() => setReady(!(myRacePlayer?.isReady === true))} disabled={!myRacePlayer}>
                      {myRacePlayer?.isReady ? L("준비 해제", "Unready") : L("준비", "Ready")}
                    </button>
                    <button onClick={startRace} disabled={raceState?.hostPlayerId !== racePlayerId || !raceState?.canStart}>
                      {L("시작 (방장)", "Start (Host)")}
                    </button>
                  </>
                )}
                {isModeMulti && isRaceFinished && (
                  <button onClick={requestRematch} disabled={isRematchLoading}>
                    {isRematchLoading ? L("준비중...", "Preparing...") : L("한판 더?", "Rematch?")}
                  </button>
                )}
              </div>
            </aside>

            <div className="raceBoardPane">
              <div
                ref={boardStageRef}
                className="boardWrap hasTopToolbar"
                onContextMenu={(e) => e.preventDefault()}
              >
                {renderBoardTopToolbar()}
                <div className={`excelBoardScaffold ${isExcelMode ? "active" : ""}`}>
                  {isExcelMode && (
                    <div className="excelBoardHeaderRow" aria-hidden="true">
                      <div className="excelBoardHeadCorner" />
                      <div
                        className="excelBoardColLetters"
                        style={{
                          gridTemplateColumns: `repeat(${puzzle.width}, ${cellSize}px)`,
                          marginLeft: `${maxRowHintDepth * cellSize}px`,
                          width: `${puzzle.width * cellSize}px`,
                        }}
                      >
                        {excelBoardCols.map((label, idx) => (
                          <span key={`board-col-${idx}`}>{label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={`excelBoardBodyRow ${isExcelMode ? "active" : ""}`}>
                    {isExcelMode && (
                      <div
                        className="excelBoardRowNumbers"
                        aria-hidden="true"
                        style={{
                          gridTemplateRows: `repeat(${puzzle.height}, ${cellSize}px)`,
                          marginTop: `${maxColHintDepth * cellSize}px`,
                          height: `${puzzle.height * cellSize}px`,
                        }}
                      >
                        {excelBoardRows.map((label, idx) => (
                          <span key={`board-row-${idx}`}>{label}</span>
                        ))}
                      </div>
                    )}
                    <div
                      className="nonogram"
                      style={{
                        "--cell-size": `${cellSize}px`,
                        "--left-depth": maxRowHintDepth,
                        "--top-depth": maxColHintDepth,
                        "--board-w": puzzle.width,
                        "--board-h": puzzle.height,
                      }}
                    >
                      <div className="corner" />
                      <div className="colHints" style={{ gridTemplateColumns: `repeat(${puzzle.width}, var(--cell-size))` }}>
                        {colHints.map((hint, colIdx) => (
                          <div key={`col-${colIdx}`} className="colHintCol" style={{ gridTemplateRows: `repeat(${maxColHintDepth}, var(--cell-size))` }}>
                            {Array.from({ length: maxColHintDepth }).map((_, depthIdx) => {
                              const value = hint[hint.length - maxColHintDepth + depthIdx];
                              const hintId = `c-${colIdx}-${depthIdx}`;
                              const solvedByHint = solvedCols.has(colIdx) && value != null;
                              return (
                                <button
                                  key={hintId}
                                  type="button"
                                  className={`hintNum ${activeHints.has(hintId) ? "active" : ""} ${solvedByHint ? "solved" : ""}`}
                                  onClick={() => toggleHint(hintId)}
                                >
                                  {value ?? ""}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div className="rowHints" style={{ gridTemplateRows: `repeat(${puzzle.height}, var(--cell-size))` }}>
                        {rowHints.map((hint, rowIdx) => (
                          <div
                            key={`row-${rowIdx}`}
                            className={`rowHintRow ${tutorialHighlightRows.includes(rowIdx) ? "tutorialHintPulse" : ""}`}
                            style={{ gridTemplateColumns: `repeat(${maxRowHintDepth}, var(--cell-size))` }}
                          >
                            {Array.from({ length: maxRowHintDepth }).map((_, depthIdx) => {
                              const value = hint[hint.length - maxRowHintDepth + depthIdx];
                              const hintId = `r-${rowIdx}-${depthIdx}`;
                              const solvedByHint = solvedRows.has(rowIdx) && value != null;
                              return (
                                <button
                                  key={hintId}
                                  type="button"
                                  className={`hintNum ${activeHints.has(hintId) ? "active" : ""} ${solvedByHint ? "solved" : ""}`}
                                  onClick={() => toggleHint(hintId)}
                                >
                                  {value ?? ""}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div
                        ref={boardRef}
                        className={`board ${isHpPuzzleMode && puzzleHpDamage ? "hpDamage" : ""}`}
                        style={{
                          width: `${puzzle.width * cellSize}px`,
                          height: `${puzzle.height * cellSize}px`,
                          cursor: canInteractBoard ? "crosshair" : "not-allowed",
                        }}
                        onPointerDown={onBoardPointerDown}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <canvas ref={canvasRef} className="boardCanvas" />
                        {renderCellInputFx()}
                        {renderLineClearFx()}
                        {renderPuzzleHpCellFx()}
                        {renderPuzzleHintCellFx()}
                        {isRaceFinished && !isModePvp && <div className="countdownOverlay result">{raceResultText}</div>}
                        {showInactivityWarning && (
                          <div className={`idleDangerOverlay ${inactivityLeftSec <= 3 ? "critical" : inactivityLeftSec <= 6 ? "hot" : ""}`}>
                            <div className="idleDangerHead">
                              <span>{L("위험", "DANGER")}</span>
                              <b>{inactivityLeftSec}s</b>
                            </div>
                            <div className="idleDangerText">
                              {L("입력이 없으면 자동 패배", "No input will cause auto-defeat")}
                            </div>
                            <div className="idleDangerBar">
                              <span style={{ width: `${inactivityWarnPercent}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {isRacePreStartMasked && (
                  <div className="racePuzzleMask">
                    {isRaceCountdown ? (
                      <span className="racePuzzleMaskCount">{countdownLeft ?? 0}</span>
                    ) : (
                      <span className="racePuzzleMaskWait">{L("READY 대기", "Waiting for READY")}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <aside className="raceSidePane">
              <div className="raceSidePlayers">
                {isModePvp && <div className="raceSideTitle">{L("상대 진행률", "Opponent Progress")}</div>}
                {(raceState?.players || [])
                  .filter((p) => p.playerId !== racePlayerId)
                  .map((p) => {
                  const percent = getRaceProgressPercent(p);
                  const canOpenProfile = canOpenUserProfile(p?.userId);
                  return (
                    canOpenProfile ? (
                      <button
                        key={p.playerId}
                        type="button"
                        className="raceProgressRow raceProgressRowButton clickable"
                        onClick={() => handleOpenUserProfile(p.userId, p)}
                      >
                        <span className="raceProgressIdentity">
                          <ProfileAvatar avatarKey={getDisplayedRaceProfileAvatarKey(p)} nickname={p.nickname} size="sm" />
                          <span>{p.nickname}</span>
                        </span>
                        <span>{percent}%</span>
                      </button>
                    ) : (
                      <div key={p.playerId} className="raceProgressRow">
                        <span className="raceProgressIdentity">
                          <ProfileAvatar avatarKey={getDisplayedRaceProfileAvatarKey(p)} nickname={p.nickname} size="sm" />
                          <span>{p.nickname}</span>
                        </span>
                        <span>{percent}%</span>
                      </div>
                    )
                  );
                })}
              </div>

              {isModeMulti && (
                <div className="chatBox">
                  <div className="chatTitle">{L("방 채팅", "Room Chat")}</div>
                  <div className="chatBody" ref={chatBodyRef}>
                    {chatMessages.length === 0 ? (
                      <div className="chatEmpty">{L("아직 채팅이 없습니다.", "No chat yet.")}</div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div className="chatMsg" key={msg.id}>
                          {canOpenUserProfile(msg.userId) ? (
                            <button type="button" className="chatProfileBtn" onClick={() => handleOpenUserProfile(msg.userId, msg)}>
                              <b>{msg.nickname}</b>
                            </button>
                          ) : (
                            <b>{msg.nickname}</b>
                          )}
                          : {msg.text}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="chatInputRow">
                    <div className="emojiWrap" ref={emojiWrapRef}>
                      <button type="button" onClick={() => setShowEmojiPicker((prev) => !prev)} title={L("이모지", "Emoji")}>😀</button>
                      {showEmojiPicker && (
                        <div className="emojiPopover">
                          <EmojiPicker
                            onEmojiClick={(emojiData) => {
                              setChatInput((prev) => `${prev}${emojiData.emoji}`);
                              setShowEmojiPicker(false);
                            }}
                            skinTonesDisabled
                            width={300}
                            height={340}
                          />
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={L("메시지 입력...", "Type a message...")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          sendRaceChat();
                        }
                      }}
                    />
                    <button onClick={sendRaceChat} disabled={chatSending || !chatInput.trim()}>
                      {chatSending ? "..." : L("전송", "Send")}
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </section>
        )}

        {shouldShowPuzzleBoard && !isSingleSoloMode && !isModeCreate && !isInRaceRoom && (
          <div className="timerBar">TIME {formattedTime}</div>
        )}
        {shouldShowSingleTimer && (
          <div className="singleBottomBar">
            <div className="singleTimer">
              {L("남은 시간", "Time Left")}: {placementTimerText}
            </div>
          </div>
        )}
        {(status || shouldReserveStatusSlot) && !isModeAuth && (
          <div className={`status ${!status ? "empty" : ""}`}>{status || "\u00a0"}</div>
        )}

        {isPuzzleHpGameOver && (
          <div className="modalBackdrop puzzleHpGameOverBackdrop" role="dialog" aria-modal="true">
            <div className="modalCard puzzleHpGameOverCard">
              <div className="puzzleHpGameOverHearts" aria-hidden="true">♡ ♡ ♡</div>
              <h2>{L("기회를 모두 사용했어요", "No HP Left")}</h2>
              <p>
                {canRequestRewardAd
                  ? L("광고를 보면 HP 1로 이어서 할 수 있어요.", "Watch an ad to revive with 1 HP.")
                  : L("광고 연결이 완료되면 부활 기능을 사용할 수 있어요.", "Revive will be available after reward ads are configured.")}
              </p>
              <div className="modalActions puzzleHpGameOverActions">
                <button
                  type="button"
                  className="puzzleHpReviveBtn"
                  onClick={handleReviveWithAd}
                  disabled={reviveAdLoading || !canRequestRewardAd}
                >
                  {reviveAdLoading
                    ? L("광고 준비 중...", "Loading Ad...")
                    : canRequestRewardAd
                      ? L("광고 보고 부활", "Watch Ad")
                      : L("광고 준비 중", "Ad unavailable")}
                </button>
                <button type="button" className="puzzleHpRetryBtn" onClick={resetGrid} disabled={reviveAdLoading}>
                  {L("처음부터 다시", "Try Again")}
                </button>
              </div>
              {reviveAdError && <div className="puzzleHpAdError">{reviveAdError}</div>}
            </div>
          </div>
        )}

        {pvpRatingFx && (
          <div
            className={`rankedFxOverlay ${pvpFxTierClass}`}
            onClick={pvpRatingFx.isTest ? dismissPvpRatingFx : undefined}
          >
            <motion.div
              className={`rankedFxCard ${pvpFxTierClass} ${pvpRatingFx.result === "loss" ? "loss" : "win"} ${
                pvpRatingFx.done ? "done" : ""
              }`}
              initial={{ opacity: 0, scale: 0.86, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 230, damping: 24, mass: 0.94 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rankedFxEyebrow">{pvpRatingFx.isTest ? L("연출 테스트", "FX Test") : L("배틀 결과", "Battle Result")}</div>
              <div className={`rankedFxOutcome ${pvpRatingFx.result === "loss" ? "loss" : "win"}`}>{pvpFxOutcomeLabel}</div>
              <div className="rankedFxSub">{pvpFxOutcomeSub}</div>

              <div className={`rankedFxTierStage ${pvpRatingFx.tierShift}`}>
                <span className="rankedFxBurst one" />
                <span className="rankedFxBurst two" />
                <span className="rankedFxHalo" />
                {pvpRatingFx.tierShift === "promoted" && (
                  <div className="rankedFxPromotionFx" aria-hidden="true">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span
                        key={`promo-${i}`}
                        style={{
                          "--pa": `${i * 36}deg`,
                          "--pd": `${(i % 5) * 0.06}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
                {pvpRatingFx.tierShift === "demoted" && (
                  <div className="rankedFxDemotionFx" aria-hidden="true">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span
                        key={`demo-${i}`}
                        style={{
                          "--dx": `${(i - 4) * 18}px`,
                          "--dd": `${i * 0.04}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
                <img src={TIER_IMAGE_MAP[pvpFxTierNow?.key] || TIER_IMAGE_MAP.bronze} alt={pvpFxTierLabel || "Tier"} />
                {pvpFxShiftLabel && <div className={`rankedFxShiftTag ${pvpRatingFx.tierShift}`}>{pvpFxShiftLabel}</div>}
              </div>

              <div className="rankedFxTierName">{pvpFxTierLabel}</div>
              {pvpFxRouteChanged && (
                <div className="rankedFxTierRoute">
                  <span>{pvpFxFromTierLabel}</span>
                  <span className="arrow">→</span>
                  <span>{pvpFxToTierLabel}</span>
                </div>
              )}

              <div className="rankedFxScoreRow">
                <div className="rankedFxScoreNow">R {pvpRatingFx.ratingNow}</div>
                <div className={`rankedFxScoreDelta ${pvpRatingFx.delta >= 0 ? "plus" : "minus"}`}>{pvpFxDeltaText}</div>
              </div>
              <div className={`rankedFxDeltaSummary ${pvpRatingFx.delta >= 0 ? "plus" : "minus"}`}>
                {L(
                  `이번 경기 ${pvpRatingFx.delta >= 0 ? "+" : ""}${pvpRatingFx.delta}점`,
                  `This match ${pvpRatingFx.delta >= 0 ? "+" : ""}${pvpRatingFx.delta}`
                )}
              </div>

              <div className="rankedFxTrackBlock">
                <div className="rankedFxTrackRail">
                  <div className="rankedFxTrackFill" style={{ width: `${pvpFxGaugePercent}%` }} />
                  <div className="rankedFxTrackGlow" style={{ left: `${pvpFxGaugePercent}%` }} />
                </div>
                <div className="rankedFxTrackLabels">
                  <span>{pvpFxTierLabel}</span>
                  <span>{pvpFxNextTierLabel}</span>
                </div>
              </div>

              <div className="rankedFxNumbers">
                <span>{pvpRatingFx.from}</span>
                <span className="arrow">→</span>
                <span>{pvpRatingFx.to}</span>
              </div>

              <div className="rankedFxActions">
                <button type="button" className="singleHomeBtn" onClick={confirmPvpRatingFx}>
                  {pvpRatingFx.isTest ? L("닫기", "Close") : L("확인", "OK")}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showMultiResultModal && isModeMulti && isInRaceRoom && isRaceFinished && (
          <div className="modalBackdrop" onClick={() => setShowMultiResultModal(false)}>
            <div className="modalCard raceResultModal" onClick={(e) => e.stopPropagation()}>
              <h2>{L("경기 기록", "Match Results")}</h2>
              <p>
                {L("참가자 결과", "Participants")}:
                {" "}
                <b>{roomTitleText || raceRoomCode}</b>
              </p>
              <div className="raceResultTableWrap">
                <table className="raceResultTable">
                  <thead>
                    <tr>
                      <th>{L("순위", "Rank")}</th>
                      <th>{L("닉네임", "Nickname")}</th>
                      <th>{L("기록", "Time")}</th>
                      <th>{L("상태", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raceResultRows.map((row) => (
                      <tr key={`result-${row.playerId}`} className={row.isMe ? "me" : ""}>
                        <td>{Number.isInteger(row.rank) ? row.rank : "-"}</td>
                        <td>
                          {canOpenUserProfile(row.userId) ? (
                            <button type="button" className="tableLinkBtn" onClick={() => handleOpenUserProfile(row.userId, row)}>
                              {row.nickname}
                            </button>
                          ) : (
                            row.nickname
                          )}
                        </td>
                        <td>{formatRaceElapsedMs(row.elapsedMs, row.elapsedSec)}</td>
                        <td>{formatRaceStatusLabel(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modalActions">
                <button onClick={() => setShowMultiResultModal(false)}>{L("확인", "OK")}</button>
              </div>
            </div>
          </div>
        )}

        {isMenuTourActive && (
          <motion.aside
            className="screenTourGuide"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            aria-label={L("사이트 이용 흐름 안내", "Site flow guide")}
          >
            <div className="screenTourGuideHead">
              <div className="screenTourGuideProgress">
                <span>{L("사이트 이용 흐름", "Site flow guide")}</span>
                <strong>
                  {lang === "ko"
                    ? `${menuTourIndex + 1} / ${MENU_TOUR_STEPS.length}`
                    : `Step ${menuTourIndex + 1} / ${MENU_TOUR_STEPS.length}`}
                </strong>
              </div>
              <button type="button" className="screenTourGuideClose" onClick={closeMenuTour}>
                {L("끄기", "Close")}
              </button>
            </div>

            <div className="screenTourGuideBody">
              <div className="screenTourGuideLabel">
                {lang === "ko" ? `${activeMenuTourStep.shortKo} 화면` : `${activeMenuTourStep.shortEn} screen`}
              </div>
              <h3>{lang === "ko" ? activeMenuTourStep.titleKo : activeMenuTourStep.titleEn}</h3>
              <p className="screenTourGuideSummary">
                {lang === "ko" ? activeMenuTourStep.summaryKo : activeMenuTourStep.summaryEn}
              </p>
              <p>{lang === "ko" ? activeMenuTourStep.bodyKo : activeMenuTourStep.bodyEn}</p>
              <div className="menuTourPointRow">
                {activeMenuTourPoints.map((point) => (
                  <span key={`${activeMenuTourStep.key}-${point}`} className="menuTourPointChip">
                    {point}
                  </span>
                ))}
              </div>
            </div>

            <div className="screenTourGuideActions">
              <button
                type="button"
                className="menuSecondaryCta menuTourResetBtn"
                onClick={() => moveMenuTourTo(menuTourIndex - 1)}
                disabled={menuTourIndex === 0}
              >
                {L("이전", "Previous")}
              </button>
              <button
                type="button"
                className="menuPrimaryCta"
                onClick={() => {
                  if (menuTourIndex >= MENU_TOUR_STEPS.length - 1) {
                    closeMenuTour();
                    return;
                  }
                  moveMenuTourTo(menuTourIndex + 1);
                }}
              >
                {menuTourIndex >= MENU_TOUR_STEPS.length - 1 ? L("안내 종료", "Finish Guide") : L("다음 화면", "Next Screen")}
              </button>
            </div>
          </motion.aside>
        )}

        {showCreateModal && (
          <div className="modalBackdrop" onClick={() => setShowCreateModal(false)}>
            <div className="modalCard" onClick={(e) => e.stopPropagation()}>
              <h2>{L("방 만들기", "Create Room")}</h2>
              <label>
                {L("퍼즐 유형", "Puzzle Size")}
                <select value={createSize} onChange={(e) => setCreateSize(e.target.value)}>
                  <option value="5x5">5x5</option>
                  <option value="10x10">10x10</option>
                  <option value="15x15">15x15</option>
                  <option value="20x20">20x20</option>
                  <option value="25x25">25x25</option>
                </select>
              </label>
              <label>
                {L("최대 인원", "Max Players")}
                <select value={createMaxPlayers} onChange={(e) => setCreateMaxPlayers(e.target.value)}>
                  <option value="2">{L("2명", "2 players")}</option>
                  <option value="3">{L("3명", "3 players")}</option>
                  <option value="4">{L("4명", "4 players")}</option>
                </select>
              </label>
              <label>
                {L("방 공개 설정", "Room Visibility")}
                <select value={createVisibility} onChange={(e) => setCreateVisibility(e.target.value)}>
                  <option value="public">{L("오픈방", "Public")}</option>
                  <option value="private">{L("비밀방", "Private")}</option>
                </select>
              </label>
              {createVisibility === "private" && (
                <label>
                  {L("비밀번호", "Password")}
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder={L("비밀번호", "Password")}
                  />
                </label>
              )}
              <label>
                {L("방 제목", "Room Title")}
                <input
                  type="text"
                  value={createRoomTitle}
                  onChange={(e) => setCreateRoomTitle(e.target.value)}
                  placeholder={L("예: 10x10 스피드전", "e.g. 10x10 Speed Run")}
                />
              </label>
              <div className="modalActions">
                <button onClick={() => setShowCreateModal(false)}>{L("취소", "Cancel")}</button>
                <button onClick={createRaceRoom} disabled={isLoading}>
                  {isLoading ? L("생성중...", "Creating...") : L("생성", "Create")}
                </button>
              </div>
            </div>
          </div>
        )}

        {showJoinModal && (
          <div className="modalBackdrop" onClick={() => setShowJoinModal(false)}>
            <div className="modalCard" onClick={(e) => e.stopPropagation()}>
              <h2>{L("방 참가", "Join Room")}</h2>
              {joinModalSource === "manual" && (
                <label>
                  {L("방 코드", "Room Code")}
                  <input
                    type="text"
                    value={joinRoomCode}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      setJoinRoomCode(code);
                      const matched = publicRooms.find((r) => r.roomCode === code);
                      setJoinRoomType(matched ? (matched.isPrivate ? "private" : "public") : "unknown");
                    }}
                    placeholder={L("예: AB12CD", "e.g. AB12CD")}
                  />
                </label>
              )}
              {joinRoomType !== "public" && (
                <label>
                  {L("비밀번호(비밀방만)", "Password (private rooms only)")}
                  <input
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder={L("비밀방 비밀번호", "Private room password")}
                  />
                </label>
              )}
              <div className="modalActions">
                <button onClick={() => setShowJoinModal(false)}>{L("취소", "Cancel")}</button>
                <button
                  onClick={joinRaceRoom}
                  disabled={
                    isLoading ||
                    (joinModalSource === "manual" && !joinRoomCode.trim()) ||
                    (joinRoomType !== "public" && !joinPassword.trim())
                  }
                >
                  {isLoading ? L("참가중...", "Joining...") : L("참가", "Join")}
                </button>
              </div>
            </div>
          </div>
        )}

        {showNeedLoginPopup && (
          <div className="modalBackdrop" onClick={() => setShowNeedLoginPopup(false)}>
            <div className="modalCard" onClick={(e) => e.stopPropagation()}>
              <h2>{L("로그인 필요", "Login Required")}</h2>
              <p>{needLoginReturnMode === "pvp"
                ? L("PVP 매칭은 로그인 후 이용 가능합니다.", "PVP matchmaking requires login.")
                : needLoginReturnMode === "placement_test"
                  ? L("PVP 매칭은 로그인 후 이용 가능합니다.", "PVP matchmaking requires login.")
                  : L("멀티플레이는 로그인 후 이용 가능합니다.", "Multiplayer requires login.")}</p>
              <div className="modalActions">
                <button onClick={() => setShowNeedLoginPopup(false)}>{L("취소", "Cancel")}</button>
                <button
                  onClick={() => {
                    setShowNeedLoginPopup(false);
                    openAuthScreen("login", needLoginReturnMode);
                  }}
                >
                  {L("로그인하러 가기", "Go to Login")}
                </button>
              </div>
            </div>
          </div>
        )}

        {showPvpTierGuideModal && (
          <div className="modalBackdrop pvpTierGuideBackdrop" onClick={() => setShowPvpTierGuideModal(false)}>
            <motion.div
              className="pvpTierGuideModal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.84, y: 42, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.94, y: 20, filter: "blur(6px)" }}
              transition={{ type: "spring", stiffness: 210, damping: 22, mass: 0.9 }}
            >
              <div className="pvpTierGuideAura" aria-hidden="true" />
              <div className="pvpTierGuideBadge">{L("티어 안내", "TIER GUIDE")}</div>
              <button
                type="button"
                className="pvpTierGuideClose"
                onClick={() => setShowPvpTierGuideModal(false)}
                aria-label={L("닫기", "Close")}
              >
                ×
              </button>
              <div className="pvpTierGuideFrame">
                <img
                  className="pvpTierGuideModalImage"
                  src={lang === "ko" ? TIER_GUIDE_IMAGE_MAP.ko : TIER_GUIDE_IMAGE_MAP.en}
                  alt={lang === "ko" ? "티어 안내" : "Tier guide"}
                />
              </div>
            </motion.div>
          </div>
        )}

        {showProfileModal && (
          <div className="modalBackdrop" onClick={closeProfileModal}>
            <div className="modalCard profileModal" onClick={(e) => e.stopPropagation()}>
              {profileModalLoading ? (
                <div className="profileLoadingState">{L("프로필 불러오는 중...", "Loading profile...")}</div>
              ) : (
                <>
                  <div className="profileHero">
                    {profileModalMode === "self" ? (
                      <button
                        type="button"
                        className={`profileHeroAvatarButton ${profilePickerOpen ? "open" : ""}`}
                        onClick={() => setProfilePickerOpen((prev) => !prev)}
                      >
                        <ProfileAvatar
                          avatarKey={profileModalAvatarKey}
                          nickname={profileDraftNickname || profileModalData?.nickname}
                          size="xl"
                        />
                        <span className="profileHeroAvatarChevron">
                          <ChevronDown size={18} />
                        </span>
                      </button>
                    ) : (
                      <ProfileAvatar
                        avatarKey={profileModalAvatarKey}
                        nickname={profileModalData?.nickname}
                        size="xl"
                      />
                    )}
                    <div className="profileHeroMeta">
                      <div className="profileEyebrow">
                        {profileModalMode === "self" ? L("내 프로필", "My Profile") : L("플레이어 프로필", "Player Profile")}
                      </div>
                      {profileModalMode === "self" ? (
                        <label className="profileNicknameEditor">
                          <span>{L("닉네임", "Nickname")}</span>
                          <input
                            type="text"
                            maxLength={24}
                            value={profileDraftNickname}
                            onChange={(e) => setProfileDraftNickname(e.target.value.slice(0, 24))}
                            disabled={profileModalSaving}
                            placeholder={L("닉네임 입력", "Enter nickname")}
                          />
                        </label>
                      ) : (
                        <h2>{profileModalData?.nickname || L("알 수 없는 플레이어", "Unknown Player")}</h2>
                      )}
                      {profileModalTier && (
                        <div className="profileTierLine">
                          {!IS_APPS_IN_TOSS && (
                            <img
                              className="profileTierBadge"
                              src={TIER_IMAGE_MAP[profileModalTier.key] || TIER_IMAGE_MAP.bronze}
                              alt={profileModalTierLabel}
                            />
                          )}
                          <span>{profileModalTierLabel}</span>
                          <span>R {Number(profileModalData?.rating || 0)}</span>
                          {profileModalRankText && <span>{profileModalRankText}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {profileModalError && <div className="modalError">{profileModalError}</div>}

                  {profileModalData && (
                    <>
                      {profileModalMode === "self" && (
                        <div className="profileLevelShowcase">
                          <div className="profileLevelBadgeLarge">{profileLevelLabel}</div>
                          <div className="profileLevelShowcaseCopy">
                            <span>{L("내 성장 레벨", "My Growth Level")}</span>
                            <strong>{profileLevelXpText}</strong>
                            <b aria-hidden="true">
                              <i style={{ width: `${missionLevelInfo.progressPercent}%` }} />
                            </b>
                          </div>
                        </div>
                      )}

                      <div className="profileStatsGrid">
                        <div className="profileStatCard">
                          <span>{L("판수", "Games")}</span>
                          <strong>{Number(profileModalData.rating_games || 0)}</strong>
                        </div>
                        <div className="profileStatCard">
                          <span>{L("승", "Wins")}</span>
                          <strong>{Number(profileModalData.rating_wins || 0)}</strong>
                        </div>
                        <div className="profileStatCard">
                          <span>{L("패", "Losses")}</span>
                          <strong>{Number(profileModalData.rating_losses || 0)}</strong>
                        </div>
                        <div className="profileStatCard">
                          <span>{L("승률", "Win Rate")}</span>
                          <strong>{Math.round(Number(profileModalData.winRate || 0))}%</strong>
                        </div>
                        <div className="profileStatCard">
                          <span>{L("최고 연승", "Best Streak")}</span>
                          <strong>{Number(profileModalData.win_streak_best || 0)}</strong>
                        </div>
                        <div className="profileStatCard">
                          <span>{L("현재 연승", "Current Streak")}</span>
                          <strong>{Number(profileModalData.win_streak_current || 0)}</strong>
                        </div>
                      </div>

                      {profileModalMode === "self" ? (
                        <>
                          {profilePickerOpen && (
                            <div className="profilePickerPanel">
                              <div className="profileSection">
                                <div className="profileTabRow">
                                  <button
                                    type="button"
                                    className={`profileTabBtn ${profileAvatarTab === "default" ? "active" : ""}`}
                                    onClick={() => setProfileAvatarTab("default")}
                                  >
                                    {L("기본 프로필", "Default Profiles")}
                                  </button>
                                  <button
                                    type="button"
                                    className={`profileTabBtn ${profileAvatarTab === "special" ? "active" : ""}`}
                                    onClick={() => setProfileAvatarTab("special")}
                                  >
                                    {L("특별 프로필", "Special Profiles")}
                                  </button>
                                </div>
                              </div>

                              {profileAvatarTab === "default" ? (
                                <div className="profileSection">
                                  <div className="profileAvatarGrid profileAvatarGridScrollable profileAvatarGridDefaultPicker">
                                    {DEFAULT_PROFILE_AVATAR_OPTIONS.map((option) => {
                                      const selected = normalizeProfileAvatarKey(profileDraftAvatarKey) === option.key;
                                      const label = lang === "ko" ? option.labelKo : option.labelEn;
                                      return (
                                        <button
                                          key={option.key}
                                          type="button"
                                          title={label}
                                          aria-label={label}
                                          className={`profileAvatarOption compact ${selected ? "selected" : ""}`}
                                          onClick={() => setProfileDraftAvatarKey(option.key)}
                                        >
                                          <ProfileAvatar avatarKey={option.key} nickname={profileDraftNickname || profileModalData.nickname} size="picker" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div className="profileSection">
                                  <div className="profileAvatarGrid profileAvatarGridScrollable hall">
                                    {SPECIAL_PROFILE_AVATAR_OPTIONS.map((option) => {
                                      const unlocked = profileUnlockedSpecialKeys.has(option.key);
                                      const selected = normalizeProfileAvatarKey(profileDraftAvatarKey) === option.key;
                                      const label = lang === "ko" ? option.labelKo : option.labelEn;
                                      const unlockHint = lang === "ko" ? option.unlockHintKo : option.unlockHintEn;
                                      return (
                                        <button
                                          key={option.key}
                                          type="button"
                                          title={unlockHint}
                                          aria-label={label}
                                          data-tooltip={unlockHint}
                                          className={`profileAvatarOption hall compact hasTooltip ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}`}
                                          onClick={() => {
                                            if (unlocked) setProfileDraftAvatarKey(option.key);
                                          }}
                                        >
                                          {unlocked ? (
                                            <ProfileAvatar avatarKey={option.key} nickname={profileDraftNickname || profileModalData.nickname} size="picker" />
                                          ) : (
                                            <span className="profileSpecialLockedPreview" aria-hidden="true">
                                              <Lock size={22} />
                                            </span>
                                          )}
                                          <span className="profileAvatarTitle">{label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : profileModalHallRewards.length > 0 ? (
                        <div className="profileSection">
                          <div className="profileSectionHead">
                            <div className="profileSectionTitle">{L("명예의 전당 기록", "Hall of Fame Records")}</div>
                          </div>
                          <div className="profileRewardList">
                            {profileModalHallRewards.map((reward) => {
                              const option = HALL_PROFILE_AVATAR_OPTIONS.find((entry) => entry.key === reward.key);
                              return (
                                <div key={`${reward.key}-${reward.finishedAtMs}`} className="profileRewardItem">
                                  <ProfileAvatar avatarKey={reward.key} nickname={profileModalData.nickname} size="md" />
                                  <div>
                                    <strong>{lang === "ko" ? option?.labelKo || reward.key : option?.labelEn || reward.key}</strong>
                                    <span>{formatRaceElapsedSec(Math.max(0, Number(reward.elapsedSec || 0)))}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}

                  <div className="modalActions">
                    <button onClick={closeProfileModal}>{profileModalMode === "self" ? L("닫기", "Close") : L("확인", "Close")}</button>
                    {profileModalMode === "self" && profileModalData && (
                      <button onClick={saveProfileAvatarSelection} disabled={profileModalSaving || !profileDirty}>
                        {profileModalSaving ? L("저장 중...", "Saving...") : L("프로필 저장", "Save Profile")}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {shouldShowPuzzleBoard && !isInRaceRoom && (
          <div
                ref={boardStageRef}
                className={`boardWrap puzzleBoardStage ${!isModeCreate ? "hasTopToolbar" : ""}`}
                onContextMenu={(e) => e.preventDefault()}
                data-tutorial={isSingleSoloMode ? "single-board" : undefined}
              >
                {renderBoardTopToolbar()}
                <div className={`excelBoardScaffold ${isExcelMode ? "active" : ""}`}>
                  {isExcelMode && (
                    <div className="excelBoardHeaderRow" aria-hidden="true">
                      <div className="excelBoardHeadCorner" />
                      <div
                        className="excelBoardColLetters"
                        style={{
                          gridTemplateColumns: `repeat(${puzzle.width}, ${cellSize}px)`,
                          marginLeft: `${maxRowHintDepth * cellSize}px`,
                          width: `${puzzle.width * cellSize}px`,
                        }}
                      >
                        {excelBoardCols.map((label, idx) => (
                          <span key={`solo-col-${idx}`}>{label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={`excelBoardBodyRow ${isExcelMode ? "active" : ""}`}>
                    {isExcelMode && (
                      <div
                        className="excelBoardRowNumbers"
                        aria-hidden="true"
                        style={{
                          gridTemplateRows: `repeat(${puzzle.height}, ${cellSize}px)`,
                          marginTop: `${maxColHintDepth * cellSize}px`,
                          height: `${puzzle.height * cellSize}px`,
                        }}
                      >
                        {excelBoardRows.map((label, idx) => (
                          <span key={`solo-row-${idx}`}>{label}</span>
                        ))}
                      </div>
                    )}
                    <div
                      className="nonogram"
                      style={{
                        "--cell-size": `${cellSize}px`,
                        "--left-depth": maxRowHintDepth,
                        "--top-depth": maxColHintDepth,
                        "--board-w": puzzle.width,
                        "--board-h": puzzle.height,
                      }}
                    >
                      <div className="corner" />

                      <div
                        className="colHints"
                        style={{
                          gridTemplateColumns: `repeat(${puzzle.width}, var(--cell-size))`,
                        }}
                      >
                        {colHints.map((hint, colIdx) => (
                          <div
                            key={`col-${colIdx}`}
                            className="colHintCol"
                            style={{ gridTemplateRows: `repeat(${maxColHintDepth}, var(--cell-size))` }}
                          >
                            {Array.from({ length: maxColHintDepth }).map((_, depthIdx) => {
                              const value = hint[hint.length - maxColHintDepth + depthIdx];
                              const hintId = `c-${colIdx}-${depthIdx}`;
                              const solvedByHint = solvedCols.has(colIdx) && value != null;
                              return (
                                <button
                                  key={hintId}
                                  type="button"
                                  className={`hintNum ${activeHints.has(hintId) ? "active" : ""} ${solvedByHint ? "solved" : ""}`}
                                  onClick={() => toggleHint(hintId)}
                                >
                                  {value ?? ""}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      <div
                        className="rowHints"
                        style={{ gridTemplateRows: `repeat(${puzzle.height}, var(--cell-size))` }}
                      >
                        {rowHints.map((hint, rowIdx) => (
                          <div
                            key={`row-${rowIdx}`}
                            className={`rowHintRow ${tutorialHighlightRows.includes(rowIdx) ? "tutorialHintPulse" : ""}`}
                            style={{ gridTemplateColumns: `repeat(${maxRowHintDepth}, var(--cell-size))` }}
                          >
                            {Array.from({ length: maxRowHintDepth }).map((_, depthIdx) => {
                              const value = hint[hint.length - maxRowHintDepth + depthIdx];
                              const hintId = `r-${rowIdx}-${depthIdx}`;
                              const solvedByHint = solvedRows.has(rowIdx) && value != null;
                              return (
                                <button
                                  key={hintId}
                                  type="button"
                                  className={`hintNum ${activeHints.has(hintId) ? "active" : ""} ${solvedByHint ? "solved" : ""}`}
                                  onClick={() => toggleHint(hintId)}
                                >
                                  {value ?? ""}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      <div
                        ref={boardRef}
                        className={`board ${isHpPuzzleMode && puzzleHpDamage ? "hpDamage" : ""}`}
                        style={{
                          width: `${puzzle.width * cellSize}px`,
                          height: `${puzzle.height * cellSize}px`,
                          cursor: canInteractBoard ? "crosshair" : "not-allowed",
                        }}
                        onPointerDown={onBoardPointerDown}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <canvas ref={canvasRef} className="boardCanvas" />
                        {renderCellInputFx()}
                        {renderLineClearFx()}
                        {renderPuzzleHpCellFx()}
                        {renderPuzzleHintCellFx()}
                        {isModeTutorial && tutorialHighlightCells.length > 0 && (
                          <div className="tutorialGuideLayer" aria-hidden="true">
                            {tutorialHighlightCells.map((index) => {
                              const x = index % puzzle.width;
                              const y = Math.floor(index / puzzle.width);
                              return (
                                <span
                                  key={`guide-${index}`}
                                  className="tutorialGuideCell"
                                  style={{
                                    left: `${x * cellSize}px`,
                                    top: `${y * cellSize}px`,
                                    width: `${cellSize}px`,
                                    height: `${cellSize}px`,
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}
                        {isRaceCountdown && (
                          <div className="countdownOverlay">{countdownLeft ?? 0}</div>
                        )}
                        {isRaceLobby && <div className="countdownOverlay wait">{L("READY 대기", "Waiting for READY")}</div>}
                        {isRaceFinished && !isModePvp && <div className="countdownOverlay result">{raceResultText}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
        )}
      </motion.section>
    </main>
  );
}

export default App;


