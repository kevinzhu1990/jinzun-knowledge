const BUILD_VERSION = "20260711-round5";
const PRACTICE_AUTO_NEXT_DELAY_MS = 1200;
const FORMAL_AUTO_NEXT_DELAY_MS = 350;
let autoNextTimer = null;
const productUrl = `./outputs/product_quiz/é‡‘å°Šäº§å“çŸ¥è¯†åº“é¢˜åº“.json?v=${BUILD_VERSION}`;
const roleUrl = `./outputs/role_quiz/å²—ä½å­¦ä¹ è€ƒæ ¸é¢˜åº“.json?v=${BUILD_VERSION}`;
const API_BASE = "https://jinzun-knowledge.vercel.app";
const API_BASES = [API_BASE];
const CLOUD_ENABLED = true;
const CLOUD_TIMEOUT_MS = 60000;
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
  examId: "",
  examSessionToken: "",
  submissionId: "",
  serverRecordId: "",
  serverDuration: null,
  examSubmitting: false,
  answers: new Map(),
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
  loginForm: document.querySelector("#loginForm"),
  registerForm: document.querySelector("#registerForm"),
  resetForm: document.querySelector("#resetForm"),
  showLoginTab: document.querySelector("#showLoginTab"),
  showRegisterTab: document.querySelector("#showRegisterTab"),
  showResetForm: document.querySelector("#showResetForm"),
  backToLogin: document.querySelector("#backToLogin"),
  loginAccount: document.querySelector("#loginAccount"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  registerName: document.querySelector("#registerName"),
  registerPhone: document.querySelector("#registerPhone"),
  registerRole: document.querySelector("#registerRole"),
  registerPassword: document.querySelector("#registerPassword"),
  registerPasswordConfirm: document.querySelector("#registerPasswordConfirm"),
  registerCode: document.querySelector("#registerCode"),
  registerError: document.querySelector("#registerError"),
  resetPhone: document.querySelector("#resetPhone"),
  resetName: document.querySelector("#resetName"),
  resetRole: document.querySelector("#resetRole"),
  resetPassword: document.querySelector("#resetPassword"),
  resetPasswordConfirm: document.querySelector("#resetPasswordConfirm"),
  resetCode: document.querySelector("#resetCode"),
  resetError: document.querySelector("#resetError"),
  userName: document.querySelector("#userName"),
  userMeta: document.querySelector("#userMeta"),
  logoutBtn: document.querySelector("#logoutBtn"),
  quizSetupStatus: document.querySelector("#quizSetupStatus"),
  examSubmitStatus: document.querySelector("#examSubmitStatus"),
  retryExamSubmitBtn: document.querySelector("#retryExamSubmitBtn"),
  adminDataWarning: document.querySelector("#adminDataWarning"),
  mobileSidebarToggle: document.querySelector("#mobileSidebarToggle"),
  sidebarTools: document.querySelector("#sidebarTools"),
};

const safeJson = (key, fallback) => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
};

function getClientId() {
  let clientId = localStorage.getItem("jz_client_id");
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem("jz_client_id", clientId);
  }
  return clientId;
}

function clearAutoNextTimer() {
  if (autoNextTimer) {
    clearTimeout(autoNextTimer);
    autoNextTimer = null;
  }
}

const safeJsonArray = (key) => {
  const value = safeJson(key, []);
  return Array.isArray(value) ? value : [];
};

const safeJsonObject = (key) => {
  const value = safeJson(key, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};

async function fetchWithTimeout(url, options = {}, timeoutMs = CLOUD_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (error?.name === "AbortError" || message.includes("aborted")) {
      throw new Error("æœåŠ¡å™¨å“åº”è¶…è¿‡60ç§’ï¼Œè¯·ç¨åŽé‡æ–°æäº¤");
    }
    if (error instanceof TypeError || message.includes("failed to fetch") || message.includes("networkerror")) {
      throw new Error("æš‚æ—¶æ— æ³•è¿žæŽ¥æœåŠ¡å™¨ï¼Œè¯·æ£€æŸ¥ç½‘ç»œåŽé‡è¯•");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const userStore = {
  get users() {
    return safeJsonObject("jz_users");
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
  return user?.isAdmin === true;
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
    return safeJsonArray(userKey("mistakes"));
  },
  set mistakes(value) {
    localStorage.setItem(userKey("mistakes"), JSON.stringify(value));
  },
  get examRecords() {
    return safeJsonArray(userKey("exam_records"));
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
  return `${year}-${month}-${day}×~¶êÚ$z{-®éÜj×G#àÐ¢’æ¦ö–â‚""—ÐÐ¢Â÷F&öG“àÐ¢Â÷F&ÆSàÐ¢¢ÆF—b6Æ73Ò&V×G’#îi¨.izYŽ[z^Šë[Ù^8#ÂöF—cæ°Ð Ð¢6öç7BÆÄÖ—7F¶W2Ò&÷w2æfÆDÖ‚‡&÷r’Óâ&÷ræÖ—7F¶W2“°Ð¢6öç7BvV²ÒÆÄÖ—7F¶W2ç&VGV6R‚†62Â’Óâ°Ð¢6öç7B¶W’Òæ¶æ÷vÆVFvUö–çBÇÂæ&æ²ÇÂ.X[nK¹b#°Ð¢65¶¶W•ÒÒ†65¶¶W•ÒÇÂ’²°Ð¢&WGW&â63°Ð¢ÒÂ·Ò“°Ð¢6öç7BvVµ&÷w2Òö&¦V7BæVçG&–W2‡vV²’ç6÷'B‚†Â"’Óâ%³ÒÒ³Ò’ç6Æ–6RƒÂ"“°Ð¢VÇ2æFÖ–åvV´Æ—7Bæ–ææW$…DÔÂÒvVµ&÷w2æÆVæwF‚ò Ð¢ÇF&ÆSãÇF†VCãÇG#ãÇFƒîyú^Šønx+“Â÷FƒãÇFƒî™Ižš)Ži[Â÷FƒãÂ÷G#ãÂ÷F†VCãÇF&öG“àÐ¢G·vVµ&÷w2æÖ‚…¶æÖRÂ6÷VçEÒ’ÓâÇG#ãÇFCâG¶W66T‡FÖÂ†æÖR—ÓÂ÷FCãÇFCâG¶6÷VçGÓÂ÷FCãÂ÷G#æ’æ¦ö–â‚""—ÐÐ¢Â÷F&öG“ãÂ÷F&ÆSàÐ¢¢ÆF—b6Æ73Ò&V×G’#îi¨.iz™Ižš)Ž{¹þŠê8#ÂöF—cæ°Ð§ÐÐ Ð¦gVæ7F–öâW‡÷'E&V6÷&G2‚’°Ð¢6öç7B&÷w2Ò7FFRæ6Æ÷VE7FG3òæW†×3òæÆVæwF€Ð¢ò7FFRæ6Æ÷VE7FG2æW†×2æÖ‚‡"’Óâ‡°¢Zy>YÓ¢%².Zy>YÒ%ÒÂh˜¾iË®Xûs¢%².h˜¾iË®Xûr%ÒÂ[)~KØÓ¢%².[)~KØÒ%ÒÂˆ>Šù^YÞz{¢%².ˆ>Šù^YÞz{%ÒÂˆ>jŽ{¾Yè³¢%².ˆ>jŽ{¾Yè²%ÒÂš)Ž[©3¢%².š)Ž[©2%ÒÂXˆni[¢%².Xˆni[%ÒÂzÙNZûži[¢%².zÙNZûži[%ÒÂh¾š)Ži[¢%².h¾š)Ži[%ÒÂzÙN™Iži[¢%².zÙN™Iži[%ÒÂiŠþY
n˜	®‹øs¢%².iŠþY
n˜	®‹ør%ÒÂyJŽi{nzy.i[¢%².yJŽi{nzy.i[%ÒÂhùKªNi{n™{C¢%².hùKªNi{n™{B%ÒÂˆ>Šù^KÉ®ŠùÔ”C¢%².ˆ>Šù^KÉ®ŠùÔ”B%ÒÀ¢Ò’Ð¢¢ö&¦V7BçfÇVW2‡W6W%7F÷&RçW6W'2’æfÆDÖ‚‡W6W"’ÓâvWEW6W%&V6÷&G2‡W6W"ç†öæR’æÖ‚‡&V6÷&B’Óâ‡°Ð¢Zy>YÓ¢W6W"ææÖRÀÐ¢h˜¾iË®Xûs¢W6W"ç†öæRÀÐ¢[)~KØÓ¢W6W"ç&öÆRÀÐ¢ˆ>jŽ{¾Yè³¢&V6÷&BçG—RÇÂ.{¸>KšjŠ[Èò"ÀÐ¢š)Ž[©3¢&V6÷&Bæ&æ²ÀÐ¢Xˆni[¢&V6÷&BçW&6VçBÀÐ¢ˆ>Šù^YÞz{¢.˜y[®Kª~Y8yú^Šøn[©>ZÚnKšˆ>j‚"À¢zÙNZûži[¢&V6÷&Bç66÷&RÀ¢h¾š)Ži[¢&V6÷&BçF÷FÂÀ¢zÙN™Iži[¢&V6÷&Bçw&öæróòÖF‚æÖ‚ƒÂçVÖ&W"‡&V6÷&BçF÷FÂÇÂ’ÒçVÖ&W"‡&V6÷&Bç66÷&RÇÂ’’À¢iŠþY
n˜	®‹øs¢çVÖ&W"‡&V6÷&BçW&6VçB’ãÒƒò.iŠò"¢.Y
b"ÀÐ¢yJŽi{nzy.i[¢&V6÷&BæGW&F–öâÀ¢hùKªNi{n™{C¢&V6÷&Bæf–æ—6†VDBÀ¢Ò’’“°¢F÷væÆöEFW‡B†˜y[®ˆ>Šù^Šë[ÙUòG·FöF”¶W’‚—Òæ77fÂFô77b…².Zy>YÒ"Â.h˜¾iË®Xûr"Â.[)~KØÒ"Â.ˆ>Šù^YÞz{"Â.ˆ>jŽ{¾Yè²"Â.š)Ž[©2"Â.Xˆni["Â.zÙNZûži["Â.h¾š)Ži["Â.zÙN™Iži["Â.iŠþY
n˜	®‹ør"Â.yJŽi{nzy.i["Â.hùKªNi{n™{B"Â.ˆ>Šù^KÉ®ŠùÔ”B%ÒÂ&÷w2’“°§ÐÐ Ð¦gVæ7F–öâW‡÷'DÖ—7F¶W2‚’°Ð¢6öç7B&÷w2Ò7FFRæ6Æ÷VE7FG3òæÖ—7F¶W3òæÆVæwF€Ð¢ò7FFRæ6Æ÷VE7FG2æÖ—7F¶W2æÖ‚‡’Óâ‡°¢Zy>YÓ¢².Zy>YÒ%ÒÂh˜¾iË®Xûs¢².h˜¾iË®Xûr%ÒÂ[)~KØÓ¢².[)~KØÒ%ÒÂš)Ž[©3¢².š)Ž[©2%ÒÂyú^Šønx+“¢².yú^Šønx+’%ÒÂš)Žyºã¢².š)Žyºâ%ÒÂ™Iž˜“¢².™Iž˜’%ÒÂjÚ>zîzÙNjƒ¢².jÚ>zîzÙNj‚%ÒÂŠz>ié¢².Šz>ié%ÒÂŠë[Ù^i{n™{C¢².Šë[Ù^i{n™{B%ÒÀ¢Ò’Ð¢¢ö&¦V7BçfÇVW2‡W6W%7F÷&RçW6W'2’æfÆDÖ‚‡W6W"’ÓâvWEW6W$Ö—7F¶W2‡W6W"ç†öæR’æÖ‚‡’Óâ‡°Ð¢Zy>YÓ¢W6W"ææÖRÀÐ¢h˜¾iË®Xûs¢W6W"ç†öæRÀÐ¢[)~KØÓ¢W6W"ç&öÆRÀÐ¢š)Ž[©3¢æ&æ²ÀÐ¢yú^Šønx+“¢æ¶æ÷vÆVFvUö–çBÀÐ¢š)Žyºã¢çVW7F–öâÀÐ¢™Iž˜“¢ç6VÆV7FVBÀÐ¢jÚ>zîzÙNjƒ¢G·æç7vW'ÒG¶F—7Æ”ç7vW%FW‡B‡—ÖÀÐ¢Šz>ié¢F—7Æ”W‡ÆæF–öâ‡’ÀÐ¢Šë[Ù^i{n™{C¢ç6fVDBÀÐ¢Ò’’“°Ð¢F÷væÆöEFW‡B†˜y[®™Ižš)ŽŠë[ÙUòG·FöF”¶W’‚—Òæ77fÂFô77b…².Zy>YÒ"Â.h˜¾iË®Xûr"Â.[)~KØÒ"Â.š)Ž[©2"Â.yú^Šønx+’"Â.š)Žyºâ"Â.™Iž˜’"Â.jÚ>zîzÙNj‚"Â.Šz>ié"Â.Šë[Ù^i{n™{B%ÒÂ&÷w2’“°Ð§ÐÐ Ð¦gVæ7F–öâ7v—F6…f–Wr‡f–Wr’°¢–b‡f–WrÓÒ'V—¢"’6ÆV$WFôæW‡EF–ÖW"‚“°¢–b‚7FFRæW†Ôf–æ—6†VBbb7FFRæW†ÕG—RÓÓÒ&f÷&ÖÂ"bbf–WrÓÒ'V—¢"’&WGW&ã°¢–b‡f–WrÓÓÒ&FÖ–â"bb—4FÖ–åW6W"‚’’°Ð¢f–WrÒ&F6†&ö&B#°Ð¢ÐÐ¢7FFRæ7W'&VçEf–WrÒf–Ws°Ð¢VÇ2ææeF'2æf÷$V6‚‚‡F"’ÓâF"æ6Æ74Æ—7BçFövvÆR‚&7F—fR"ÂF"æFF6WBçf–WrÓÓÒf–Wr’“°Ð¢ö&¦V7BæVçG&–W2†VÇ2çf–Ww2’æf÷$V6‚‚…¶æÖRÂVÆVÖVçEÒ’ÓâVÆVÖVçBæ6Æ74Æ—7BçFövvÆR‚&7F—fR"ÂæÖRÓÓÒf–Wr’“°Ð¢VÇ2çvUF—FÆRçFW‡D6öçFVçBÒvUF—FÆW5·f–WuÓ°Ð¢–b‡f–WrÓÓÒ'V—¢"bb7FFRçV—¢æÆVæwF‚’°Ð¢VÇ2çV—¥6WGWæ6Æ74Æ—7Bç&VÖ÷fR‚&†–FFVâ"“°Ð¢VÇ2çV—¥'VææW"æ6Æ74Æ—7BæFB‚&†–FFVâ"“°Ð¢VÇ2çV—¥&W7VÇBæ6Æ74Æ—7BæFB‚&†–FFVâ"“°Ð¢ÐÐ¢–b‡f–WrÓÓÒ'&æ¶–ær"’&VæFW%&æ¶–ær‚“°Ð¢–b‡f–WrÓÓÒ&Ö—7F¶W2"’&VæFW$Ö—7F¶W2‚“°Ð¢–b‡f–WrÓÓÒ&FÖ–â"’°Ð¢ÆöD6Æ÷VE7FG2‚’çF†Vâ‡&VæFW$FÖ–â“°Ð¢&VæFW$FÖ–â‚“°Ð¢ÐÐ§ÐÐ Ð¦gVæ7F–öâ&VæFW$ÆÂ‚’°Ð¢&VæFW%7FG2‚“°Ð¢&VæFW$F6†&ö&B‚“°Ð¢&VæFW$ÆV&äf–ÇFW"‚“°Ð¢&VæFW$ÆV&äÆ—7B‚“°Ð¢&VæFW$Ö—7F¶W2‚“°Ð¢&VæFW$FÖ–â‚“°Ð§ÐÐ Ð¦gVæ7F–öâ&VæFW%W6W"‚’°Ð¢Ç”FÖ–ä66W72‚“°Ð¢–b‚7FFRæ7W'&VçEW6W"’°Ð¢VÇ2çW6W$æÖRçFW‡D6öçFVçBÒ.iÊ®y›¾[ÙR#°Ð¢VÇ2çW6W$ÖWFçFW‡D6öçFVçBÒ"Ò#°Ð¢&WGW&ã°Ð¢ÐÐ¢VÇ2çW6W$æÖRçFW‡D6öçFVçBÒ7FFRæ7W'&VçEW6W"ææÖS°Ð¢VÇ2çW6W$ÖWFçFW‡D6öçFVçBÒG·7FFRæ7W'&VçEW6W"ç&öÆWÒ+rG·7FFRæ7W'&VçEW6W"ç†öæWÖ°Ð§ÐÐ Ð¦gVæ7F–öâæ÷&ÖÆ—¦U†öæR‡fÇVR’°Ð¢&WGW&â7G&–ær‡fÇVRÇÂ""’ç&WÆ6R‚õÄBörÂ""“°Ð§ÐÐ Ð¦gVæ7F–öâÆöD7W'&VçEW6W"‚’°¢–b‚Æö6Å7F÷&vRævWD—FVÒ‚&§¥öWF…÷Fö¶Vâ"’’°¢7FFRæ7W'&VçEW6W"ÒçVÆÃ°¢&WGW&ã°¢Ð¢6öç7B†öæRÒW6W%7F÷&Ræ7W'&VçE†öæS°¢6öç7BW6W'2ÒW6W%7F÷&RçW6W'3°¢7FFRæ7W'&VçEW6W"Ò†öæRbbW6W'5·†öæUÒòW6W'5·†öæUÒ¢çVÆÃ°§Ð Ð¦gVæ7F–öâ6†÷tWF‚‡f—6–&ÆR’°Ð¢VÇ2æWF…f–Wræ6Æ74Æ—7BçFövvÆR‚&†–FFVâ"Âf—6–&ÆR“°Ð¢Fö7VÖVçBæ&öG’æ6Æ74Æ—7BçFövvÆR‚&WF‚ÖÆö6¶VB"Âf—6–&ÆR“°Ð§ÐÐ Ð¦gVæ7F–öâ7v—F6„WF„ÖöFR†ÖöFR’°¢6öç7B—4Æöv–âÒÖöFRÓÓÒ&Æöv–â#°¢6öç7B—5&Vv—7FW"ÒÖöFRÓÓÒ'&Vv—7FW"#°¢VÇ2æÆöv–äf÷&Òæ6Æ74Æ—7BçFövvÆR‚&†–FFVâ"Â—4Æöv–â“°¢VÇ2ç&Vv—7FW$f÷&Òæ6Æ74Æ—7BçFövvÆR‚&†–FFVâ"Â—5&Vv—7FW"“°¢VÇ2ç&W6WDf÷&Òæ6Æ74Æ—7BçFövvÆR‚&†–FFVâ"ÂÖöFRÓÒ'&W6WB"“°¢VÇ2ç6†÷tÆöv–åF"æ6Æ74Æ—7BçFövvÆR‚&7F—fR"Â—4Æöv–â“°¢VÇ2ç6†÷u&Vv—7FW%F"æ6Æ74Æ—7BçFövvÆR‚&7F—fR"Â—5&Vv—7FW"“°¢VÇ2æÆöv–äW'&÷"çFW‡D6öçFVçBÒ"#°¢VÇ2ç&Vv—7FW$W'&÷"çFW‡D6öçFVçBÒ"#°¢VÇ2ç&W6WDW'&÷"çFW‡D6öçFVçBÒ"#°§Ð ¦gVæ7F–öâ6fTWF†VçF–6FVEW6W"†FF’°¢Æö6Å7F÷&vRç6WD—FVÒ‚&§¥öWF…÷Fö¶Vâ"ÂFFçFö¶Vâ“°¢6öç7BW6W"Ò°¢–C¢FFçW6W"æ–BÀ¢æÖS¢FFçW6W"ææÖRÀ¢†öæS¢FFçW6W"ç†öæRÀ¢&öÆS¢FFçW6W"ç&öÆRÀ¢—4FÖ–ã¢FFçW6W"æ—4FÖ–âÓÓÒG'VRÀ¢WFFVDC¢æWrFFR‚’çFô•4õ7G&–ær‚’À¢Ó°¢6öç7BW6W'2ÒW6W%7F÷&RçW6W'3°¢W6W'5·W6W"ç†öæUÒÒW6W#°¢W6W%7F÷&RçW6W'2ÒW6W'3°¢W6W%7F÷&Ræ7W'&VçE†öæRÒW6W"ç†öæS°¢7FFRæ7W'&VçEW6W"ÒW6W#°¢&V6öæ6–ÆU7F÷&VEVW7F–öç2‚“°¢Ç”FÖ–ä66W72‚“°§Ð ¦6öç7B77v÷&DW'&÷"Ò‡77v÷&B’Óâ°¢–b‡77v÷&BæÆVæwF‚Â‚’&WGW&â.ZønzKˆÞˆ;Þ[	K¨ãŽKØÒ#°¢–b‚õ´Õ¦×¥ÒòçFW7B‡77v÷&B’’&WGW&â.Zønz[ø^š¾XÈ^Y
¾ZÙ~jøÒ#°¢–b‚õÆBòçFW7B‡77v÷&B’’&WGW&â.Zønz[ø^š¾XÈ^Y
¾i[ZÙr#°¢&WGW&â"#°§Ó° ¦7–æ2gVæ7F–öâÆöv–äV×Æ÷–VR†WfVçB’°¢WfVçBç&WfVçDFVfVÇB‚“°¢6öç7B66÷VçBÒVÇ2æÆöv–ä66÷VçBçfÇVRçG&–Ò‚“°¢6öç7B77v÷&BÒVÇ2æÆöv–å77v÷&BçfÇVS°¢VÇ2æÆöv–äW'&÷"çFW‡D6öçFVçBÒ"#°¢–b‚66÷VçBÇÂ77v÷&B’°¢VÇ2æÆöv–äW'&÷"çFW‡D6öçFVçBÒ.Šû~‹é>XZ^Zy>YÞh‰nh˜¾iË®Xû~Y(ÎZønz#°¢&WGW&ã°¢Ð¢6öç7B'WGFöâÒVÇ2æÆöv–äf÷&ÒçVW'•6VÆV7F÷"‚v'WGFöå·G—SÒ'7V&Ö—B%Òr“°¢'WGFöâæF—6&ÆVBÒG'VS°¢'WGFöâçFW‡D6öçFVçBÒ.jÚ>YÊŽy›¾[ÙRâââ#°¢G'’°¢6öç7BFFÒv—B6Æ÷VE&WVW7B‚&Æöv–â"Â²66÷VçBÂ77v÷&BÂ6Æ–VçD–C¢vWD6Æ–VçD–B‚’Ò“°¢–b‚FFçFö¶VâÇÂFFçW6W"’F‡&÷ræWrW'&÷"‚.‹JnXû~h‰nZønz™IžŠúò"“°¢6fTWF†VçF–6FVEW6W"†FF“°¢VÇ2æÆöv–å77v÷&BçfÇVRÒ"#°¢6†÷tWF‚†fÇ6R“°¢&VæFW$ÆÂ‚“°¢Ò6F6‚†W'&÷"’°¢VÇ2æÆöv–äW'&÷"çFW‡D6öçFVçBÒW'&÷"æÖW76vRÇÂ.‹JnXû~h‰nZønz™IžŠúò#°¢Òf–æÆÇ’°¢'WGFöâæF—6&ÆVBÒfÇ6S°¢'WGFöâçFW‡D6öçFVçBÒ.y›¾[ÙR#°¢Ð§Ð ¦7–æ2gVæ7F–öâ&Vv—7FW$V×Æ÷–VR†WfVçB’°¢WfVçBç&WfVçDFVfVÇB‚“°¢6öç7BæÖRÒVÇ2ç&Vv—7FW$æÖRçfÇVRçG&–Ò‚“°¢6öç7B†öæRÒæ÷&ÖÆ—¦U†öæR†VÇ2ç&Vv—7FW%†öæRçfÇVR“°¢6öç7B&öÆRÒVÇ2ç&Vv—7FW%&öÆRçfÇVS°¢6öç7B77v÷&BÒVÇ2ç&Vv—7FW%77v÷&BçfÇVS°¢6öç7B6öæf—&ÒÒVÇ2ç&Vv—7FW%77v÷&D6öæf—&ÒçfÇVS°¢6öç7B&Vv—7FW$6öFRÒVÇ2ç&Vv—7FW$6öFRçfÇVRçG&–Ò‚“°¢VÇ2ç&Vv—7FW$W'&÷"çFW‡D6öçFVçBÒ"#°¢–b‚æÖR’&WGW&âfö–B†VÇ2ç&Vv—7FW$W'&÷"çFW‡D6öçFVçBÒ.Šû~Z¾XižyÉþZéîZy>YÒ"“°¢–b‚õãÆG³ÒBòçFW7B‡†öæR’’&WGW&âfö–B†VÇ2ç&Vv—7FW$W'&÷"çFW‡D6öçFVçBÒ.Šû~‹é>XZ^jÚ>zîy¨CKØÞh˜¾iË®Xûr"“°¢–b‚&öÆR’&WGW&âfö–B†VÇ2ç&Vv—7FW$W'&÷"çFW‡D6öçFVçBÒ.Šû~˜žhºž[)~KØÒ"“°¢6öç7BW'&÷"Ò77v÷&DW'&÷"‡77v÷&B“°¢–b†W'&÷"’&WGW&âfö–B†VÇ2ç&Vv—7FW$W'&÷"çFW‡D6öçFVçBÒW'&÷"“°¢–b‡77v÷&BÓÒ6öæf—&Ò’&WGW&âfö–B†VÇ2ç&Vv—7FW$W'&÷"çFW‡D6öçFVçBÒ.KŠNjÊ‹é>XZ^y¨NZønzKˆÞKˆˆ{B"“°¢–b‚&Vv—7FW$6öFR’&WGW&âfö–B†VÇ2ç&Vv—7FW$W'&÷"çFW‡D6öçFVçBÒ.Šû~‹é>XZ^XZÎXûŽk:ŽXhÎXú>KºB"“°¢6öç7B'WGFöâÒVÇ2ç&Vv—7FW$f÷&ÒçVW'•6VÆV7F÷"‚v'WGFöå·G—SÒ'7V&Ö—B%Òr“°¢'WGFöâæF—6&ÆVBÒG'VS°¢'WGFöâçFW‡D6öçFVçBÒ.jÚ>YÊŽk:ŽXhÂâââ#°¢G'’°¢6öç7BFFÒv—B6Æ÷VE&WVW7B‚'&Vv—7FW""Â²æÖRÂ†öæRÂ&öÆRÂ77v÷&BÂ&Vv—7FW$6öFRÂ6Æ–VçD–C¢vWD6Æ–VçD–B‚’Ò“°¢–b‚FFçFö¶VâÇÂFFçW6W"’F‡&÷ræWrW'&÷"‚.k:ŽXhÎZK‹JR"“°¢6fTWF†VçF–6FVEW6W"†FF“°¢VÇ2ç&Vv—7FW$f÷&Òç&W6WB‚“°¢6†÷tWF‚†fÇ6R“°¢&VæFW$ÆÂ‚“°¢Ò6F6‚‡&WVW7DW'&÷"’°¢6öç7BÖW76vRÒ&WVW7DW'&÷"æÖW76vRÇÂ.k:ŽXhÎZK‹J^ûÈÎŠû~zˆÞYî˜xÞŠùR#°¢VÇ2ç&Vv—7FW$W'&÷"çFW‡D6öçFVçBÒÖW76vRæ–æ6ÇVFW2‚.[{.{¸þk:ŽXhÂ"¢òG¶ÖW76vWÞûÈÎŠû~Xˆ~hÚ.X‹(	ÎYŽ[z^y›¾[Ù^(	Ö ¢¢ÖW76vS°¢Òf–æÆÇ’°¢'WGFöâæF—6&ÆVBÒfÇ6S°¢'WGFöâçFW‡D6öçFVçBÒ.k:ŽXhÎ[›n‹ù¾XZ^ZÚnKš#°¢Ð§Ð ¦7–æ2gVæ7F–öâ&W6WE77v÷&B†WfVçB’°¢WfVçBç&WfVçDFVfVÇB‚“°¢6öç7BæÖRÒVÇ2ç&W6WDæÖRçfÇVRçG&–Ò‚“°¢6öç7B†öæRÒæ÷&ÖÆ—¦U†öæR†VÇ2ç&W6WE†öæRçfÇVR“°¢6öç7B&öÆRÒVÇ2ç&W6WE&öÆRçfÇVS°¢6öç7B77v÷&BÒVÇ2ç&W6WE77v÷&BçfÇVS°¢6öç7B6öæf—&ÒÒVÇ2ç&W6WE77v÷&D6öæf—&ÒçfÇVS°¢6öç7B&Vv—7FW$6öFRÒVÇ2ç&W6WD6öFRçfÇVRçG&–Ò‚“°¢VÇ2ç&W6WDW'&÷"çFW‡D6öçFVçBÒ"#°¢–b‚æÖR’&WGW&âfö–B†VÇ2ç&W6WDW'&÷"çFW‡D6öçFVçBÒ.Šû~‹é>XZ^yÉþZéîZy>YÒ"“°¢–b‚õãÆG³ÒBòçFW7B‡†öæR’’&WGW&âfö–B†VÇ2ç&W6WDW'&÷"çFW‡D6öçFVçBÒ.Šû~‹é>XZ^jÚ>zîy¨CKØÞh˜¾iË®Xûr"“°¢–b‚&öÆR’&WGW&âfö–B†VÇ2ç&W6WDW'&÷"çFW‡D6öçFVçBÒ.Šû~˜žhºž[)~KØÒ"“°¢6öç7BW'&÷"Ò77v÷&DW'&÷"‡77v÷&B“°¢–b†W'&÷"’&WGW&âfö–B†VÇ2ç&W6WDW'&÷"çFW‡D6öçFVçBÒW'&÷"“°¢–b‡77v÷&BÓÒ6öæf—&Ò’&WGW&âfö–B†VÇ2ç&W6WDW'&÷"çFW‡D6öçFVçBÒ.KŠNjÊ‹é>XZ^y¨NZønzKˆÞKˆˆ{B"“°¢–b‚&Vv—7FW$6öFR’&WGW&âfö–B†VÇ2ç&W6WDW'&÷"çFW‡D6öçFVçBÒ.Šû~‹é>XZ^XZÎXûŽk:ŽXhÎXú>KºB"“°¢6öç7B'WGFöâÒVÇ2ç&W6WDf÷&ÒçVW'•6VÆV7F÷"‚v'WGFöå·G—SÒ'7V&Ö—B%Òr“°¢'WGFöâæF—6&ÆVBÒG'VS°¢'WGFöâçFW‡D6öçFVçBÒ.jÚ>YÊŽ˜xÞ{Úââââ#°¢G'’°¢6öç7BFFÒv—B6Æ÷VE&WVW7B‚'&W6WB"Â²æÖRÂ†öæRÂ&öÆRÂ77v÷&BÂ&Vv—7FW$6öFRÂ6Æ–VçD–C¢vWD6Æ–VçD–B‚’Ò“°¢–b‚FFçFö¶VâÇÂFFçW6W"’F‡&÷ræWrW'&÷"‚.Zønz˜xÞ{ÚîZK‹JR"“°¢6fTWF†VçF–6FVEW6W"†FF“°¢VÇ2ç&W6WDf÷&Òç&W6WB‚“°¢6†÷tWF‚†fÇ6R“°¢&VæFW$ÆÂ‚“°¢Ò6F6‚‡&WVW7DW'&÷"’°¢VÇ2ç&W6WDW'&÷"çFW‡D6öçFVçBÒ&WVW7DW'&÷"æÖW76vRÇÂ.Zønz˜xÞ{ÚîZK‹J^ûÈÎŠû~zˆÞYî˜xÞŠùR#°¢Òf–æÆÇ’°¢'WGFöâæF—6&ÆVBÒfÇ6S°¢'WGFöâçFW‡D6öçFVçBÒ.˜xÞ{ÚîZønz[›ny›¾[ÙR#°¢Ð§Ð Ð¦gVæ7F–öâÆöv÷WB‚’°¢6ÆV$WFôæW‡EF–ÖW"‚“°¢7F÷F–ÖW"‚“°¢7FFRæW†Ôf–æ—6†VBÒG'VS°¢7FFRæW†Õ7V&Ö—GF–ærÒfÇ6S°¢6WDW†ÔÆö6¶VB†fÇ6R“°Ð¢W6W%7F÷&Ræ7W'&VçE†öæRÒ"#°¢Æö6Å7F÷&vRç&VÖ÷fT—FVÒ‚&§¥öWF…÷Fö¶Vâ"“°¢7FFRæ7W'&VçEW6W"ÒçVÆÃ°Ð¢Ç”FÖ–ä66W72‚“°Ð¢7FFRçV—¢ÒµÓ°Ð¢7FFRçV—¤–æFW‚Ò°Ð¢7FFRç66÷&RÒ°Ð¢VÇ2æÆöv–ä66÷VçBçfÇVRÒ"#°¢VÇ2æÆöv–å77v÷&BçfÇVRÒ"#°¢VÇ2ç&Vv—7FW$f÷&Òç&W6WB‚“°¢VÇ2ç&W6WDf÷&Òç&W6WB‚“°¢6†÷tWF‚‡G'VR“°¢&VæFW$ÆÂ‚“°Ð§ÐÐ Ð¦gVæ7F–öâ&–æDWfVçG2‚’°Ð¢VÇ2ææeF'2æf÷$V6‚‚‡F"’ÓâF"æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ7v—F6…f–Wr‡F"æFF6WBçf–Wr’’“°Ð¢VÇ2æ&æµ6VÆV7BæFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ°¢6ÆV$WFôæW‡EF–ÖW"‚“°¢7FFRæ7W'&VçD&æ²ÒVÇ2æ&æµ6VÆV7BçfÇVS°¢7FFRæÆV&åvRÒ°Ð¢&VæFW$ÆÂ‚“°Ð¢Ò“°Ð¢VÇ2ç6V&6„–çWBæFDWfVçDÆ—7FVæW"‚&–çWB"Â‚’Óâ°Ð¢7FFRæÆV&åvRÒ°Ð¢&VæFW$ÆÂ‚“°Ð¢Ò“°Ð¢VÇ2ç7F'EV—¤'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â7F'EV—¢“°Ð¢VÇ2ç&WG'”Ö—7F¶W4'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â7F'DÖ—7F¶UV—¢“°Ð¢VÇ2æW‡÷'E&V6÷&G4'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂW‡÷'E&V6÷&G2“°Ð¢VÇ2æW‡÷'DÖ—7F¶W4'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂW‡÷'DÖ—7F¶W2“°Ð¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"æÖöFR×F""’æf÷$V6‚‚‡F"’Óâ°Ð¢F"æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°¢6ÆV$WFôæW‡EF–ÖW"‚“°¢7FFRçV—¤ÖöFRÒF"æFF6WBæÖöFS°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"æÖöFR×F""’æf÷$V6‚‚‡B’ÓàÐ¢Bæ6Æ74Æ—7BçFövvÆR‚&7F—fR"ÂBÓÓÒF"Ð¢“°Ð¢VÇ2æÖöFU&æFöÒæ6Æ74Æ—7BçFövvÆR‚&†–FFVâ"Â7FFRçV—¤ÖöFRÓÒ'&æFöÒ"“°Ð¢VÇ2æÖöFU&öGV7Bæ6Æ74Æ—7BçFövvÆR‚&†–FFVâ"Â7FFRçV—¤ÖöFRÓÒ'&öGV7B"“°Ð¢VÇ2æÖöFU&öÆRæ6Æ74Æ—7BçFövvÆR‚&†–FFVâ"Â7FFRçV—¤ÖöFRÓÒ'&öÆR"“°Ð¢Ò“°Ð¢Ò“°Ð¢VÇ2æ6ÆV$Ö—7F¶W4'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°Ð¢–b‚v–æF÷ræ6öæf—&Ò‚.zîZé®kˆ^z›®[Ù>X˜Þ‹JnXû~y¨NXZŽ˜:Ž™Ižš)ŽY	~ûÉþjÚNi8ÞKÙÎKˆÞˆ;Þi*N™H8""’’&WGW&ã°Ð¢7F÷&vRæÖ—7F¶W2ÒµÓ°Ð¢&VæFW$ÆÂ‚“°Ð¢Ò“°Ð¢VÇ2ç&W6WD'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°Ð¢–b‚v–æF÷ræ6öæf—&Ò‚.zîZé®kˆ^z›®[Ù>X˜Þ‹JnXû~y¨NjÚ>zîxè~8™Ižš)ŽY(ÎXZŽ˜:Žˆ>Šù^Šë[Ù^Y	~ûÉþjÚNi8ÞKÙÎKˆÞˆ;Þi*N™H8""’’&WGW&ã°Ð¢7F÷&vRæGFV×G2Ò°Ð¢7F÷&vRæ6÷'&V7BÒ°Ð¢7F÷&vRæÖ—7F¶W2ÒµÓ°Ð¢7F÷&vRæW†Õ&V6÷&G2ÒµÓ°Ð¢Æö6Å7F÷&vRç&VÖ÷fT—FVÒ‚&§¥÷7–æ5÷VWVR"“°Ð¢&VæFW$ÆÂ‚“°Ð¢Ò“°Ð¢VÇ2ç6†÷tÆöv–åF"æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ7v—F6„WF„ÖöFR‚&Æöv–â"’“°¢VÇ2ç6†÷u&Vv—7FW%F"æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ7v—F6„WF„ÖöFR‚'&Vv—7FW""’“°¢VÇ2ç6†÷u&W6WDf÷&ÒæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ7v—F6„WF„ÖöFR‚'&W6WB"’“°¢VÇ2æ&6µFôÆöv–âæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ7v—F6„WF„ÖöFR‚&Æöv–â"’“°¢VÇ2æÆöv–äf÷&ÒæFDWfVçDÆ—7FVæW"‚'7V&Ö—B"ÂÆöv–äV×Æ÷–VR“°¢VÇ2ç&Vv—7FW$f÷&ÒæFDWfVçDÆ—7FVæW"‚'7V&Ö—B"Â&Vv—7FW$V×Æ÷–VR“°¢VÇ2ç&W6WDf÷&ÒæFDWfVçDÆ—7FVæW"‚'7V&Ö—B"Â&W6WE77v÷&B“°¢VÇ2ç&WG'”W†Õ7V&Ö—D'FãòæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Âf–æ—6…V—¢“°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"ç77v÷&B×FövvÆR"’æf÷$V6‚‚†'WGFöâ’Óâ°¢'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°¢6öç7B–çWBÒFö7VÖVçBævWDVÆVÖVçD'”–B†'WGFöâæFF6WBçF&vWB“°¢–b‚–çWB’&WGW&ã°¢6öç7Bf—6–&ÆRÒ–çWBçG—RÓÓÒ'FW‡B#°¢–çWBçG—RÒf—6–&ÆRò'77v÷&B"¢'FW‡B#°¢'WGFöâçFW‡D6öçFVçBÒf—6–&ÆRò.i‹îzK¢"¢.™©‰xò#°¢Ò“°¢Ò“°¢VÇ2æÆöv÷WD'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂÆöv÷WB“°Ð¢VÇ2æÖö&–ÆU6–FV&%FövvÆSòæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°Ð¢6öç7B÷VâÒVÇ2ç6–FV&%FööÇ2æ6Æ74Æ—7Bæ6öçF–ç2‚&Öö&–ÆRÖ÷Vâ"“°Ð¢VÇ2ç6–FV&%FööÇ2æ6Æ74Æ—7BçFövvÆR‚&Öö&–ÆRÖ÷Vâ"Â÷Vâ“°Ð¢VÇ2æÖö&–ÆU6–FV&%FövvÆRç6WDGG&–'WFR‚&&–ÖW‡æFVB"Â7G&–ær†÷Vâ’“°Ð¢Ò“°Ð¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&&Vf÷&WVæÆöB"Â†WfVçB’Óâ°Ð¢–b‚7FFRæW†Ôf–æ—6†VBbb7FFRæW†ÕG—RÓÓÒ&f÷&ÖÂ"’°Ð¢WfVçBç&WfVçDFVfVÇB‚“°Ð¢WfVçBç&WGW&åfÇVRÒ"#°Ð¢ÐÐ¢Ò“°Ð§ÐÐ Ð¦7–æ2gVæ7F–öâ–æ—B‚’°Ð¢G'’°Ð¢v—BÆöEVW7F–öç2‚“°Ð¢ÆöD7W'&VçEW6W"‚“°Ð¢&V6öæ6–ÆU7F÷&VEVW7F–öç2‚“°Ð¢&VæFW$&æµ6VÆV7B‚“°Ð¢&VæFW%V—¥6WGW‚“°Ð¢–æ—E6Æövâ‚“°Ð¢&–æDWfVçG2‚“°Ð¢Ç”FÖ–ä66W72‚“°Ð¢v—BfÇW6…7–æ5VWVR‚“°Ð¢v—BÆöD6Æ÷VE7FG2‚“°Ð¢&VæFW$ÆÂ‚“°Ð¢6†÷tWF‚‚7FFRæ7W'&VçEW6W"“°Ð¢Ò6F6‚†W'&÷"’°Ð¢Fö7VÖVçBæ&öG’æ–ææW$…DÔÂÒÆF—b6Æ73Ò&V×G’#îš)Ž[©>Xª‹ÛÞZK‹J^ûÉ¢G¶W66T‡FÖÂ†W'&÷"æÖW76vR—ÓÂöF—cæ°Ð¢F‡&÷rW'&÷#°Ð¢ÐÐ§ÐÐ Ð¦–æ—B‚“°Ð Ð 