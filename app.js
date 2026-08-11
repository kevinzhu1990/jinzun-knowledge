const BUILD_VERSION = "20260811-wangdiantong1";
const PRACTICE_AUTO_NEXT_DELAY_MS = 1200;
const FORMAL_AUTO_NEXT_DELAY_MS = 350;
let autoNextTimer = null;
let deferredInstallPrompt = null;
let waitingServiceWorker = null;
const productUrl = `./outputs/product_quiz/金尊产品知识库题库.json?v=${BUILD_VERSION}`;
const roleUrl = `./outputs/role_quiz/岗位学习考核题库.json?v=${BUILD_VERSION}`;
const API_BASE = "https://jinzun-knowledge.vercel.app";
const API_BASES = [API_BASE];
const CLOUD_ENABLED = true;
const CLOUD_TIMEOUT_MS = 60000;
const state = {
  baseQuestions: [],
  questionChanges: [],
  allQuestions: [],
  filtered: [],
  currentBank: "全部题库",
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
  learnMode: "knowledge",
  learnFilterOpen: false,
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
  companyRanking: [],
  ownFormalHistory: [],
  rankingLoading: false,
  rankingError: "",
  adminQuestionPage: 1,
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
  learnModeTabs: document.querySelector("#learnModeTabs"),
  learnSummary: document.querySelector("#learnSummary"),
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
  adminPracticeList: document.querySelector("#adminPracticeList"),
  exportRecordsBtn: document.querySelector("#exportRecordsBtn"),
  exportPracticeRecordsBtn: document.querySelector("#exportPracticeRecordsBtn"),
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
  installAppBtn: document.querySelector("#installAppBtn"),
  checkAppUpdateBtn: document.querySelector("#checkAppUpdateBtn"),
  appVersionText: document.querySelector("#appVersionText"),
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
  adminQuestionSearch: document.querySelector("#adminQuestionSearch"),
  adminQuestionBank: document.querySelector("#adminQuestionBank"),
  adminQuestionStatus: document.querySelector("#adminQuestionStatus"),
  adminQuestionCount: document.querySelector("#adminQuestionCount"),
  adminQuestionMessage: document.querySelector("#adminQuestionMessage"),
  adminQuestionList: document.querySelector("#adminQuestionList"),
  adminQuestionPagination: document.querySelector("#adminQuestionPagination"),
  adminQuestionDialog: document.querySelector("#adminQuestionDialog"),
  adminQuestionForm: document.querySelector("#adminQuestionForm"),
  adminQuestionDialogClose: document.querySelector("#adminQuestionDialogClose"),
  adminQuestionCancel: document.querySelector("#adminQuestionCancel"),
  adminQuestionId: document.querySelector("#adminQuestionId"),
  adminEditBank: document.querySelector("#adminEditBank"),
  adminEditCode: document.querySelector("#adminEditCode"),
  adminEditKnowledgePoint: document.querySelector("#adminEditKnowledgePoint"),
  adminEditAnswer: document.querySelector("#adminEditAnswer"),
  adminEditQuestion: document.querySelector("#adminEditQuestion"),
  adminEditOptionA: document.querySelector("#adminEditOptionA"),
  adminEditOptionB: document.querySelector("#adminEditOptionB"),
  adminEditOptionC: document.querySelector("#adminEditOptionC"),
  adminEditOptionD: document.querySelector("#adminEditOptionD"),
  adminEditExplanation: document.querySelector("#adminEditExplanation"),
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

function showAppInstallButton(label, mode = "install") {
  if (!els.installAppBtn) return;
  els.installAppBtn.textContent = label;
  els.installAppBtn.dataset.mode = mode;
  els.installAppBtn.classList.remove("hidden");
}

async function handleAppInstallOrUpdate() {
  if (els.installAppBtn?.dataset.mode === "update") {
    if (!state.examFinished && state.examType === "formal") {
      setSyncStatus("正式考试进行中，请交卷后再更新应用", "warn");
      return;
    }
    waitingServiceWorker?.postMessage({ type: "SKIP_WAITING" });
    return;
  }
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installAppBtn.classList.add("hidden");
}

async function registerInstallableApp() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${BUILD_VERSION}`);
    if (registration.waiting) {
      waitingServiceWorker = registration.waiting;
      showAppInstallButton("更新到最新版本", "update");
    }
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          waitingServiceWorker = worker;
          showAppInstallButton("更新到最新版本", "update");
        }
      });
    });
    await registration.update();
  } catch (error) {
    console.warn("应用安装服务注册失败", error);
  }
}

async function checkLatestVersion({ silent = false } = {}) {
  if (els.appVersionText) els.appVersionText.textContent = `当前版本 ${BUILD_VERSION}`;
  if (els.checkAppUpdateBtn) {
    els.checkAppUpdateBtn.disabled = true;
    if (!silent) els.checkAppUpdateBtn.textContent = "正在检查...";
  }
  try {
    const response = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const latestVersion = String(data.buildVersion || "").trim();
    if (!latestVersion) throw new Error("服务器未返回版本号");
    if (latestVersion === BUILD_VERSION) {
      if (!silent) setSyncStatus(`当前已是最新版本 ${latestVersion}`, "success");
      return;
    }
    if (!state.examFinished && state.examType === "formal") {
      setSyncStatus(`发现新版本 ${latestVersion}，请交卷后再更新`, "warn");
      if (els.checkAppUpdateBtn) els.checkAppUpdateBtn.textContent = "交卷后更新";
      return;
    }
    setSyncStatus(`发现新版本 ${latestVersion}，正在更新...`, "success");
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
    window.setTimeout(() => {
      window.location.replace(`./?v=${encodeURIComponent(latestVersion)}&updated=${Date.now()}`);
    }, 500);
  } catch (error) {
    if (!silent) setSyncStatus(`版本检查失败：${error.message}`, "error");
  } finally {
    if (els.checkAppUpdateBtn) {
      els.checkAppUpdateBtn.disabled = false;
      if (els.checkAppUpdateBtn.textContent === "正在检查...") els.checkAppUpdateBtn.textContent = "检查最新版本";
    }
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  showAppInstallButton("安装到电脑", "install");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  els.installAppBtn?.classList.add("hidden");
  setSyncStatus("金尊知识库已安装到电脑", "success");
});

navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (!waitingServiceWorker) return;
  if (!state.examFinished && state.examType === "formal") {
    showAppInstallButton("交卷后重启更新", "update");
    return;
  }
  window.location.reload();
});

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
      throw new Error("服务器响应超过60秒，请稍后重新提交");
    }
    if (error instanceof TypeError || message.includes("failed to fetch") || message.includes("networkerror")) {
      throw new Error("暂时无法连接服务器，请检查网络后重试");
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
  get learningProgress() {
    return safeJsonObject(userKey("learning_progress"));
  },
  set learningProgress(value) {
    localStorage.setItem(userKey("learning_progress"), JSON.stringify(value));
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
  learn: "学习中心",
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

const displayAnswerText = (question) => {
  if (question.knowledgePoint === "看货号选图片") return `选项${question.answer}`;
  return stripCodeFromOption(question.answerText, question);
};
const displayExplanation = (question) => {
  if (question.knowledgePoint === "看货号选图片") {
    return `${question.code} 对应的产品图片是选项 ${question.answer}。`;
  }
  if (question.knowledgePoint !== "产品名称") return question.explanation;
  const name = displayAnswerText(question);
  return `${question.code} 对应的产品名称是：${name}。`;
};

const imagePath = (src) => {
  if (!src) return "";
  const separator = String(src).includes("?") ? "&" : "?";
  return `./${src}${separator}v=${BUILD_VERSION}`;
};

const preloadedImages = new Set();

function questionImagePaths(question) {
  if (!question) return [];
  return [question.questionImage, ...optionEntries(question).map(([, , image]) => image)].filter(Boolean);
}

function preloadQuizImages(startIndex = state.quizIndex + 1, count = 2) {
  state.quiz.slice(startIndex, startIndex + count).forEach((question) => {
    questionImagePaths(question).forEach((src) => {
      const url = imagePath(src);
      if (preloadedImages.has(url)) return;
      preloadedImages.add(url);
      const image = new Image();
      image.decoding = "async";
      image.src = url;
    });
  });
}

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

const MOONCAKE_IMAGE_POINTS = new Set(["看图片选货号", "看货号选图片"]);
const MOONCAKE_FLAVOR_POINTS = new Set(["内配/口味", "口味个数"]);
const PRODUCT_BASIC_POINTS = new Set(["产品名称", "克重/净重", "内配/口味", "口味个数", "保质期"]);
const PRODUCT_LOGISTICS_POINTS = new Set(["箱规", "单位", "条码"]);

function productQuestionAllowedForRole(question, role = state.currentUser?.role) {
  if (!question || !["月饼题库", "日常年货题库", "商家编码题库"].includes(question.bank)) return true;
  const point = String(question.knowledgePoint || "");
  if (PRODUCT_BASIC_POINTS.has(point)) return true;
  if (MOONCAKE_IMAGE_POINTS.has(point)) return ["客服", "主播", "运营", "美工"].includes(role);
  if (PRODUCT_LOGISTICS_POINTS.has(point)) return ["仓储", "采购", "审单", "运营"].includes(role);
  if (point.includes("商家编码") || question.bank === "商家编码题库") return ["运营", "审单"].includes(role);
  if (point.includes("包装") || point.includes("盒型") || point.includes("产品线")) return ["美工", "客服", "运营"].includes(role);
  return ["客服", "主播", "运营"].includes(role);
}

function suitableRolesForProduct(questions) {
  const roles = ["客服", "主播", "运营", "美工", "仓储", "采购", "审单"];
  return roles.filter((role) => questions.some((question) => productQuestionAllowedForRole(question, role)));
}

function selectMooncakeQuizQuestions(pool, requestedSize) {
  const size = Math.min(requestedSize, pool.length);
  const imageTotal = Math.round(size * 0.7);
  const flavorTotal = Math.round(size * 0.1);
  const otherTotal = size - imageTotal - flavorTotal;
  const selectedIds = new Set();
  const selected = [];
  const take = (questions, count) => {
    const picked = shuffle(questions.filter((question) => !selectedIds.has(String(question.id))))
      .slice(0, Math.max(0, count));
    picked.forEach((question) => selectedIds.add(String(question.id)));
    selected.push(...picked);
  };
  const codeToImage = pool.filter((question) => question.knowledgePoint === "看货号选图片");
  const imageToCode = pool.filter((question) => question.knowledgePoint === "看图片选货号");
  const flavor = pool.filter((question) => MOONCAKE_FLAVOR_POINTS.has(question.knowledgePoint));
  const other = pool.filter((question) => !MOONCAKE_IMAGE_POINTS.has(question.knowledgePoint)
    && !MOONCAKE_FLAVOR_POINTS.has(question.knowledgePoint));

  take(codeToImage, Math.floor(imageTotal / 2));
  take(imageToCode, imageTotal - selected.length);
  take([...codeToImage, ...imageToCode], imageTotal - selected.length);
  take(flavor, flavorTotal);
  take(other, otherTotal);
  take(pool, size - selected.length);
  return shuffle(selected.slice(0, size));
}

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
  target.textContent = "正在连接公司账号系统，请勿关闭页面……";
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
  const requestToken = accountAction ? "" : (payload.token || token);
  const requestPayload = {
    ...payload,
    userAgent: navigator.userAgent,
    deviceId: payload.deviceId || getClientId(),
    clientId: payload.clientId || getClientId(),
  };
  if (requestToken) requestPayload.token = requestToken;
  const body = JSON.stringify(requestPayload);
  const directApiActions = new Set(["login", "register", "reset", "exam-start", "exam-submit", "mistakes", "practice-submit"]);
  const endpoint = directApiActions.has(action) ? action : `cloud?action=${encodeURIComponent(action)}`;
  let lastError = null;
  for (const base of API_BASES) {
    try {
      const res = await fetchWithTimeout(`${base}/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}) },
        body,
      }, CLOUD_TIMEOUT_MS);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(normalizeCloudError(data.error, res.status, action));
        error.status = res.status;
        throw error;
      }
      if (!data.ok) throw new Error(data.error || "云端同步失败");
      if (accountAction) hideConnectionStatus();
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  if (accountAction) hideConnectionStatus();
  throw lastError || new Error("云端同步失败");
}

function normalizeCloudError(message, status, action) {
  const raw = String(message || "").trim();
  const normalized = raw.toLowerCase();
  if (status === 401 && action === "login") {
    return "账号或密码错误；如忘记密码，请使用公司口令 jiuding 重置";
  }
  if (status === 401 || normalized === "unauthorized") {
    return "登录状态已失效，请重新登录";
  }
  if (normalized.includes("account service is not configured") || normalized.includes("cloud service disabled")) {
    return "公司账号系统暂时不可用，请稍后重试";
  }
  if (normalized.includes("origin not allowed")) {
    return "当前登录地址未获授权，请使用最新版登录网址";
  }
  return raw || `公司账号系统请求失败（${status}）`;
}

async function syncLater(action, payload) {
  if (!CLOUD_ENABLED) return { ok: true, skipped: true };
  try {
    const data = await cloudRequest(action, payload);
    if (action === "practice-submit" && !data.record_id) throw new Error("服务器未返回练习记录ID");
    if (action === "mistakes" && payload.items?.length && (!Array.isArray(data.record_ids) || data.record_ids.length < payload.items.length)) {
      throw new Error("服务器未返回完整错题记录ID");
    }
    if (action === "practice-submit") setSyncStatus("练习成绩已同步到飞书", "success");
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
  if (!localStorage.getItem("jz_auth_token")) return;
  const queue = safeJsonArray("jz_sync_queue");
  if (!queue.length) return;
  const remain = [];
  let restoredPracticeCount = 0;
  for (const item of queue) {
    if (!['mistakes', 'practice-submit'].includes(item.action)) continue;
    try {
      const data = await cloudRequest(item.action, item.payload);
      if (item.action === "practice-submit" && !data.record_id) throw new Error("服务器未返回练习记录ID");
      if (item.action === "practice-submit") restoredPracticeCount += 1;
    } catch (error) {
      remain.push({ ...item, error: error.message });
    }
  }
  localStorage.setItem("jz_sync_queue", JSON.stringify(remain.slice(-300)));
  if (restoredPracticeCount > 0) setSyncStatus(`已自动补传 ${restoredPracticeCount} 条练习成绩到飞书`, "success");
}

async function loadCloudStats() {
  if (!CLOUD_ENABLED || !isAdminUser()) {
    state.cloudStats = null;
    return;
  }
  try {
    const token = localStorage.getItem("jz_auth_token") || "";
    const res = await fetchWithTimeout(`${API_BASE}/api/stats`, token ? { headers: { Authorization: `Bearer ${token}` } } : {}, CLOUD_TIMEOUT_MS);
    const data = await res.json();
    if (res.status === 401) {
      clearAuthenticationSession();
      showAuth(true);
      throw new Error("登录状态已失效，请重新登录");
    }
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
  const parseQuizJson = async (response, label) => {
    if (!response.ok) {
      throw new Error(`${label}暂时无法加载，请刷新页面重试`);
    }
    const text = await response.text();
    const start = Math.min(...[text.indexOf("["), text.indexOf("{")].filter((index) => index >= 0));
    if (!Number.isFinite(start)) {
      throw new Error(`${label}格式异常，请刷新页面重试`);
    }
    try {
      return JSON.parse(text.slice(start));
    } catch {
      throw new Error(`${label}格式异常，请刷新页面重试`);
    }
  };

  const [productQuestions, roleQuestions] = await Promise.all([
    parseQuizJson(productRes, "产品题库"),
    parseQuizJson(roleRes, "岗位题库")
  ]);
  state.baseQuestions = [...productQuestions, ...roleQuestions].map((question) => ({
    ...question,
    role: question.role || question.category || "",
    module: question.module || question.productLine || "",
    source: question.source || "产品知识库",
    note: question.note || "",
  }));
  applyQuestionChanges();
}

function applyQuestionChanges() {
  const byId = new Map(state.questionChanges.map((change) => [String(change.id), change]));
  state.allQuestions = state.baseQuestions.flatMap((question) => {
    const change = byId.get(String(question.id));
    if (!change) return [{ ...question, _changeStatus: "original" }];
    if (change.status === "deleted") return [];
    return [{ ...question, ...(change.patch || {}), _changeStatus: "active", _updatedAt: change.updatedAt || "", _updatedBy: change.updatedBy || "" }];
  });
}

function allManagedQuestions() {
  const byId = new Map(state.questionChanges.map((change) => [String(change.id), change]));
  return state.baseQuestions.map((question) => {
    const change = byId.get(String(question.id));
    if (!change) return { ...question, _changeStatus: "original" };
    return { ...question, ...(change.patch || {}), _changeStatus: change.status, _updatedAt: change.updatedAt || "", _updatedBy: change.updatedBy || "" };
  });
}

async function loadQuestionChanges() {
  if (!state.currentUser) {
    state.questionChanges = [];
    applyQuestionChanges();
    return;
  }
  const data = await cloudRequest("questions", {});
  state.questionChanges = Array.isArray(data.changes) ? data.changes : [];
  applyQuestionChanges();
}

const questionIdentity = (question) => [
  question.bank || "",
  question.code || "",
  question.knowledgePoint || "",
  question.type || "",
].join("|");

const MISTAKE_REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14];

function mistakeReviewStage(question) {
  const stage = Number(question?.reviewStage || 0);
  return Math.max(0, Math.min(MISTAKE_REVIEW_INTERVAL_DAYS.length - 1, Number.isFinite(stage) ? stage : 0));
}

function mistakeDueTime(question) {
  const value = question?.nextReviewAt || question?.savedAt;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isMistakeDue(question, now = Date.now()) {
  return mistakeDueTime(question) <= now;
}

function scheduledReviewDate(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function reviewDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "今日";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((target - today) / 86400000);
  if (dayDiff <= 0) return "今日";
  if (dayDiff === 1) return "明日";
  return `${target.getMonth() + 1}月${target.getDate()}日`;
}

function advanceMistakeReview(question) {
  const key = questionIdentity(question);
  const mistakes = storage.mistakes;
  const index = mistakes.findIndex((item) => questionIdentity(item) === key);
  if (index < 0) return;
  const nextStage = mistakeReviewStage(mistakes[index]) + 1;
  if (nextStage >= MISTAKE_REVIEW_INTERVAL_DAYS.length) {
    mistakes.splice(index, 1);
  } else {
    mistakes[index] = {
      ...mistakes[index],
      reviewStage: nextStage,
      lastReviewedAt: new Date().toISOString(),
      nextReviewAt: scheduledReviewDate(MISTAKE_REVIEW_INTERVAL_DAYS[nextStage]),
    };
  }
  storage.mistakes = mistakes;
}

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
    const savedAt = oldQuestion.savedAt || new Date().toISOString();
    return [{
      ...current,
      selected: oldQuestion.selected || "",
      savedAt,
      reviewStage: mistakeReviewStage(oldQuestion),
      nextReviewAt: oldQuestion.nextReviewAt || savedAt,
      lastReviewedAt: oldQuestion.lastReviewedAt || "",
    }];
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
  const dueMistakes = mistakes.filter((question) => isMistakeDue(question));
  const scheduledMistakes = mistakes.length - dueMistakes.length;
  const todayRecords = records.filter((record) => record.finishedAt && todayKey(record.finishedAt) === todayKey());
  const best = records.reduce((acc, record) => Math.max(acc, Number(record.percent) || 0), 0);
  const last = records[0];

  els.taskPanel.innerHTML = `
    <div class="task-card ${todayRecords.length ? "done" : ""}">
      <span>${todayRecords.length ? "✓" : "1"}</span>
      <div><strong>完成今日考核</strong><small>${todayRecords.length ? `今日已完成 ${todayRecords.length} 次` : "建议先做 30-50 题正式考核"}</small></div>
    </div>
    <div class="task-card ${dueMistakes.length === 0 ? "done" : ""}">
      <span>${dueMistakes.length === 0 ? "✓" : "2"}</span>
      <div><strong>复习错题</strong><small>${dueMistakes.length ? `今日待复习 ${dueMistakes.length} 道${scheduledMistakes ? `，另有 ${scheduledMistakes} 道已排程` : ""}` : scheduledMistakes ? `今日已完成，${scheduledMistakes} 道等待后续复习` : "当前没有待复习错题"}</small></div>
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
  return `<img class="thumb" src="${imagePath(question.questionImage)}" alt="题目图片" loading="lazy" decoding="async" />`;
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
              <img src="${imagePath(img)}" alt="选项${letter}图片" loading="lazy" decoding="async" ${imageWidth ? `style="max-width:${imageWidth}px"` : ""} />
              <figcaption>${letter} ${escapeHtml(text)}</figcaption>
            </figure>
          `
        )
        .join("")}
    </div>
  `;
}

const LEARN_CATEGORY_LABELS = {
  home: "学习首页",
  product: "产品知识",
  merchant: "商家编码",
  role: "岗位规则",
  operations: "平台运营",
  brand: "品牌知识",
};

function learnCategoryForBank(bank) {
  if (bank === "全部题库") return "home";
  if (["月饼题库", "日常年货题库"].includes(bank)) return "product";
  if (bank === "商家编码题库") return "merchant";
  if (bank === "品牌题库") return "brand";
  if (String(bank).startsWith("运营-")) return "operations";
  return "role";
}

function currentLearnCategory() {
  return learnCategoryForBank(state.currentBank);
}

function learnCategoryBanks(category) {
  const all = banks().filter((bank) => bank !== "全部题库");
  if (category === "product") return all.filter((bank) => ["月饼题库", "日常年货题库"].includes(bank));
  if (category === "merchant") return all.filter((bank) => bank === "商家编码题库");
  if (category === "brand") return all.filter((bank) => bank === "品牌题库");
  if (category === "operations") return all.filter((bank) => bank.startsWith("运营-"));
  if (category === "role") {
    return all.filter((bank) => !PRODUCT_BANKS.includes(bank) && bank !== "品牌题库" && !bank.startsWith("运营-")
      && state.allQuestions.some((question) => question.bank === bank
        && (question.role === state.currentUser?.role || question.role === "全员")));
  }
  return [];
}

function renderLearnFilter() {
  const category = currentLearnCategory();
  const subBanks = learnCategoryBanks(category);
  const categoryButtons = Object.entries(LEARN_CATEGORY_LABELS).map(([value, label]) =>
    `<button class="learn-category-btn${category === value ? " active" : ""}" data-learn-category="${value}">${label}</button>`
  ).join("");
  const filterable = ["role", "operations"].includes(category);
  els.learnFilter.innerHTML = `
    <div class="learn-category-tabs">${categoryButtons}</div>
    ${subBanks.length > 1 ? `<div class="learn-sub-banks">${subBanks.map((bank) => `<button class="learn-filter-btn${state.currentBank === bank ? " active" : ""}" data-bank="${escapeHtml(bank)}">${escapeHtml(bank.replace(/^运营-/, ""))}</button>`).join("")}</div>` : ""}
    ${filterable ? `<button class="learn-filter-toggle" type="button" aria-expanded="${state.learnFilterOpen}">筛选</button>` : ""}`;

  const filterQuestions = state.allQuestions.filter((question) => {
    if (category === "operations") return String(question.bank).startsWith("运营-");
    if (category === "role") return !PRODUCT_BANKS.includes(question.bank) && !String(question.bank).startsWith("运营-");
    return false;
  });
  els.ruleFilters.classList.toggle("hidden", !filterable || !state.learnFilterOpen);
  const fillRuleSelect = (element, values, placeholder) => {
    if (!element) return;
    const current = element.value;
    element.innerHTML = `<option value="">${placeholder}</option>${values.sort().map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    element.value = current;
  };
  fillRuleSelect(els.ruleRoleFilter, [...new Set(filterQuestions.map((q) => q.role).filter(Boolean))], "全部岗位");
  fillRuleSelect(els.rulePlatformFilter, [...new Set(filterQuestions.map((q) => q.platform).filter(Boolean))], "全部平台");
  fillRuleSelect(els.ruleModuleFilter, [...new Set(filterQuestions.map((q) => q.module).filter(Boolean))], "全部模块");
  els.ruleRiskFilter.value = state.ruleFilters.riskLevel;
  els.ruleSourceFilter.value = state.ruleFilters.sourceLevel;

  els.learnFilter.querySelectorAll("[data-learn-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextCategory = button.dataset.learnCategory;
      state.currentBank = nextCategory === "home" ? "全部题库" : (learnCategoryBanks(nextCategory)[0] || "全部题库");
      state.learnMode = "knowledge";
      state.learnPage = 1;
      state.ruleFilters = { role: "", platform: "", riskLevel: "", module: "", sourceLevel: "" };
      els.bankSelect.value = state.currentBank;
      renderAll();
    });
  });
  els.learnFilter.querySelectorAll(".learn-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearAutoNextTimer();
      state.currentBank = btn.dataset.bank;
      state.learnPage = 1;
      els.bankSelect.value = state.currentBank;
      renderAll();
    });
  });
  els.learnFilter.querySelector(".learn-filter-toggle")?.addEventListener("click", () => {
    state.learnFilterOpen = !state.learnFilterOpen;
    renderLearnFilter();
  });
  els.learnModeTabs.classList.toggle("hidden", category === "home");
  els.learnModeTabs.querySelectorAll("[data-learn-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.learnMode === state.learnMode);
  });
}

function renderLearnList() {
  const category = currentLearnCategory();
  renderLearningProgress();
  if (category === "home") return renderLearningOverview();
  if (category === "product") return renderProductLearning();
  if (category === "merchant") return renderMerchantLearning();
  return renderRuleLearning();
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
  const previousRoleBank = els.roleBankSelect.value;
  const productBanks = PRODUCT_BANKS.filter((bank) =>
    state.allQuestions.some((q) => q.bank === bank)
  );
  const roleBanks = banks().filter(
    (bank) => bank !== "全部题库" && !PRODUCT_BANKS.includes(bank)
      && state.allQuestions.some((question) => question.bank === bank
        && (question.role === state.currentUser?.role || question.role === "全员"))
  );

  els.productBankSelect.innerHTML = productBanks
    .map((bank) => {
      const count = state.allQuestions.filter((q) => q.bank === bank).length;
      return `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}（${count} 题）</option>`;
    })
    .join("");

  els.roleBankSelect.innerHTML = roleBanks
    .map((bank) => {
      const matching = state.allQuestions.filter((question) => question.bank === bank
        && (question.role === state.currentUser?.role || question.role === "全员"));
      const formalCount = matching.filter(isFormalRoleQuestion).length;
      const count = els.examType?.value === "formal" ? formalCount : matching.length;
      return `<option value="${escapeHtml(bank)}" ${els.examType?.value === "formal" && !formalCount ? "disabled" : ""}>${escapeHtml(bank)}（${els.examType?.value === "formal" ? "正式可用 " : ""}${count} 题）</option>`;
    })
    .join("");
  if (roleBanks.includes(previousRoleBank)) els.roleBankSelect.value = previousRoleBank;
  if (!els.roleBankSelect.value) {
    const firstEnabled = [...els.roleBankSelect.options].find((option) => !option.disabled);
    if (firstEnabled) els.roleBankSelect.value = firstEnabled.value;
  }
  updateQuizSetupAvailability();
}

function isFormalRoleQuestion(question) {
  return question.verificationStatus === "verified"
    && question.effectiveForFormalExam === true
    && question.sourceConflict === false
    && question.semanticDuplicate === false
    && question.humanReviewStatus === "approved";
}

function updateQuizSetupAvailability() {
  if (!els.startQuizBtn) return;
  const isFormalRole = state.quizMode === "role" && els.examType?.value === "formal";
  const bank = els.roleBankSelect.value;
  const count = state.allQuestions.filter((question) => question.bank === bank
    && (question.role === state.currentUser?.role || question.role === "全员")
    && isFormalRoleQuestion(question)).length;
  const unavailable = isFormalRole && count < 1;
  els.startQuizBtn.disabled = unavailable;
  els.quizSetupStatus.textContent = unavailable
    ? "当前岗位题库尚未完成审核，仅支持练习模式。"
    : "";
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
    if (state.examType === "redline") {
      pool = state.allQuestions.filter((q) => q.riskLevel === "redline" && (!q.role || q.role === state.currentUser?.role || q.role === "全员"));
      state.examLabelOverride = "岗位红线规则题库";
    } else if (state.quizMode === "product") {
      const bank = els.productBankSelect.value;
      pool = state.allQuestions.filter((q) => q.bank === bank && productQuestionAllowedForRole(q));
      state.examLabelOverride = bank;
    } else if (state.quizMode === "role") {
      const bank = els.roleBankSelect.value;
      pool = state.allQuestions.filter((q) => q.bank === bank && (q.role === state.currentUser?.role || q.role === "全员"));
      state.examLabelOverride = bank;
    } else {
      pool = state.allQuestions.filter((q) => CORE_EXAM_BANKS.includes(q.bank));
      state.examLabelOverride = "综合产品题库";
    }
    state.quiz = state.quizMode === "product" && els.productBankSelect.value === "月饼题库"
      ? selectMooncakeQuizQuestions(pool, size)
      : shuffle(pool).slice(0, Math.min(size, pool.length));
  }
  if (!state.quiz.length) {
    els.quizSetupStatus.textContent = "当前筛选没有可用于考核的题目，请调整搜索或题库筛选。";
    return;
  }
  if (state.examType !== "formal") state.submissionId = crypto.randomUUID();
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

function productKnowledgeValue(questions, point) {
  return questions.find((question) => question.knowledgePoint === point)?.answerText || "--";
}

function learningStatus(id) {
  return storage.learningProgress[id]?.status || "new";
}

function updateLearningStatus(id, status) {
  const progress = storage.learningProgress;
  progress[id] = { status, updatedAt: new Date().toISOString() };
  storage.learningProgress = progress;
  renderLearnList();
}

function learningActionButtons(id) {
  const status = learningStatus(id);
  return `<div class="learning-actions">
    <button type="button" class="memory-btn${status === "learned" ? " active" : ""}" data-learning-id="${escapeHtml(id)}" data-learning-status="learned">记住了</button>
    <button type="button" class="review-btn${status === "review" ? " active" : ""}" data-learning-id="${escapeHtml(id)}" data-learning-status="review">需要复习</button>
  </div>`;
}

function bindLearningInteractions() {
  els.learnList.querySelectorAll("[data-learning-status]").forEach((button) => {
    button.addEventListener("click", () => updateLearningStatus(button.dataset.learningId, button.dataset.learningStatus));
  });
  els.learnList.querySelectorAll("[data-reveal-card]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".memory-flash-card");
      card?.classList.toggle("is-revealed");
      button.textContent = card?.classList.contains("is-revealed") ? "收起要点" : "查看要点";
    });
  });
  els.learnList.querySelectorAll("[data-overview-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.overviewCategory;
      state.currentBank = button.dataset.bankTarget || learnCategoryBanks(category)[0] || "全部题库";
      state.learnMode = button.dataset.overviewMode || "knowledge";
      state.learnPage = 1;
      els.bankSelect.value = state.currentBank;
      renderAll();
    });
  });
}

function renderLearningPagination(total, pageSize) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  state.learnPage = Math.min(state.learnPage, totalPages);
  els.learnPagination.innerHTML = totalPages <= 1 ? "" : `
    <button class="secondary-btn" data-page="prev" ${state.learnPage <= 1 ? "disabled" : ""}>上一页</button>
    <span>第 ${state.learnPage} / ${totalPages} 页</span>
    <button class="secondary-btn" data-page="next" ${state.learnPage >= totalPages ? "disabled" : ""}>下一页</button>`;
  els.learnPagination.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.learnPage += button.dataset.page === "next" ? 1 : -1;
      renderLearnList();
      document.querySelector("#learnView")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  return { start: (state.learnPage - 1) * pageSize, end: state.learnPage * pageSize };
}

function renderLearningProgress() {
  const progress = Object.values(storage.learningProgress);
  const learned = progress.filter((item) => item.status === "learned").length;
  const learnedToday = progress.filter((item) => item.status === "learned" && todayKey(item.updatedAt) === todayKey()).length;
  const review = progress.filter((item) => item.status === "review").length;
  els.learnSummary.innerHTML = `<div class="learning-progress-strip">
    <div><span>当前岗位</span><strong>${escapeHtml(state.currentUser?.role || "未设置")}</strong></div>
    <div><span>已掌握</span><strong>${learned}</strong></div>
    <div><span>待复习</span><strong>${review}</strong></div>
    <div><span>今日目标</span><strong>${learnedToday}/10 张</strong></div>
  </div>`;
}

function renderLearningOverview() {
  const roleBanks = learnCategoryBanks("role");
  const reviewTargets = new Map();
  Object.entries(storage.learningProgress)
    .filter(([, item]) => item.status === "review")
    .forEach(([id]) => {
      let bank = "";
      if (id.startsWith("product|")) bank = id.split("|")[1] || "";
      else if (id.startsWith("merchant|")) bank = "商家编码题库";
      else if (id.startsWith("rule|knowledge|")) {
        const knowledgeId = id.slice("rule|knowledge|".length);
        bank = state.allQuestions.find((question) => String(question.knowledgeId || "") === knowledgeId)?.bank || "";
      }
      else if (id.startsWith("rule|")) bank = state.allQuestions.find((question) => question.id === id.slice(5))?.bank || "";
      if (!bank) return;
      const category = learnCategoryForBank(bank);
      const key = `${category}|${bank}`;
      reviewTargets.set(key, { category, bank, count: (reviewTargets.get(key)?.count || 0) + 1 });
    });
  const items = [
    ["product", "产品知识", "货号、图片、规格、口味与保质期", "knowledge"],
    ["merchant", "商家编码", "单品、多盒装与组合装编码规律", "knowledge"],
    ["role", "岗位规则", `${state.currentUser?.role || "当前岗位"}必学动作与常见误区`, "knowledge"],
    ["operations", "平台运营", "天猫、京东、拼多多、抖音与视频号", "knowledge"],
    ["brand", "品牌知识", "品牌背书、工艺和统一服务口径", "knowledge"],
  ];
  els.learnCount.textContent = `${storage.learningProgress ? Object.keys(storage.learningProgress).length : 0} 条进度`;
  els.learnList.innerHTML = `<div class="learning-home">
    <section class="learning-home-section"><div class="learning-section-title"><h4>岗位必学</h4><span>${escapeHtml(state.currentUser?.role || "全员")}</span></div>
      <div class="learning-home-links">${roleBanks.length ? roleBanks.map((bank) => `<button type="button" data-overview-category="role" data-bank-target="${escapeHtml(bank)}"><strong>${escapeHtml(bank)}</strong><span>${state.allQuestions.filter((q) => q.bank === bank && (q.role === state.currentUser?.role || q.role === "全员")).length} 个知识点</span></button>`).join("") : `<p class="empty">当前岗位先学习全员产品与协作规范。</p>`}</div>
    </section>
    <section class="learning-home-section"><div class="learning-section-title"><h4>学习内容</h4></div>
      <div class="learning-path-grid">${items.map(([category, title, description, mode]) => `<button type="button" data-overview-category="${category}" data-overview-mode="${mode}"><strong>${title}</strong><span>${description}</span><b>${state.allQuestions.filter((q) => learnCategoryBanks(category).includes(q.bank)).length}</b></button>`).join("")}</div>
    </section>
    <section class="learning-home-section"><div class="learning-section-title"><h4>复习任务</h4></div>
      ${reviewTargets.size ? `<div class="learning-home-links">${[...reviewTargets.values()].map((target) => `<button type="button" class="review-entry" data-overview-category="${target.category}" data-bank-target="${escapeHtml(target.bank)}" data-overview-mode="review"><strong>${target.count}</strong><span>${escapeHtml(target.bank)}待复习</span></button>`).join("")}</div>` : `<p class="empty">当前没有待复习内容。</p>`}
    </section>
  </div>`;
  els.learnPagination.innerHTML = "";
  bindLearningInteractions();
}

function productLearningEntities() {
  const matchedCodes = new Set(state.filtered.map((question) => String(question.code || "")).filter(Boolean));
  const allBankQuestions = state.allQuestions.filter((question) => question.bank === state.currentBank && matchedCodes.has(String(question.code || "")));
  const grouped = new Map();
  allBankQuestions.forEach((question) => {
    const code = String(question.code || "");
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code).push(question);
  });
  const cards = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN", { numeric: true }));
  return cards.map(([code, questions]) => {
    const name = questions[0]?.productName || productKnowledgeValue(questions, "产品名称");
    const imageQuestion = questions.find((question) => question.knowledgePoint === "看货号选图片");
    const image = questions.find((question) => question.questionImage)?.questionImage
      || imageQuestion?.[`option${imageQuestion.answer}Image`]
      || "";
    const peers = cards
      .filter(([peerCode, peerQuestions]) => peerCode !== code && peerQuestions[0]?.productLine === questions[0]?.productLine)
      .sort(([left], [right]) => Math.abs(Number(left) - Number(code)) - Math.abs(Number(right) - Number(code)))
      .slice(0, 3)
      .map(([peerCode]) => peerCode);
    const roles = suitableRolesForProduct(questions);
    return { id: `product|${state.currentBank}|${code}`, code, questions, name, image, peers, roles,
      line: questions[0]?.productLine || "--", net: productKnowledgeValue(questions, "克重/净重"),
      carton: productKnowledgeValue(questions, "箱规"), contents: productKnowledgeValue(questions, "内配/口味"),
      shelf: productKnowledgeValue(questions, "保质期") };
  });
}

function renderProductLearning() {
  let entities = productLearningEntities();
  if (state.learnMode === "review") entities = entities.filter((item) => learningStatus(item.id) === "review");
  const pageSize = state.learnMode === "compare" ? 30 : 16;
  const { start, end } = renderLearningPagination(entities.length, pageSize);
  const pageItems = entities.slice(start, end);
  els.learnCount.textContent = `${entities.length} 个产品`;
  if (!pageItems.length) {
    els.learnList.innerHTML = `<div class="empty">${state.learnMode === "review" ? "当前产品题库没有待复习内容。" : "没有找到匹配的产品。"}</div>`;
    return;
  }
  if (state.learnMode === "compare") {
    els.learnList.innerHTML = `<div class="learning-table-wrap"><table class="learning-compare-table"><thead><tr><th>货号</th><th>产品</th><th>产品线</th><th>净重</th><th>箱规</th><th>保质期</th><th>易混货号</th></tr></thead><tbody>${pageItems.map((item) => `<tr><td><strong>${escapeHtml(item.code)}</strong></td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.line)}</td><td>${escapeHtml(item.net)}</td><td>${escapeHtml(item.carton)}</td><td>${escapeHtml(item.shelf)}</td><td>${escapeHtml(item.peers.join("、") || "--")}</td></tr>`).join("")}</tbody></table></div>`;
  } else if (state.learnMode === "flash") {
    els.learnList.innerHTML = `<div class="memory-flash-grid">${pageItems.map((item) => `<article class="memory-flash-card">
      <div class="flash-front">${item.image ? `<img src="${imagePath(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" />` : ""}<span>${escapeHtml(item.line)}</span><h4>${escapeHtml(item.name)}</h4><strong>${escapeHtml(item.code)}</strong></div>
      <div class="flash-back"><dl><div><dt>净重</dt><dd>${escapeHtml(item.net)}</dd></div><div><dt>箱规</dt><dd>${escapeHtml(item.carton)}</dd></div><div><dt>保质期</dt><dd>${escapeHtml(item.shelf)}</dd></div><div><dt>内配/口味</dt><dd>${escapeHtml(item.contents)}</dd></div></dl>${learningActionButtons(item.id)}</div>
      <button type="button" class="flash-reveal-btn" data-reveal-card>查看要点</button></article>`).join("")}</div>`;
  } else {
    els.learnList.innerHTML = `<div class="product-knowledge-grid">${pageItems.map((item) => `<article class="product-knowledge-card">
      ${item.image ? `<img src="${imagePath(item.image)}" alt="${escapeHtml(item.code)} ${escapeHtml(item.name)}" loading="lazy" decoding="async" />` : `<div class="product-image-empty">暂无产品图</div>`}
      <div class="product-card-body"><div class="meta"><span>${escapeHtml(item.line)}</span><span>${escapeHtml(item.code)}</span></div><h4>${escapeHtml(item.name)}</h4>
        <dl><div><dt>净重</dt><dd>${escapeHtml(item.net)}</dd></div><div><dt>箱规</dt><dd>${escapeHtml(item.carton)}</dd></div><div><dt>内配/口味</dt><dd>${escapeHtml(item.contents)}</dd></div><div><dt>保质期</dt><dd>${escapeHtml(item.shelf)}</dd></div><div><dt>易混货号</dt><dd>${escapeHtml(item.peers.join("、") || "--")}</dd></div><div><dt>适用岗位</dt><dd>${escapeHtml(item.roles.join("、") || "全员基础学习")}</dd></div></dl>
        ${learningActionButtons(item.id)}</div></article>`).join("")}</div>`;
  }
  bindLearningInteractions();
}

function merchantLearningEntities() {
  const productNames = new Map(state.allQuestions.filter((q) => q.knowledgePoint === "产品名称" && q.code).map((q) => [String(q.code), q.productName || q.answerText]));
  const matchedQuestionIds = new Set(state.filtered.map((question) => question.id));
  const groups = new Map();
  state.allQuestions.filter((question) => question.bank === state.currentBank).forEach((question) => {
    const code = String(question.answerText || "").match(/\d{4}/)?.[0] || "其他";
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(question);
  });
  return [...groups.entries()]
    .filter(([, questions]) => questions.some((question) => matchedQuestionIds.has(question.id)))
    .sort(([left], [right]) => left.localeCompare(right, "zh-CN", { numeric: true })).map(([code, questions]) => {
    const singles = questions.filter((q) => !String(q.answerText).includes("+") && !String(q.answerText).includes("*"));
    return {
      id: `merchant|${code}`,
      code,
      singleCode: singles[0]?.answerText || code,
      name: productNames.get(code) || questions[0]?.productName || `货号 ${code}`,
      singles,
      multiples: questions.filter((q) => !String(q.answerText).includes("+") && String(q.answerText).includes("*")),
      combos: questions.filter((q) => String(q.answerText).includes("+")),
      questions,
    };
  });
}

function merchantExample(question) {
  return `<div class="merchant-example-row"><span>${escapeHtml(question.productName || "组合")}</span><strong>${escapeHtml(question.answerText)}</strong></div>`;
}

function merchantExampleGroup(title, questions) {
  if (!questions.length) return "";
  return `<section class="merchant-example-group"><h5>${title}<small>${questions.length} 个</small></h5><div class="merchant-example-list">${questions.map(merchantExample).join("")}</div></section>`;
}

function renderMerchantLearning() {
  let entities = merchantLearningEntities();
  if (state.learnMode === "review") entities = entities.filter((item) => learningStatus(item.id) === "review");
  const { start, end } = renderLearningPagination(entities.length, state.learnMode === "compare" ? 30 : 16);
  const pageItems = entities.slice(start, end);
  els.learnCount.textContent = `${entities.length} 组编码`;
  if (!pageItems.length) {
    els.learnList.innerHTML = `<div class="empty">${state.learnMode === "review" ? "当前没有待复习的商家编码。" : "没有找到匹配的编码资料。"}</div>`;
    return;
  }
  const ruleStrip = `<div class="encoding-rule-strip"><div><span>单品</span><strong>年份N-JZ-货号</strong></div><div><span>多盒</span><strong>JZ-货号*数量</strong></div><div><span>组合</span><strong>JZ-货号*数量+其他货号</strong></div></div>`;
  if (state.learnMode === "compare") {
    els.learnList.innerHTML = `${ruleStrip}<div class="learning-table-wrap"><table class="learning-compare-table"><thead><tr><th>货号</th><th>产品</th><th>单品编码</th><th>多盒编码</th><th>组合编码</th></tr></thead><tbody>${pageItems.map((item) => `<tr><td><strong>${escapeHtml(item.code)}</strong></td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.singles.map((q) => q.answerText).join("；") || "--")}</td><td>${escapeHtml(item.multiples.map((q) => q.answerText).join("；") || "--")}</td><td>${escapeHtml(item.combos.map((q) => q.answerText).join("；") || "--")}</td></tr>`).join("")}</tbody></table></div>`;
  } else if (state.learnMode === "flash") {
    els.learnList.innerHTML = `${ruleStrip}<div class="memory-flash-grid">${pageItems.map((item) => `<article class="memory-flash-card"><div class="flash-front"><span>在售货号</span><strong>${escapeHtml(item.code)}</strong><h4>${escapeHtml(item.name)}</h4></div><div class="flash-back"><div class="merchant-examples">${merchantExampleGroup("单品编码", item.singles)}${merchantExampleGroup("多盒编码", item.multiples)}${merchantExampleGroup("组合编码", item.combos)}</div>${learningActionButtons(item.id)}</div><button type="button" class="flash-reveal-btn" data-reveal-card>查看全部编码</button></article>`).join("")}</div>`;
  } else {
    els.learnList.innerHTML = `${ruleStrip}<div class="merchant-learning-grid">${pageItems.map((item) => `<article class="merchant-knowledge-card"><div class="merchant-card-head"><div><span>商品编码</span><strong>${escapeHtml(item.singleCode)}</strong></div><h4><small>货号 ${escapeHtml(item.code)}</small>${escapeHtml(item.name)}</h4></div><div class="merchant-examples">${merchantExampleGroup("单品编码", item.singles)}${merchantExampleGroup("多盒编码", item.multiples)}${merchantExampleGroup("组合编码", item.combos)}</div>${learningActionButtons(item.id)}</article>`).join("")}</div>`;
  }
  bindLearningInteractions();
}

function learningScenario(question) {
  return String(question.question || "").replace(/[？?]$/, "");
}

function normalizeRuleLearningItems(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeRuleSourceReferences(questions) {
  const references = [];
  const seen = new Set();
  const append = (raw, fallbackSection = "") => {
    const source = typeof raw === "string"
      ? { url: raw.trim(), section: fallbackSection }
      : {
          url: String(raw?.url || raw?.sourceUrl || "").trim(),
          section: String(raw?.section || raw?.sourceSection || fallbackSection || "").trim(),
        };
    if (!source.url || seen.has(source.url)) return;
    seen.add(source.url);
    references.push(source);
  };
  questions.forEach((question) => {
    const rawReferences = Array.isArray(question.sourceReferences) ? question.sourceReferences : [];
    rawReferences.forEach((reference) => append(reference, question.sourceSection));
    if (!rawReferences.length && question.sourceUrl) append(question.sourceUrl, question.sourceSection);
  });
  return references;
}

function firstRuleLearningField(questions, field) {
  for (const question of questions) {
    const value = question[field];
    if (Array.isArray(value) ? value.length : String(value ?? "").trim()) return value;
  }
  return undefined;
}

function ruleQuestionMistakes(question) {
  return "ABCD".split("")
    .filter((letter) => letter !== question.answer)
    .map((letter) => question[`option${letter}`])
    .filter(Boolean);
}

function buildRuleLearningEntity(questions, knowledgeId = "") {
  const question = questions[0];
  const explicitMistakes = normalizeRuleLearningItems(firstRuleLearningField(questions, "commonMistakes"));
  const fallbackMistakes = [...new Set(questions.flatMap(ruleQuestionMistakes))].slice(0, 2);
  return {
    id: knowledgeId ? `rule|knowledge|${knowledgeId}` : `rule|${question.id}`,
    knowledgeId,
    questions,
    question,
    questionCount: questions.length,
    title: firstRuleLearningField(questions, "knowledgeTitle") || question.code || question.knowledgePoint || question.module || question.bank,
    scenario: firstRuleLearningField(questions, "learningScenario") || learningScenario(question),
    action: firstRuleLearningField(questions, "standardAction") || question.answerText,
    reason: firstRuleLearningField(questions, "explanation") || question.explanation,
    entryPath: normalizeRuleLearningItems(firstRuleLearningField(questions, "entryPath")),
    prerequisites: normalizeRuleLearningItems(firstRuleLearningField(questions, "prerequisites")),
    steps: normalizeRuleLearningItems(firstRuleLearningField(questions, "steps")),
    successChecks: normalizeRuleLearningItems(firstRuleLearningField(questions, "successChecks")),
    exceptions: normalizeRuleLearningItems(firstRuleLearningField(questions, "exceptions")),
    mistakes: explicitMistakes.length ? explicitMistakes : fallbackMistakes,
    sources: normalizeRuleSourceReferences(questions),
    riskLevel: questions.some((item) => item.riskLevel === "redline") ? "redline" : question.riskLevel,
  };
}

function ruleLearningEntities() {
  const knowledgeBuckets = new Map();
  state.filtered.forEach((question) => {
    const knowledgeId = String(question.knowledgeId || "").trim();
    const key = knowledgeId ? `knowledge|${knowledgeId}` : `question|${question.id}`;
    if (!knowledgeBuckets.has(key)) knowledgeBuckets.set(key, { knowledgeId, questions: [] });
    knowledgeBuckets.get(key).questions.push(question);
  });
  return [...knowledgeBuckets.values()].map(({ knowledgeId, questions }) => buildRuleLearningEntity(questions, knowledgeId));
}

function renderRuleLearningBlock(label, values, variant = "", ordered = false) {
  if (!values.length) return "";
  const content = ordered
    ? values.map((value, index) => `${index + 1}. ${escapeHtml(value)}`).join("<br>")
    : values.map((value) => escapeHtml(value)).join("；");
  return `<div class="rule-knowledge-block${variant ? ` ${variant}` : ""}"><span>${label}</span><p>${content}</p></div>`;
}

function renderRuleSourceReferences(sources) {
  if (!sources.length) return "";
  const content = sources.map((source, index) => {
    const label = source.section || `资料来源 ${index + 1}`;
    if (/^https?:\/\//i.test(source.url)) {
      return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    }
    return `<span>${escapeHtml(label)}</span>`;
  }).join("；");
  return `<div class="rule-knowledge-block"><span>资料来源</span><p>${content}</p></div>`;
}

function renderRuleOperationalBlocks(item) {
  return `${item.entryPath.length ? renderRuleLearningBlock("入口路径", [item.entryPath.join(" → ")], "key") : ""}
    ${renderRuleLearningBlock("前置条件", item.prerequisites)}
    ${renderRuleLearningBlock("操作步骤", item.steps, "key", true)}
    ${renderRuleLearningBlock("完成标志", item.successChecks)}
    ${renderRuleLearningBlock("异常处理", item.exceptions, "warning", true)}
    ${renderRuleSourceReferences(item.sources)}`;
}

function renderRuleLearning() {
  let entities = ruleLearningEntities();
  if (state.learnMode === "review") entities = entities.filter((item) => learningStatus(item.id) === "review");
  const { start, end } = renderLearningPagination(entities.length, state.learnMode === "compare" ? 30 : 18);
  const pageItems = entities.slice(start, end);
  els.learnCount.textContent = `${entities.length} 个知识点`;
  if (!pageItems.length) {
    els.learnList.innerHTML = `<div class="empty">${state.learnMode === "review" ? "当前分类没有待复习内容。" : "没有找到匹配的学习内容。"}</div>`;
    return;
  }
  if (state.learnMode === "compare") {
    els.learnList.innerHTML = `<div class="learning-table-wrap"><table class="learning-compare-table"><thead><tr><th>模块</th><th>工作场景</th><th>入口路径</th><th>标准动作</th><th>完成标志</th><th>记忆原因</th></tr></thead><tbody>${pageItems.map((item) => `<tr><td>${escapeHtml(item.question.knowledgePoint || item.question.module)}</td><td>${escapeHtml(item.scenario)}</td><td>${escapeHtml(item.entryPath.join(" → ") || "--")}</td><td>${escapeHtml(item.action)}</td><td>${escapeHtml(item.successChecks.join("；") || "--")}</td><td>${escapeHtml(item.reason)}</td></tr>`).join("")}</tbody></table></div>`;
  } else if (state.learnMode === "flash") {
    els.learnList.innerHTML = `<div class="memory-flash-grid">${pageItems.map((item) => `<article class="memory-flash-card"><div class="flash-front"><span>${escapeHtml(item.question.bank)}</span><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.scenario)}</p></div><div class="flash-back"><div class="rule-knowledge-block key"><span>标准动作</span><p>${escapeHtml(item.action)}</p></div>${renderRuleOperationalBlocks(item)}${item.mistakes.length ? renderRuleLearningBlock("常见误区", item.mistakes, "warning") : ""}<small>${escapeHtml(item.reason)}</small>${learningActionButtons(item.id)}</div><button type="button" class="flash-reveal-btn" data-reveal-card>查看要点</button></article>`).join("")}</div>`;
  } else {
    els.learnList.innerHTML = `<div class="rule-learning-grid">${pageItems.map((item) => `<article class="rule-knowledge-card"><div class="meta"><span>${escapeHtml(item.question.bank)}</span><span>${escapeHtml(item.question.knowledgePoint || item.question.module)}</span>${item.riskLevel === "redline" ? "<span class=\"redline-tag\">红线</span>" : ""}${item.questionCount > 1 ? `<span>${item.questionCount} 道关联题</span>` : ""}</div><h4>${escapeHtml(item.title)}</h4><div class="rule-knowledge-block"><span>工作场景</span><p>${escapeHtml(item.scenario)}</p></div><div class="rule-knowledge-block key"><span>标准动作</span><p>${escapeHtml(item.action)}</p></div>${renderRuleOperationalBlocks(item)}<div class="rule-knowledge-block"><span>为什么</span><p>${escapeHtml(item.reason)}</p></div>${item.mistakes.length ? renderRuleLearningBlock("常见误区", item.mistakes, "warning") : ""}${learningActionButtons(item.id)}</article>`).join("")}</div>`;
  }
  bindLearningInteractions();
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
        <img src="${imagePath(question.questionImage)}" alt="题目图片" loading="eager" decoding="async" fetchpriority="high" />
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
                  <img src="${imagePath(img)}" alt="选项${letter}图片" loading="eager" decoding="async" fetchpriority="high" />
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
  preloadQuizImages();
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
    if (state.examLabelOverride === "错题重练") advanceMistakeReview(question);
  } else if (correct === false) {
    state.quizWrong += 1;
    state.wrongDetails.push({ ...question, selected: letter, savedAt: new Date().toISOString() });
    if (state.examType === "practice") {
      saveMistake(question, letter);
      updateWrongCount();
    }
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
  const savedAt = new Date().toISOString();
  const item = { ...question, selected, savedAt, reviewStage: 0, nextReviewAt: savedAt, lastReviewedAt: "" };
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
  if (state.examSubmitting) return;
  clearAutoNextTimer();
  stopTimer();
  let practiceSyncSuccess = false;
  let practiceSyncError = "";
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
    state.examSubmitting = true;
    document.body.classList.add("exam-submitting");
    if (els.examSubmitStatus) els.examSubmitStatus.textContent = "正在同步练习成绩，请勿关闭页面……";
    try {
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
      const practiceResult = await syncLater("practice-submit", {
        submissionId: state.submissionId || crypto.randomUUID(),
        practiceName: "金尊知识库练习",
        practiceType: state.examType === "redline" ? "红线规则练习" : "练习模式",
        bank: examLabel(),
        total: state.quiz.length,
        correct: state.score,
        wrong: state.quizWrong,
        duration: timerSeconds,
      });
      practiceSyncSuccess = Boolean(practiceResult?.record_id);
      practiceSyncError = practiceResult?.error || "";
    } finally {
      state.examSubmitting = false;
      document.body.classList.remove("exam-submitting");
      if (els.examSubmitStatus) els.examSubmitStatus.textContent = "";
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
    ? `<p class="exam-sync-success" role="status">正式考试已同步到飞书</p>`
    : state.examType !== "formal" && practiceSyncSuccess
      ? `<p class="exam-sync-success" role="status">练习成绩已同步到飞书练习表</p>`
      : state.examType !== "formal" && practiceSyncError
        ? `<p class="exam-sync-error" role="alert">练习成绩暂存在本机，页面刷新后会自动补传到飞书。</p>`
        : "";
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
    ${examSyncSuccess}
    <p class="eyebrow">Result · ${escapeHtml(examLabel())} · ${state.examType === "formal" ? "正式考试" : "练习模式"}</p>
    <h3>${percent} 分</h3>
    ${timerExpired ? `<p class="explain result-wrong">时间到，已自动交卷。</p>` : ""}
    <div class="result-meta">
      <span>✓ 答对 ${state.score} 题</span>
      <span class="${state.quizWrong > 0 ? "result-wrong" : ""}">✗ 答错 ${state.quizWrong} 题</span>
      <span>⏱ 用时 ${timeStr}</span>
      <span>${percent >= passMark ? "已通过" : state.examType === "redline" ? "红线模块未通过" : "未通过"}</span>
    </div>
    <p class="explain">${state.examType === "redline" && percent < 100 ? "红线题错1题即未通过，请先复习错题后重新学习。" : percent >= 90 ? "表现很稳，可以进入下一组题库。" : percent >= 80 ? "已达到合格线，建议继续重练错题冲刺优秀。" : "建议先复习错题，再重新考一次。"}</p>
    ${wrongReview}
    <div class="result-actions">
      <button class="primary-btn" id="retryQuizBtn">重新考核</button>
      <button class="secondary-btn" id="backToQuizSetupBtn">返回选择题目</button>
      <button class="secondary-btn" id="reviewMistakesBtn">查看错题</button>
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
  const dueMistakes = mistakes.filter((question) => isMistakeDue(question));
  const scheduledMistakes = mistakes.filter((question) => !isMistakeDue(question));
  els.retryMistakesBtn.disabled = !dueMistakes.length;
  els.retryMistakesBtn.textContent = dueMistakes.length ? `重练今日错题（${dueMistakes.length}）` : "今日复习已完成";
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
      <strong>今日待复习 ${dueMistakes.length} 道</strong>
      <span class="review-plan-count">已排程 ${scheduledMistakes.length} 道</span>
      <div>${topTags}</div>
    </div>
    ${[...dueMistakes, ...scheduledMistakes]
      .map(
        (question) => `
          <article class="learn-item ${isMistakeDue(question) ? "due-review" : "scheduled-review"}">
            <div>
              <div class="meta">
                <span>${escapeHtml(question.bank)}</span>
                <span>${escapeHtml(question.knowledgePoint)}</span>
                <span>错选：${escapeHtml(question.selected)}</span>
                <span class="review-schedule">${isMistakeDue(question) ? "今日到期" : `下次复习 ${reviewDateLabel(question.nextReviewAt)}`} · 第 ${mistakeReviewStage(question) + 1} 轮</span>
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
  const mistakes = storage.mistakes.filter((question) => isMistakeDue(question));
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

async function loadRanking() {
  if (!state.currentUser || state.rankingLoading) return;
  state.rankingLoading = true;
  state.rankingError = "";
  renderRanking();
  try {
    const data = await cloudRequest("ranking", {});
    state.companyRanking = Array.isArray(data.ranking) ? data.ranking : [];
    state.ownFormalHistory = Array.isArray(data.ownHistory) ? data.ownHistory : [];
  } catch (error) {
    state.rankingError = error.message || "公司正式考试记录暂时无法读取";
  } finally {
    state.rankingLoading = false;
    renderRanking();
  }
}

function renderRanking() {
  const listEl = document.querySelector("#rankingList");
  if (!listEl) return;
  const rows = [...state.companyRanking];
  rows.sort((a, b) => rankSortMode === "time"
    ? (Number(a.duration ?? 99999) - Number(b.duration ?? 99999)) || (Number(b.percent) - Number(a.percent))
    : (Number(b.percent) - Number(a.percent)) || (Number(a.duration ?? 99999) - Number(b.duration ?? 99999)));
  const localPractice = storage.examRecords.filter((record) => record.type !== "正式考试");
  const rankingRows = state.rankingLoading
    ? `<div class="empty">正在读取公司正式考试记录...</div>`
    : state.rankingError
      ? `<div class="empty">${escapeHtml(state.rankingError)}</div>`
      : rows.length ? rows.map((row, i) => `
    <div class="rank-row${i < 3 ? " rank-top" : ""}">
      <div class="rank-num${i === 0 ? " rank-gold" : i === 1 ? " rank-silver" : i === 2 ? " rank-bronze" : ""}">${i + 1}</div>
      <div class="rank-info">
        <strong>${escapeHtml(row.name)}</strong>
        <span>${escapeHtml(row.role)} · 正式考试 ${Number(row.totalExams || 0)} 次</span>
      </div>
      <div class="rank-mid">
        <span class="rank-bank">${escapeHtml(row.bank || "")}</span>
        <span class="rank-detail-time">${row.duration != null ? formatTime(Number(row.duration)) : ""}</span>
      </div>
      <div class="rank-score${Number(row.percent) >= 90 ? " rank-score-high" : ""}">${Number(row.percent || 0)}<small>分</small></div>
    </div>
  `).join("") : `<div class="empty">还没有公司正式考试记录。</div>`;
  const historyRows = state.ownFormalHistory.length
    ? state.ownFormalHistory.map((record) => `<div class="history-row"><strong>${Number(record.percent || 0)}分</strong><span>${escapeHtml(record.bank || "正式考试")}</span><span>${Number(record.total || 0)}题 · ${formatTime(Number(record.duration || 0))}</span><time>${escapeHtml(record.finishedAt || "")}</time></div>`).join("")
    : `<div class="empty">你还没有正式考试记录。</div>`;
  const practiceRows = localPractice.length
    ? localPractice.slice(0, 30).map((record) => `<div class="history-row"><strong>${Number(record.percent || 0)}分</strong><span>${escapeHtml(record.bank || "练习模式")}</span><span>${Number(record.total || 0)}题 · ${formatTime(Number(record.duration || 0))}</span><time>${escapeHtml(examTimeLabel(record.finishedAt))}</time></div>`).join("")
    : `<div class="empty">当前设备还没有练习记录。</div>`;

  listEl.innerHTML = `
    <section class="ranking-section"><div class="ranking-section-head"><div><h4>公司正式考试排行榜</h4><p>来自公司账号系统，仅统计正式考试。</p></div><div class="rank-sort-btns"><button class="rank-sort-btn" data-sort="score">按分数</button><button class="rank-sort-btn" data-sort="time">按用时</button></div></div>${rankingRows}</section>
    <section class="ranking-section"><div class="ranking-section-head"><div><h4>我的正式考试历史</h4><p>来自公司账号系统，换设备后仍可查看。</p></div></div><div class="history-list">${historyRows}</div></section>
    <section class="ranking-section"><div class="ranking-section-head"><div><h4>本机练习记录</h4><p>仅保存在当前设备浏览器，不计入公司排名。</p></div></div><div class="history-list">${practiceRows}</div></section>`;

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
        <div><strong>${escapeHtml(employee.name)}${employee.isAdmin ? " · 管理员" : ""}</strong><small>${escapeHtml(employee.phone)} · ${escapeHtml(employee.role)} · ${escapeHtml(employee.status)} · 最近登录 ${escapeHtml(employee.lastLoginAt || "暂无")}</small></div>
        <div class="admin-employee-actions">
          <button class="secondary-btn admin-password-btn" type="button" data-phone="${escapeHtml(employee.phone)}">修改密码</button>
          ${String(employee.phone) === String(state.currentUser?.phone)
            ? '<button class="secondary-btn" type="button" disabled>当前账号</button>'
            : `<button class="danger-btn admin-delete-btn" type="button" data-phone="${escapeHtml(employee.phone)}">删除员工</button>`}
        </div>
      </div>
    `).join("") || '<div class="empty">暂无员工账号。</div>';
  } catch (error) {
    if (els.adminAccountStatus) els.adminAccountStatus.textContent = error.message || "员工账号读取失败";
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
    els.adminAccountStatus.textContent = "员工账号已添加";
    await refreshAdminEmployees();
  } catch (error) {
    els.adminAccountStatus.textContent = error.message || "添加员工失败";
  } finally {
    button.disabled = false;
  }
}

async function handleAdminEmployeeAction(event) {
  const button = event.target.closest("[data-phone]");
  if (!button) return;
  const phone = button.dataset.phone;
  if (button.classList.contains("admin-delete-btn")) {
    if (!window.confirm(`确定删除员工账号 ${phone} 吗？删除后该员工需要重新注册。`)) return;
    try {
      await cloudRequest("admin-delete", { phone });
      els.adminAccountStatus.textContent = "员工账号已删除";
      await refreshAdminEmployees();
    } catch (error) {
      els.adminAccountStatus.textContent = error.message || "删除员工失败";
    }
    return;
  }
  const password = window.prompt("请输入新密码（至少8位，包含字母和数字）", "");
  if (!password) return;
  try {
    await cloudRequest("admin-password", { phone, password });
    els.adminAccountStatus.textContent = "员工密码已修改";
  } catch (error) {
    els.adminAccountStatus.textContent = error.message || "修改密码失败";
  }
}

function renderAdminQuestions() {
  if (!isAdminUser() || !els.adminQuestionList) return;
  const questions = allManagedQuestions();
  const banks = [...new Set(questions.map((question) => question.bank).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const selectedBank = els.adminQuestionBank.value;
  els.adminQuestionBank.innerHTML = `<option value="">全部题库</option>${banks.map((bank) => `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}</option>`).join("")}`;
  if (banks.includes(selectedBank)) els.adminQuestionBank.value = selectedBank;
  const keyword = String(els.adminQuestionSearch.value || "").trim().toLowerCase();
  const status = els.adminQuestionStatus.value || "active";
  const filtered = questions.filter((question) => {
    if (els.adminQuestionBank.value && question.bank !== els.adminQuestionBank.value) return false;
    if (status === "active" && question._changeStatus === "deleted") return false;
    if (status === "changed" && question._changeStatus !== "active") return false;
    if (status === "deleted" && question._changeStatus !== "deleted") return false;
    if (keyword) {
      const haystack = [question.id, question.bank, question.code, question.knowledgePoint, question.question,
        question.optionA, question.optionB, question.optionC, question.optionD].join(" ").toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
  const pageSize = 40;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.adminQuestionPage = Math.min(Math.max(1, state.adminQuestionPage), pages);
  const rows = filtered.slice((state.adminQuestionPage - 1) * pageSize, state.adminQuestionPage * pageSize);
  els.adminQuestionCount.textContent = `${filtered.length} 题`;
  els.adminQuestionList.innerHTML = rows.length ? `
    <table><thead><tr><th>ID / 货号</th><th>题库 / 知识点</th><th>题目</th><th>答案</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${rows.map((question) => `<tr class="${question._changeStatus === "deleted" ? "question-deleted" : ""}">
        <td><strong>${escapeHtml(question.id)}</strong><small>${escapeHtml(question.code || "--")}</small></td>
        <td>${escapeHtml(question.bank || "--")}<small>${escapeHtml(question.knowledgePoint || "--")}</small></td>
        <td class="admin-question-text">${escapeHtml(question.question)}</td>
        <td><strong>${escapeHtml(question.answer)}</strong><small>${escapeHtml(question[`option${question.answer}`] || "")}</small></td>
        <td>${question._changeStatus === "deleted" ? '<span class="status-badge deleted">已删除</span>' : question._changeStatus === "active" ? '<span class="status-badge changed">已修改</span>' : '<span class="status-badge">原始</span>'}</td>
        <td><div class="admin-question-actions">${question._changeStatus === "deleted"
          ? `<button class="secondary-btn admin-question-restore" type="button" data-question-id="${escapeHtml(question.id)}">恢复</button>`
          : `<button class="secondary-btn admin-question-edit" type="button" data-question-id="${escapeHtml(question.id)}">修改</button><button class="danger-btn admin-question-delete" type="button" data-question-id="${escapeHtml(question.id)}">删除</button>`}</div></td>
      </tr>`).join("")}
    </tbody></table>` : `<div class="empty">没有符合条件的题目。</div>`;
  els.adminQuestionPagination.innerHTML = pages > 1 ? `
    <button type="button" data-question-page="${state.adminQuestionPage - 1}" ${state.adminQuestionPage <= 1 ? "disabled" : ""}>上一页</button>
    <span>第 ${state.adminQuestionPage} / ${pages} 页</span>
    <button type="button" data-question-page="${state.adminQuestionPage + 1}" ${state.adminQuestionPage >= pages ? "disabled" : ""}>下一页</button>` : "";
}

function openAdminQuestionEditor(id) {
  const question = allManagedQuestions().find((item) => String(item.id) === String(id));
  if (!question || question._changeStatus === "deleted") return;
  els.adminQuestionId.value = question.id;
  els.adminEditBank.value = question.bank || "";
  els.adminEditCode.value = question.code || "";
  els.adminEditKnowledgePoint.value = question.knowledgePoint || "";
  els.adminEditQuestion.value = question.question || "";
  els.adminEditOptionA.value = question.optionA || "";
  els.adminEditOptionB.value = question.optionB || "";
  els.adminEditOptionC.value = question.optionC || "";
  els.adminEditOptionD.value = question.optionD || "";
  els.adminEditAnswer.value = question.answer || "A";
  els.adminEditExplanation.value = question.explanation || "";
  if (typeof els.adminQuestionDialog.showModal === "function") els.adminQuestionDialog.showModal();
  else els.adminQuestionDialog.setAttribute("open", "");
}

function closeAdminQuestionEditor() {
  if (typeof els.adminQuestionDialog.close === "function") els.adminQuestionDialog.close();
  else els.adminQuestionDialog.removeAttribute("open");
}

async function refreshQuestionsAfterAdminChange(message) {
  await loadQuestionChanges();
  reconcileStoredQuestions();
  renderBankSelect();
  renderQuizSetup();
  els.adminQuestionMessage.textContent = message;
  renderAll();
}

async function saveAdminQuestion(event) {
  event.preventDefault();
  const button = els.adminQuestionForm.querySelector('button[type="submit"]');
  button.disabled = true;
  els.adminQuestionMessage.textContent = "";
  try {
    await cloudRequest("admin-questions", {
      operation: "update",
      id: els.adminQuestionId.value,
      question: {
        bank: els.adminEditBank.value,
        code: els.adminEditCode.value,
        knowledgePoint: els.adminEditKnowledgePoint.value,
        question: els.adminEditQuestion.value,
        optionA: els.adminEditOptionA.value,
        optionB: els.adminEditOptionB.value,
        optionC: els.adminEditOptionC.value,
        optionD: els.adminEditOptionD.value,
        answer: els.adminEditAnswer.value,
        explanation: els.adminEditExplanation.value,
      },
    });
    closeAdminQuestionEditor();
    await refreshQuestionsAfterAdminChange("题目已修改，学习、练习和正式考试已同步更新。");
  } catch (error) {
    els.adminQuestionMessage.textContent = error.message || "题目修改失败";
  } finally {
    button.disabled = false;
  }
}

async function handleAdminQuestionAction(event) {
  const pageButton = event.target.closest("[data-question-page]");
  if (pageButton && !pageButton.disabled) {
    state.adminQuestionPage = Number(pageButton.dataset.questionPage) || 1;
    renderAdminQuestions();
    return;
  }
  const button = event.target.closest("[data-question-id]");
  if (!button) return;
  const id = button.dataset.questionId;
  if (button.classList.contains("admin-question-edit")) return openAdminQuestionEditor(id);
  const restore = button.classList.contains("admin-question-restore");
  if (!restore && !window.confirm("确定删除这道题吗？删除后不再出现在学习、练习和正式考试中。")) return;
  button.disabled = true;
  try {
    await cloudRequest("admin-questions", { operation: restore ? "restore" : "delete", id });
    await refreshQuestionsAfterAdminChange(restore ? "题目已恢复。" : "题目已删除。");
  } catch (error) {
    els.adminQuestionMessage.textContent = error.message || (restore ? "恢复失败" : "删除失败");
    button.disabled = false;
  }
}

function renderAdmin() {
  if (!isAdminUser()) {
    els.adminDataWarning?.classList.add("hidden");
    els.adminMetrics.innerHTML = `<div class="empty">无权限访问管理看板。</div>`;
    els.adminUserTable.innerHTML = "";
    els.adminWeakList.innerHTML = "";
    if (els.adminPracticeList) els.adminPracticeList.innerHTML = "";
    if (els.adminQuestionList) els.adminQuestionList.innerHTML = "";
    return;
  }
  renderAdminQuestions();
  const cloud = state.cloudStats;
  const errors = Array.isArray(cloud?.errors) ? cloud.errors : [];
  if (els.adminDataWarning) {
    els.adminDataWarning.classList.toggle("hidden", !errors.length);
    els.adminDataWarning.textContent = errors.length
      ? "部分飞书数据读取失败，本页统计可能不完整，请勿直接用于考核结论。"
      : "";
  }
  const users = cloud?.employees?.length
    ? cloud.employees.map((u) => ({ name: u["姓名"], phone: u["手机号"], role: u["岗位"], lastLoginAt: u["最后登录时间"] }))
    : Object.values(userStore.users);
  const rows = users.map((user) => {
    const records = Array.isArray(cloud?.exams)
      ? cloud.exams.filter((r) => String(r["手机号"]) === String(user.phone) && String(r["考核类型"] || "") === "正式考试").map((r) => ({
          percent: Number(r["分数"] || 0), score: Number(r["答对数"] || 0), total: Number(r["总题数"] || 0),
          wrong: Number(r["答错数"] || 0), duration: Number(r["用时秒数"] || 0), bank: r["题库"], type: r["考核类型"], finishedAt: r["提交时间"],
        })).sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime())
      : getUserRecords(user.phone).filter((r) => r.type === "正式考试");
    records.sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime());
    const practices = Array.isArray(cloud?.practices)
      ? cloud.practices.filter((r) => String(r["手机号"]) === String(user.phone)).map((r) => ({
          percent: Number(r["分数"] || 0), score: Number(r["答对数"] || 0), total: Number(r["总题数"] || 0),
          wrong: Number(r["答错数"] || 0), duration: Number(r["用时秒数"] || 0), bank: r["题库"], type: r["练习类型"], finishedAt: r["提交时间"],
        })).sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime())
      : getUserRecords(user.phone).filter((r) => r.type !== "正式考试");
    practices.sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime());
    const mistakes = Array.isArray(cloud?.mistakes)
      ? cloud.mistakes.filter((r) => String(r["手机号"]) === String(user.phone)).map((r) => ({ knowledgePoint: r["知识点"], bank: r["题库"] }))
      : getUserMistakes(user.phone);
    const best = records.reduce((acc, record) => (Number(record.percent) > Number(acc?.percent || -1) ? record : acc), null);
    const latest = records[0];
    const latestPractice = practices[0];
    const practiceQuestions = practices.reduce((sum, record) => sum + Number(record.total || 0), 0);
    const practiceAverage = practices.length
      ? Math.round(practices.reduce((sum, record) => sum + Number(record.percent || 0), 0) / practices.length)
      : 0;
    return { user, records, practices, mistakes, best, latest, latestPractice, practiceQuestions, practiceAverage };
  });
  const allRecords = rows.flatMap((row) => row.records.map((record) => ({ ...record, user: row.user })));
  const allPractices = rows.flatMap((row) => row.practices.map((record) => ({ ...record, user: row.user })));
  const avg = allRecords.length ? Math.round(allRecords.reduce((sum, r) => sum + Number(r.percent || 0), 0) / allRecords.length) : 0;
  const passed = allRecords.filter((r) => Number(r.percent) >= 80).length;
  const passRate = allRecords.length ? Math.round((passed / allRecords.length) * 100) : 0;
  const notExam = rows.filter((row) => !row.records.length).length;
  const practicedEmployees = rows.filter((row) => row.practices.length).length;
  const practiceQuestions = allPractices.reduce((sum, record) => sum + Number(record.total || 0), 0);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activePracticeEmployees = rows.filter((row) => row.practices.some((record) => new Date(record.finishedAt || 0).getTime() >= sevenDaysAgo)).length;

  els.adminMetrics.innerHTML = `
    <div class="summary-card"><span>员工数</span><strong>${users.length}</strong><small>${cloud?.employees?.length ? "飞书云端数据" : "本机已登录账号"}</small></div>
    <div class="summary-card"><span>有练习员工</span><strong>${practicedEmployees}/${users.length}</strong><small>近7天活跃 ${activePracticeEmployees} 人</small></div>
    <div class="summary-card"><span>练习总次数</span><strong>${allPractices.length}</strong><small>累计完成 ${practiceQuestions} 题</small></div>
    <div class="summary-card"><span>正式考试次数</span><strong>${allRecords.length}</strong><small>仅用于员工考核</small></div>
    <div class="summary-card"><span>正式考试平均分</span><strong>${avg}</strong><small>练习数据不计入</small></div>
    <div class="summary-card"><span>正式考试通过率</span><strong>${passRate}%</strong><small>未参加正式考试 ${notExam} 人</small></div>
  `;

  els.adminUserTable.innerHTML = rows.length ? `
    <table>
      <thead><tr><th>姓名</th><th>岗位</th><th>最近登录</th><th>练习次数</th><th>练习题数</th><th>练习均分</th><th>最近练习</th><th>正式次数</th><th>正式最佳</th><th>最近考试</th><th>错题</th></tr></thead>
      <tbody>
        ${rows.map(({ user, records, practices, mistakes, best, latest, latestPractice, practiceQuestions: totalPracticeQuestions, practiceAverage }) => `
          <tr>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.role)}</td>
            <td>${user.lastLoginAt ? escapeHtml(examTimeLabel(user.lastLoginAt)) : "--"}</td>
            <td><strong>${practices.length}</strong></td>
            <td>${totalPracticeQuestions}</td>
            <td>${practices.length ? `${practiceAverage}分` : "--"}</td>
            <td>${latestPractice ? `${latestPractice.percent}分 · ${examTimeLabel(latestPractice.finishedAt)}` : "从未练习"}</td>
            <td>${records.length}</td>
            <td>${best ? `${best.percent}分` : "未考"}</td>
            <td>${latest ? `${latest.percent}分 · ${examTimeLabel(latest.finishedAt)}` : "--"}</td>
            <td>${mistakes.length}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : `<div class="empty">暂无员工记录。</div>`;

  if (els.adminPracticeList) {
    const latestPractices = [...allPractices]
      .sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime())
      .slice(0, 50);
    els.adminPracticeList.innerHTML = latestPractices.length ? `
      <table><thead><tr><th>员工</th><th>岗位</th><th>题库</th><th>分数</th><th>答题数</th><th>用时</th><th>练习时间</th></tr></thead><tbody>
        ${latestPractices.map((record) => `<tr><td>${escapeHtml(record.user.name)}</td><td>${escapeHtml(record.user.role)}</td><td>${escapeHtml(record.bank || "综合题库")}</td><td><strong>${Number(record.percent || 0)}分</strong></td><td>${Number(record.total || 0)}题</td><td>${formatTime(Number(record.duration || 0))}</td><td>${escapeHtml(examTimeLabel(record.finishedAt))}</td></tr>`).join("")}
      </tbody></table>
    ` : `<div class="empty">暂无云端练习记录。员工完成练习后会自动记录在“练习成绩记录”表。</div>`;
  }

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
    : Object.values(userStore.users).flatMap((user) => getUserRecords(user.phone).filter((record) => record.type === "正式考试").map((record) => ({
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

function exportPracticeRecords() {
  const rows = Array.isArray(state.cloudStats?.practices)
    ? state.cloudStats.practices.map((record) => ({
        姓名: record["姓名"], 手机号: record["手机号"], 岗位: record["岗位"], 练习名称: record["练习名称"],
        练习类型: record["练习类型"], 题库: record["题库"], 分数: record["分数"], 答对数: record["答对数"],
        总题数: record["总题数"], 答错数: record["答错数"], 是否达标: record["是否达标"],
        用时秒数: record["用时秒数"], 提交时间: record["提交时间"], 练习提交编号: record["练习提交编号"],
      }))
    : Object.values(userStore.users).flatMap((user) => getUserRecords(user.phone).filter((record) => record.type !== "正式考试").map((record) => ({
        姓名: user.name, 手机号: user.phone, 岗位: user.role, 练习名称: "金尊知识库练习", 练习类型: record.type || "练习模式",
        题库: record.bank, 分数: record.percent, 答对数: record.score, 总题数: record.total,
        答错数: record.wrong ?? Math.max(0, Number(record.total || 0) - Number(record.score || 0)),
        是否达标: Number(record.percent) >= (record.type === "红线规则" ? 100 : 80) ? "达标" : "未达标",
        用时秒数: record.duration, 提交时间: record.finishedAt, 练习提交编号: "本机记录",
      })));
  downloadText(`金尊练习记录_${todayKey()}.csv`, toCsv(["姓名", "手机号", "岗位", "练习名称", "练习类型", "题库", "分数", "答对数", "总题数", "答错数", "是否达标", "用时秒数", "提交时间", "练习提交编号"], rows));
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
  if (view === "ranking") loadRanking();
  if (view === "mistakes") renderMistakes();
  if (view === "admin") {
    renderAdmin();
    Promise.all([loadCloudStats(), refreshAdminEmployees(), loadQuestionChanges()]).then(() => {
      renderBankSelect();
      renderQuizSetup();
      renderAdmin();
    }).catch((error) => {
      if (els.adminQuestionMessage) els.adminQuestionMessage.textContent = error.message || "题库明细读取失败";
    });
  }
}

function renderAll() {
  renderStats();
  renderDashboard();
  renderLearnFilter();
  renderLearnList();
  renderMistakes();
  renderAdmin();
  if (state.currentView === "ranking") renderRanking();
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

function clearAuthenticationSession() {
  localStorage.removeItem("jz_auth_token");
  userStore.currentPhone = "";
  state.currentUser = null;
  applyAdminAccess();
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
  renderQuizSetup();
}

async function refreshAuthenticatedQuestions() {
  try {
    await loadQuestionChanges();
    reconcileStoredQuestions();
    renderBankSelect();
    renderQuizSetup();
  } catch (error) {
    setSyncStatus(`题库云端修改暂时无法读取：${error.message}`, "error");
  }
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
    clearAuthenticationSession();
    const data = await cloudRequest("login", { account, password, clientId: getClientId() });
    if (!data.token || !data.user) throw new Error("账号或密码错误");
    saveAuthenticatedUser(data);
    await refreshAuthenticatedQuestions();
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
    await refreshAuthenticatedQuestions();
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
    await refreshAuthenticatedQuestions();
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
  clearAuthenticationSession();
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
  els.exportPracticeRecordsBtn?.addEventListener("click", exportPracticeRecords);
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
      renderQuizSetup();
    });
  });
  els.learnModeTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-learn-mode]");
    if (!button) return;
    state.learnMode = button.dataset.learnMode;
    state.learnPage = 1;
    renderLearnFilter();
    renderLearnList();
  });
  [[els.ruleRoleFilter, "role"], [els.rulePlatformFilter, "platform"], [els.ruleRiskFilter, "riskLevel"], [els.ruleModuleFilter, "module"], [els.ruleSourceFilter, "sourceLevel"]].forEach(([element, key]) => {
    element?.addEventListener("change", () => {
      state.ruleFilters[key] = element.value;
      state.learnPage = 1;
      renderAll();
    });
  });
  els.examType?.addEventListener("change", renderQuizSetup);
  els.roleBankSelect?.addEventListener("change", updateQuizSetupAvailability);
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
  els.adminEmployeeForm?.addEventListener("submit", addAdminEmployee);
  els.adminEmployeeList?.addEventListener("click", handleAdminEmployeeAction);
  els.adminQuestionForm?.addEventListener("submit", saveAdminQuestion);
  els.adminQuestionList?.addEventListener("click", handleAdminQuestionAction);
  els.adminQuestionPagination?.addEventListener("click", handleAdminQuestionAction);
  [els.adminQuestionSearch, els.adminQuestionBank, els.adminQuestionStatus].forEach((control) => {
    control?.addEventListener(control === els.adminQuestionSearch ? "input" : "change", () => {
      state.adminQuestionPage = 1;
      renderAdminQuestions();
    });
  });
  els.adminQuestionDialogClose?.addEventListener("click", closeAdminQuestionEditor);
  els.adminQuestionCancel?.addEventListener("click", closeAdminQuestionEditor);
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
  els.installAppBtn?.addEventListener("click", handleAppInstallOrUpdate);
  els.checkAppUpdateBtn?.addEventListener("click", () => checkLatestVersion());
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
        if (session?.token && session?.user) {
          saveAuthenticatedUser(session);
          try {
            await loadQuestionChanges();
          } catch (error) {
            setSyncStatus(`题库云端修改暂时无法读取：${error.message}`, "error");
          }
        }
      } catch {
        clearAuthenticationSession();
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
    await registerInstallableApp();
    await checkLatestVersion({ silent: true });
    window.setInterval(() => checkLatestVersion({ silent: true }), 10 * 60 * 1000);
  } catch (error) {
    document.body.innerHTML = `<div class="empty">题库加载失败：${escapeHtml(error.message)}</div>`;
    throw error;
  }
}

init();

