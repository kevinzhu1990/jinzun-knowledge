const BUILD_VERSION = "20260711-round5";
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
    …8396 tokens truncated… els.adminWeakList.innerHTML = "";
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


