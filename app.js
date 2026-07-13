const BUILD_VERSION = "20260713-operations-quiz6";
const PRACTICE_AUTO_NEXT_DELAY_MS = 1200;
const FORMAL_AUTO_NEXT_DELAY_MS = 350;
let autoNextTimer = null;
const productUrl = `./outputs/product_quiz/閲戝皧浜у搧鐭ヨ瘑搴撻搴?json?v=${BUILD_VERSION}`;
const roleUrl = `./outputs/role_quiz/宀椾綅瀛︿範鑰冩牳棰樺簱.json?v=${BUILD_VERSION}`;
const API_BASE = "https://jinzun-knowledge.vercel.app";
const API_BASES = [API_BASE];
const CLOUD_ENABLED = true;
const CLOUD_TIMEOUT_MS = 60000;
const state = {
  allQuestions: [],
  filtered: [],
  currentBank: "鍏ㄩ儴棰樺簱",
  ruleFilters: { role: "", platform: "", riskLevel: "", module: "", sourceLevel: "" },
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
  ruleFilters: document.querySelector("#ruleFilters"),
  ruleRoleFilter: document.querySelector("#ruleRoleFilter"),
  rulePlatformFilter: document.querySelector("#rulePlatformFilter"),
  ruleRiskFilter: document.querySelector("#ruleRiskFilter"),
  ruleModuleFilter: document.querySelector("#ruleModuleFilter"),
  ruleSourceFilter: document.querySelector("#ruleSourceFilter"),
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
  adminEmployeeForm: document.querySelector("#adminEmployeeForm"),
  adminEmployeeName: document.querySelector("#adminEmployeeName"),
  adminEmployeePhone: document.querySelector("#adminEmployeePhone"),
  adminEmployeeRole: document.querySelector("#adminEmployeeRole"),
  adminEmployeePassword: document.querySelector("#adminEmployeePassword"),
  adminEmployeeList: document.querySelector("#adminEmployeeList"),
  adminAccountStatus: document.querySelector("#adminAccountStatus"),
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
      throw new Error("鏈嶅姟鍣ㄥ搷搴旇秴杩?0绉掞紝璇风◢鍚庨噸鏂版彁浜?);
    }
    if (error instanceof TypeError || message.includes("failed to fetch") || message.includes("networkerror")) {
      throw new Error("鏆傛椂鏃犳硶杩炴帴鏈嶅姟鍣紝璇锋鏌ョ綉缁滃悗閲嶈瘯");
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
  "浠ヤ笓涓氱煡璇嗙瓚鐗㈤樀鍦版牴鍩猴紝鐢ㄦ瘡娆＄粌涔犺В閿佹垚闀垮媼绔犮€?,
  "鐢ㄧ煡璇嗘媺婊″矖浣嶆垬鏂楀姏锛屽湪杩欓噷鎸戞垬鍏充箮灞炰簬浣犵殑楂樺厜鏃跺埢锛?,
  "姣忎竴娆＄簿鍑嗙殑缁冧範涓庢矇娣€锛岄兘鍦ㄨ璇佷綘鏇村嚭鑹茬殑涓撲笟铚曞彉銆?,
  "鑱氶泦鍥㈤槦鐐规淮涓撲笟鏅烘収锛岃祴鑳芥瘡涓€涓墿璧勭殑璧风偣锛岃鎴戜滑鍦ㄥ苟鑲╁墠琛屼腑鍏卞悓铚曞彉銆?,
  "瑙ｉ攣宀椾綅鏍稿績鎶€鑳斤紝涓庝紭绉€鐨勫墠杈堝苟鑲╁墠琛岋紝鍦ㄨ繖閲屽紑鍚綘鐨勮亴鍦鸿湑鍙樹箣鏃呫€?,
  "鐭ヨ瘑鍏变韩锛岃兘鍔涘叡杩涖€傚嚌鑱氭瘡涓€涓汉鐨勭偣婊磋繘姝ワ紝鍏卞垱灞炰簬鎴戜滑鐨勭簿褰╂湭鏉ャ€?,
  "杩欓噷鏄垜浠殑涓撲笟鍔犳补绔欙紝鐢ㄧ煡璇嗘棤澶勪笉璧嬭兘锛屽湪骞惰偐鎸戞垬涓悜涓婅湑鍙樸€?,
];

let sloganIndex = 0;
let sloganTimer = null;

function initSlogan() {
  const el = document.querySelector("#heroSlogan");
  const dots = document.querySelector("#sloganDots");
  if (!el || !dots) return;

  dots.innerHTML = slogans.map((_, i) =>
    `<button class="slogan-dot${i === 0 ? " active" : ""}" data-i="${i}" aria-label="鏌ョ湅绗?${i + 1} 鏉″涔犳彁绀?></button>`
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
  dashboard: "瀛︿範鎬昏",
  ranking: "鎺掕姒?,
  learn: "瀛︿範棰樺簱",
  quiz: "瀛︿範鑰冩牳",
  mistakes: "閿欓澶嶄範",
  admin: "绠＄悊鐪嬫澘",
};

const normalize = (value) => String(value ?? "").toLowerCase().trim();

const shelfLifeDays = (value) => {
  const text = String(value ?? "").trim();
  const digits = text.match(/\d+/)?.[0];
  if (!digits) return null;
  const number = Number(digits);
  if (text.includes("澶?)) return number;
  return text.includes("鏈?) ? number * 30 : number;
};

const isEquivalentAnswer = (question, selectedLetter) => {
  if (selectedLetter === question.answer) return true;
  if (question.knowledgePoint !== "淇濊川鏈?) return false;
  const selected = optionEntries(question).find(([letter]) => letter === selectedLetter)?.[1];
  const selectedDays = shelfLifeDays(selected);
  const answerDays = shelfLifeDays(question.answerText);
  return selectedDays !== null && answerDays !== null && selectedDays === answerDays;
};

// Strip product code from option text for quiz display.
// Only applied to 浜у搧鍚嶇О questions where the code in the option text gives away the answer.
const stripCodeFromOption = (text, question) => {
  if (question.knowledgePoint !== "浜у搧鍚嶇О" || !text) return text;
  const isCorrectAnswer = text === question.answerText;
  const answerStartsWithCurrentCode = normalize(text).startsWith(normalize(question.code));
  if (isCorrectAnswer && !answerStartsWithCurrentCode) return text;
  return text
    .replace(/^\d{4}[A-Za-z]?\s*/, "") // "2232A 閲戝皧..." / "2421婢抽棬鍏槦..." 鈫?"閲戝皧..." / "婢抽棬鍏槦..."
    .replace(/銆怺^銆慮+銆?g, "")          // "绀肩洅銆?206銆?鐩掕" 鈫?"绀肩洅2鐩掕"
    .trim();
};

const displayAnswerText = (question) => stripCodeFromOption(question.answerText, question);
const displayExplanation = (question) => {
  if (question.knowledgePoint !== "浜у搧鍚嶇О") return question.explanation;
  const name = displayAnswerText(question);
  return `${question.code} 瀵瑰簲鐨勪骇鍝佸悕绉版槸锛?{name}銆俙;
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
  safeJsonArray(`jz_${phone}_exam_records`);

const getUserMistakes = (phone) =>
  safeJsonArray(`jz_${phone}_mistakes`);

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

function showConnectionStatus() {
  const existing = document.querySelector("#cloudSyncStatus");
  const target = existing || document.createElement("div");
  target.id = "cloudSyncStatus";
  target.className = "cloud-sync-status info";
  target.textContent = "姝ｅ湪杩炴帴鍏徃璐﹀彿绯荤粺锛岃鍕垮叧闂〉闈⑩€︹€?;
  if (!existing) document.body.appendChild(target);
  clearTimeout(target._timer);
  target._timer = null;
}

function hideConnectionStatus() {
  document.querySelector("#cloudSyncStatus")?.remove();
}

async function cloudRequest(action, payload) {
  if (!CLOUD_ENABLED) return { ok: true, skipped: true };
  const accountAction = ["login", "register", "reset"].includes(action);
  if (accountAction) showConnectionStatus();
  const token = localStorage.getItem("jz_auth_token") || "";
  const body = JSON.stringify({ ...payload, token: payload.token || token, userAgent: navigator.userAgent, deviceId: payload.deviceId || getClientId(), clientId: payload.clientId || getClientId() });
  let lastError = null;
  for (const base of API_BASES) {
    try {
      const res = await fetchWithTimeout(`${base}/api/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body,
      }, CLOUD_TIMEOUT_MS);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `浜戠鍚屾澶辫触锛?{res.status}`);
      if (!data.ok) throw new Error(data.error || "浜戠鍚屾澶辫触");
      if (accountAction) hideConnectionStatus();
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  if (accountAction) hideConnectionStatus();
  throw lastError || new Error("浜戠鍚屾澶辫触");
}

async function syncLater(action, payload) {
  if (!CLOUD_ENABLED) return { ok: true, skipped: true };
  try {
    const data = await cloudRequest(action, payload);
    if (action === "exam" && !data.record_id) throw new Error("鏈嶅姟鍣ㄦ湭杩斿洖鑰冭瘯璁板綍ID");
    if (action === "mistakes" && payload.items?.length && (!Array.isArray(data.record_ids) || data.record_ids.length < payload.items.length)) {
      throw new Error("鏈嶅姟鍣ㄦ湭杩斿洖瀹屾暣閿欓璁板綍ID");
    }
    if (action === "exam") setSyncStatus("姝ｅ紡鑰冭瘯宸插悓姝ュ埌椋炰功", "success");
    if (action === "mistakes" && payload.items?.length) setSyncStatus("閿欓宸叉壒閲忓悓姝ュ埌椋炰功", "success");
    return data;
  } catch (error) {
    const queue = safeJsonArray("jz_sync_queue");
    queue.push({ action, payload, createdAt: new Date().toISOString(), error: error.message });
    localStorage.setItem("jz_sync_queue", JSON.stringify(queue.slice(-300)));
    setSyncStatus(`浜戠鍚屾澶辫触锛屽凡鏆傚瓨鏈満锛?{error.message}`, "error");
    return { ok: false, error: error.message };
  }
}

async function flushSyncQueue() {
  if (!CLOUD_ENABLED) {
    localStorage.removeItem("jz_sync_queue");
    return;
  }
  const queue = safeJsonArray("jz_sync_queue");
  if (!queue.length) return;
  const remain = [];
  for (const item of queue) {
    if (!['mistakes'].includes(item.action)) continue;
    try {
      await cloudRequest(item.action, item.payload);
    } catch (error) {
      remain.push({ ...item, error: error.message });
    }
  }
  localStorage.setItem("jz_sync_queue", JSON.stringify(remain.slice(-300)));
}

async function loadCloudStats() {
  if (!CLOUD_ENABLED) {
    state.cloudStats = null;
    return;
  }
  try {
    const token = localStorage.getItem("jz_auth_token") || "";
    const res = await fetchWithTimeout(`${API_BASE}/api/stats`, token ? { headers: { Authorization: `Bearer ${token}` } } : {}, CLOUD_TIMEOUT_MS);
    const data = await res.json();
    if (data.ok) state.cloudStats = data;
  } catch {
    state.cloudStats = null;
  }
}

async function loadQuestions() {
  const [productRes, roleRes] = await Promise.all([fetch(productUrl), fetch(roleUrl)]);
  if (!productRes.ok || !roleRes.ok) {
    throw new Error(`棰樺簱鏂囦欢璇锋眰澶辫触锛堜骇鍝?${productRes.status} / 宀椾綅 ${roleRes.status}锛塦);
  }
  const parseQuizJson = async (response, label) => {
    if (!response.ok) {
      throw new Error(`${label}鏆傛椂鏃犳硶鍔犺浇锛岃鍒锋柊椤甸潰閲嶈瘯`);
    }
    const text = await response.text();
    const start = Math.min(...[text.indexOf("["), text.indexOf("{")].filter((index) => index >= 0));
    if (!Number.isFinite(start)) {
      throw new Error(`${label}鏍煎紡寮傚父锛岃鍒锋柊椤甸潰閲嶈瘯`);
    }
    try {
      return JSON.parse(text.slice(start));
    } catch {
      throw new Error(`${label}鏍煎紡寮傚父锛岃鍒锋柊椤甸潰閲嶈瘯`);
    }
  };

  const [productQuestions, roleQuestions] = await Promise.all([
    parseQuizJson(productRes, "浜у搧棰樺簱"),
    parseQuizJson(roleRes, "宀椾綅棰樺簱")
  ]);
  state.allQuestions = [...productQuestions, ...roleQuestions].map((question) => ({
    ...question,
    role: question.role || question.category || "",
    module: question.module || question.productLine || "",
    source: question.source || "浜у搧鐭ヨ瘑搴?,
    note: question.note || "",
  }));
}

const questionIdentity = (question) => [
  question.bank || "",
  question.code || "",
  question.knowledgePoint || "",
  question.type || "",
].join("|");

function reconcileStoredQuestions() {
  if (!state.currentUser) return;
  const byId = new Map(state.allQuestions.map((question) => [question.id, question]));
  const byIdentity = new Map(state.allQuestions.map((question) => [questionIdentity(question), question]));
  const resolveCurrent = (question) => {
    if (!question) return null;
    if (String(question.id || "").startsWith("R-")) return byId.get(question.id) || null;
    return byIdentity.get(questionIdentity(question)) || null;
  };

  const seen = new Set();
  const migratedMistakes = storage.mistakes.flatMap((oldQuestion) => {
    const current = resolveCurrent(oldQuestion);
    if (!current) return [];
    const key = questionIdentity(current);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...current, selected: oldQuestion.selected || "", savedAt: oldQuestion.savedAt || new Date().toISOString() }];
  });
  storage.mistakes = migratedMistakes.slice(0, 300);

  storage.examRecords = storage.examRecords.slice(0, 100).map((record) => ({
    ...record,
    buildVersion: record.buildVersion || "legacy",
    wrongDetails: (record.wrongDetails || []).flatMap((oldQuestion) => {
      const current = resolveCurrent(oldQuestion);
      return current ? [{ ...current, selected: oldQuestion.selected || "", savedAt: oldQuestion.savedAt || "" }] : [];
    }),
  }));
}

function banks() {
  return ["鍏ㄩ儴棰樺簱", ...new Set(state.allQuestions.map((question) => question.bank))];
}

function bankQuestions() {
  const keyword = normalize(els.searchInput.value);
  return state.allQuestions.filter((question) => {
    const bankMatch = state.currentBank === "鍏ㄩ儴棰樺簱" || question.bank === state.currentBank;
    if (!bankMatch) return false;
    const filter = state.ruleFilters;
    if (filter.role && question.role !== filter.role) return false;
    if (filter.platform && question.platform !== filter.platform) return false;
    if (filter.riskLevel && question.riskLevel !== filter.riskLevel) return false;
    if (filter.module && question.module !== filter.module) return false;
    if (filter.sourceLevel && question.sourceLevel !== filter.sourceLevel) return false;
    if (!keyword) return true;
    return [
      question.id,
      question.bank,
      question.role,
      question.module,
      question.code,
      question.productName,
      question.knowledgePoint,
      question.question,
      question.answerText,
    ]
      .map(normalize)
      .some((text) => text.includes(keyword));
  });
}

function renderBankSelect() {
  els.bankSelect.innerHTML = banks()
    .map((bank) => `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}</option>`)
    .join("");
  els.bankSelect.value = state.currentBank;
}

function renderStats() {
  state.filtered = bankQuestions();
  els.bankCount.textContent = state.filtered.length;
  els.mistakeCount.textContent = storage.mistakes.length;
  const accuracy = storage.attempts ? Math.round((storage.correct / storage.attempts) * 100) : 0;
  els.accuracyText.textContent = `${accuracy}%`;
  renderUser();
}

function renderDashboard() {
  const records = storage.examRecords;
  const mistakes = storage.mistakes;
  const todayRecords = records.filter((record) => record.finishedAt && todayKey(record.finishedAt) === todayKey());
  const best = records.reduce((acc, record) => Math.max(acc, Number(record.percent) || 0), 0);
  const last = records[0];

  els.taskPanel.innerHTML = `
    <div class="task-card ${todayRecords.length ? "done" : ""}">
      <span>${todayRecords.length ? "鉁? : "1"}</span>
      <div><strong>瀹屾垚浠婃棩鑰冩牳</strong><small>${todayRecords.length ? `浠婃棩宸插畬鎴?${todayRecords.length} 娆 : "寤鸿鍏堝仛 30-50 棰樻寮忚€冩牳"}</small></div>
    </div>
    <div class="task-card ${mistakes.length === 0 ? "done" : ""}">
      <span>${mistakes.length === 0 ? "鉁? : "2"}</span>
      <div><strong>澶嶄範閿欓</strong><small>${mistakes.length ? `杩樻湁 ${mistakes.length} 閬撻敊棰樺緟閲嶇粌` : "褰撳墠娌℃湁寰呭涔犻敊棰?}</small></div>
    </div>
    <div class="task-card ${best >= 90 ? "done" : ""}">
      <span>${best >= 90 ? "鉁? : "3"}</span>
      <div><strong>鍐插埡浼樼</strong><small>${best >= 90 ? `鏈€浣虫垚缁?${best} 鍒哷 : `璺濈浼樼杩樺樊 ${Math.max(0, 90 - best)} 鍒哷}</small></div>
    </div>
  `;

  const total = state.allQuestions.length;
  const productTotal = state.allQuestions.filter((q) => PRODUCT_BANKS.includes(q.bank)).length;
  const roleTotal = total - productTotal;
  els.summaryCards.innerHTML = `
    <div class="summary-card"><span>棰樺簱鎬婚噺</span><strong>${total}</strong><small>瑕嗙洊浜у搧涓庡矖浣?/small></div>
    <div class="summary-card"><span>浜у搧璧勬枡棰?/span><strong>${productTotal}</strong><small>浜у搧 / 鍦烘櫙 / 鍝佺墝 / 鍟嗗缂栫爜</small></div>
    <div class="summary-card"><span>宀椾綅棰?/span><strong>${roleTotal}</strong><small>杩愯惀 / 瀹㈡湇 / 缇庡伐绛?/small></div>
    <div class="summary-card"><span>鏈€杩戞垚缁?/span><strong>${last ? `${last.percent}鍒哷 : "--"}</strong><small>${last ? examTimeLabel(last.finishedAt) : "鏆傛棤鑰冭瘯璁板綍"}</small></div>
  `;

  const grouped = banks()
    .filter((bank) => bank !== "鍏ㄩ儴棰樺簱")
    .map((bank) => ({
      bank,
      count: state.allQuestions.filter((question) => question.bank === bank).length,
      imageCount: state.allQuestions.filter((question) => question.bank === bank && (question.questionImage || question.optionAImage)).length,
    }));

  els.bankCards.innerHTML = grouped
    .map(
      (item) => `
        <button class="bank-card" data-bank="${escapeHtml(item.bank)}">
          <h4>${escapeHtml(item.bank)}</h4>
          <p>${item.imageCount ? `${item.imageCount} 閬撳浘鐗囬` : "宀椾綅涓庣煡璇嗙偣缁冧範"}</p>
          <strong>${item.count}</strong>
        </button>
      `
    )
    .join("");

  els.bankCards.querySelectorAll(".bank-card").forEach((card) => {
    card.addEventListener("click", () => {
      clearAutoNextTimer();
      state.currentBank = card.dataset.bank;
      state.learnPage = 1;
      els.bankSelect.value = state.currentBank;
      switchView("learn");
      renderAll();
    });
  });
}

function examTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function renderQuestionImages(question) {
  if (!question.questionImage) return "";
  return `<img class="thumb" src="${imagePath(question.questionImage)}" alt="棰樼洰鍥剧墖" loading="lazy" />`;
}

function renderOptionImages(question) {
  const imageOptions = optionEntries(question).filter(([, , image]) => image);
  if (!imageOptions.length) return "";
  return `
    <div class="learn-option-images">
      ${imageOptions
        .map(
          ([letter, text, img, imageWidth]) => `
            <figure>
              <img src="${imagePath(img)}" alt="閫夐」${letter}鍥剧墖" loading="lazy" ${imageWidth ? `style="max-width:${imageWidth}px"` : ""} />
              <figcaption>${letter} ${escapeHtml(text)}</figcaption>
            </figure>
          `
        )
        .join("")}
    </div>
  `;
}

function renderLearnFilter() {
  const allBanks = banks().filter((b) => b !== "鍏ㄩ儴棰樺簱");
  const productBankSet = new Set(PRODUCT_BANKS);
  const productGroup = allBanks.filter((b) => productBankSet.has(b));
  const roleGroup = allBanks.filter((b) => !productBankSet.has(b));

  const makeBtn = (label, value) => {
    const active = state.currentBank === value;
    return `<button class="learn-filter-btn${active ? " active" : ""}" data-bank="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
  };

  els.learnFilter.innerHTML = `
    ${makeBtn("鍏ㄩ儴", "鍏ㄩ儴棰樺簱")}
    <span class="filter-sep"></span>
    ${productGroup.map((b) => makeBtn(b, b)).join("")}
    <span class="filter-sep"></span>
    ${roleGroup.map((b) => makeBtn(b, b)).join("")}
  `;

  const ruleQuestions = state.allQuestions.filter((q) => q.role && q.riskLevel);
  els.ruleFilters.classList.toggle("hidden", !ruleQuestions.length);
  const fillRuleSelect = (element, values, placeholder) => {
    if (!element) return;
    const current = element.value;
    element.innerHTML = `<option value="">${placeholder}</option>${values.sort().map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    element.value = current;
  };
  fillRuleSelect(els.ruleRoleFilter, [...new Set(ruleQuestions.map((q) => q.role))], "鍏ㄩ儴宀椾綅");
  fillRuleSelect(els.rulePlatformFilter, [...new Set(ruleQuestions.map((q) => q.platform))], "鍏ㄩ儴骞冲彴");
  fillRuleSelect(els.ruleModuleFilter, [...new Set(ruleQuestions.map((q) => q.module))], "鍏ㄩ儴妯″潡");
  els.ruleRiskFilter.value = state.ruleFilters.riskLevel;
  els.ruleSourceFilter.value = state.ruleFilters.sourceLevel;

  els.learnFilter.querySelectorAll(".learn-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearAutoNextTimer();
      state.currentBank = btn.dataset.bank;
      state.learnPage = 1;
      els.bankSelect.value = state.currentBank;
      renderAll();
    });
  });
}

function renderLearnList() {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.learnPageSize));
  state.learnPage = Math.min(state.learnPage, totalPages);
  const start = (state.learnPage - 1) * state.learnPageSize;
  const items = state.filtered.slice(start, start + state.learnPageSize);
  els.learnCount.textContent = `${state.filtered.length} 閬撻`;
  if (!items.length) {
    els.learnList.innerHTML = `<div class="empty">娌℃湁鎵惧埌鍖归厤鐨勯鐩€?/div>`;
    els.learnPagination.innerHTML = "";
    return;
  }
  els.learnList.innerHTML = items
    .map(
      (question) => {
        const statusTags = [];
        if (question.humanReviewStatus === "approved" && question.verificationStatus === "verified") statusTags.push("宸插鏍?);
        else if (question.humanReviewStatus === "pending" || question.verificationStatus === "pending") statusTags.push("寰呮牳楠?);
        if (question.sourceId?.includes("PUBLIC-AGREEMENT")) statusTags.push("瀹樻柟骞冲彴瑙勫垯");
        else if (question.sourceId) statusTags.push("鍥藉娉曞緥");
        else statusTags.push("鍐呴儴SOP");
        if (question.rejectionReason) statusTags.push("宸插簾寮?);
        return `
        <article class="learn-item">
          <div>
            <div class="meta">
              <span>${escapeHtml(question.bank)}</span>
              <span>${escapeHtml(question.type)}</span>
              <span>${escapeHtml(question.difficulty)}</span>
              <span>${escapeHtml(question.knowledgePoint)}</span>
              ${statusTags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
            </div>
            <h4>${escapeHtml(question.question)}</h4>
            <p class="answer-line">绛旀锛?{escapeHtml(question.answer)}锝?{escapeHtml(displayAnswerText(question))}</p>
            <p class="explain">${escapeHtml(displayExplanation(question))}</p>
            ${renderOptionImages(question)}
          </div>
          ${renderQuestionImages(question)}
        </article>
      `;
      }
    )
    .join("");
  els.learnPagination.innerHTML = `
    <button class="secondary-btn" data-page="prev" ${state.learnPage <= 1 ? "disabled" : ""}>涓婁竴椤?/button>
    <span>绗?${state.learnPage} / ${totalPages} 椤?/span>
    <button class="secondary-btn" data-page="next" ${state.learnPage >= totalPages ? "disabled" : ""}>涓嬩竴椤?/button>
  `;
  els.learnPagination.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.learnPage += button.dataset.page === "next" ? 1 : -1;
      renderLearnList();
      document.querySelector("#learnView")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

const PRODUCT_BANKS = ["鏈堥ゼ棰樺簱", "鏃ュ父骞磋揣棰樺簱", "涓氬姟鍦烘櫙棰樺簱", "鍝佺墝鐭ヨ瘑棰樺簱", "鍟嗗缂栫爜棰樺簱"];
const CORE_EXAM_BANKS = ["鏈堥ゼ棰樺簱", "鏃ュ父骞磋揣棰樺簱", "涓氬姟鍦烘櫙棰樺簱"];

let timerInterval = null;
let timerSeconds = 0;
let timerLimitSeconds = 0;
let timerExpired = false;

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function quizTimeLimit(size) {
  // 50棰?20鍒嗛挓锛屾寜姣斾緥缁欐椂闂达細姣忛24绉掞紱10棰?4鍒嗛挓銆?
  return Math.max(60, Math.round(size * 24));
}

function updateTimerText() {
  const remaining = Math.max(0, timerLimitSeconds - timerSeconds);
  els.quizTimer.textContent = `鈴?鍓╀綑 ${formatTime(remaining)}`;
}

function startTimer(limitSeconds) {
  clearInterval(timerInterval);
  timerSeconds = 0;
  timerExpired = false;
  timerLimitSeconds = limitSeconds || quizTimeLimit(state.quiz.length || EXAM_SIZE);
  updateTimerText();
  timerInterval = setInterval(() => {
    timerSeconds += 1;
    updateTimerText();
    if (timerSeconds >= timerLimitSeconds) {
      timerExpired = true;
      finishQuiz();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateWrongCount() {
  if (state.examType === "formal" && !state.examFinished) {
    els.quizWrongCount.textContent = "姝ｅ紡妯″紡涓嶆樉绀哄閿?;
    els.quizWrongCount.classList.remove("has-wrong");
    return;
  }
  els.quizWrongCount.textContent = `鉁?閿欒 ${state.quizWrong} 棰榒;
  els.quizWrongCount.classList.toggle("has-wrong", state.quizWrong > 0);
}
const EXAM_SIZE = 50;

function setExamLocked(locked) {
  document.body.classList.toggle("exam-locked", locked);
  els.navTabs.forEach((tab) => { tab.disabled = locked; });
  [els.bankSelect, els.searchInput, els.resetBtn, els.logoutBtn].forEach((control) => {
    if (control) control.disabled = locked;
  });
}

function renderQuizSetup() {
  const productBanks = PRODUCT_BANKS.filter((bank) =>
    state.allQuestions.some((q) => q.bank === bank)
  );
  const roleBanks = banks().filter(
    (bank) => bank !== "鍏ㄩ儴棰樺簱" && !PRODUCT_BANKS.includes(bank)
  );

  els.productBankSelect.innerHTML = productBanks
    .map((bank) => {
      const count = state.allQuestions.filter((q) => q.bank === bank).length;
      return `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}锛?{count} 棰橈級</option>`;
    })
    .join("");

  els.roleBankSelect.innerHTML = roleBanks
    .map((bank) => {
      const count = state.allQuestions.filter((q) => q.bank === bank).length;
      return `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}锛?{count} 棰橈級</option>`;
    })
    .join("");
}

async function startQuiz() {
  clearAutoNextTimer();
  const size = Number(els.quizSize.value) || EXAM_SIZE;
  state.examType = els.examType?.value || "practice";
  state.examLabelOverride = "";
  state.examId = "";
  state.examSessionToken = "";
  state.submissionId = "";
  state.serverRecordId = "";
  state.serverDuration = null;
  state.examSubmitting = false;
  state.answers = new Map();
  let pool = [];
  if (state.examType === "formal") {
    const allowedModes = ["random", "product", "role"];
    const mode = allowedModes.includes(state.quizMode) ? state.quizMode : "random";
    let bank = "";
    if (mode === "product") bank = els.productBankSelect.value;
    if (mode === "role") bank = els.roleBankSelect.value;
    try {
      const data = await cloudRequest("exam-start", { mode, bank, size });
      if (!data.sessionToken || !data.examId || !Array.isArray(data.questions) || !data.questions.length) {
        throw new Error("鏈嶅姟鍣ㄦ湭杩斿洖鏈夋晥鑰冭瘯棰樼洰");
      }
      state.examId = data.examId;
      state.examSessionToken = data.sessionToken;
      state.submissionId = crypto.randomUUID();
      state.quiz = data.questions;
      state.examLabelOverride = data.bank || bank || "缁煎悎浜у搧棰樺簱";
    } catch (error) {
      els.quizSetupStatus.textContent = `姝ｅ紡鑰冭瘯鍚姩澶辫触锛?{error.message}`;
      return;
    }
  } else {
    // 缁冧範妯″紡涔熷彧浠庤€冭瘯鎺т欢閫夋嫨鐨勯搴撳彇棰橈紝涓嶅彈鎼滅储妗嗗拰宸︿晶瀛︿範绛涢€夊奖鍝嶃€?    if (state.examType === "redline") {
      pool = state.allQuestions.filter((q) => q.riskLevel === "redline" && (!q.role || q.role === state.currentUser?.role || q.role === "鍏ㄥ憳"));
      state.examLabelOverride = "宀椾綅绾㈢嚎瑙勫垯棰樺簱";
    } else if (state.quizMode === "product") {
      const bank = els.productBankSelect.value;
      pool = state.allQuestions.filter((q) => q.bank === bank);
      state.examLabelOverride = bank;
    } else if (state.quizMode === "role") {
      const bank = els.roleBankSelect.value;
      pool = state.allQuestions.filter((q) => q.bank === bank && (q.role === state.currentUser?.role || q.role === "鍏ㄥ憳"));
      state.examLabelOverride = bank;
    } else {
      pool = state.allQuestions.filter((q) => CORE_EXAM_BANKS.includes(q.bank));
      state.examLabelOverride = "缁煎悎浜у搧棰樺簱";
    }
    state.quiz = shuffle(pool).slice(0, Math.min(size, pool.length));
  }
  if (!state.quiz.length) {
    els.quizSetupStatus.textContent = "褰撳墠绛涢€夋病鏈夊彲鐢ㄤ簬鑰冩牳鐨勯鐩紝璇疯皟鏁存悳绱㈡垨棰樺簱绛涢€夈€?;
    return;
  }
  els.quizSetupStatus.textContent = state.quiz.length < size
    ? `褰撳墠棰樺簱鍙湁 ${state.quiz.length} 棰橈紝鏈灏嗗叏閮ㄤ娇鐢ㄣ€俙
    : "";
  state.quizIndex = 0;
  state.score = 0;
  state.answered = false;
  state.answeredCount = 0;
  state.answeredQuestionIds = new Set();
  state.quizWrong = 0;
  state.wrongDetails = [];
  state.examFinished = false;
  if (els.examSubmitStatus) els.examSubmitStatus.textContent = "";
  if (els.retryExamSubmitBtn) els.retryExamSubmitBtn.classList.add("hidden");
  setExamLocked(state.examType === "formal");
  startTimer(quizTimeLimit(state.quiz.length));
  updateWrongCount();
  els.quizSetup.classList.add("hidden");
  els.quizResult.classList.add("hidden");
  els.quizRunner.classList.remove("hidden");
  renderQuizCard();
}

function goToNextQuestion() {
  clearAutoNextTimer();
  if (state.quizIndex + 1 >= state.quiz.length) {
    finishQuiz();
    return;
  }
  state.quizIndex += 1;
  state.answered = false;
  renderQuizCard();
  renderStats();
  requestAnimationFrame(() => {
    els.quizCard?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  });
  [[els.ruleRoleFilter, "role"], [els.rulePlatformFilter, "platform"], [els.ruleRiskFilter, "riskLevel"], [els.ruleModuleFilter, "module"], [els.ruleSourceFilter, "sourceLevel"]].forEach(([element, key]) => {
    element?.addEventListener("change", () => {
      state.ruleFilters[key] = element.value;
      state.learnPage = 1;
      renderAll();
    });
  });
}

function scheduleAutoNext() {
  clearAutoNextTimer();
  const delay = state.examType === "formal" ? FORMAL_AUTO_NEXT_DELAY_MS : PRACTICE_AUTO_NEXT_DELAY_MS;
  autoNextTimer = setTimeout(goToNextQuestion, delay);
}

function renderQuizCard() {
  const question = state.quiz[state.quizIndex];
  if (!question) {
    finishQuiz();
    return;
  }
  const progress = ((state.quizIndex + 1) / state.quiz.length) * 100;
  els.quizStep.textContent = `绗?${state.quizIndex + 1} 棰榒;
  els.quizScore.textContent = state.examType === "formal"
    ? `宸茬瓟 ${state.answeredCount} 棰榒
    : `绛斿 ${state.score} 棰榒;
  els.progressBar.style.width = `${progress}%`;
  const options = optionEntries(question);
  els.quizCard.innerHTML = `
    <div class="meta">
      <span>${escapeHtml(question.bank)}</span>
      <span>${escapeHtml(question.type)}</span>
      <span>${escapeHtml(question.knowledgePoint)}</span>
    </div>
    <h3>${escapeHtml(question.question)}</h3>
    ${question.questionImage ? (() => {
      const sourceWidth = Math.max(120, Number(question.questionImageWidth) || 520);
      return `<div class="quiz-img-wrap" style="width:min(${sourceWidth}px, 100%)">
        <img src="${imagePath(question.questionImage)}" alt="棰樼洰鍥剧墖" />
      </div>`;
    })() : ""}
    <div class="options">
      ${options
        .map(
          ([letter, text, img, imageWidth]) => `
            <button class="option-btn" data-letter="${letter}">
              <strong>${letter}</strong>${escapeHtml(stripCodeFromOption(text, question))}
              ${img ? (() => {
                return `<div class="quiz-opt-img" ${imageWidth ? `style="max-width:${Math.max(120, imageWidth)}px"` : ""}>
                  <img src="${imagePath(img)}" alt="閫夐」${letter}鍥剧墖" />
                </div>`;
              })() : ""}
            </button>
          `
        )
        .join("")}
    </div>
    <div id="feedback" class="feedback hidden"></div>
  `;
  els.quizCard.querySelectorAll(".option-btn").forEach((button) => {
    button.addEventListener("click", () => chooseAnswer(button.dataset.letter));
  });
}

function chooseAnswer(letter) {
  if (state.answered) return;
  state.answered = true;
  const question = state.quiz[state.quizIndex];
  state.answeredCount += 1;
  state.answeredQuestionIds.add(question.id);
  const correct = state.examType === "formal" ? null : isEquivalentAnswer(question, letter);
  if (state.examType === "formal") state.answers.set(question.id, letter);
  storage.attempts += 1;
  if (correct === true) {
    storage.correct += 1;
    state.score += 1;
  } else if (correct === false) {
    state.quizWrong += 1;
    state.wrongDetails.push({ ...question, selected: letter, savedAt: new Date().toISOString() });
    if (state.examType === "practice") updateWrongCount();
  }
  els.quizScore.textContent = state.examType === "formal"
    ? `宸茬瓟 ${state.answeredCount} 棰榒
    : `绛斿 ${state.score} 棰榒;
  els.quizCard.querySelectorAll(".option-btn").forEach((button) => {
    button.disabled = true;
    if (state.examType === "practice" && button.dataset.letter === question.answer) button.classList.add("correct");
    if (state.examType === "practice" && button.dataset.letter === letter && !correct) button.classList.add("wrong");
    if (state.examType === "formal" && button.dataset.letter === letter) button.classList.add("selected");
  });
  const feedback = document.querySelector("#feedback");
  feedback.classList.remove("hidden");
  const isLast = state.quizIndex + 1 >= state.quiz.length;
  feedback.innerHTML = state.examType === "formal" ? `
    <strong>宸蹭綔绛?/strong>
    <p class="explain">${isLast ? "姝ｅ湪鎻愪氦璇曞嵎鈥? : "鍗冲皢杩涘叆涓嬩竴棰樷€?}</p>
  ` : `
    <strong>${correct ? "鍥炵瓟姝ｇ‘" : "鍥炵瓟閿欒"}</strong>
    <p class="explain">姝ｇ‘绛旀锛?{escapeHtml(question.answer)}锝?{escapeHtml(displayAnswerText(question))}</p>
    <p class="explain">${escapeHtml(displayExplanation(question))}</p>
    <p class="auto-next-hint">${isLast ? "鍗冲皢鏄剧ず鎴愮哗鈥? : "鍗冲皢杩涘叆涓嬩竴棰樷€?}</p>
  `;
  scheduleAutoNext();
}

function saveMistake(question, selected) {
  const key = questionIdentity(question);
  const mistakes = storage.mistakes.filter((item) => questionIdentity(item) !== key);
  const item = { ...question, selected, savedAt: new Date().toISOString() };
  mistakes.unshift(item);
  storage.mistakes = mistakes.slice(0, 300);
}

async function submitFormalExam() {
  const data = await cloudRequest("exam-submit", {
    sessionToken: state.examSessionToken,
    submissionId: state.submissionId,
    answers: [...state.answers.entries()].map(([id, answer]) => ({ id, answer })),
  });
  if (!data.record_id) throw new Error("鏈嶅姟鍣ㄦ湭杩斿洖姝ｅ紡鑰冭瘯璁板綍ID");
  state.score = Number(data.correct || 0);
  state.quizWrong = Number(data.wrong || 0);
  state.serverRecordId = data.record_id;
  state.serverDuration = Number.isFinite(Number(data.duration)) ? Number(data.duration) : null;
  state.wrongDetails = Array.isArray(data.wrong_details) ? data.wrong_details : [];
  state.wrongDetails.forEach((item) => saveMistake(item, item.selected || "鏈綔绛?));
  return data;
}

async function finishQuiz() {
  if (state.examFinished || !state.quiz.length) return;
  if (state.examType === "formal" && state.examSubmitting) return;
  clearAutoNextTimer();
  stopTimer();
  if (state.examType === "formal") {
    state.examSubmitting = true;
    document.body.classList.add("exam-submitting");
    try {
      await submitFormalExam();
    } catch (error) {
      state.examFinished = false;
      setExamLocked(true);
      if (els.examSubmitStatus) {
        els.examSubmitStatus.textContent = `鎴愮哗鎻愪氦澶辫触锛?{error.message}`;
        els.retryExamSubmitBtn.classList.remove("hidden");
      }
      return;
    } finally {
      state.examSubmitting = false;
      document.body.classList.remove("exam-submitting");
    }
  } else {
    const unansweredQuestions = state.quiz.filter((question) => !state.answeredQuestionIds.has(question.id));
    if (unansweredQuestions.length) {
      storage.attempts += unansweredQuestions.length;
      unansweredQuestions.forEach((question) => {
        state.wrongDetails.push({ ...question, selected: "鏈綔绛?, savedAt: new Date().toISOString() });
        saveMistake(question, "鏈綔绛?);
      });
      state.quizWrong += unansweredQuestions.length;
    }
    if (state.wrongDetails.length) {
      await syncLater("mistakes", { user: state.currentUser, items: state.wrongDetails, submissionId: crypto.randomUUID() });
    }
  }
  state.examFinished = true;
  setExamLocked(false);
  if (els.examSubmitStatus) els.examSubmitStatus.textContent = "";
  if (els.retryExamSubmitBtn) els.retryExamSubmitBtn.classList.add("hidden");
  updateWrongCount();
  const percent = state.quiz.length ? Math.round((state.score / state.quiz.length) * 100) : 0;
  const passMark = state.examType === "redline" ? 100 : 80;
  const timeStr = formatTime(state.serverDuration ?? timerSeconds);
  const examSyncSuccess = state.examType === "formal" && state.serverRecordId
    ? `<p class="exam-sync-success" role="status">姝ｅ紡鑰冭瘯宸插悓姝ュ埌椋炰功</p>`
    : "";
  saveExamRecord(percent);
  els.quizRunner.classList.add("hidden");
  els.quizResult.classList.remove("hidden");
  const wrongReview = state.wrongDetails.length ? `
    <div class="wrong-review">
      <h4>鏈閿欓瑙ｆ瀽</h4>
      ${state.wrongDetails.slice(0, 8).map((q, i) => `
        <div class="wrong-review-item">
          <strong>${i + 1}. ${escapeHtml(q.question)}</strong>
          <p>閿欓€夛細${escapeHtml(q.selected)}锝滄纭細${escapeHtml(q.answer)} ${escapeHtml(displayAnswerText(q))}</p>
          <small>${escapeHtml(displayExplanation(q))}</small>
        </div>
      `).join("")}
      ${state.wrongDetails.length > 8 ? `<p class="explain">鏇村閿欓宸茶繘鍏ラ敊棰樻湰銆?/p>` : ""}
    </div>
  ` : "";
  els.quizResult.innerHTML = `
    ${examSyncSuccess}
    <p class="eyebrow">Result 路 ${escapeHtml(examLabel())} 路 ${state.examType === "formal" ? "姝ｅ紡鑰冭瘯" : "缁冧範妯″紡"}</p>
    <h3>${percent} 鍒?/h3>
    ${timerExpired ? `<p class="explain result-wrong">鏃堕棿鍒帮紝宸茶嚜鍔ㄤ氦鍗枫€?/p>` : ""}
    <div class="result-meta">
      <span>鉁?绛斿 ${state.score} 棰?/span>
      <span class="${state.quizWrong > 0 ? "result-wrong" : ""}">鉁?绛旈敊 ${state.quizWrong} 棰?/span>
      <span>鈴?鐢ㄦ椂 ${timeStr}</span>
      <span>${percent >= passMark ? "宸查€氳繃" : state.examType === "redline" ? "绾㈢嚎妯″潡鏈€氳繃" : "鏈€氳繃"}</span>
    </div>
    <p class="explain">${state.examType === "redline" && percent < 100 ? "绾㈢嚎棰橀敊1棰樺嵆鏈€氳繃锛岃鍏堝涔犻敊棰樺悗閲嶆柊瀛︿範銆? : percent >= 90 ? "琛ㄧ幇寰堢ǔ锛屽彲浠ヨ繘鍏ヤ笅涓€缁勯搴撱€? : percent >= 80 ? "宸茶揪鍒板悎鏍肩嚎锛屽缓璁户缁噸缁冮敊棰樺啿鍒轰紭绉€銆? : "寤鸿鍏堝涔犻敊棰橈紝鍐嶉噸鏂拌€冧竴娆°€?}</p>
    ${wrongReview}
    <div class="result-actions">
      <button class="primary-btn" id="retryQuizBtn">閲嶆柊鑰冩牳</button>
      <button class="secondary-btn" id="backToQuizSetupBtn">杩斿洖閫夋嫨棰樼洰</button>
      <button class="secondary-btn" id="reviewMistakesBtn">鏌ョ湅閿欓</button>
    </div>
  `;
  document.querySelector("#retryQuizBtn").addEventListener("click", startQuiz);
  document.querySelector("#backToQuizSetupBtn").addEventListener("click", () => {
    clearAutoNextTimer();
    els.quizResult.classList.add("hidden");
    els.quizRunner.classList.add("hidden");
    els.quizSetup.classList.remove("hidden");
    els.quizSetupStatus.textContent = "";
    els.examSubmitStatus.textContent = "";
    els.retryExamSubmitBtn.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.querySelector("#reviewMistakesBtn").addEventListener("click", () => switchView("mistakes"));
  renderStats();
}

function examLabel() {
  if (state.examLabelOverride) return state.examLabelOverride;
  if (state.quizMode === "product") return els.productBankSelect.value;
  if (state.quizMode === "role") return els.roleBankSelect.value;
  return "缁煎悎浜у搧棰樺簱";
}

function saveExamRecord(percent) {
  const records = storage.examRecords;
  records.unshift({
    user: state.currentUser,
    bank: examLabel(),
    type: state.examType === "formal" ? "姝ｅ紡鑰冭瘯" : "缁冧範妯″紡",
    score: state.score,
    total: state.quiz.length,
    wrong: state.quizWrong,
    percent,
    passed: state.examType === "redline" ? percent >= 100 : percent >= 80,
    duration: timerSeconds,
    finishedAt: new Date().toISOString(),
    buildVersion: BUILD_VERSION,
    serverRecordId: state.serverRecordId || "",
    wrongDetails: state.wrongDetails.slice(0, 30),
  });
  storage.examRecords = records.slice(0, 100);
}

function renderMistakes() {
  const mistakes = storage.mistakes;
  els.retryMistakesBtn.disabled = !mistakes.length;
  if (!mistakes.length) {
    els.mistakeList.innerHTML = `<div class="empty">鐜板湪杩樻病鏈夐敊棰樿褰曘€?/div>`;
    return;
  }
  const grouped = mistakes.reduce((acc, q) => {
    const key = q.knowledgePoint || "鍏朵粬";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topTags = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, count]) => `<span class="pill">${escapeHtml(name)} ${count}</span>`).join("");
  els.mistakeList.innerHTML = `
    <div class="mistake-summary">
      <strong>寰呭涔?${mistakes.length} 閬?/strong>
      <div>${topTags}</div>
    </div>
    ${mistakes
      .map(
        (question) => `
          <article class="learn-item">
            <div>
              <div class="meta">
                <span>${escapeHtml(question.bank)}</span>
                <span>${escapeHtml(question.knowledgePoint)}</span>
                <span>閿欓€夛細${escapeHtml(question.selected)}</span>
              </div>
              <h4>${escapeHtml(question.question)}</h4>
              <p class="answer-line">姝ｇ‘绛旀锛?{escapeHtml(question.answer)}锝?{escapeHtml(displayAnswerText(question))}</p>
              <p class="explain">${escapeHtml(displayExplanation(question))}</p>
              ${renderOptionImages(question)}
            </div>
            ${renderQuestionImages(question)}
          </article>
        `
      )
      .join("")}
  `;
}

function startMistakeQuiz() {
  clearAutoNextTimer();
  const mistakes = storage.mistakes;
  if (!mistakes.length) return;
  state.quiz = shuffle(mistakes).slice(0, Math.min(30, mistakes.length));
  state.quizIndex = 0;
  state.score = 0;
  state.answered = false;
  state.answeredCount = 0;
  state.answeredQuestionIds = new Set();
  state.quizWrong = 0;
  state.wrongDetails = [];
  state.examType = "practice";
  state.examFinished = false;
  state.examSubmitting = false;
  state.examLabelOverride = "閿欓閲嶇粌";
  startTimer(quizTimeLimit(state.quiz.length));
  updateWrongCount();
  switchView("quiz");
  els.quizSetup.classList.add("hidden");
  els.quizResult.classList.add("hidden");
  els.quizRunner.classList.remove("hidden");
  renderQuizCard();
}

let rankSortMode = "score";

function renderRanking() {
  const listEl = document.querySelector("#rankingList");
  if (!listEl) return;

  const allUsers = userStore.users;
  const rows = Object.values(allUsers).map((user) => {
    const records = JSON.parse(
      localStorage.getItem(`jz_${user.phone}_exam_records`) || "[]"
    );
    if (!records.length) return null;
    const best = records.reduce((a, b) => {
      if (b.percent > a.percent) return b;
      if (b.percent === a.percent && (b.duration ?? 99999) < (a.duration ?? 99999)) return b;
      return a;
    });
    return { user, best, totalExams: records.length };
  }).filter(Boolean);

  if (rankSortMode === "time") {
    rows.sort((a, b) => {
      const ta = a.best.duration ?? 99999;
      const tb = b.best.duration ?? 99999;
      if (ta !== tb) return ta - tb;
      return b.best.percent - a.best.percent;
    });
  } else {
    rows.sort((a, b) => {
      if (b.best.percent !== a.best.percent) return b.best.percent - a.best.percent;
      return (a.best.duration ?? 99999) - (b.best.duration ?? 99999);
    });
  }

  if (!rows.length) {
    listEl.innerHTML = `<div class="empty">杩樻病鏈夎€冩牳璁板綍锛屽畬鎴愪竴娆¤€冩牳鍚庡嵆鍙笂姒溿€?/div>`;
    return;
  }

  const medalClass = (i) => (i === 0 ? " rank-gold" : i === 1 ? " rank-silver" : i === 2 ? " rank-bronze" : "");
  const medalLabel = (i) => (i === 0 ? "馃" : i === 1 ? "馃" : i === 2 ? "馃" : String(i + 1));

  listEl.innerHTML = rows.map(({ user, best, totalExams }, i) => `
    <div class="rank-row${i < 3 ? " rank-top" : ""}">
      <div class="rank-num${medalClass(i)}">${medalLabel(i)}</div>
      <div class="rank-info">
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.role)} 路 鑰冩牳 ${totalExams} 娆?/span>
      </div>
      <div class="rank-mid">
        <span class="rank-bank">${escapeHtml(best.bank || "")}</span>
        <span class="rank-detail-time">${best.duration != null ? "鈴?" + formatTime(best.duration) : ""}</span>
      </div>
      <div class="rank-score${best.percent >= 90 ? " rank-score-high" : ""}">${best.percent}<small>鍒?/small></div>
    </div>
  `).join("");

  document.querySelectorAll(".rank-sort-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sort === rankSortMode);
    btn.onclick = () => {
      rankSortMode = btn.dataset.sort;
      renderRanking();
    };
  });
}

async function refreshAdminEmployees() {
  if (!isAdminUser() || !els.adminEmployeeList) return;
  try {
    const data = await cloudRequest("admin-list", {});
    els.adminEmployeeList.innerHTML = (data.employees || []).map((employee) => `
      <div class="admin-employee-row">
        <div><strong>${escapeHtml(employee.name)}</strong><small>${escapeHtml(employee.phone)} 路 ${escapeHtml(employee.role)} 路 ${escapeHtml(employee.status)}</small></div>
        <div class="admin-employee-actions">
          <button class="secondary-btn admin-password-btn" type="button" data-phone="${escapeHtml(employee.phone)}">淇敼瀵嗙爜</button>
          <button class="danger-btn admin-delete-btn" type="button" data-phone="${escapeHtml(employee.phone)}">鍒犻櫎鍛樺伐</button>
        </div>
      </div>
    `).join("") || '<div class="empty">鏆傛棤鍛樺伐璐﹀彿銆?/div>';
  } catch (error) {
    if (els.adminAccountStatus) els.adminAccountStatus.textContent = error.message || "鍛樺伐璐﹀彿璇诲彇澶辫触";
  }
}

async function addAdminEmployee(event) {
  event.preventDefault();
  if (!els.adminEmployeeForm) return;
  els.adminAccountStatus.textContent = "";
  const button = els.adminEmployeeForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await cloudRequest("admin-add", {
      name: els.adminEmployeeName.value.trim(),
      phone: normalizePhone(els.adminEmployeePhone.value),
      role: els.adminEmployeeRole.value,
      password: els.adminEmployeePassword.value,
    });
    els.adminEmployeeForm.reset();
    els.adminAccountStatus.textContent = "鍛樺伐璐﹀彿宸叉坊鍔?;
    await refreshAdminEmployees();
  } catch (error) {
    els.adminAccountStatus.textContent = error.message || "娣诲姞鍛樺伐澶辫触";
  } finally {
    button.disabled = false;
  }
}

async function handleAdminEmployeeAction(event) {
  const button = event.target.closest("[data-phone]");
  if (!button) return;
  const phone = button.dataset.phone;
  if (button.classList.contains("admin-delete-btn")) {
    if (!window.confirm(`纭畾鍒犻櫎鍛樺伐璐﹀彿 ${phone} 鍚楋紵鍒犻櫎鍚庤鍛樺伐闇€瑕侀噸鏂版敞鍐屻€俙)) return;
    try {
      await cloudRequest("admin-delete", { phone });
      els.adminAccountStatus.textContent = "鍛樺伐璐﹀彿宸插垹闄?;
      await refreshAdminEmployees();
    } catch (error) {
      els.adminAccountStatus.textContent = error.message || "鍒犻櫎鍛樺伐澶辫触";
    }
    return;
  }
  const password = window.prompt("璇疯緭鍏ユ柊瀵嗙爜锛堣嚦灏?浣嶏紝鍖呭惈瀛楁瘝鍜屾暟瀛楋級", "");
  if (!password) return;
  try {
    await cloudRequest("admin-password", { phone, password });
    els.adminAccountStatus.textContent = "鍛樺伐瀵嗙爜宸蹭慨鏀?;
  } catch (error) {
    els.adminAccountStatus.textContent = error.message || "淇敼瀵嗙爜澶辫触";
  }
}

function renderAdmin() {
  if (!isAdminUser()) {
    els.adminDataWarning?.classList.add("hidden");
    els.adminMetrics.innerHTML = `<div class="empty">鏃犳潈闄愯闂鐞嗙湅鏉裤€?/div>`;
    els.adminUserTable.innerHTML = "";
    els.adminWeakList.innerHTML = "";
    return;
  }
  const cloud = state.cloudStats;
  const errors = Array.isArray(cloud?.errors) ? cloud.errors : [];
  if (els.adminDataWarning) {
    els.adminDataWarning.classList.toggle("hidden", !errors.length);
    els.adminDataWarning.textContent = errors.length
      ? "閮ㄥ垎椋炰功鏁版嵁璇诲彇澶辫触锛屾湰椤电粺璁″彲鑳戒笉瀹屾暣锛岃鍕跨洿鎺ョ敤浜庤€冩牳缁撹銆?
      : "";
  }
  const users = cloud?.employees?.length
    ? cloud.employees.map((u) => ({ name: u["濮撳悕"], phone: u["鎵嬫満鍙?], role: u["宀椾綅"] }))
    : Object.values(userStore.users);
  const rows = users.map((user) => {
    const records = cloud?.exams?.length
      ? cloud.exams.filter((r) => String(r["鎵嬫満鍙?]) === String(user.phone) && String(r["鑰冩牳绫诲瀷"] || "") === "姝ｅ紡鑰冭瘯").map((r) => ({
          percent: Number(r["鍒嗘暟"] || 0), score: Number(r["绛斿鏁?] || 0), total: Number(r["鎬婚鏁?] || 0),
          wrong: Number(r["绛旈敊鏁?] || 0), duration: Number(r["鐢ㄦ椂绉掓暟"] || 0), bank: r["棰樺簱"], type: r["鑰冩牳绫诲瀷"], finishedAt: r["鎻愪氦鏃堕棿"],
        })).sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime())
      : getUserRecords(user.phone).filter((r) => r.type === "姝ｅ紡鑰冭瘯");
    records.sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime());
    const mistakes = cloud?.mistakes?.length
      ? cloud.mistakes.filter((r) => String(r["鎵嬫満鍙?]) === String(user.phone)).map((r) => ({ knowledgePoint: r["鐭ヨ瘑鐐?], bank: r["棰樺簱"] }))
      : getUserMistakes(user.phone);
    const best = records.reduce((acc, record) => (Number(record.percent) > Number(acc?.percent || -1) ? record : acc), null);
    const latest = records[0];
    return { user, records, mistakes, best, latest };
  });
  const allRecords = rows.flatMap((row) => row.records.map((record) => ({ ...record, user: row.user })));
  const practiceCount = cloud?.exams?.length
    ? cloud.exams.filter((r) => String(r["鑰冩牳绫诲瀷"] || "") === "缁冧範妯″紡").length
    : Object.values(userStore.users).flatMap((user) => getUserRecords(user.phone)).filter((r) => r.type === "缁冧範妯″紡").length;
  const avg = allRecords.length ? Math.round(allRecords.reduce((sum, r) => sum + Number(r.percent || 0), 0) / allRecords.length) : 0;
  const passed = allRecords.filter((r) => Number(r.percent) >= 80).length;
  const passRate = allRecords.length ? Math.round((passed / allRecords.length) * 100) : 0;
  const notExam = rows.filter((row) => !row.records.length).length;

  els.adminMetrics.innerHTML = `
    <div class="summary-card"><span>鍛樺伐鏁?/span><strong>${users.length}</strong><small>${cloud?.employees?.length ? "椋炰功浜戠鏁版嵁" : "鏈満宸茬櫥褰曡处鍙?}</small></div>
    <div class="summary-card"><span>姝ｅ紡鑰冭瘯娆℃暟</span><strong>${allRecords.length}</strong><small>浠呯敤浜庡憳宸ヨ€冩牳</small></div>
    <div class="summary-card"><span>姝ｅ紡鑰冭瘯骞冲潎鍒?/span><strong>${avg}</strong><small>缁冧範鏁版嵁涓嶈鍏?/small></div>
    <div class="summary-card"><span>姝ｅ紡鑰冭瘯閫氳繃鐜?/span><strong>${passRate}%</strong><small>缁冧範娆℃暟 ${practiceCount}锛屾湭鑰?${notExam} 浜?/small></div>
  `;

  els.adminUserTable.innerHTML = rows.length ? `
    <table>
      <thead><tr><th>濮撳悕</th><th>宀椾綅</th><th>娆℃暟</th><th>鏈€浣?/th><th>鏈€杩?/th><th>閿欓</th></tr></thead>
      <tbody>
        ${rows.map(({ user, records, mistakes, best, latest }) => `
          <tr>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.role)}</td>
            <td>${records.length}</td>
            <td>${best ? `${best.percent}鍒哷 : "鏈€?}</td>
            <td>${latest ? `${latest.percent}鍒?路 ${examTimeLabel(latest.finishedAt)}` : "--"}</td>
            <td>${mistakes.length}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : `<div class="empty">鏆傛棤鍛樺伐璁板綍銆?/div>`;

  const allMistakes = rows.flatMap((row) => row.mistakes);
  const weak = allMistakes.reduce((acc, q) => {
    const key = q.knowledgePoint || q.bank || "鍏朵粬";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const weakRows = Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 12);
  els.adminWeakList.innerHTML = weakRows.length ? `
    <table><thead><tr><th>鐭ヨ瘑鐐?/th><th>閿欓鏁?/th></tr></thead><tbody>
      ${weakRows.map(([name, count]) => `<tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>`).join("")}
    </tbody></table>
  ` : `<div class="empty">鏆傛棤閿欓缁熻銆?/div>`;
}

function exportRecords() {
  const rows = state.cloudStats?.exams?.length
    ? state.cloudStats.exams.map((r) => ({
        濮撳悕: r["濮撳悕"], 鎵嬫満鍙? r["鎵嬫満鍙?], 宀椾綅: r["宀椾綅"], 鑰冭瘯鍚嶇О: r["鑰冭瘯鍚嶇О"], 鑰冩牳绫诲瀷: r["鑰冩牳绫诲瀷"], 棰樺簱: r["棰樺簱"], 鍒嗘暟: r["鍒嗘暟"], 绛斿鏁? r["绛斿鏁?], 鎬婚鏁? r["鎬婚鏁?], 绛旈敊鏁? r["绛旈敊鏁?], 鏄惁閫氳繃: r["鏄惁閫氳繃"], 鐢ㄦ椂绉掓暟: r["鐢ㄦ椂绉掓暟"], 鎻愪氦鏃堕棿: r["鎻愪氦鏃堕棿"], 鑰冭瘯浼氳瘽ID: r["鑰冭瘯浼氳瘽ID"],
      }))
    : Object.values(userStore.users).flatMap((user) => getUserRecords(user.phone).map((record) => ({
        濮撳悕: user.name,
        鎵嬫満鍙? user.phone,
        宀椾綅: user.role,
        鑰冩牳绫诲瀷: record.type || "缁冧範妯″紡",
        棰樺簱: record.bank,
        鍒嗘暟: record.percent,
        鑰冭瘯鍚嶇О: "閲戝皧浜у搧鐭ヨ瘑搴撳涔犺€冩牳",
        绛斿鏁? record.score,
        鎬婚鏁? record.total,
        绛旈敊鏁? record.wrong ?? Math.max(0, Number(record.total || 0) - Number(record.score || 0)),
        鏄惁閫氳繃: Number(record.percent) >= 80 ? "鏄? : "鍚?,
        鐢ㄦ椂绉掓暟: record.duration,
        鎻愪氦鏃堕棿: record.finishedAt,
      })));
  downloadText(`閲戝皧鑰冭瘯璁板綍_${todayKey()}.csv`, toCsv(["濮撳悕", "鎵嬫満鍙?, "宀椾綅", "鑰冭瘯鍚嶇О", "鑰冩牳绫诲瀷", "棰樺簱", "鍒嗘暟", "绛斿鏁?, "鎬婚鏁?, "绛旈敊鏁?, "鏄惁閫氳繃", "鐢ㄦ椂绉掓暟", "鎻愪氦鏃堕棿", "鑰冭瘯浼氳瘽ID"], rows));
}

function exportMistakes() {
  const rows = state.cloudStats?.mistakes?.length
    ? state.cloudStats.mistakes.map((q) => ({
        濮撳悕: q["濮撳悕"], 鎵嬫満鍙? q["鎵嬫満鍙?], 宀椾綅: q["宀椾綅"], 棰樺簱: q["棰樺簱"], 鐭ヨ瘑鐐? q["鐭ヨ瘑鐐?], 棰樼洰: q["棰樼洰"], 閿欓€? q["閿欓€?], 姝ｇ‘绛旀: q["姝ｇ‘绛旀"], 瑙ｆ瀽: q["瑙ｆ瀽"], 璁板綍鏃堕棿: q["璁板綍鏃堕棿"],
      }))
    : Object.values(userStore.users).flatMap((user) => getUserMistakes(user.phone).map((q) => ({
        濮撳悕: user.name,
        鎵嬫満鍙? user.phone,
        宀椾綅: user.role,
        棰樺簱: q.bank,
        鐭ヨ瘑鐐? q.knowledgePoint,
        棰樼洰: q.question,
        閿欓€? q.selected,
        姝ｇ‘绛旀: `${q.answer} ${displayAnswerText(q)}`,
        瑙ｆ瀽: displayExplanation(q),
        璁板綍鏃堕棿: q.savedAt,
      })));
  downloadText(`閲戝皧閿欓璁板綍_${todayKey()}.csv`, toCsv(["濮撳悕", "鎵嬫満鍙?, "宀椾綅", "棰樺簱", "鐭ヨ瘑鐐?, "棰樼洰", "閿欓€?, "姝ｇ‘绛旀", "瑙ｆ瀽", "璁板綍鏃堕棿"], rows));
}

function switchView(view) {
  if (view !== "quiz") clearAutoNextTimer();
  if (!state.examFinished && state.examType === "formal" && view !== "quiz") return;
  if (view === "admin" && !isAdminUser()) {
    view = "dashboard";
  }
  state.currentView = view;
  els.navTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  Object.entries(els.views).forEach(([name, element]) => element.classList.toggle("active", name === view));
  els.pageTitle.textContent = pageTitles[view];
  if (view === "quiz" && !state.quiz.length) {
    els.quizSetup.classList.remove("hidden");
    els.quizRunner.classList.add("hidden");
    els.quizResult.classList.add("hidden");
  }
  if (view === "ranking") renderRanking();
  if (view === "mistakes") renderMistakes();
  if (view === "admin") {
    loadCloudStats().then(renderAdmin);
    renderAdmin();
  }
}

function renderAll() {
  renderStats();
  renderDashboard();
  renderLearnFilter();
  renderLearnList();
  renderMistakes();
  renderAdmin();
}

function renderUser() {
  applyAdminAccess();
  if (!state.currentUser) {
    els.userName.textContent = "鏈櫥褰?;
    els.userMeta.textContent = "-";
    return;
  }
  els.userName.textContent = state.currentUser.name;
  els.userMeta.textContent = `${state.currentUser.role} 路 ${state.currentUser.phone}`;
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function loadCurrentUser() {
  if (!localStorage.getItem("jz_auth_token")) {
    state.currentUser = null;
    return;
  }
  const phone = userStore.currentPhone;
  const users = userStore.users;
  state.currentUser = phone && users[phone] ? users[phone] : null;
}

function showAuth(visible) {
  els.authView.classList.toggle("hidden", !visible);
  document.body.classList.toggle("auth-locked", visible);
}

function switchAuthMode(mode) {
  const isLogin = mode === "login";
  const isRegister = mode === "register";
  els.loginForm.classList.toggle("hidden", !isLogin);
  els.registerForm.classList.toggle("hidden", !isRegister);
  els.resetForm.classList.toggle("hidden", mode !== "reset");
  els.showLoginTab.classList.toggle("active", isLogin);
  els.showRegisterTab.classList.toggle("active", isRegister);
  els.loginError.textContent = "";
  els.registerError.textContent = "";
  els.resetError.textContent = "";
}

function saveAuthenticatedUser(data) {
  localStorage.setItem("jz_auth_token", data.token);
  const user = {
    id: data.user.id,
    name: data.user.name,
    phone: data.user.phone,
    role: data.user.role,
    isAdmin: data.user.isAdmin === true,
    updatedAt: new Date().toISOString(),
  };
  const users = userStore.users;
  users[user.phone] = user;
  userStore.users = users;
  userStore.currentPhone = user.phone;
  state.currentUser = user;
  reconcileStoredQuestions();
  applyAdminAccess();
}

const passwordError = (password) => {
  if (password.length < 8) return "瀵嗙爜涓嶈兘灏戜簬8浣?;
  if (!/[A-Za-z]/.test(password)) return "瀵嗙爜蹇呴』鍖呭惈瀛楁瘝";
  if (!/\d/.test(password)) return "瀵嗙爜蹇呴』鍖呭惈鏁板瓧";
  return "";
};

async function loginEmployee(event) {
  event.preventDefault();
  const account = els.loginAccount.value.trim();
  const password = els.loginPassword.value;
  els.loginError.textContent = "";
  if (!account || !password) {
    els.loginError.textContent = "璇疯緭鍏ュ鍚嶆垨鎵嬫満鍙峰拰瀵嗙爜";
    return;
  }
  const button = els.loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "姝ｅ湪鐧诲綍...";
  try {
    const data = await cloudRequest("login", { account, password, clientId: getClientId() });
    if (!data.token || !data.user) throw new Error("璐﹀彿鎴栧瘑鐮侀敊璇?);
    saveAuthenticatedUser(data);
    els.loginPassword.value = "";
    showAuth(false);
    renderAll();
  } catch (error) {
    els.loginError.textContent = error.message || "璐﹀彿鎴栧瘑鐮侀敊璇?;
  } finally {
    button.disabled = false;
    button.textContent = "鐧诲綍";
  }
}

async function registerEmployee(event) {
  event.preventDefault();
  const name = els.registerName.value.trim();
  const phone = normalizePhone(els.registerPhone.value);
  const role = els.registerRole.value;
  const password = els.registerPassword.value;
  const confirm = els.registerPasswordConfirm.value;
  const registerCode = els.registerCode.value.trim();
  els.registerError.textContent = "";
  if (!name) return void (els.registerError.textContent = "璇峰～鍐欑湡瀹炲鍚?);
  if (!/^1\d{10}$/.test(phone)) return void (els.registerError.textContent = "璇疯緭鍏ユ纭殑11浣嶆墜鏈哄彿");
  if (!role) return void (els.registerError.textContent = "璇烽€夋嫨宀椾綅");
  const error = passwordError(password);
  if (error) return void (els.registerError.textContent = error);
  if (password !== confirm) return void (els.registerError.textContent = "涓ゆ杈撳叆鐨勫瘑鐮佷笉涓€鑷?);
  if (!registerCode) return void (els.registerError.textContent = "璇疯緭鍏ュ叕鍙告敞鍐屽彛浠?);
  const button = els.registerForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "姝ｅ湪娉ㄥ唽...";
  try {
    const data = await cloudRequest("register", { name, phone, role, password, registerCode, clientId: getClientId() });
    if (!data.token || !data.user) throw new Error("娉ㄥ唽澶辫触");
    saveAuthenticatedUser(data);
    els.registerForm.reset();
    showAuth(false);
    renderAll();
  } catch (requestError) {
    const message = requestError.message || "娉ㄥ唽澶辫触锛岃绋嶅悗閲嶈瘯";
    els.registerError.textContent = message.includes("宸茬粡娉ㄥ唽")
      ? `${message}锛岃鍒囨崲鍒扳€滃憳宸ョ櫥褰曗€漙
      : message;
  } finally {
    button.disabled = false;
    button.textContent = "娉ㄥ唽骞惰繘鍏ュ涔?;
  }
}

async function resetPassword(event) {
  event.preventDefault();
  const name = els.resetName.value.trim();
  const phone = normalizePhone(els.resetPhone.value);
  const role = els.resetRole.value;
  const password = els.resetPassword.value;
  const confirm = els.resetPasswordConfirm.value;
  const registerCode = els.resetCode.value.trim();
  els.resetError.textContent = "";
  if (!name) return void (els.resetError.textContent = "璇疯緭鍏ョ湡瀹炲鍚?);
  if (!/^1\d{10}$/.test(phone)) return void (els.resetError.textContent = "璇疯緭鍏ユ纭殑11浣嶆墜鏈哄彿");
  if (!role) return void (els.resetError.textContent = "璇烽€夋嫨宀椾綅");
  const error = passwordError(password);
  if (error) return void (els.resetError.textContent = error);
  if (password !== confirm) return void (els.resetError.textContent = "涓ゆ杈撳叆鐨勫瘑鐮佷笉涓€鑷?);
  if (!registerCode) return void (els.resetError.textContent = "璇疯緭鍏ュ叕鍙告敞鍐屽彛浠?);
  const button = els.resetForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "姝ｅ湪閲嶇疆...";
  try {
    const data = await cloudRequest("reset", { name, phone, role, password, registerCode, clientId: getClientId() });
    if (!data.token || !data.user) throw new Error("瀵嗙爜閲嶇疆澶辫触");
    saveAuthenticatedUser(data);
    els.resetForm.reset();
    showAuth(false);
    renderAll();
  } catch (requestError) {
    els.resetError.textContent = requestError.message || "瀵嗙爜閲嶇疆澶辫触锛岃绋嶅悗閲嶈瘯";
  } finally {
    button.disabled = false;
    button.textContent = "閲嶇疆瀵嗙爜骞剁櫥褰?;
  }
}

function logout() {
  clearAutoNextTimer();
  stopTimer();
  state.examFinished = true;
  state.examSubmitting = false;
  setExamLocked(false);
  userStore.currentPhone = "";
  localStorage.removeItem("jz_auth_token");
  state.currentUser = null;
  applyAdminAccess();
  state.quiz = [];
  state.quizIndex = 0;
  state.score = 0;
  els.loginAccount.value = "";
  els.loginPassword.value = "";
  els.registerForm.reset();
  els.resetForm.reset();
  showAuth(true);
  renderAll();
}

function bindEvents() {
  els.navTabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  els.bankSelect.addEventListener("change", () => {
    clearAutoNextTimer();
    state.currentBank = els.bankSelect.value;
    state.learnPage = 1;
    renderAll();
  });
  els.searchInput.addEventListener("input", () => {
    state.learnPage = 1;
    renderAll();
  });
  els.startQuizBtn.addEventListener("click", startQuiz);
  els.retryMistakesBtn.addEventListener("click", startMistakeQuiz);
  els.exportRecordsBtn.addEventListener("click", exportRecords);
  els.exportMistakesBtn.addEventListener("click", exportMistakes);
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      clearAutoNextTimer();
      state.quizMode = tab.dataset.mode;
      document.querySelectorAll(".mode-tab").forEach((t) =>
        t.classList.toggle("active", t === tab)
      );
      els.modeRandom.classList.toggle("hidden", state.quizMode !== "random");
      els.modeProduct.classList.toggle("hidden", state.quizMode !== "product");
      els.modeRole.classList.toggle("hidden", state.quizMode !== "role");
    });
  });
  els.clearMistakesBtn.addEventListener("click", () => {
    if (!window.confirm("纭畾娓呯┖褰撳墠璐﹀彿鐨勫叏閮ㄩ敊棰樺悧锛熸鎿嶄綔涓嶈兘鎾ら攢銆?)) return;
    storage.mistakes = [];
    renderAll();
  });
  els.resetBtn.addEventListener("click", () => {
    if (!window.confirm("纭畾娓呯┖褰撳墠璐﹀彿鐨勬纭巼銆侀敊棰樺拰鍏ㄩ儴鑰冭瘯璁板綍鍚楋紵姝ゆ搷浣滀笉鑳芥挙閿€銆?)) return;
    storage.attempts = 0;
    storage.correct = 0;
    storage.mistakes = [];
    storage.examRecords = [];
    localStorage.removeItem("jz_sync_queue");
    renderAll();
  });
  els.showLoginTab.addEventListener("click", () => switchAuthMode("login"));
  els.showRegisterTab.addEventListener("click", () => switchAuthMode("register"));
  els.showResetForm.addEventListener("click", () => switchAuthMode("reset"));
  els.backToLogin.addEventListener("click", () => switchAuthMode("login"));
  els.loginForm.addEventListener("submit", loginEmployee);
  els.registerForm.addEventListener("submit", registerEmployee);
  els.resetForm.addEventListener("submit", resetPassword);
  els.retryExamSubmitBtn?.addEventListener("click", finishQuiz);
  els.adminEmployeeForm?.addEventListener("submit", addAdminEmployee);
  els.adminEmployeeList?.addEventListener("click", handleAdminEmployeeAction);
  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "鏄剧ず" : "闅愯棌";
    });
  });
  els.logoutBtn.addEventListener("click", logout);
  els.mobileSidebarToggle?.addEventListener("click", () => {
    const open = !els.sidebarTools.classList.contains("mobile-open");
    els.sidebarTools.classList.toggle("mobile-open", open);
    els.mobileSidebarToggle.setAttribute("aria-expanded", String(open));
  });
  window.addEventListener("beforeunload", (event) => {
    if (!state.examFinished && state.examType === "formal") {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}

async function init() {
  try {
    await loadQuestions();
    loadCurrentUser();
    if (state.currentUser) {
      try {
        const session = await cloudRequest("session", {});
        if (session?.token && session?.user) saveAuthenticatedUser(session);
      } catch {
        localStorage.removeItem("jz_auth_token");
        state.currentUser = null;
      }
    }
    reconcileStoredQuestions();
    renderBankSelect();
    renderQuizSetup();
    initSlogan();
    bindEvents();
    applyAdminAccess();
    await flushSyncQueue();
    await loadCloudStats();
    renderAll();
    showAuth(!state.currentUser);
  } catch (error) {
    document.body.innerHTML = `<div class="empty">棰樺簱鍔犺浇澶辫触锛?{escapeHtml(error.message)}</div>`;
    throw error;
  }
}

init();


