const productUrl = "./outputs/product_quiz/金尊产品知识库题库.json";
const roleUrl = "./outputs/role_quiz/岗位学习考核题库.json";
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
  quizWrong: 0,
  currentUser: null,
};

const els = {
  navTabs: [...document.querySelectorAll(".nav-tab")],
  views: {
    dashboard: document.querySelector("#dashboardView"),
    ranking: document.querySelector("#rankingView"),
    learn: document.querySelector("#learnView"),
    quiz: document.querySelector("#quizView"),
    mistakes: document.querySelector("#mistakesView"),
  },
  pageTitle: document.querySelector("#pageTitle"),
  bankSelect: document.querySelector("#bankSelect"),
  bankCount: document.querySelector("#bankCount"),
  mistakeCount: document.querySelector("#mistakeCount"),
  accuracyText: document.querySelector("#accuracyText"),
  bankCards: document.querySelector("#bankCards"),
  learnFilter: document.querySelector("#learnFilter"),
  learnList: document.querySelector("#learnList"),
  learnCount: document.querySelector("#learnCount"),
  searchInput: document.querySelector("#searchInput"),
  resetBtn: document.querySelector("#resetBtn"),
  quizTimer: document.querySelector("#quizTimer"),
  quizWrongCount: document.querySelector("#quizWrongCount"),
  quizSetup: document.querySelector("#quizSetup"),
  quizRunner: document.querySelector("#quizRunner"),
  quizResult: document.querySelector("#quizResult"),
  startQuizBtn: document.querySelector("#startQuizBtn"),
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
  clearMistakesBtn: document.querySelector("#clearMistakesBtn"),
  authView: document.querySelector("#authView"),
  authForm: document.querySelector("#authForm"),
  authName: document.querySelector("#authName"),
  authPhone: document.querySelector("#authPhone"),
  authRole: document.querySelector("#authRole"),
  authError: document.querySelector("#authError"),
  userName: document.querySelector("#userName"),
  userMeta: document.querySelector("#userMeta"),
  logoutBtn: document.querySelector("#logoutBtn"),
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
    `<button class="slogan-dot${i === 0 ? " active" : ""}" data-i="${i}"></button>`
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
  quiz: "随机考核",
  mistakes: "错题复习",
};

const normalize = (value) => String(value ?? "").toLowerCase().trim();

// Strip product code from option text for quiz display.
// Only applied to 产品名称 questions where the code in the option text gives away the answer.
const stripCodeFromOption = (text, knowledgePoint) => {
  if (knowledgePoint !== "产品名称" || !text) return text;
  return text
    .replace(/^\d{4}/, "")          // "2421澳门八星..." → "澳门八星..."
    .replace(/【[^】]+】/g, "")     // "礼盒【0206】2盒装" → "礼盒2盒装"
    .trim();
};

const imagePath = (src) => (src ? `./${src}` : "");

const optionEntries = (question) => [
  ["A", question.optionA, question.optionAImage],
  ["B", question.optionB, question.optionBImage],
  ["C", question.optionC, question.optionCImage],
  ["D", question.optionD, question.optionDImage],
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

async function loadQuestions() {
  const [productRes, roleRes] = await Promise.all([fetch(productUrl), fetch(roleUrl)]);
  const [productQuestions, roleQuestions] = await Promise.all([productRes.json(), roleRes.json()]);
  state.allQuestions = [...productQuestions, ...roleQuestions].map((question) => ({
    ...question,
    role: question.role || question.category || "",
    module: question.module || question.productLine || "",
    source: question.source || "产品知识库",
    note: question.note || "",
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
      state.currentBank = card.dataset.bank;
      els.bankSelect.value = state.currentBank;
      switchView("learn");
      renderAll();
    });
  });
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
          ([letter, text, img]) => `
            <figure>
              <img src="${imagePath(img)}" alt="选项${letter}图片" loading="lazy" />
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
      state.currentBank = btn.dataset.bank;
      els.bankSelect.value = state.currentBank;
      renderAll();
    });
  });
}

function renderLearnList() {
  const items = state.filtered.slice(0, 180);
  els.learnCount.textContent = `${state.filtered.length} 道题${state.filtered.length > 180 ? "，当前显示前 180 道" : ""}`;
  if (!items.length) {
    els.learnList.innerHTML = `<div class="empty">没有找到匹配的题目。</div>`;
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
            <p class="answer-line">答案：${escapeHtml(question.answer)}｜${escapeHtml(question.answerText)}</p>
            <p class="explain">${escapeHtml(question.explanation)}</p>
            ${renderOptionImages(question)}
          </div>
          ${renderQuestionImages(question)}
        </article>
      `
    )
    .join("");
}

const PRODUCT_BANKS = ["月饼题库", "日常年货题库", "纸箱耗材题库"];

let timerInterval = null;
let timerSeconds = 0;

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function startTimer() {
  clearInterval(timerInterval);
  timerSeconds = 0;
  els.quizTimer.textContent = `⏱ 00:00`;
  timerInterval = setInterval(() => {
    timerSeconds += 1;
    els.quizTimer.textContent = `⏱ ${formatTime(timerSeconds)}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateWrongCount() {
  els.quizWrongCount.textContent = `✗ 错误 ${state.quizWrong} 题`;
  els.quizWrongCount.classList.toggle("has-wrong", state.quizWrong > 0);
}
const EXAM_SIZE = 50;

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

function startQuiz() {
  const size = Number(els.quizSize.value) || EXAM_SIZE;
  let pool;
  if (state.quizMode === "product") {
    const bank = els.productBankSelect.value;
    pool = state.allQuestions.filter((q) => q.bank === bank);
  } else if (state.quizMode === "role") {
    const bank = els.roleBankSelect.value;
    const roleQs = state.allQuestions.filter((q) => q.bank === bank);
    const needed = Math.max(0, size - roleQs.length);
    const productPool = shuffle(state.allQuestions.filter((q) => PRODUCT_BANKS.includes(q.bank)));
    pool = [...roleQs, ...productPool.slice(0, needed)];
  } else {
    pool = state.allQuestions;
  }
  state.quiz = shuffle(pool).slice(0, Math.min(size, pool.length));
  state.quizIndex = 0;
  state.score = 0;
  state.answered = false;
  state.quizWrong = 0;
  startTimer();
  updateWrongCount();
  els.quizSetup.classList.add("hidden");
  els.quizResult.classList.add("hidden");
  els.quizRunner.classList.remove("hidden");
  renderQuizCard();
}

function renderQuizCard() {
  const question = state.quiz[state.quizIndex];
  if (!question) {
    finishQuiz();
    return;
  }
  const progress = ((state.quizIndex + 1) / state.quiz.length) * 100;
  els.quizStep.textContent = `第 ${state.quizIndex + 1} 题`;
  els.quizScore.textContent = `${state.score} 分`;
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
      const isMooncake = question.questionImage.includes('/mooncake/');
      return `<div class="quiz-img-wrap${isMooncake ? ' quiz-img-crop-moon' : ''}">
        <img src="${imagePath(question.questionImage)}" alt="题目图片" />
      </div>`;
    })() : ""}
    <div class="options">
      ${options
        .map(
          ([letter, text, img]) => `
            <button class="option-btn" data-letter="${letter}">
              <strong>${letter}</strong>${escapeHtml(stripCodeFromOption(text, question.knowledgePoint))}
              ${img ? (() => {
                const isMooncake = img.includes('/mooncake/');
                return `<div class="quiz-opt-img${isMooncake ? ' quiz-img-crop-moon' : ''}">
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
  const correct = letter === question.answer;
  storage.attempts += 1;
  if (correct) {
    storage.correct += 1;
    state.score += 1;
  } else {
    state.quizWrong += 1;
    updateWrongCount();
    saveMistake(question, letter);
  }
  els.quizScore.textContent = `${state.score} 分`;
  els.quizCard.querySelectorAll(".option-btn").forEach((button) => {
    button.disabled = true;
    if (button.dataset.letter === question.answer) button.classList.add("correct");
    if (button.dataset.letter === letter && !correct) button.classList.add("wrong");
  });
  const feedback = document.querySelector("#feedback");
  feedback.classList.remove("hidden");
  feedback.innerHTML = `
    <strong>${correct ? "回答正确" : "回答错误"}</strong>
    <p class="explain">正确答案：${escapeHtml(question.answer)}｜${escapeHtml(question.answerText)}</p>
    <p class="explain">${escapeHtml(question.explanation)}</p>
    <button class="primary-btn next-btn" id="nextQuestionBtn">${state.quizIndex + 1 === state.quiz.length ? "查看成绩" : "下一题"}</button>
  `;
  document.querySelector("#nextQuestionBtn").addEventListener("click", () => {
    state.quizIndex += 1;
    state.answered = false;
    renderQuizCard();
    renderStats();
  });
}

function saveMistake(question, selected) {
  const mistakes = storage.mistakes.filter((item) => item.id !== question.id);
  mistakes.unshift({ ...question, selected, savedAt: new Date().toISOString() });
  storage.mistakes = mistakes.slice(0, 300);
}

function finishQuiz() {
  stopTimer();
  const percent = state.quiz.length ? Math.round((state.score / state.quiz.length) * 100) : 0;
  const timeStr = formatTime(timerSeconds);
  saveExamRecord(percent);
  els.quizRunner.classList.add("hidden");
  els.quizResult.classList.remove("hidden");
  els.quizResult.innerHTML = `
    <p class="eyebrow">Result · ${escapeHtml(examLabel())}</p>
    <h3>${percent} 分</h3>
    <div class="result-meta">
      <span>✓ 答对 ${state.score} 题</span>
      <span class="${state.quizWrong > 0 ? "result-wrong" : ""}">✗ 答错 ${state.quizWrong} 题</span>
      <span>⏱ 用时 ${timeStr}</span>
    </div>
    <p class="explain">${percent >= 90 ? "表现很稳，可以进入下一组题库。" : "建议先复习错题，再重新考一次。"}</p>
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
  if (state.quizMode === "product") return els.productBankSelect.value;
  if (state.quizMode === "role") return els.roleBankSelect.value + "（含补充题）";
  return "随机混合";
}

function saveExamRecord(percent) {
  const records = storage.examRecords;
  records.unshift({
    user: state.currentUser,
    bank: examLabel(),
    score: state.score,
    total: state.quiz.length,
    percent,
    duration: timerSeconds,
    finishedAt: new Date().toISOString(),
  });
  storage.examRecords = records.slice(0, 100);
}

function renderMistakes() {
  const mistakes = storage.mistakes;
  if (!mistakes.length) {
    els.mistakeList.innerHTML = `<div class="empty">现在还没有错题记录。</div>`;
    return;
  }
  els.mistakeList.innerHTML = mistakes
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
            <p class="answer-line">正确答案：${escapeHtml(question.answer)}｜${escapeHtml(question.answerText)}</p>
            <p class="explain">${escapeHtml(question.explanation)}</p>
            ${renderOptionImages(question)}
          </div>
          ${renderQuestionImages(question)}
        </article>
      `
    )
    .join("");
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

function switchView(view) {
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
}

function renderAll() {
  renderStats();
  renderDashboard();
  renderLearnFilter();
  renderLearnList();
  renderMistakes();
}

function renderUser() {
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
  const phone = userStore.currentPhone;
  const users = userStore.users;
  state.currentUser = phone && users[phone] ? users[phone] : null;
}

function showAuth(visible) {
  els.authView.classList.toggle("hidden", !visible);
  document.body.classList.toggle("auth-locked", visible);
}

function saveUserFromForm(event) {
  event.preventDefault();
  const name = els.authName.value.trim();
  const phone = normalizePhone(els.authPhone.value);
  const role = els.authRole.value;
  if (!name) {
    els.authError.textContent = "请填写姓名。";
    return;
  }
  if (phone.length !== 11) {
    els.authError.textContent = "请输入 11 位手机号。";
    return;
  }
  const users = userStore.users;
  const user = {
    name,
    phone,
    role,
    updatedAt: new Date().toISOString(),
  };
  users[phone] = user;
  userStore.users = users;
  userStore.currentPhone = phone;
  state.currentUser = user;
  els.authError.textContent = "";
  showAuth(false);
  renderAll();
}

function logout() {
  userStore.currentPhone = "";
  state.currentUser = null;
  state.quiz = [];
  state.quizIndex = 0;
  state.score = 0;
  els.authPhone.value = "";
  els.authName.value = "";
  showAuth(true);
  renderAll();
}

function bindEvents() {
  els.navTabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  els.bankSelect.addEventListener("change", () => {
    state.currentBank = els.bankSelect.value;
    state.quiz = [];
    renderAll();
  });
  els.searchInput.addEventListener("input", renderAll);
  els.startQuizBtn.addEventListener("click", startQuiz);
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
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
    storage.mistakes = [];
    renderAll();
  });
  els.resetBtn.addEventListener("click", () => {
    storage.attempts = 0;
    storage.correct = 0;
    storage.mistakes = [];
    storage.examRecords = [];
    renderAll();
  });
  els.authForm.addEventListener("submit", saveUserFromForm);
  els.logoutBtn.addEventListener("click", logout);
}

async function init() {
  try {
    await loadQuestions();
    loadCurrentUser();
    renderBankSelect();
    renderQuizSetup();
    initSlogan();
    bindEvents();
    renderAll();
    showAuth(!state.currentUser);
  } catch (error) {
    document.body.innerHTML = `<div class="empty">题库加载失败：${escapeHtml(error.message)}</div>`;
    throw error;
  }
}

init();
