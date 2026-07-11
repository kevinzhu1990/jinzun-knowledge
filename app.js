const BUILD_VERSION = "20260711-round4";
const PRACTICE_AUTO_NEXT_DELAY_MS = 1200;
const FORMAL_AUTO_NEXT_DELAY_MS = 350;
let autoNextTimer = null;
const productUrl = `./outputs/product_quiz/金尊产品知识库题库.json?v=${BUILD_VERSION}`;
const roleUrl = `./outputs/role_quiz/岗位学习考核题库.json?v=${BUILD_VERSION}`;
const API_BASE = "https://jinzun-knowledge.vercel.app";
const API_BASES = [API_BASE];
const CLOUD_ENABLED = true;
const CLOUD_TIMEOUT_MS = 8000;
const state = {
  allQuestions: [],
  filtered: [],
  currentBank: "全部题库",
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
  "以专业知识筑牢阵地根基，用每次练习解锁成长勋章。",
  "用知识拉满岗位战斗力，在这里挑战关乎属于你的高光时刻！",
  "每一次精准的练习与沉淀，都在见证你更出色的专业蜕变。",
  "聚集团队点滴专业智慧，赋能每一个物资的起点，让我们在并肩前行中共同蜕变。",
  "解锁岗位核心技能，与优秀的前辈并肩前行，在这里开启你的职场蜕变之旅。",
  "知识共享，能力共进。凝聚每一个人的点滴进步，共创属于我们的精彩未来。",
  "这里是我们的专业加油站，用知识无处不赋能，在并肩挑战中向上蜕变。",
];

let sloganIndex = 0;
let sloganTimer = null;

function initSlogan() {
  const el = document.querySelector("#heroSlogan");
  const dots = document.querySelector("#sloganDots");
  if (!el || !dots) return;

  dots.innerHTML = slogans.map((_, i) =>
    `<button class="slogan-dot${i === 0 ? " active" : ""}" data-i="${i}" aria-label="查看第 ${i + 1} 条学习提示"></button>`
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
  dashboard: "学习总览",
  ranking: "排行榜",
  learn: "学习题库",
  quiz: "学习考核",
  mistakes: "错题复习",
  admin: "管理看板",
};

const normalize = (value) => String(value ?? "").toLowerCase().trim();

const shelfLifeDays = (value) => {
  const text = String(value ?? "").trim();
  const digits = text.match(/\d+/)?.[0];
  if (!digits) return null;
  const number = Number(digits);
  if (text.includes("天")) return number;
  return text.includes("月") ? number * 30 : number;
};

const isEquivalentAnswer = (question, selectedLetter) => {
  if (selectedLetter === question.answer) return true;
  if (question.knowledgePoint !== "保质期") return false;
  const selected = optionEntries(question).find(([letter]) => letter === selectedLetter)?.[1];
  const selectedDays = shelfLifeDays(selected);
  const answerDays = shelfLifeDays(question.answerText);
  return selectedDays !== null && answerDays !== null && selectedDays === answerDays;
};

// Strip product code from option text for quiz display.
// Only applied to 产品名称 questions where the code in the option text gives away the answer.
const stripCodeFromOption = (text, question) => {
  if (question.knowledgePoint !== "产品名称" || !text) return text;
  const isCorrectAnswer = text === question.answerText;
  const answerStartsWithCurrentCode = normalize(text).startsWith(normalize(question.code));
  if (isCorrectAnswer && !answerStartsWithCurrentCode) return text;
  return text
    .replace(/^\d{4}[A-Za-z]?\s*/, "") // "2232A 金尊..." / "2421澳门八星..." → "金尊..." / "澳门八星..."
    .replace(/【[^】]+】/g, "")          // "礼盒【0206】2盒装" → "礼盒2盒装"
    .trim();
};

const displayAnswerText = (question) => stripCodeFromOption(question.answerText, question);
const displayExplanation = (question) => {
  if (question.knowledgePoint !== "产品名称") return question.explanation;
  const name = displayAnswerText(question);
  return `${question.code} 对应的产品名称是：${name}。`;
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

async function cloudRequest(action, payload) {
  if (!CLOUD_ENABLED) return { ok: true, skipped: true };
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
      if (!res.ok) throw new Error(data.error || `云端同步失败：${res.status}`);
      if (!data.ok) throw new Error(data.error || "云端同步失败");
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("云端同步失败");
}

async function syncLater(action, payload) {
  if (!CLOUD_ENABLED) return { ok: true, skipped: true };
  try {
    const data = await cloudRequest(action, payload);
    if (action === "exam" && !data.record_id) throw new Error("服务器未返回考试记录ID");
    if (action === "mistakes" && payload.items?.length && (!Array.isArray(data.record_ids) || data.record_ids.length < payload.items.length)) {
      throw new Error("服务器未返回完整错题记录ID");
    }
    if (action === "exam") setSyncStatus("正式考试已同步到飞书", "success");
    if (action === "mistakes" && payload.items?.length) setSyncStatus("错题已批量同步到飞书", "success");
    return data;
  } catch (error) {
    const queue = safeJsonArray("jz_sync_queue");
    queue.push({ action, payload, createdAt: new Date().toISOString(), error: error.message });
    localStorage.setItem("jz_sync_queue", JSON.stringify(queue.slice(-300)));
    setSyncStatus(`云端同步失败，已暂存本机：${error.message}`, "error");
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
    throw new Error(`题库文件请求失败（产品 ${productRes.status} / 岗位 ${roleRes.status}）`);
  }
  const [productQuestions, roleQuestions] = await Promise.all([productRes.json(), roleRes.json()]);
  state.allQuestions = [...productQuestions, ...roleQuestions].map((question) => ({
    ...question,
    role: question.role || question.category || "",
    module: question.module || question.productLine || "",
    source: question.source || "产品知识库",
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
  return ["全部题库", ...new Set(state.allQuestions.map((question) => question.bank))];
}

function bankQuestions() {
  const keyword = normalize(els.searchInput.value);
  return state.allQuestions.filter((question) => {
    const bankMatch = state.currentBank === "全部题库" || question.bank === state.currentBank;
    if (!bankMatch) return false;
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
      <span>${todayRecords.length ? "✓" : "1"}</span>
      <div><strong>完成今日考核</strong><small>${todayRecords.length ? `今日已完成 ${todayRecords.length} 次` : "建议先做 30-50 题正式考核"}</small></div>
    </div>
    <div class="task-card ${mistakes.length === 0 ? "done" : ""}">
      <span>${mistakes.length === 0 ? "✓" : "2"}</span>
      <div><strong>复习错题</strong><small>${mistakes.length ? `还有 ${mistakes.length} 道错题待重练` : "当前没有待复习错题"}</small></div>
    </div>
    <div class="task-card ${best >= 90 ? "done" : ""}">
      <span>${best >= 90 ? "✓" : "3"}</span>
      <div><strong>冲刺优秀</strong><small>${best >= 90 ? `最佳成绩 ${best} 分` : `距离优秀还差 ${Math.max(0, 90 - best)} 分`}</small></div>
    </div>
  `;

  const total = state.allQuestions.length;
  const productTotal = state.allQuestions.filter((q) => PRODUCT_BANKS.includes(q.bank)).length;
  const roleTotal = total - productTotal;
  els.summaryCards.innerHTML = `
    <div class="summary-card"><span>题库总量</span><strong>${total}</strong><small>覆盖产品与岗位</small></div>
    <div class="summary-card"><span>产品资料题</span><strong>${productTotal}</strong><small>产品 / 场景 / 品牌 / 商家编码</small></div>
    <div class="summary-card"><span>岗位题</span><strong>${roleTotal}</strong><small>运营 / 客服 / 美工等</small></div>
    <div class="summary-card"><span>最近成绩</span><strong>${last ? `${last.percent}分` : "--"}</strong><small>${last ? examTimeLabel(last.finishedAt) : "暂无考试记录"}</small></div>
  `;

  const grouped = banks()
    .filter((bank) => bank !== "全部题库")
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
          <p>${item.imageCount ? `${item.imageCount} 道图片题` : "岗位与知识点练习"}</p>
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
  return `<img class="thumb" src="${imagePath(question.questionImage)}" alt="题目图片" loading="lazy" />`;
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
              <img src="${imagePath(img)}" alt="选项${letter}图片" loading="lazy" ${imageWidth ? `style="max-width:${imageWidth}px"` : ""} />
              <figcaption>${letter} ${escapeHtml(text)}</figcaption>
            </figure>
          `
        )
        .join("")}
    </div>
  `;
}

function renderLearnFilter() {
  const allBanks = banks().filter((b) => b !== "全部题库");
  const productBankSet = new Set(PRODUCT_BANKS);
  const productGroup = allBanks.filter((b) => productBankSet.has(b));
  const roleGroup = allBanks.filter((b) => !productBankSet.has(b));

  const makeBtn = (label, value) => {
    const active = state.currentBank === value;
    return `<button class="learn-filter-btn${active ? " active" : ""}" data-bank="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
  };

  els.learnFilter.innerHTML = `
    ${makeBtn("全部", "全部题库")}
    <span class="filter-sep"></span>
    ${productGroup.map((b) => makeBtn(b, b)).join("")}
    <span class="filter-sep"></span>
    ${roleGroup.map((b) => makeBtn(b, b)).join("")}
  `;

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
  els.learnCount.textContent = `${state.filtered.length} 道题`;
  if (!items.length) {
    els.learnList.innerHTML = `<div class="empty">没有找到匹配的题目。</div>`;
    els.learnPagination.innerHTML = "";
    return;
  }
  els.learnList.innerHTML = items
    .map(
      (question) => `
        <article class="learn-item">
          <div>
            <div class="meta">
              <span>${escapeHtml(question.bank)}</span>
              <span>${escapeHtml(question.type)}</span>
              <span>${escapeHtml(question.difficulty)}</span>
              <span>${escapeHtml(question.knowledgePoint)}</span>
            </div>
            <h4>${escapeHtml(question.question)}</h4>
            <p class="answer-line">答案：${escapeHtml(question.answer)}｜${escapeHtml(displayAnswerText(question))}</p>
            <p class="explain">${escapeHtml(displayExplanation(question))}</p>
            ${renderOptionImages(question)}
          </div>
          ${renderQuestionImages(question)}
        </article>
      `
    )
    .join("");
  els.learnPagination.innerHTML = `
    <button class="secondary-btn" data-page="prev" ${state.learnPage <= 1 ? "disabled" : ""}>上一页</button>
    <span>第 ${state.learnPage} / ${totalPages} 页</span>
    <button class="secondary-btn" data-page="next" ${state.learnPage >= totalPages ? "disabled" : ""}>下一页</button>
  `;
  els.learnPagination.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.learnPage += button.dataset.page === "next" ? 1 : -1;
      renderLearnList();
      document.querySelector("#learnView")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

const PRODUCT_BANKS = ["月饼题库", "日常年货题库", "业务场景题库", "品牌知识题库", "商家编码题库"];
const CORE_EXAM_BANKS = ["月饼题库", "日常年货题库", "业务场景题库"];

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
  // 50题=20分钟，按比例给时间：每题24秒；10题=4分钟。
  return Math.max(60, Math.round(size * 24));
}

function updateTimerText() {
  const remaining = Math.max(0, timerLimitSeconds - timerSeconds);
  els.quizTimer.textContent = `⏳ 剩余 ${formatTime(remaining)}`;
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
    els.quizWrongCount.textContent = "正式模式不显示对错";
    els.quizWrongCount.classList.remove("has-wrong");
    return;
  }
  els.quizWrongCount.textContent = `✗ 错误 ${state.quizWrong} 题`;
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
    (bank) => bank !== "全部题库" && !PRODUCT_BANKS.includes(bank)
  );

  els.productBankSelect.innerHTML = productBanks
    .map((bank) => {
      const count = state.allQuestions.filter((q) => q.bank === bank).length;
      return `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}（${count} 题）</option>`;
    })
    .join("");

  els.roleBankSelect.innerHTML = roleBanks
    .map((bank) => {
      const count = state.allQuestions.filter((q) => q.bank === bank).length;
      return `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}（${count} 题）</option>`;
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
        throw new Error("服务器未返回有效考试题目");
      }
      state.examId = data.examId;
      state.examSessionToken = data.sessionToken;
      state.submissionId = crypto.randomUUID();
      state.quiz = data.questions;
      state.examLabelOverride = data.bank || bank || "综合产品题库";
    } catch (error) {
      els.quizSetupStatus.textContent = `正式考试启动失败：${error.message}`;
      return;
    }
  } else {
    // 练习模式也只从考试控件选择的题库取题，不受搜索框和左侧学习筛选影响。
    if (state.quizMode === "product") {
      const bank = els.productBankSelect.value;
      pool = state.allQuestions.filter((q) => q.bank === bank);
      state.examLabelOverride = bank;
    } else if (state.quizMode === "role") {
      const bank = els.roleBankSelect.value;
      pool = state.allQuestions.filter((q) => q.bank === bank && (q.role === state.currentUser?.role || q.role === "全员"));
      state.examLabelOverride = bank;
    } else {
      pool = state.allQuestions.filter((q) => CORE_EXAM_BANKS.includes(q.bank));
      state.examLabelOverride = "综合产品题库";
    }
    state.quiz = shuffle(pool).slice(0, Math.min(size, pool.length));
  }
  if (!state.quiz.length) {
    els.quizSetupStatus.textContent = "当前筛选没有可用于考核的题目，请调整搜索或题库筛选。";
    return;
  }
  els.quizSetupStatus.textContent = state.quiz.length < size
    ? `当前题库只有 ${state.quiz.length} 题，本次将全部使用。`
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
  els.quizStep.textContent = `第 ${state.quizIndex + 1} 题`;
  els.quizScore.textContent = state.examType === "formal"
    ? `已答 ${state.answeredCount} 题`
    : `答对 ${state.score} 题`;
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
        <img src="${imagePath(question.questionImage)}" alt="题目图片" />
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
                  <img src="${imagePath(img)}" alt="选项${letter}图片" />
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
    ? `已答 ${state.answeredCount} 题`
    : `答对 ${state.score} 题`;
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
    <strong>已作答</strong>
    <p class="explain">${isLast ? "正在提交试卷…" : "即将进入下一题…"}</p>
  ` : `
    <strong>${correct ? "回答正确" : "回答错误"}</strong>
    <p class="explain">正确答案：${escapeHtml(question.answer)}｜${escapeHtml(displayAnswerText(question))}</p>
    <p class="explain">${escapeHtml(displayExplanation(question))}</p>
    <p class="auto-next-hint">${isLast ? "即将显示成绩…" : "即将进入下一题…"}</p>
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
  if (!data.record_id) throw new Error("服务器未返回正式考试记录ID");
  state.score = Number(data.correct || 0);
  state.quizWrong = Number(data.wrong || 0);
  state.serverRecordId = data.record_id;
  state.serverDuration = Number.isFinite(Number(data.duration)) ? Number(data.duration) : null;
  state.wrongDetails = Array.isArray(data.wrong_details) ? data.wrong_details : [];
  state.wrongDetails.forEach((item) => saveMistake(item, item.selected || "未作答"));
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
        els.examSubmitStatus.textContent = `成绩提交失败：${error.message}`;
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
        state.wrongDetails.push({ ...question, selected: "未作答", savedAt: new Date().toISOString() });
        saveMistake(question, "未作答");
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
  const timeStr = formatTime(state.serverDuration ?? timerSeconds);
  saveExamRecord(percent);
  els.quizRunner.classList.add("hidden");
  els.quizResult.classList.remove("hidden");
  const wrongReview = state.wrongDetails.length ? `
    <div class="wrong-review">
      <h4>本次错题解析</h4>
      ${state.wrongDetails.slice(0, 8).map((q, i) => `
        <div class="wrong-review-item">
          <strong>${i + 1}. ${escapeHtml(q.question)}</strong>
          <p>错选：${escapeHtml(q.selected)}｜正确：${escapeHtml(q.answer)} ${escapeHtml(displayAnswerText(q))}</p>
          <small>${escapeHtml(displayExplanation(q))}</small>
        </div>
      `).join("")}
      ${state.wrongDetails.length > 8 ? `<p class="explain">更多错题已进入错题本。</p>` : ""}
    </div>
  ` : "";
  els.quizResult.innerHTML = `
    <p class="eyebrow">Result · ${escapeHtml(examLabel())} · ${state.examType === "formal" ? "正式考试" : "练习模式"}</p>
    <h3>${percent} 分</h3>
    ${timerExpired ? `<p class="explain result-wrong">时间到，已自动交卷。</p>` : ""}
    <div class="result-meta">
      <span>✓ 答对 ${state.score} 题</span>
      <span class="${state.quizWrong > 0 ? "result-wrong" : ""}">✗ 答错 ${state.quizWrong} 题</span>
      <span>⏱ 用时 ${timeStr}</span>
      <span>${percent >= 80 ? "已通过" : "未通过"}</span>
    </div>
    <p class="explain">${percent >= 90 ? "表现很稳，可以进入下一组题库。" : percent >= 80 ? "已达到合格线，建议继续重练错题冲刺优秀。" : "建议先复习错题，再重新考一次。"}</p>
    ${wrongReview}
    <div class="result-actions">
      <button class="primary-btn" id="retryQuizBtn">重新考核</button>
      <button class="secondary-btn" id="reviewMistakesBtn">查看错题</button>
    </div>
  `;
  document.querySelector("#retryQuizBtn").addEventListener("click", startQuiz);
  document.querySelector("#reviewMistakesBtn").addEventListener("click", () => switchView("mistakes"));
  renderStats();
}

function examLabel() {
  if (state.examLabelOverride) return state.examLabelOverride;
  if (state.quizMode === "product") return els.productBankSelect.value;
  if (state.quizMode === "role") return els.roleBankSelect.value;
  return "综合产品题库";
}

function saveExamRecord(percent) {
  const records = storage.examRecords;
  records.unshift({
    user: state.currentUser,
    bank: examLabel(),
    type: state.examType === "formal" ? "正式考试" : "练习模式",
    score: state.score,
    total: state.quiz.length,
    wrong: state.quizWrong,
    percent,
    passed: percent >= 80,
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
    els.mistakeList.innerHTML = `<div class="empty">现在还没有错题记录。</div>`;
    return;
  }
  const grouped = mistakes.reduce((acc, q) => {
    const key = q.knowledgePoint || "其他";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topTags = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, count]) => `<span class="pill">${escapeHtml(name)} ${count}</span>`).join("");
  els.mistakeList.innerHTML = `
    <div class="mistake-summary">
      <strong>待复习 ${mistakes.length} 道</strong>
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
                <span>错选：${escapeHtml(question.selected)}</span>
              </div>
              <h4>${escapeHtml(question.question)}</h4>
              <p class="answer-line">正确答案：${escapeHtml(question.answer)}｜${escapeHtml(displayAnswerText(question))}</p>
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
  state.examLabelOverride = "错题重练";
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
    listEl.innerHTML = `<div class="empty">还没有考核记录，完成一次考核后即可上榜。</div>`;
    return;
  }

  const medalClass = (i) => (i === 0 ? " rank-gold" : i === 1 ? " rank-silver" : i === 2 ? " rank-bronze" : "");
  const medalLabel = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1));

  listEl.innerHTML = rows.map(({ user, best, totalExams }, i) => `
    <div class="rank-row${i < 3 ? " rank-top" : ""}">
      <div class="rank-num${medalClass(i)}">${medalLabel(i)}</div>
      <div class="rank-info">
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.role)} · 考核 ${totalExams} 次</span>
      </div>
      <div class="rank-mid">
        <span class="rank-bank">${escapeHtml(best.bank || "")}</span>
        <span class="rank-detail-time">${best.duration != null ? "⏱ " + formatTime(best.duration) : ""}</span>
      </div>
      <div class="rank-score${best.percent >= 90 ? " rank-score-high" : ""}">${best.percent}<small>分</small></div>
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

function renderAdmin() {
  if (!isAdminUser()) {
    els.adminDataWarning?.classList.add("hidden");
    els.adminMetrics.innerHTML = `<div class="empty">无权限访问管理看板。</div>`;
    els.adminUserTable.innerHTML = "";
    els.adminWeakList.innerHTML = "";
    return;
  }
  const cloud = state.cloudStats;
  const errors = Array.isArray(cloud?.errors) ? cloud.errors : [];
  if (els.adminDataWarning) {
    els.adminDataWarning.classList.toggle("hidden", !errors.length);
    els.adminDataWarning.textContent = errors.length
      ? "部分飞书数据读取失败，本页统计可能不完整，请勿直接用于考核结论。"
      : "";
  }
  const users = cloud?.employees?.length
    ? cloud.employees.map((u) => ({ name: u["姓名"], phone: u["手机号"], role: u["岗位"] }))
    : Object.values(userStore.users);
  const rows = users.map((user) => {
    const records = cloud?.exams?.length
      ? cloud.exams.filter((r) => String(r["手机号"]) === String(user.phone) && String(r["考核类型"] || "") === "正式考试").map((r) => ({
          percent: Number(r["分数"] || 0), score: Number(r["答对数"] || 0), total: Number(r["总题数"] || 0),
          wrong: Number(r["答错数"] || 0), duration: Number(r["用时秒数"] || 0), bank: r["题库"], type: r["考核类型"], finishedAt: r["提交时间"],
        })).sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime())
      : getUserRecords(user.phone).filter((r) => r.type === "正式考试");
    records.sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime());
    const mistakes = cloud?.mistakes?.length
      ? cloud.mistakes.filter((r) => String(r["手机号"]) === String(user.phone)).map((r) => ({ knowledgePoint: r["知识点"], bank: r["题库"] }))
      : getUserMistakes(user.phone);
    const best = records.reduce((acc, record) => (Number(record.percent) > Number(acc?.percent || -1) ? record : acc), null);
    const latest = records[0];
    return { user, records, mistakes, best, latest };
  });
  const allRecords = rows.flatMap((row) => row.records.map((record) => ({ ...record, user: row.user })));
  const practiceCount = cloud?.exams?.length
    ? cloud.exams.filter((r) => String(r["考核类型"] || "") === "练习模式").length
    : Object.values(userStore.users).flatMap((user) => getUserRecords(user.phone)).filter((r) => r.type === "练习模式").length;
  const avg = allRecords.length ? Math.round(allRecords.reduce((sum, r) => sum + Number(r.percent || 0), 0) / allRecords.length) : 0;
  const passed = allRecords.filter((r) => Number(r.percent) >= 80).length;
  const passRate = allRecords.length ? Math.round((passed / allRecords.length) * 100) : 0;
  const notExam = rows.filter((row) => !row.records.length).length;

  els.adminMetrics.innerHTML = `
    <div class="summary-card"><span>员工数</span><strong>${users.length}</strong><small>${cloud?.employees?.length ? "飞书云端数据" : "本机已登录账号"}</small></div>
    <div class="summary-card"><span>正式考试次数</span><strong>${allRecords.length}</strong><small>仅用于员工考核</small></div>
    <div class="summary-card"><span>正式考试平均分</span><strong>${avg}</strong><small>练习数据不计入</small></div>
    <div class="summary-card"><span>正式考试通过率</span><strong>${passRate}%</strong><small>练习次数 ${practiceCount}，未考 ${notExam} 人</small></div>
  `;

  els.adminUserTable.innerHTML = rows.length ? `
    <table>
      <thead><tr><th>姓名</th><th>岗位</th><th>次数</th><th>最佳</th><th>最近</th><th>错题</th></tr></thead>
      <tbody>
        ${rows.map(({ user, records, mistakes, best, latest }) => `
          <tr>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.role)}</td>
            <td>${records.length}</td>
            <td>${best ? `${best.percent}分` : "未考"}</td>
            <td>${latest ? `${latest.percent}分 · ${examTimeLabel(latest.finishedAt)}` : "--"}</td>
            <td>${mistakes.length}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : `<div class="empty">暂无员工记录。</div>`;

  const allMistakes = rows.flatMap((row) => row.mistakes);
  const weak = allMistakes.reduce((acc, q) => {
    const key = q.knowledgePoint || q.bank || "其他";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const weakRows = Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 12);
  els.adminWeakList.innerHTML = weakRows.length ? `
    <table><thead><tr><th>知识点</th><th>错题数</th></tr></thead><tbody>
      ${weakRows.map(([name, count]) => `<tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>`).join("")}
    </tbody></table>
  ` : `<div class="empty">暂无错题统计。</div>`;
}

function exportRecords() {
  const rows = state.cloudStats?.exams?.length
    ? state.cloudStats.exams.map((r) => ({
        姓名: r["姓名"], 手机号: r["手机号"], 岗位: r["岗位"], 考试名称: r["考试名称"], 考核类型: r["考核类型"], 题库: r["题库"], 分数: r["分数"], 答对数: r["答对数"], 总题数: r["总题数"], 答错数: r["答错数"], 是否通过: r["是否通过"], 用时秒数: r["用时秒数"], 提交时间: r["提交时间"], 考试会话ID: r["考试会话ID"],
      }))
    : Object.values(userStore.users).flatMap((user) => getUserRecords(user.phone).map((record) => ({
        姓名: user.name,
        手机号: user.phone,
        岗位: user.role,
        考核类型: record.type || "练习模式",
        题库: record.bank,
        分数: record.percent,
        考试名称: "金尊产品知识库学习考核",
        答对数: record.score,
        总题数: record.total,
        答错数: record.wrong ?? Math.max(0, Number(record.total || 0) - Number(record.score || 0)),
        是否通过: Number(record.percent) >= 80 ? "是" : "否",
        用时秒数: record.duration,
        提交时间: record.finishedAt,
      })));
  downloadText(`金尊考试记录_${todayKey()}.csv`, toCsv(["姓名", "手机号", "岗位", "考试名称", "考核类型", "题库", "分数", "答对数", "总题数", "答错数", "是否通过", "用时秒数", "提交时间", "考试会话ID"], rows));
}

function exportMistakes() {
  const rows = state.cloudStats?.mistakes?.length
    ? state.cloudStats.mistakes.map((q) => ({
        姓名: q["姓名"], 手机号: q["手机号"], 岗位: q["岗位"], 题库: q["题库"], 知识点: q["知识点"], 题目: q["题目"], 错选: q["错选"], 正确答案: q["正确答案"], 解析: q["解析"], 记录时间: q["记录时间"],
      }))
    : Object.values(userStore.users).flatMap((user) => getUserMistakes(user.phone).map((q) => ({
        姓名: user.name,
        手机号: user.phone,
        岗位: user.role,
        题库: q.bank,
        知识点: q.knowledgePoint,
        题目: q.question,
        错选: q.selected,
        正确答案: `${q.answer} ${displayAnswerText(q)}`,
        解析: displayExplanation(q),
        记录时间: q.savedAt,
      })));
  downloadText(`金尊错题记录_${todayKey()}.csv`, toCsv(["姓名", "手机号", "岗位", "题库", "知识点", "题目", "错选", "正确答案", "解析", "记录时间"], rows));
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
    els.userName.textContent = "未登录";
    els.userMeta.textContent = "-";
    return;
  }
  els.userName.textContent = state.currentUser.name;
  els.userMeta.textContent = `${state.currentUser.role} · ${state.currentUser.phone}`;
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
  if (password.length < 8) return "密码不能少于8位";
  if (!/[A-Za-z]/.test(password)) return "密码必须包含字母";
  if (!/\d/.test(password)) return "密码必须包含数字";
  return "";
};

async function loginEmployee(event) {
  event.preventDefault();
  const account = els.loginAccount.value.trim();
  const password = els.loginPassword.value;
  els.loginError.textContent = "";
  if (!account || !password) {
    els.loginError.textContent = "请输入姓名或手机号和密码";
    return;
  }
  const button = els.loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "正在登录...";
  try {
    const data = await cloudRequest("login", { account, password, clientId: getClientId() });
    if (!data.token || !data.user) throw new Error("账号或密码错误");
    saveAuthenticatedUser(data);
    els.loginPassword.value = "";
    showAuth(false);
    renderAll();
  } catch (error) {
    els.loginError.textContent = error.message || "账号或密码错误";
  } finally {
    button.disabled = false;
    button.textContent = "登录";
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
  if (!name) return void (els.registerError.textContent = "请填写真实姓名");
  if (!/^1\d{10}$/.test(phone)) return void (els.registerError.textContent = "请输入正确的11位手机号");
  if (!role) return void (els.registerError.textContent = "请选择岗位");
  const error = passwordError(password);
  if (error) return void (els.registerError.textContent = error);
  if (password !== confirm) return void (els.registerError.textContent = "两次输入的密码不一致");
  if (!registerCode) return void (els.registerError.textContent = "请输入公司注册口令");
  const button = els.registerForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "正在注册...";
  try {
    const data = await cloudRequest("register", { name, phone, role, password, registerCode, clientId: getClientId() });
    if (!data.token || !data.user) throw new Error("注册失败");
    saveAuthenticatedUser(data);
    els.registerForm.reset();
    showAuth(false);
    renderAll();
  } catch (requestError) {
    const message = requestError.message || "注册失败，请稍后重试";
    els.registerError.textContent = message.includes("已经注册")
      ? `${message}，请切换到“员工登录”`
      : message;
  } finally {
    button.disabled = false;
    button.textContent = "注册并进入学习";
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
  if (!name) return void (els.resetError.textContent = "请输入真实姓名");
  if (!/^1\d{10}$/.test(phone)) return void (els.resetError.textContent = "请输入正确的11位手机号");
  if (!role) return void (els.resetError.textContent = "请选择岗位");
  const error = passwordError(password);
  if (error) return void (els.resetError.textContent = error);
  if (password !== confirm) return void (els.resetError.textContent = "两次输入的密码不一致");
  if (!registerCode) return void (els.resetError.textContent = "请输入公司注册口令");
  const button = els.resetForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "正在重置...";
  try {
    const data = await cloudRequest("reset", { name, phone, role, password, registerCode, clientId: getClientId() });
    if (!data.token || !data.user) throw new Error("密码重置失败");
    saveAuthenticatedUser(data);
    els.resetForm.reset();
    showAuth(false);
    renderAll();
  } catch (requestError) {
    els.resetError.textContent = requestError.message || "密码重置失败，请稍后重试";
  } finally {
    button.disabled = false;
    button.textContent = "重置密码并登录";
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
    if (!window.confirm("确定清空当前账号的全部错题吗？此操作不能撤销。")) return;
    storage.mistakes = [];
    renderAll();
  });
  els.resetBtn.addEventListener("click", () => {
    if (!window.confirm("确定清空当前账号的正确率、错题和全部考试记录吗？此操作不能撤销。")) return;
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
      button.textContent = visible ? "显示" : "隐藏";
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
    document.body.innerHTML = `<div class="empty">题库加载失败：${escapeHtml(error.message)}</div>`;
    throw error;
  }
}

init();

