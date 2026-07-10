const BUILD_VERSION = "20260710";
const productUrl = `./outputs/product_quiz/é‡‘å°Šäº§å“çŸ¥è¯†åº“é¢˜åº“.json?v=${BUILD_VERSION}`;
const roleUrl = `./outputs/role_quiz/å²—ä½å­¦ä¹ è€ƒæ ¸é¢˜åº“.json?v=${BUILD_VERSION}`;
const API_BASES = [];
const API_BASE = "";
const CLOUD_ENABLED = false;
const ADMIN_PHONES = [];
const state = {
  allQuestions: [],
  filtered: [],
  currentBank: "å…¨éƒ¨é¢˜åº“",
  currentView: "dashboard",
  quiz: [],
  quizIndex: 0,
  score: 0,
  answered: false,
  quizMode: "random",
  examType: "practice",
  quizWrong: 0,
  wrongDetails: [],
  currentUser: null,
  cloudStats: null,
  learnPage: 1,
  learnPageSize: 60,
  answeredCount: 0,
  answeredQuestionIds: new Set(),
  examFinished: true,
  examLabelOverride: "",
};

const els = {
  navTabs: [...document.querySelectorAll(".nav-tab")],
  views: {
    dashboard: document.querySelector("#dashboardView"),
    ranking: document.querySelector("#rankingView"),
    learn: document.querySelector("#learnView"),
    quiz: document.querySelector("#quizView"),
    mistakes: document.querySelector("#mistakesView"),
    admin: document.querySelector("#adminView"),
  },
  pageTitle: document.querySelector("#pageTitle"),
  bankSelect: document.querySelector("#bankSelect"),
  bankCount: document.querySelector("#bankCount"),
  mistakeCount: document.querySelector("#mistakeCount"),
  accuracyText: document.querySelector("#accuracyText"),
  taskPanel: document.querySelector("#taskPanel"),
  summaryCards: document.querySelector("#summaryCards"),
  bankCards: document.querySelector("#bankCards"),
  learnFilter: document.querySelector("#learnFilter"),
  learnList: document.querySelector("#learnList"),
  learnCount: document.querySelector("#learnCount"),
  learnPagination: document.querySelector("#learnPagination"),
  searchInput: document.querySelector("#searchInput"),
  resetBtn: document.querySelector("#resetBtn"),
  quizTimer: document.querySelector("#quizTimer"),
  quizWrongCount: document.querySelector("#quizWrongCount"),
  quizSetup: document.querySelector("#quizSetup"),
  quizRunner: document.querySelector("#quizRunner"),
  quizResult: document.querySelector("#quizResult"),
  startQuizBtn: document.querySelector("#startQuizBtn"),
  examType: document.querySelector("#examType"),
  quizSize: document.querySelector("#quizSize"),
  productBankSelect: document.querySelector("#productBankSelect"),
  roleBankSelect: document.querySelector("#roleBankSelect"),
  modeRandom: document.querySelector("#modeRandom"),
  modeProduct: document.querySelector("#modeProduct"),
  modeRole: document.querySelector("#modeRole"),
  quizStep: document.querySelector("#quizStep"),
  quizScore: document.querySelector("#quizScore"),
  progressBar: document.querySelector("#progressBar"),
  quizCard: document.querySelector("#quizCard"),
  mistakeList: document.querySelector("#mistakeList"),
  retryMistakesBtn: document.querySelector("#retryMistakesBtn"),
  clearMistakesBtn: document.querySelector("#clearMistakesBtn"),
  adminMetrics: document.querySelector("#adminMetrics"),
  adminUserTable: document.querySelector("#adminUserTable"),
  adminWeakList: document.querySelector("#adminWeakList"),
  exportRecordsBtn: document.querySelector("#exportRecordsBtn"),
  exportMistakesBtn: document.querySelector("#exportMistakesBtn"),
  authView: document.querySelector("#authView"),
  authForm: document.querySelector("#authForm"),
  authName: document.querySelector("#authName"),
  authPhone: document.querySelector("#authPhone"),
  authRole: document.querySelector("#authRole"),
  authError: document.querySelector("#authError"),
  userName: document.querySelector("#userName"),
  userMeta: document.querySelector("#userMeta"),
  logoutBtn: document.querySelector("#logoutBtn"),
  quizSetupStatus: document.querySelector("#quizSetupStatus"),
  mobileSidebarToggle: document.querySelector("#mobileSidebarToggle"),
  sidebarTools: document.querySelector("#sidebarTools"),
};

const userStore = {
  get users() {
    return JSON.parse(localStorage.getItem("jz_users") || "{}");
  },
  set users(value) {
    localStorage.setItem("jz_users", JSON.stringify(value));
  },
  get currentPhone() {
    return localStorage.getItem("jz_current_phone") || "";
  },
  set currentPhone(value) {
    if (value) {
      localStorage.setItem("jz_current_phone", value);
    } else {
      localStorage.removeItem("jz_current_phone");
    }
  },
};

const isAdminUser = (user = state.currentUser) => {
  const phone = String(user?.phone || "").replace(/\D/g, "");
  return Boolean(phone && ADMIN_PHONES.includes(phone));
};

function applyAdminAccess() {
  const allowed = isAdminUser();
  els.navTabs
    .filter((tab) => tab.dataset.view === "admin")
    .forEach((tab) => {
      tab.classList.toggle("hidden", !allowed);
      tab.setAttribute("aria-hidden", allowed ? "false" : "true");
    });
  if (!allowed && state.currentView === "admin") switchView("dashboard");
}

const userKey = (name) => {
  const phone = state.currentUser?.phone || "guest";
  return `jz_${phone}_${name}`;
};

const storage = {
  get attempts() {
    return Number(localStorage.getItem(userKey("attempts")) || 0);
  },
  set attempts(value) {
    localStorage.setItem(userKey("attempts"), String(value));
  },
  get correct() {
    return Number(localStorage.getItem(userKey("correct")) || 0);
  },
  set correct(value) {
    localStorage.setItem(userKey("correct"), String(value));
  },
  get mistakes() {
    return JSON.parse(localStorage.getItem(userKey("mistakes")) || "[]");
  },
  set mistakes(value) {
    localStorage.setItem(userKey("mistakes"), JSON.stringify(value));
  },
  get examRecords() {
    return JSON.parse(localStorage.getItem(userKey("exam_records")) || "[]");
  },
  set examRecords(value) {
    localStorage.setItem(userKey("exam_records"), JSON.stringify(value));
  },
};

const slogans = [
  "ä»¥ä¸“ä¸šçŸ¥è¯†ç­‘ç‰¢é˜µåœ°æ ¹åŸºï¼Œç”¨æ¯æ¬¡ç»ƒä¹ è§£é”æˆé•¿å‹‹ç« ã€‚",
  "ç”¨çŸ¥è¯†æ‹‰æ»¡å²—ä½æˆ˜æ–—åŠ›ï¼Œåœ¨è¿™é‡ŒæŒ‘æˆ˜å…³ä¹Žå±žäºŽä½ çš„é«˜å…‰æ—¶åˆ»ï¼",
  "æ¯ä¸€æ¬¡ç²¾å‡†çš„ç»ƒä¹ ä¸Žæ²‰æ·€ï¼Œéƒ½åœ¨è§è¯ä½ æ›´å‡ºè‰²çš„ä¸“ä¸šèœ•å˜ã€‚",
  "èšé›†å›¢é˜Ÿç‚¹æ»´ä¸“ä¸šæ™ºæ…§ï¼Œèµ‹èƒ½æ¯ä¸€ä¸ªç‰©èµ„çš„èµ·ç‚¹ï¼Œè®©æˆ‘ä»¬åœ¨å¹¶è‚©å‰è¡Œä¸­å…±åŒèœ•å˜ã€‚",
  "è§£é”å²—ä½æ ¸å¿ƒæŠ€èƒ½ï¼Œä¸Žä¼˜ç§€çš„å‰è¾ˆå¹¶è‚©å‰è¡Œï¼Œåœ¨è¿™é‡Œå¼€å¯ä½ çš„èŒåœºèœ•å˜ä¹‹æ—…ã€‚",
  "çŸ¥è¯†å…±äº«ï¼Œèƒ½åŠ›å…±è¿›ã€‚å‡èšæ¯ä¸€ä¸ªäººçš„ç‚¹æ»´è¿›æ­¥ï¼Œå…±åˆ›å±žäºŽæˆ‘ä»¬çš„ç²¾å½©æœªæ¥ã€‚",
  "è¿™é‡Œæ˜¯æˆ‘ä»¬çš„ä¸“ä¸šåŠ æ²¹ç«™ï¼Œç”¨çŸ¥è¯†æ— å¤„ä¸èµ‹èƒ½ï¼Œåœ¨å¹¶è‚©æŒ‘æˆ˜ä¸­å‘ä¸Šèœ•å˜ã€‚",
];

let sloganIndex = 0;
let sloganTimer = null;

function initSlogan() {
  const el = document.querySelector("#heroSlogan");
  const dots = document.querySelector("#sloganDots");
  if (!el || !dots) return;

  dots.innerHTML = slogans.map((_, i) =>
    `<button class="slogan-dot${i === 0 ? " active" : ""}" data-i="${i}" aria-label="æŸ¥çœ‹ç¬¬ ${i + 1} æ¡å­¦ä¹ æç¤º"></button>`
  ).join("");

  dots.querySelectorAll(".slogan-dot").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearInterval(sloganTimer);
      showSlogan(Number(btn.dataset.i));
      sloganTimer = setInterval(nextSlogan, 4000);
    });
  });

  showSlogan(0);
  sloganTimer = setInterval(nextSlogan, 4000);
}

function showSlogan(index) {
  const el = document.querySelector("#heroSlogan");
  const dots = document.querySelector("#sloganDots");
  if (!el) return;
  sloganIndex = index;
  el.classList.remove("slogan-in");
  void el.offsetWidth;
  el.textContent = slogans[index];
  el.classList.add("slogan-in");
  dots?.querySelectorAll(".slogan-dot").forEach((btn, i) =>
    btn.classList.toggle("active", i === index)
  );
}

function nextSlogan() {
  showSlogan((sloganIndex + 1) % slogans.length);
}

const pageTitles = {
  dashboard: "å­¦ä¹ æ€»è§ˆ",
  ranking: "æŽ’è¡Œæ¦œ",
  learn: "å­¦ä¹ é¢˜åº“",
  quiz: "å­¦ä¹ è€ƒæ ¸",
  mistakes: "é”™é¢˜å¤ä¹ ",
  admin: "ç®¡ç†çœ‹æ¿",
};

const normalize = (value) => String(value ?? "").toLowerCase().trim();

const shelfLifeDays = (value) => {
  const text = String(value ?? "").trim();
  const digits = text.match(/\d+/)?.[0];
  if (!digits) return null;
  const number = Number(digits);
  if (text.includes("å¤©")) return number;
  return text.includes("æœˆ") ? number * 30 : number;
};

const isEquivalentAnswer = (question, selectedLetter) => {
  if (selectedLetter === question.answer) return true;
  if (question.knowledgePoint !== "ä¿è´¨æœŸ") return false;
  const selected = optionEntries(question).find(([letter]) => letter === selectedLetter)?.[1];
  const selectedDays = shelfLifeDays(selected);
  const answerDays = shelfLifeDays(question.answerText);
  return selectedDays !== null && answerDays !== null && selectedDays === answerDays;
};

// Strip product code from option text for quiz display.
// Only applied to äº§å“åç§° questions where the code in the option text gives away the answer.
const stripCodeFromOption = (text, question) => {
  if (question.knowledgePoint !== "äº§å“åç§°" || !text) return text;
  const isCorrectAnswer = text === question.answerText;
  const answerStartsWithCurrentCode = normalize(text).startsWith(normalize(question.code));
  if (isCorrectAnswer && !answerStartsWithCurrentCode) return text;
  return text
    .replace(/^\d{4}[A-Za-z]?\s*/, "") // "2232A é‡‘å°Š..." / "2421æ¾³é—¨å…«æ˜Ÿ..." â†’ "é‡‘å°Š..." / "æ¾³é—¨å…«æ˜Ÿ..."
    .replace(/ã€[^ã€‘]+ã€‘/g, "")          // "ç¤¼ç›’ã€0206ã€‘2ç›’è£…" â†’ "ç¤¼ç›’2ç›’è£…"
    .trim();
};

const displayAnswerText = (question) => stripCodeFromOption(question.answerText, question);
const displayExplanation = (question) => {
  if (question.knowledgePoint !== "äº§å“åç§°") return question.explanation;
  const name = displayAnswerText(question);
  return `${question.code} å¯¹åº”çš„äº§å“åç§°æ˜¯ï¼š${name}ã€‚`;
};

const imagePath = (src) => (src ? `./${src}` : "");

const optionEntries = (question) => [
  ["A", question.optionA, question.optionAImage, Number(question.optionAImageWidth) || 0],
  ["B", question.optionB, question.optionBImage, Number(question.optionBImageWidth) || 0],
  ["C", question.optionC, question.optionCImage, Number(question.optionCImageWidth) || 0],
  ["D", question.optionD, question.optionDImage, Number(question.optionDImageWidth) || 0],
].filter(([, text, image]) => text || image);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const shuffle = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const downloadText = (filename, content, type = "text/csv;charset=utf-8") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const toCsv = (headers, rows) => {
  const lines = [headers.map(csvCell).join(",")];
  rows.forEach((row) => lines.push(headers.map((header) => csvCell(row[header])).join(",")));
  return `\uFEFF${lines.join("\n")}`;
};

const todayKey = (value = new Date()) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getUserRecords = (phone) =>
  JSON.parse(localStorage.getItem(`jz_${phone}_exam_records`) || "[]");

const getUserMistakes = (phone) =>
  JSON.parse(localStorage.getItem(`jz_${phone}_mistakes`) || "[]");

function setSyncStatus(text, type = "info") {
  const existing = document.querySelector("#cloudSyncStatus");
  const target = existing || document.createElement("div");
  target.id = "cloudSyncStatus";
  target.className = `cloud-sync-status ${type}`;
  target.textContent = text;
  if (!existing) document.body.appendChild(target);
  clearTimeout(target._timer);
  target._timer = setTimeout(() => target.remove(), type === "error" ? 8000 : 3000);
}

async function cloudRequest(action, payload) {
  if (!CLOUD_ENABLED) return { ok: true, skipped: true };
  const body = JSON.stringify({ ...payload, userAgent: navigator.userAgent, deviceId: navigator.userAgent });
  let lastError = null;
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}/api/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) throw new Error(`äº‘ç«¯åŒæ­¥å¤±è´¥ï¼š${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "äº‘ç«¯åŒæ­¥å¤±è´¥");
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  for (const base of API_BASES) {
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
        if (navigator.sendBeacon(`${base}/api/${action}`, blob)) return { ok: true, fallback: true };
      }
    } catch {}
    try {
      await fetch(`${base}/api/${action}`, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        keepalive: body.length < 60000,
      });
      return { ok: true, fallback: true };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("äº‘ç«¯åŒæ­¥å¤±è´¥");
}

async function syncLater(action, payload) {
  if (!CLOUD_ENABLED) return { ok: true, skipped: true };
  try {
    const data = await cloudRequest(action, payload);
    if (action === "exam") setSyncStatus(data.fallback ? "è€ƒè¯•æˆç»©å·²æäº¤ï¼Œæ­£åœ¨åŽå°åŒæ­¥é£žä¹¦" : "è€ƒè¯•æˆç»©å·²åŒæ­¥åˆ°é£žä¹¦", "success");
    if (action === "login") setSyncStatus(data.fallback ? "ç™»å½•è®°å½•å·²æäº¤ï¼Œæ­£åœ¨åŽå°åŒæ­¥é£žä¹¦" : (data.warning || "ç™»å½•è”ç³»è®°å½•å·²åŒæ­¥"), data.warning ? "warn" : "success");
    return data;
  } catch (error) {
    const queue = JSON.parse(localStorage.getItem("jz_sync_queue") || "[]");
    queue.push({ action, payload, createdAt: new Date().toISOString(), error: error.message });
    localStorage.setItem("jz_sync_queue", JSON.stringify(queue.slice(-300)));
    setSyncStatus(`äº‘ç«¯åŒæ­¥å¤±è´¥ï¼Œå·²æš‚å­˜æœ¬æœºï¼š${error.message}`, "error");
    return { ok: false, error: error.message };
÷Mµ¶‰žËkºwµç@ì4(€ÍÑ…Ñ”¹…¹ÍÝ•É•‘EÕ•ÍÑ¥½¹%‘Ì€ô¹•ÜM•Ð ¤ì4(€ÍÑ…Ñ”¹ÅÕ¥é]É½¹œ€ô€Àì4(€ÍÑ…Ñ”¹ÝÉ½¹•Ñ…¥±Ì€ômtì4(€ÍÑ…Ñ”¹•á…µQåÁ”€ô€‰ÁÉ…Ñ¥”ˆì4(€ÍÑ…Ñ”¹•á…µ¥¹¥Í¡•€ô™…±Í”ì4(€ÍÑ…Ñ”¹•á…µ1…‰•±=Ù•ÉÉ¥‘”€ô€‹¦Rg¦Šc¦7žîˆì4(€ÍÑ…ÉÑQ¥µ•È¡ÅÕ¥éQ¥µ•1¥µ¥Ð¡ÍÑ…Ñ”¹ÅÕ¥è¹±•¹Ñ ¤¤ì4(€ÕÁ‘…Ñ•]É½¹½Õ¹Ð ¤ì4(€ÍÝ¥Ñ¡Y¥•Ü ‰ÅÕ¥èˆ¤ì4(€•±Ì¹ÅÕ¥éM•ÑÕÀ¹±…ÍÍ1¥ÍÐ¹…‘ ‰¡¥‘‘•¸ˆ¤ì4(€•±Ì¹ÅÕ¥éI•ÍÕ±Ð¹±…ÍÍ1¥ÍÐ¹…‘ ‰¡¥‘‘•¸ˆ¤ì4(€•±Ì¹ÅÕ¥éIÕ¹¹•È¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰¡¥‘‘•¸ˆ¤ì4(€É•¹‘•ÉEÕ¥é…É ¤ì4)ô4(4)±•ÐÉ…¹­M½ÉÑ5½‘”€ô€‰Í½É”ˆì4(4)™Õ¹Ñ¥½¸É•¹‘•ÉI…¹­¥¹œ ¤ì4(€½¹ÍÐ±¥ÍÑ°€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆÉ…¹­¥¹1¥ÍÐˆ¤ì4(€¥˜€ …±¥ÍÑ°¤É•ÑÕÉ¸ì4(4(€½¹ÍÐ…±±UÍ•ÉÌ€ôÕÍ•ÉMÑ½É”¹ÕÍ•ÉÌì4(€½¹ÍÐÉ½ÝÌ€ô=‰©•Ð¹Ù…±Õ•Ì¡…±±UÍ•ÉÌ¤¹µ…À ¡ÕÍ•È¤€ôøì4(€€€½¹ÍÐÉ•½É‘Ì€ô)M=8¹Á…ÉÍ” 4(€€€€€±½…±MÑ½É…”¹•Ñ%Ñ•´¡©é|‘íÕÍ•È¹Á¡½¹•õ}•á…µ}É•½É‘Í€¤ñð€‰mtˆ4(€€€€¤ì4(€€€¥˜€ …É•½É‘Ì¹±•¹Ñ ¤É•ÑÕÉ¸¹Õ±°ì4(€€€½¹ÍÐ‰•ÍÐ€ôÉ•½É‘Ì¹É•‘Õ” ¡„°ˆ¤€ôøì4(€€€€€¥˜€¡ˆ¹Á•É•¹Ð€ø„¹Á•É•¹Ð¤É•ÑÕÉ¸ˆì4(€€€€€¥˜€¡ˆ¹Á•É•¹Ð€ôôô„¹Á•É•¹Ð€˜˜€¡ˆ¹‘ÕÉ…Ñ¥½¸€üü€äääää¤€ð€¡„¹‘ÕÉ…Ñ¥½¸€üü€äääää¤¤É•ÑÕÉ¸ˆì4(€€€€€É•ÑÕÉ¸„ì4(€€€ô¤ì4(€€€É•ÑÕÉ¸ìÕÍ•È°‰•ÍÐ°Ñ½Ñ…±á…µÌèÉ•½É‘Ì¹±•¹Ñ ôì4(€ô¤¹™¥±Ñ•È¡	½½±•…¸¤ì4(4(€¥˜€¡É…¹­M½ÉÑ5½‘”€ôôô€‰Ñ¥µ”ˆ¤ì4(€€€É½ÝÌ¹Í½ÉÐ ¡„°ˆ¤€ôøì4(€€€€€½¹ÍÐÑ„€ô„¹‰•ÍÐ¹‘ÕÉ…Ñ¥½¸€üü€äääääì4(€€€€€½¹ÍÐÑˆ€ôˆ¹‰•ÍÐ¹‘ÕÉ…Ñ¥½¸€üü€äääääì4(€€€€€¥˜€¡Ñ„€„ôôÑˆ¤É•ÑÕÉ¸Ñ„€´Ñˆì4(€€€€€É•ÑÕÉ¸ˆ¹‰•ÍÐ¹Á•É•¹Ð€´„¹‰•ÍÐ¹Á•É•¹Ðì4(€€€ô¤ì4(€ô•±Í”ì4(€€€É½ÝÌ¹Í½ÉÐ ¡„°ˆ¤€ôøì4(€€€€€¥˜€¡ˆ¹‰•ÍÐ¹Á•É•¹Ð€„ôô„¹‰•ÍÐ¹Á•É•¹Ð¤É•ÑÕÉ¸ˆ¹‰•ÍÐ¹Á•É•¹Ð€´„¹‰•ÍÐ¹Á•É•¹Ðì4(€€€€€É•ÑÕÉ¸€¡„¹‰•ÍÐ¹‘ÕÉ…Ñ¥½¸€üü€äääää¤€´€¡ˆ¹‰•ÍÐ¹‘ÕÉ…Ñ¥½¸€üü€äääää¤ì4(€€€ô¤ì4(€ô4(4(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤ì4(€€€±¥ÍÑ°¹¥¹¹•É!Q50€ô€ñ‘¥Ø±…ÍÌô‰•µÁÑäˆû¢þcšÊ‡šr'¢š‚ã¢ºÃ–öW¾ò3–º3š"C’âš²‡¢š‚ã–B;–6Ï–>¿’â+ššsŽð½‘¥Øù€ì4(€€€É•ÑÕÉ¸ì4(€ô4(4(€½¹ÍÐµ•‘…±±…ÍÌ€ô€¡¤¤€ôø€¡¤€ôôô€À€ü€ˆÉ…¹¬µ½±ˆ€è¤€ôôô€Ä€ü€ˆÉ…¹¬µÍ¥±Ù•Èˆ€è¤€ôôô€È€ü€ˆÉ…¹¬µ‰É½¹é”ˆ€è€ˆˆ¤ì4(€½¹ÍÐµ•‘…±1…‰•°€ô€¡¤¤€ôø€¡¤€ôôô€À€ü€‹Â~–ˆ€è¤€ôôô€Ä€ü€‹Â~– ˆ€è¤€ôôô€È€ü€‹Â~–$ˆ€èMÑÉ¥¹œ¡¤€¬€Ä¤¤ì4(4(€±¥ÍÑ°¹¥¹¹•É!Q50€ôÉ½ÝÌ¹µ…À ¡ìÕÍ•È°‰•ÍÐ°Ñ½Ñ…±á…µÌô°¤¤€ôø€4(€€€€ñ‘¥Ø±…ÍÌô‰É…¹¬µÉ½Ü‘í¤€ð€Ì€ü€ˆÉ…¹¬µÑ½Àˆ€è€ˆ‰ôˆø4(€€€€€€ñ‘¥Ø±…ÍÌô‰É…¹¬µ¹Õ´‘íµ•‘…±±…ÍÌ¡¤¥ôˆø‘íµ•‘…±1…‰•°¡¤¥ôð½‘¥Øø4(€€€€€€ñ‘¥Ø±…ÍÌô‰É…¹¬µ¥¹™¼ˆø4(€€€€€€€€ñÍÑÉ½¹œø‘í•Í…Á•!Ñµ°¡ÕÍ•È¹¹…µ”¥ôð½ÍÑÉ½¹œø4(€€€€€€€€ñÍÁ…¸ø‘í•Í…Á•!Ñµ°¡ÕÍ•È¹É½±”¥ôƒ
Üƒ¢š‚à€‘íÑ½Ñ…±á…µÍôƒš²„ð½ÍÁ…¸ø4(€€€€€€ð½‘¥Øø4(€€€€€€ñ‘¥Ø±…ÍÌô‰É…¹¬µµ¥ˆø4(€€€€€€€€ñÍÁ…¸±…ÍÌô‰É…¹¬µ‰…¹¬ˆø‘í•Í…Á•!Ñµ°¡‰•ÍÐ¹‰…¹¬ñð€ˆˆ¥ôð½ÍÁ…¸ø4(€€€€€€€€ñÍÁ…¸±…ÍÌô‰É…¹¬µ‘•Ñ…¥°µÑ¥µ”ˆø‘í‰•ÍÐ¹‘ÕÉ…Ñ¥½¸€„ô¹Õ±°€ü€‹Š>Ä€ˆ€¬™½Éµ…ÑQ¥µ”¡‰•ÍÐ¹‘ÕÉ…Ñ¥½¸¤€è€ˆ‰ôð½ÍÁ…¸ø4(€€€€€€ð½‘¥Øø4(€€€€€€ñ‘¥Ø±…ÍÌô‰É…¹¬µÍ½É”‘í‰•ÍÐ¹Á•É•¹Ð€øô€äÀ€ü€ˆÉ…¹¬µÍ½É”µ¡¥ ˆ€è€ˆ‰ôˆø‘í‰•ÍÐ¹Á•É•¹ÑôñÍµ…±°û–"ð½Íµ…±°øð½‘¥Øø4(€€€€ð½‘¥Øø4(€€¤¹©½¥¸ ˆˆ¤ì4(4(€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹É…¹¬µÍ½ÉÐµ‰Ñ¸ˆ¤¹™½É…  ¡‰Ñ¸¤€ôøì4(€€€‰Ñ¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰…Ñ¥Ù”ˆ°‰Ñ¸¹‘…Ñ…Í•Ð¹Í½ÉÐ€ôôôÉ…¹­M½ÉÑ5½‘”¤ì4(€€€‰Ñ¸¹½¹±¥¬€ô€ ¤€ôøì4(€€€€€É…¹­M½ÉÑ5½‘”€ô‰Ñ¸¹‘…Ñ…Í•Ð¹Í½ÉÐì4(€€€€€É•¹‘•ÉI…¹­¥¹œ ¤ì4(€€€ôì4(€ô¤ì4)ô4(4)™Õ¹Ñ¥½¸É•¹‘•É‘µ¥¸ ¤ì4(€¥˜€ …¥Í‘µ¥¹UÍ•È ¤¤ì4(€€€•±Ì¹…‘µ¥¹5•ÑÉ¥Ì¹¥¹¹•É!Q50€ô€ñ‘¥Ø±…ÍÌô‰•µÁÑäˆûš^ƒšv¦fC¢ºÿ¦^»žº‡žBžr/švÿŽð½‘¥Øù€ì4(€€€•±Ì¹…‘µ¥¹UÍ•ÉQ…‰±”¹¥¹¹•É!Q50€ô€ˆˆì4(€€€•±Ì¹…‘µ¥¹]•…­1¥ÍÐ¹¥¹¹•É!Q50€ô€ˆˆì4(€€€É•ÑÕÉ¸ì4(€ô4(€½¹ÍÐ±½Õ€ôÍÑ…Ñ”¹±½Õ‘MÑ…ÑÌì4(€½¹ÍÐÕÍ•ÉÌ€ô±½Õü¹•µÁ±½å••Ìü¹±•¹Ñ 4(€€€€ü±½Õ¹•µÁ±½å••Ì¹µ…À ¡Ô¤€ôø€¡ì¹…µ”èÕl‹–žO–B4‰t°Á¡½¹”èÕl‹š&/šrë–>Ü‰t°É½±”èÕl‹–Ê_’ö4‰tô¤¤4(€€€€è=‰©•Ð¹Ù…±Õ•Ì¡ÕÍ•ÉMÑ½É”¹ÕÍ•ÉÌ¤ì4(€½¹ÍÐÉ½ÝÌ€ôÕÍ•ÉÌ¹µ…À ¡ÕÍ•È¤€ôøì4(€€€½¹ÍÐÉ•½É‘Ì€ô±½Õü¹•á…µÌü¹±•¹Ñ 4(€€€€€€ü±½Õ¹•á…µÌ¹™¥±Ñ•È ¡È¤€ôøMÑÉ¥¹œ¡Él‹š&/šrë–>Ü‰t¤€ôôôMÑÉ¥¹œ¡ÕÍ•È¹Á¡½¹”¤¤¹µ…À ¡È¤€ôø€¡ì4(€€€€€€€€€Á•É•¹Ðè9Õµ‰•È¡Él‹–"šVÀ‰tñð€À¤°Í½É”è9Õµ‰•È¡Él‹ž¶S–¾ç¦ŠcšVÀ‰tñð€À¤°Ñ½Ñ…°è9Õµ‰•È¡Él‹šï¦ŠcšVÀ‰tñð€À¤°4(€€€€€€€€€ÝÉ½¹œè9Õµ‰•È¡Él‹¦Rg¦ŠcšVÀ‰tñð€À¤°‘ÕÉ…Ñ¥½¸è9Õµ‰•È¡Él‹žR£š^ÛžžH‰tñð€À¤°‰…¹¬èÉl‹¦Šc–êL‰t°ÑåÁ”èÉl‹¢š‚ãžÆï–z,‰t°™¥¹¥Í¡•‘ÐèÉl‹–º3š"Cš^Û¦^Ð‰t°4(€€€€€€€ô¤¤4(€€€€€€è•ÑUÍ•ÉI•½É‘Ì¡ÕÍ•È¹Á¡½¹”¤ì4(€€€½¹ÍÐµ¥ÍÑ…­•Ì€ô±½Õü¹µ¥ÍÑ…­•Ìü¹±•¹Ñ 4(€€€€€€ü±½Õ¹µ¥ÍÑ…­•Ì¹™¥±Ñ•È ¡È¤€ôøMÑÉ¥¹œ¡Él‹š&/šrë–>Ü‰t¤€ôôôMÑÉ¥¹œ¡ÕÍ•È¹Á¡½¹”¤¤¹µ…À ¡È¤€ôø€¡ì­¹½Ý±•‘•A½¥¹ÐèÉl‹ž~—¢¾ž
ä‰t°‰…¹¬èÉl‹¦Šc–êL‰tô¤¤4(€€€€€€è•ÑUÍ•É5¥ÍÑ…­•Ì¡ÕÍ•È¹Á¡½¹”¤ì4(€€€½¹ÍÐ‰•ÍÐ€ôÉ•½É‘Ì¹É•‘Õ” ¡…Œ°É•½É¤€ôø€¡9Õµ‰•È¡É•½É¹Á•É•¹Ð¤€ø9Õµ‰•È¡…Œü¹Á•É•¹Ðñð€´Ä¤€üÉ•½É€è…Œ¤°¹Õ±°¤ì4(€€€½¹ÍÐ±…Ñ•ÍÐ€ôÉ•½É‘ÍlÁtì4(€€€É•ÑÕÉ¸ìÕÍ•È°É•½É‘Ì°µ¥ÍÑ…­•Ì°‰•ÍÐ°±…Ñ•ÍÐôì4(€ô¤ì4(€½¹ÍÐ…±±I•½É‘Ì€ôÉ½ÝÌ¹™±…Ñ5…À ¡É½Ü¤€ôøÉ½Ü¹É•½É‘Ì¹µ…À ¡É•½É¤€ôø€¡ì€¸¸¹É•½É°ÕÍ•ÈèÉ½Ü¹ÕÍ•Èô¤¤¤ì4(€½¹ÍÐ…Ùœ€ô…±±I•½É‘Ì¹±•¹Ñ €ü5…Ñ ¹É½Õ¹¡…±±I•½É‘Ì¹É•‘Õ” ¡ÍÕ´°È¤€ôøÍÕ´€¬9Õµ‰•È¡È¹Á•É•¹Ðñð€À¤°€À¤€¼…±±I•½É‘Ì¹±•¹Ñ ¤€è€Àì4(€½¹ÍÐÁ…ÍÍ•€ô…±±I•½É‘Ì¹™¥±Ñ•È ¡È¤€ôø9Õµ‰•È¡È¹Á•É•¹Ð¤€øô€àÀ¤¹±•¹Ñ ì4(€½¹ÍÐÁ…ÍÍI…Ñ”€ô…±±I•½É‘Ì¹±•¹Ñ €ü5…Ñ ¹É½Õ¹ ¡Á…ÍÍ•€¼…±±I•½É‘Ì¹±•¹Ñ ¤€¨€ÄÀÀ¤€è€Àì4(€½¹ÍÐ¹½Ñá…´€ôÉ½ÝÌ¹™¥±Ñ•È ¡É½Ü¤€ôø€…É½Ü¹É•½É‘Ì¹±•¹Ñ ¤¹±•¹Ñ ì4(4(€•±Ì¹…‘µ¥¹5•ÑÉ¥Ì¹¥¹¹•É!Q50€ô€4(€€€€ñ‘¥Ø±…ÍÌô‰ÍÕµµ…Éäµ…ÉˆøñÍÁ…¸û–Fc–Þ—šVÀð½ÍÁ…¸øñÍÑÉ½¹œø‘íÕÍ•ÉÌ¹±•¹Ñ¡ôð½ÍÑÉ½¹œøñÍµ…±°ø‘í±½Õü¹•µÁ±½å••Ìü¹±•¹Ñ €ü€‹¦Ž{’æ›’êGž®¿šVÃš6¸ˆ€è€‹šr³šrë–ÞËžfï–öW¢Ò›–>Ü‰ôð½Íµ…±°øð½‘¥Øø4(€€€€ñ‘¥Ø±…ÍÌô‰ÍÕµµ…Éäµ…ÉˆøñÍÁ…¸û¢¢¾Wš²‡šVÀð½ÍÁ…¸øñÍÑÉ½¹œø‘í…±±I•½É‘Ì¹±•¹Ñ¡ôð½ÍÑÉ½¹œøñÍµ…±°ûš¶–ò<¯žî’æƒ¢ºÃ–öTð½Íµ…±°øð½‘¥Øø4(€€€€ñ‘¥Ø±…ÍÌô‰ÍÕµµ…Éäµ…ÉˆøñÍÁ…¸û–æÏ–v–"ð½ÍÁ…¸øñÍÑÉ½¹œø‘í…Ùôð½ÍÑÉ½¹œøñÍµ…±°û–£¦£¢¢¾W¢ºÃ–öTð½Íµ…±°øð½‘¥Øø4(€€€€ñ‘¥Ø±…ÍÌô‰ÍÕµµ…Éäµ…ÉˆøñÍÁ…¸û¦k¢þž:ð½ÍÁ…¸øñÍÑÉ½¹œø‘íÁ…ÍÍI…Ñ•ô”ð½ÍÑÉ½¹œøñÍµ…±°øàÀƒ–"’î—’â+¦k¢þ¾ò3šr«¢€‘í¹½Ñá…µôƒ’êèð½Íµ…±°øð½‘¥Øø4(€€ì4(4(€•±Ì¹…‘µ¥¹UÍ•ÉQ…‰±”¹¥¹¹•É!Q50€ôÉ½ÝÌ¹±•¹Ñ €ü€4(€€€€ñÑ…‰±”ø4(€€€€€€ñÑ¡•…øñÑÈøñÑ û–žO–B4ð½Ñ øñÑ û–Ê_’ö4ð½Ñ øñÑ ûš²‡šVÀð½Ñ øñÑ ûšr’öÌð½Ñ øñÑ ûšr¢þDð½Ñ øñÑ û¦Rg¦Š`ð½Ñ øð½ÑÈøð½Ñ¡•…ø4(€€€€€€ñÑ‰½‘äø4(€€€€€€€€‘íÉ½ÝÌ¹µ…À ¡ìÕÍ•È°É•½É‘Ì°µ¥ÍÑ…­•Ì°‰•ÍÐ°±…Ñ•ÍÐô¤€ôø€4(€€€€€€€€€€ñÑÈø4(€€€€€€€€€€€€ñÑø‘í•Í…Á•!Ñµ°¡ÕÍ•È¹¹…µ”¥ôð½Ñø4(€€€€€€€€€€€€ñÑø‘í•Í…Á•!Ñµ°¡ÕÍ•È¹É½±”¥ôð½Ñø4(€€€€€€€€€€€€ñÑø‘íÉ•½É‘Ì¹±•¹Ñ¡ôð½Ñø4(€€€€€€€€€€€€ñÑø‘í‰•ÍÐ€ü€‘í‰•ÍÐ¹Á•É•¹Ñ÷–"€€è€‹šr«¢‰ôð½Ñø4(€€€€€€€€€€€€ñÑø‘í±…Ñ•ÍÐ€ü€‘í±…Ñ•ÍÐ¹Á•É•¹Ñ÷–"ƒ
Ü€‘í•á…µQ¥µ•1…‰•°¡±…Ñ•ÍÐ¹™¥¹¥Í¡•‘Ð¥õ€€è€ˆ´´‰ôð½Ñø4(€€€€€€€€€€€€ñÑø‘íµ¥ÍÑ…­•Ì¹±•¹Ñ¡ôð½Ñø4(€€€€€€€€€€ð½ÑÈø4(€€€€€€€€¤¹©½¥¸ ˆˆ¥ô4(€€€€€€ð½Ñ‰½‘äø4(€€€€ð½Ñ…‰±”ø4(€€€è€ñ‘¥Ø±…ÍÌô‰•µÁÑäˆûšjš^ƒ–Fc–Þ—¢ºÃ–öWŽð½‘¥Øù€ì4(4(€½¹ÍÐ…±±5¥ÍÑ…­•Ì€ôÉ½ÝÌ¹™±…Ñ5…À ¡É½Ü¤€ôøÉ½Ü¹µ¥ÍÑ…­•Ì¤ì4(€½¹ÍÐÝ•…¬€ô…±±5¥ÍÑ…­•Ì¹É•‘Õ” ¡…Œ°Ä¤€ôøì4(€€€½¹ÍÐ­•ä€ôÄ¹­¹½Ý±•‘•A½¥¹ÐñðÄ¹‰…¹¬ñð€‹–Û’îXˆì4(€€€…m­•åt€ô€¡…m­•åtñð€À¤€¬€Äì4(€€€É•ÑÕÉ¸…Œì4(€ô°íô¤ì4(€½¹ÍÐÝ•…­I½ÝÌ€ô=‰©•Ð¹•¹ÑÉ¥•Ì¡Ý•…¬¤¹Í½ÉÐ ¡„°ˆ¤€ôø‰lÅt€´…lÅt¤¹Í±¥” À°€ÄÈ¤ì4(€•±Ì¹…‘µ¥¹]•…­1¥ÍÐ¹¥¹¹•É!Q50€ôÝ•…­I½ÝÌ¹±•¹Ñ €ü€4(€€€€ñÑ…‰±”øñÑ¡•…øñÑÈøñÑ ûž~—¢¾ž
äð½Ñ øñÑ û¦Rg¦ŠcšVÀð½Ñ øð½ÑÈøð½Ñ¡•…øñÑ‰½‘äø4(€€€€€€‘íÝ•…­I½ÝÌ¹µ…À ¡m¹…µ”°½Õ¹Ñt¤€ôø€ñÑÈøñÑø‘í•Í…Á•!Ñµ°¡¹…µ”¥ôð½ÑøñÑø‘í½Õ¹Ñôð½Ñøð½ÑÈù€¤¹©½¥¸ ˆˆ¥ô4(€€€€ð½Ñ‰½‘äøð½Ñ…‰±”ø4(€€€è€ñ‘¥Ø±…ÍÌô‰•µÁÑäˆûšjš^ƒ¦Rg¦Šcžî¢º‡Žð½‘¥Øù€ì4)ô4(4)™Õ¹Ñ¥½¸•áÁ½ÉÑI•½É‘Ì ¤ì4(€½¹ÍÐÉ½ÝÌ€ôÍÑ…Ñ”¹±½Õ‘MÑ…ÑÌü¹•á…µÌü¹±•¹Ñ 4(€€€€üÍÑ…Ñ”¹±½Õ‘MÑ…ÑÌ¹•á…µÌ¹µ…À ¡È¤€ôø€¡ì4(€€€€€€€ƒ–žO–B4èÉl‹–žO–B4‰t°ƒš&/šrë–>ÜèÉl‹š&/šrë–>Ü‰t°ƒ–Ê_’ö4èÉl‹–Ê_’ö4‰t°ƒ¢š‚ãžÆï–z,èÉl‹¢š‚ãžÆï–z,‰t°ƒ¦Šc–êLèÉl‹¦Šc–êL‰t°ƒ–"šVÀèÉl‹–"šVÀ‰t°ƒž¶S–¾äèÉl‹ž¶S–¾ç¦ŠcšVÀ‰t°ƒšï¦ŠcšVÀèÉl‹šï¦ŠcšVÀ‰t°ƒ¦Rg¦ŠcšVÀèÉl‹¦Rg¦ŠcšVÀ‰t°ƒšb¿–B›¦k¢þèÉl‹šb¿–B›¦k¢þ‰t°ƒžR£š^ÛžžHèÉl‹žR£š^ÛžžH‰t°ƒ–º3š"Cš^Û¦^ÐèÉl‹–º3š"Cš^Û¦^Ð‰t°4(€€€€€ô¤¤4(€€€€è=‰©•Ð¹Ù…±Õ•Ì¡ÕÍ•ÉMÑ½É”¹ÕÍ•ÉÌ¤¹™±…Ñ5…À ¡ÕÍ•È¤€ôø•ÑUÍ•ÉI•½É‘Ì¡ÕÍ•È¹Á¡½¹”¤¹µ…À ¡É•½É¤€ôø€¡ì4(€€€€€€€ƒ–žO–B4èÕÍ•È¹¹…µ”°4(€€€€€€€ƒš&/šrë–>ÜèÕÍ•È¹Á¡½¹”°4(€€€€€€€ƒ–Ê_’ö4èÕÍ•È¹É½±”°4(€€€€€€€ƒ¢š‚ãžÆï–z,èÉ•½É¹ÑåÁ”ñð€‹žî’æƒš¢‡–ò<ˆ°4(€€€€€€€ƒ¦Šc–êLèÉ•½É¹‰…¹¬°4(€€€€€€€ƒ–"šVÀèÉ•½É¹Á•É•¹Ð°4(€€€€€€€ƒž¶S–¾äèÉ•½É¹Í½É”°4(€€€€€€€ƒšï¦ŠcšVÀèÉ•½É¹Ñ½Ñ…°°4(€€€€€€€ƒ¦Rg¦ŠcšVÀèÉ•½É¹ÝÉ½¹œ€üü5…Ñ ¹µ…à À°9Õµ‰•È¡É•½É¹Ñ½Ñ…°ñð€À¤€´9Õµ‰•È¡É•½É¹Í½É”ñð€À¤¤°4(€€€€€€€ƒšb¿–B›¦k¢þè9Õµ‰•È¡É•½É¹Á•É•¹Ð¤€øô€àÀ€ü€‹šb¼ˆ€è€‹–B˜ˆ°4(€€€€€€€ƒžR£š^ÛžžHèÉ•½É¹‘ÕÉ…Ñ¥½¸°4(€€€€€€€ƒ–º3š"Cš^Û¦^ÐèÉ•½É¹™¥¹¥Í¡•‘Ð°4(€€€€€ô¤¤¤ì4(€‘½Ý¹±½…‘Q•áÐ¡ƒ¦G–Â+¢¢¾W¢ºÃ–öU|‘íÑ½‘…å-•ä ¥ô¹ÍÙ€°Ñ½ÍØ¡l‹–žO–B4ˆ°€‹š&/šrë–>Üˆ°€‹–Ê_’ö4ˆ°€‹¢š‚ãžÆï–z,ˆ°€‹¦Šc–êLˆ°€‹–"šVÀˆ°€‹ž¶S–¾äˆ°€‹šï¦ŠcšVÀˆ°€‹¦Rg¦ŠcšVÀˆ°€‹šb¿–B›¦k¢þˆ°€‹žR£š^ÛžžHˆ°€‹–º3š"Cš^Û¦^Ð‰t°É½ÝÌ¤¤ì4)ô4(4)™Õ¹Ñ¥½¸•áÁ½ÉÑ5¥ÍÑ…­•Ì ¤ì4(€½¹ÍÐÉ½ÝÌ€ôÍÑ…Ñ”¹±½Õ‘MÑ…ÑÌü¹µ¥ÍÑ…­•Ìü¹±•¹Ñ 4(€€€€üÍÑ…Ñ”¹±½Õ‘MÑ…ÑÌ¹µ¥ÍÑ…­•Ì¹µ…À ¡Ä¤€ôø€¡ì4(€€€€€€€ƒ–žO–B4èÅl‹–žO–B4‰t°ƒš&/šrë–>ÜèÅl‹š&/šrë–>Ü‰t°ƒ–Ê_’ö4èÅl‹–Ê_’ö4‰t°ƒ¦Šc–êLèÅl‹¦Šc–êL‰t°ƒž~—¢¾ž
äèÅl‹ž~—¢¾ž
ä‰t°ƒ¦Šcžn¸èÅl‹¦Šcžn¸‰t°ƒ¦Rg¦$èÅl‹¦Rg¦'ž¶Sš† ‰t°ƒš¶ž†»ž¶Sš† èÅl‹š¶ž†»ž¶Sš† ‰t°ƒ¢žšz@èÅl‹¢žšz@‰t°ƒ¢ºÃ–öWš^Û¦^ÐèÅl‹–ë¦Rgš^Û¦^Ð‰t°4(€€€€€ô¤¤4(€€€€è=‰©•Ð¹Ù…±Õ•Ì¡ÕÍ•ÉMÑ½É”¹ÕÍ•ÉÌ¤¹™±…Ñ5…À ¡ÕÍ•È¤€ôø•ÑUÍ•É5¥ÍÑ…­•Ì¡ÕÍ•È¹Á¡½¹”¤¹µ…À ¡Ä¤€ôø€¡ì4(€€€€€€€ƒ–žO–B4èÕÍ•È¹¹…µ”°4(€€€€€€€ƒš&/šrë–>ÜèÕÍ•È¹Á¡½¹”°4(€€€€€€€ƒ–Ê_’ö4èÕÍ•È¹É½±”°4(€€€€€€€ƒ¦Šc–êLèÄ¹‰…¹¬°4(€€€€€€€ƒž~—¢¾ž
äèÄ¹­¹½Ý±•‘•A½¥¹Ð°4(€€€€€€€ƒ¦Šcžn¸èÄ¹ÅÕ•ÍÑ¥½¸°4(€€€€€€€ƒ¦Rg¦$èÄ¹Í•±•Ñ•°4(€€€€€€€ƒš¶ž†»ž¶Sš† è€‘íÄ¹…¹ÍÝ•Éô€‘í‘¥ÍÁ±…å¹ÍÝ•ÉQ•áÐ¡Ä¥õ€°4(€€€€€€€ƒ¢žšz@è‘¥ÍÁ±…åáÁ±…¹…Ñ¥½¸¡Ä¤°4(€€€€€€€ƒ¢ºÃ–öWš^Û¦^ÐèÄ¹Í…Ù•‘Ð°4(€€€€€ô¤¤¤ì4(€‘½Ý¹±½…‘Q•áÐ¡ƒ¦G–Â+¦Rg¦Šc¢ºÃ–öU|‘íÑ½‘…å-•ä ¥ô¹ÍÙ€°Ñ½ÍØ¡l‹–žO–B4ˆ°€‹š&/šrë–>Üˆ°€‹–Ê_’ö4ˆ°€‹¦Šc–êLˆ°€‹ž~—¢¾ž
äˆ°€‹¦Šcžn¸ˆ°€‹¦Rg¦$ˆ°€‹š¶ž†»ž¶Sš† ˆ°€‹¢žšz@ˆ°€‹¢ºÃ–öWš^Û¦^Ð‰t°É½ÝÌ¤¤ì4)ô4(4)™Õ¹Ñ¥½¸ÍÝ¥Ñ¡Y¥•Ü¡Ù¥•Ü¤ì4(€¥˜€ …ÍÑ…Ñ”¹•á…µ¥¹¥Í¡•€˜˜ÍÑ…Ñ”¹•á…µQåÁ”€ôôô€‰™½Éµ…°ˆ€˜˜Ù¥•Ü€„ôô€‰ÅÕ¥èˆ¤É•ÑÕÉ¸ì4(€¥˜€¡Ù¥•Ü€ôôô€‰…‘µ¥¸ˆ€˜˜€…¥Í‘µ¥¹UÍ•È ¤¤ì4(€€€Ù¥•Ü€ô€‰‘…Í¡‰½…Éˆì4(€ô4(€ÍÑ…Ñ”¹ÕÉÉ•¹ÑY¥•Ü€ôÙ¥•Üì4(€•±Ì¹¹…ÙQ…‰Ì¹™½É…  ¡Ñ…ˆ¤€ôøÑ…ˆ¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰…Ñ¥Ù”ˆ°Ñ…ˆ¹‘…Ñ…Í•Ð¹Ù¥•Ü€ôôôÙ¥•Ü¤¤ì4(€=‰©•Ð¹•¹ÑÉ¥•Ì¡•±Ì¹Ù¥•ÝÌ¤¹™½É…  ¡m¹…µ”°•±•µ•¹Ñt¤€ôø•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰…Ñ¥Ù”ˆ°¹…µ”€ôôôÙ¥•Ü¤¤ì4(€•±Ì¹Á…•Q¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ð€ôÁ…•Q¥Ñ±•ÍmÙ¥•Ýtì4(€¥˜€¡Ù¥•Ü€ôôô€‰ÅÕ¥èˆ€˜˜€…ÍÑ…Ñ”¹ÅÕ¥è¹±•¹Ñ ¤ì4(€€€•±Ì¹ÅÕ¥éM•ÑÕÀ¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰¡¥‘‘•¸ˆ¤ì4(€€€•±Ì¹ÅÕ¥éIÕ¹¹•È¹±…ÍÍ1¥ÍÐ¹…‘ ‰¡¥‘‘•¸ˆ¤ì4(€€€•±Ì¹ÅÕ¥éI•ÍÕ±Ð¹±…ÍÍ1¥ÍÐ¹…‘ ‰¡¥‘‘•¸ˆ¤ì4(€ô4(€¥˜€¡Ù¥•Ü€ôôô€‰É…¹­¥¹œˆ¤É•¹‘•ÉI…¹­¥¹œ ¤ì4(€¥˜€¡Ù¥•Ü€ôôô€‰µ¥ÍÑ…­•Ìˆ¤É•¹‘•É5¥ÍÑ…­•Ì ¤ì4(€¥˜€¡Ù¥•Ü€ôôô€‰…‘µ¥¸ˆ¤ì4(€€€±½…‘±½Õ‘MÑ…ÑÌ ¤¹Ñ¡•¸¡É•¹‘•É‘µ¥¸¤ì4(€€€É•¹‘•É‘µ¥¸ ¤ì4(€ô4)ô4(4)™Õ¹Ñ¥½¸É•¹‘•É±° ¤ì4(€É•¹‘•ÉMÑ…ÑÌ ¤ì4(€É•¹‘•É…Í¡‰½…É ¤ì4(€É•¹‘•É1•…É¹¥±Ñ•È ¤ì4(€É•¹‘•É1•…É¹1¥ÍÐ ¤ì4(€É•¹‘•É5¥ÍÑ…­•Ì ¤ì4(€É•¹‘•É‘µ¥¸ ¤ì4)ô4(4)™Õ¹Ñ¥½¸É•¹‘•ÉUÍ•È ¤ì4(€…ÁÁ±å‘µ¥¹•ÍÌ ¤ì4(€¥˜€ …ÍÑ…Ñ”¹ÕÉÉ•¹ÑUÍ•È¤ì4(€€€•±Ì¹ÕÍ•É9…µ”¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹šr«žfï–öTˆì4(€€€•±Ì¹ÕÍ•É5•Ñ„¹Ñ•áÑ½¹Ñ•¹Ð€ô€ˆ´ˆì4(€€€É•ÑÕÉ¸ì4(€ô4(€•±Ì¹ÕÍ•É9…µ”¹Ñ•áÑ½¹Ñ•¹Ð€ôÍÑ…Ñ”¹ÕÉÉ•¹ÑUÍ•È¹¹…µ”ì4(€•±Ì¹ÕÍ•É5•Ñ„¹Ñ•áÑ½¹Ñ•¹Ð€ô€‘íÍÑ…Ñ”¹ÕÉÉ•¹ÑUÍ•È¹É½±•ôƒ
Ü€‘íÍÑ…Ñ”¹ÕÉÉ•¹ÑUÍ•È¹Á¡½¹•õ€ì4)ô4(4)™Õ¹Ñ¥½¸¹½Éµ…±¥é•A¡½¹”¡Ù…±Õ”¤ì4(€É•ÑÕÉ¸MÑÉ¥¹œ¡Ù…±Õ”ñð€ˆˆ¤¹É•Á±…” ½q½œ°€ˆˆ¤ì4)ô4(4)™Õ¹Ñ¥½¸±½…‘ÕÉÉ•¹ÑUÍ•È ¤ì4(€½¹ÍÐÁ¡½¹”€ôÕÍ•ÉMÑ½É”¹ÕÉÉ•¹ÑA¡½¹”ì4(€½¹ÍÐÕÍ•ÉÌ€ôÕÍ•ÉMÑ½É”¹ÕÍ•ÉÌì4(€ÍÑ…Ñ”¹ÕÉÉ•¹ÑUÍ•È€ôÁ¡½¹”€˜˜ÕÍ•ÉÍmÁ¡½¹•t€üÕÍ•ÉÍmÁ¡½¹•t€è¹Õ±°ì4)ô4(4)™Õ¹Ñ¥½¸Í¡½ÝÕÑ ¡Ù¥Í¥‰±”¤ì4(€•±Ì¹…ÕÑ¡Y¥•Ü¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¡¥‘‘•¸ˆ°€…Ù¥Í¥‰±”¤ì4(€‘½Õµ•¹Ð¹‰½‘ä¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰…ÕÑ µ±½­•ˆ°Ù¥Í¥‰±”¤ì4)ô4(4)™Õ¹Ñ¥½¸Í…Ù•UÍ•ÉÉ½µ½É´¡•Ù•¹Ð¤ì4(€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì4(€½¹ÍÐ¹…µ”€ô•±Ì¹…ÕÑ¡9…µ”¹Ù…±Õ”¹ÑÉ¥´ ¤ì4(€½¹ÍÐÁ¡½¹”€ô¹½Éµ…±¥é•A¡½¹”¡•±Ì¹…ÕÑ¡A¡½¹”¹Ù…±Õ”¤ì4(€½¹ÍÐÉ½±”€ô•±Ì¹…ÕÑ¡I½±”¹Ù…±Õ”ì4(€¥˜€ …¹…µ”¤ì4(€€€•±Ì¹…ÕÑ¡ÉÉ½È¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹¢¾ß–†¯–g–žO–B7Žˆì4(€€€É•ÑÕÉ¸ì4(€ô4(€¥˜€¡Á¡½¹”¹±•¹Ñ €„ôô€ÄÄ¤ì4(€€€•±Ì¹…ÕÑ¡ÉÉ½È¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹¢¾ß¢úO–”€ÄÄƒ’ö7š&/šrë–>ßŽˆì4(€€€É•ÑÕÉ¸ì4(€ô4(€½¹ÍÐÕÍ•ÉÌ€ôÕÍ•ÉMÑ½É”¹ÕÍ•ÉÌì4(€½¹ÍÐÕÍ•È€ôì4(€€€¹…µ”°4(€€€Á¡½¹”°4(€€€É½±”°4(€€€ÕÁ‘…Ñ•‘Ðè¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤°4(€ôì4(€ÕÍ•ÉÍmÁ¡½¹•t€ôÕÍ•Èì4(€ÕÍ•ÉMÑ½É”¹ÕÍ•ÉÌ€ôÕÍ•ÉÌì4(€ÕÍ•ÉMÑ½É”¹ÕÉÉ•¹ÑA¡½¹”€ôÁ¡½¹”ì4(€ÍÑ…Ñ”¹ÕÉÉ•¹ÑUÍ•È€ôÕÍ•Èì4(€É•½¹¥±•MÑ½É•‘EÕ•ÍÑ¥½¹Ì ¤ì4(€…ÁÁ±å‘µ¥¹•ÍÌ ¤ì4(€•±Ì¹…ÕÑ¡ÉÉ½È¹Ñ•áÑ½¹Ñ•¹Ð€ô€ˆˆì4(€Í¡½ÝÕÑ ¡™…±Í”¤ì4(€Íå¹1…Ñ•È ‰±½¥¸ˆ°ìÕÍ•Èô¤ì4(€™±ÕÍ¡Må¹EÕ•Õ” ¤ì4(€É•¹‘•É±° ¤ì4)ô4(4)™Õ¹Ñ¥½¸±½½ÕÐ ¤ì4(€ÍÑ½ÁQ¥µ•È ¤ì4(€ÍÑ…Ñ”¹•á…µ¥¹¥Í¡•€ôÑÉÕ”ì4(€Í•Ñá…µ1½­•¡™…±Í”¤ì4(€ÕÍ•ÉMÑ½É”¹ÕÉÉ•¹ÑA¡½¹”€ô€ˆˆì4(€ÍÑ…Ñ”¹ÕÉÉ•¹ÑUÍ•È€ô¹Õ±°ì4(€…ÁÁ±å‘µ¥¹•ÍÌ ¤ì4(€ÍÑ…Ñ”¹ÅÕ¥è€ômtì4(€ÍÑ…Ñ”¹ÅÕ¥é%¹‘•à€ô€Àì4(€ÍÑ…Ñ”¹Í½É”€ô€Àì4(€•±Ì¹…ÕÑ¡A¡½¹”¹Ù…±Õ”€ô€ˆˆì4(€•±Ì¹…ÕÑ¡9…µ”¹Ù…±Õ”€ô€ˆˆì4(€Í¡½ÝÕÑ ¡ÑÉÕ”¤ì4(€É•¹‘•É±° ¤ì4)ô4(4)™Õ¹Ñ¥½¸‰¥¹‘Ù•¹ÑÌ ¤ì4(€•±Ì¹¹…ÙQ…‰Ì¹™½É…  ¡Ñ…ˆ¤€ôøÑ…ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøÍÝ¥Ñ¡Y¥•Ü¡Ñ…ˆ¹‘…Ñ…Í•Ð¹Ù¥•Ü¤¤¤ì4(€•±Ì¹‰…¹­M•±•Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€ ¤€ôøì4(€€€ÍÑ…Ñ”¹ÕÉÉ•¹Ñ	…¹¬€ô•±Ì¹‰…¹­M•±•Ð¹Ù…±Õ”ì4(€€€ÍÑ…Ñ”¹±•…É¹A…”€ô€Äì4(€€€É•¹‘•É±° ¤ì4(€ô¤ì4(€•±Ì¹Í•…É¡%¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¥¹ÁÕÐˆ°€ ¤€ôøì4(€€€ÍÑ…Ñ”¹±•…É¹A…”€ô€Äì4(€€€É•¹‘•É±° ¤ì4(€ô¤ì4(€•±Ì¹ÍÑ…ÉÑEÕ¥é	Ñ¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°ÍÑ…ÉÑEÕ¥è¤ì4(€•±Ì¹É•ÑÉå5¥ÍÑ…­•Í	Ñ¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°ÍÑ…ÉÑ5¥ÍÑ…­•EÕ¥è¤ì4(€•±Ì¹•áÁ½ÉÑI•½É‘Í	Ñ¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°•áÁ½ÉÑI•½É‘Ì¤ì4(€•±Ì¹•áÁ½ÉÑ5¥ÍÑ…­•Í	Ñ¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°•áÁ½ÉÑ5¥ÍÑ…­•Ì¤ì4(€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹µ½‘”µÑ…ˆˆ¤¹™½É…  ¡Ñ…ˆ¤€ôøì4(€€€Ñ…ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì4(€€€€€ÍÑ…Ñ”¹ÅÕ¥é5½‘”€ôÑ…ˆ¹‘…Ñ…Í•Ð¹µ½‘”ì4(€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹µ½‘”µÑ…ˆˆ¤¹™½É…  ¡Ð¤€ôø4(€€€€€€€Ð¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰…Ñ¥Ù”ˆ°Ð€ôôôÑ…ˆ¤4(€€€€€€¤ì4(€€€€€•±Ì¹µ½‘•I…¹‘½´¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¡¥‘‘•¸ˆ°ÍÑ…Ñ”¹ÅÕ¥é5½‘”€„ôô€‰É…¹‘½´ˆ¤ì4(€€€€€•±Ì¹µ½‘•AÉ½‘ÕÐ¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¡¥‘‘•¸ˆ°ÍÑ…Ñ”¹ÅÕ¥é5½‘”€„ôô€‰ÁÉ½‘ÕÐˆ¤ì4(€€€€€•±Ì¹µ½‘•I½±”¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¡¥‘‘•¸ˆ°ÍÑ…Ñ”¹ÅÕ¥é5½‘”€„ôô€‰É½±”ˆ¤ì4(€€€ô¤ì4(€ô¤ì4(€•±Ì¹±•…É5¥ÍÑ…­•Í	Ñ¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì4(€€€¥˜€ …Ý¥¹‘½Ü¹½¹™¥É´ ‹ž†»–ºkšâž¦ë–öO–&7¢Ò›–>ßžj–£¦£¦Rg¦Šc–B_¾òš¶“šN7’ös’â7¢÷šJ“¦RŽˆ¤¤É•ÑÕÉ¸ì4(€€€ÍÑ½É…”¹µ¥ÍÑ…­•Ì€ômtì4(€€€É•¹‘•É±° ¤ì4(€ô¤ì4(€•±Ì¹É•Í•Ñ	Ñ¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì4(€€€¥˜€ …Ý¥¹‘½Ü¹½¹™¥É´ ‹ž†»–ºkšâž¦ë–öO–&7¢Ò›–>ßžjš¶ž†»ž:Ž¦Rg¦Šc–J3–£¦£¢¢¾W¢ºÃ–öW–B_¾òš¶“šN7’ös’â7¢÷šJ“¦RŽˆ¤¤É•ÑÕÉ¸ì4(€€€ÍÑ½É…”¹…ÑÑ•µÁÑÌ€ô€Àì4(€€€ÍÑ½É…”¹½ÉÉ•Ð€ô€Àì4(€€€ÍÑ½É…”¹µ¥ÍÑ…­•Ì€ômtì4(€€€ÍÑ½É…”¹•á…µI•½É‘Ì€ômtì4(€€€±½…±MÑ½É…”¹É•µ½Ù•%Ñ•´ ‰©é}Íå¹}ÅÕ•Õ”ˆ¤ì4(€€€É•¹‘•É±° ¤ì4(€ô¤ì4(€•±Ì¹…ÕÑ¡½É´¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ÍÕ‰µ¥Ðˆ°Í…Ù•UÍ•ÉÉ½µ½É´¤ì4(€•±Ì¹±½½ÕÑ	Ñ¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°±½½ÕÐ¤ì4(€•±Ì¹µ½‰¥±•M¥‘•‰…ÉQ½±”ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì4(€€€½¹ÍÐ½Á•¸€ô€…•±Ì¹Í¥‘•‰…ÉQ½½±Ì¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰µ½‰¥±”µ½Á•¸ˆ¤ì4(€€€•±Ì¹Í¥‘•‰…ÉQ½½±Ì¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰µ½‰¥±”µ½Á•¸ˆ°½Á•¸¤ì4(€€€•±Ì¹µ½‰¥±•M¥‘•‰…ÉQ½±”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ•áÁ…¹‘•ˆ°MÑÉ¥¹œ¡½Á•¸¤¤ì4(€ô¤ì4(€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰‰•™½É•Õ¹±½…ˆ°€¡•Ù•¹Ð¤€ôøì4(€€€¥˜€ …ÍÑ…Ñ”¹•á…µ¥¹¥Í¡•€˜˜ÍÑ…Ñ”¹•á…µQåÁ”€ôôô€‰™½Éµ…°ˆ¤ì4(€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì4(€€€€€•Ù•¹Ð¹É•ÑÕÉ¹Y…±Õ”€ô€ˆˆì4(€€€ô4(€ô¤ì4)ô4(4)…Íå¹Œ™Õ¹Ñ¥½¸¥¹¥Ð ¤ì4(€ÑÉäì4(€€€…Ý…¥Ð±½…‘EÕ•ÍÑ¥½¹Ì ¤ì4(€€€±½…‘ÕÉÉ•¹ÑUÍ•È ¤ì4(€€€É•½¹¥±•MÑ½É•‘EÕ•ÍÑ¥½¹Ì ¤ì4(€€€É•¹‘•É	…¹­M•±•Ð ¤ì4(€€€É•¹‘•ÉEÕ¥éM•ÑÕÀ ¤ì4(€€€¥¹¥ÑM±½…¸ ¤ì4(€€€‰¥¹‘Ù•¹ÑÌ ¤ì4(€€€…ÁÁ±å‘µ¥¹•ÍÌ ¤ì4(€€€…Ý…¥Ð™±ÕÍ¡Må¹EÕ•Õ” ¤ì4(€€€…Ý…¥Ð±½…‘±½Õ‘MÑ…ÑÌ ¤ì4(€€€É•¹‘•É±° ¤ì4(€€€Í¡½ÝÕÑ  …ÍÑ…Ñ”¹ÕÉÉ•¹ÑUÍ•È¤ì4(€ô…Ñ €¡•ÉÉ½È¤ì4(€€€‘½Õµ•¹Ð¹‰½‘ä¹¥¹¹•É!Q50€ô€ñ‘¥Ø±…ÍÌô‰•µÁÑäˆû¦Šc–êO–*ƒ¢ö÷–’Ç¢Ò—¾òh‘í•Í…Á•!Ñµ°¡•ÉÉ½È¹µ•ÍÍ…”¥ôð½‘¥Øù€ì4(€€€Ñ¡É½Ü•ÉÉ½Èì4(€ô4)ô4(4)¥¹¥Ð ¤ì4(