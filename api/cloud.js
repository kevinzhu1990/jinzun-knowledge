const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const BASE_TOKEN = process.env.LARK_BASE_TOKEN || '';
const EMPLOYEE_TABLE_ID = process.env.LARK_EMPLOYEE_TABLE_ID || '';
const EXAM_TABLE_ID = process.env.LARK_EXAM_TABLE_ID || '';
const PRACTICE_TABLE_ID = process.env.LARK_PRACTICE_TABLE_ID || '';
const MISTAKE_TABLE_ID = process.env.LARK_MISTAKE_TABLE_ID || '';
const LARK_APP_ID = process.env.LARK_APP_ID || '';
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || '';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://kevinzhu1990.github.io';
const ALLOWED_ORIGINS = new Set([ALLOWED_ORIGIN, 'https://jinzun-knowledge.vercel.app']);
const AUTH_SECRET = process.env.AUTH_SECRET || '';
const EMPLOYEE_REGISTER_CODE = process.env.EMPLOYEE_REGISTER_CODE || '';
const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || '';
const AUTH_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMITS = { login: 20, register: 10, reset: 10 };

const json = (req, res, status, body) => {
  const origin = String(req.headers.origin || '');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const authorized = (req) => {
  if (!INTERNAL_API_TOKEN) return false;
  return String(req.headers.authorization || '') === `Bearer ${INTERNAL_API_TOKEN}`;
};

const sameOrigin = (req) => ALLOWED_ORIGINS.has(String(req.headers.origin || ''));

const writeAuthorized = (req) => sameOrigin(req) || authorized(req);

const configured = () => Boolean(
  BASE_TOKEN && EMPLOYEE_TABLE_ID && EXAM_TABLE_ID && MISTAKE_TABLE_ID &&
  LARK_APP_ID && LARK_APP_SECRET
);

const authConfigured = () => Boolean(
  AUTH_SECRET && PASSWORD_PEPPER && EMPLOYEE_REGISTER_CODE,
);

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  if (raw.length > 200000) throw new Error('Request body too large');
  return JSON.parse(raw);
};

const dt = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const shanghai = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const pad = (number) => String(number).padStart(2, '0');
  return `${shanghai.getUTCFullYear()}-${pad(shanghai.getUTCMonth() + 1)}-${pad(shanghai.getUTCDate())} ${pad(shanghai.getUTCHours())}:${pad(shanghai.getUTCMinutes())}:${pad(shanghai.getUTCSeconds())}`;
};

const cleanPhone = (value) => String(value || '').replace(/\D/g, '');
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const isAdminValue = (value) => ['true', '是', 'yes', '1'].includes(String(value || '').trim().toLowerCase());

let cachedToken = null;
let cachedTokenExpireAt = 0;
let cachedTables = null;
let cachedTablesExpireAt = 0;
const rateLimitBuckets = new Map();
const examSubmitLocks = new Map();
const practiceSubmitLocks = new Map();

class FeishuApiError extends Error {
  constructor(message, { code = '', status = 0 } = {}) {
    super(message);
    this.name = 'FeishuApiError';
    this.code = String(code || '');
    this.status = Number(status || 0);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function larkApi(path, options = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      response = await fetch(`https://open.feishu.cn/open-apis${path}`, {
        ...options,
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(250 * (attempt + 1));
      continue;
    }
    const data = await response.json().catch(() => ({}));
    const code = data.code || data.error?.code || '';
    if (!response.ok || (data.code && data.code !== 0)) {
      const error = new FeishuApiError(
        data.msg || data.error?.message || `Feishu API error ${response.status}`,
        { code, status: response.status },
      );
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 2) throw error;
      await sleep(250 * (attempt + 1));
      continue;
    }
    return data;
  }
}

async function getTenantToken() {
  if (cachedToken && Date.now() < cachedTokenExpireAt) return cachedToken;
  const data = await larkApi('/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: LARK_APP_ID, app_secret: LARK_APP_SECRET }),
  });
  cachedToken = data.tenant_access_token;
  cachedTokenExpireAt = Date.now() + Math.max(60, Number(data.expire || 7200) - 300) * 1000;
  return cachedToken;
}

const normalizeTableName = (value) => String(value || '').replace(/[\s_-]/g, '').toLowerCase();

async function listTables() {
  if (cachedTables && Date.now() < cachedTablesExpireAt) return cachedTables;
  const token = await getTenantToken();
  const data = await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables?page_size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  cachedTables = data?.data?.items || [];
  cachedTablesExpireAt = Date.now() + 5 * 60 * 1000;
  return cachedTables;
}

async function resolveTableId(configuredId, names) {
  const tables = await listTables();
  if (configuredId && tables.some((table) => table.table_id === configuredId)) return configuredId;
  const wanted = names.map(normalizeTableName);
  const matched = tables.find((table) => wanted.includes(normalizeTableName(table.name)));
  if (matched?.table_id) return matched.table_id;
  throw new FeishuApiError(`Feishu table not found: ${names.join('/')}`, {
    code: 'TABLE_NOT_FOUND',
    status: 500,
  });
}

const employeeTableId = () => resolveTableId(EMPLOYEE_TABLE_ID, [
  '登录记录', '员工联系记录', '员工信息', '员工登录记录', '员工',
]);

const examTableId = () => resolveTableId(EXAM_TABLE_ID, [
  '考试成绩记录', '考试记录', '考试成绩', '学习考核记录', '考核记录',
]);

const mistakeTableId = () => resolveTableId(MISTAKE_TABLE_ID, [
  '错题记录', '错题', '学习错题记录',
]);

const ACCOUNT_TEXT_FIELDS = [
  '员工ID', '密码哈希', '账号状态', '是否管理员', '注册时间',
  '最后登录时间', '登录失败次数', '锁定截止时间', '密码更新时间', '客户端标识', '会话版本', '备注',
];
let accountFieldsReady = null;
const EXAM_FIELD_NAMES = [
  '考试名称', '考核类型', '题库', '总题数', '答对数', '答错数', '分数',
  '是否通过', '用时秒数', '提交时间', '考试提交编号', '考试会话ID', '设备ID',
];
const PRACTICE_FIELD_NAMES = [
  '练习名称', '练习类型', '题库', '总题数', '答对数', '答错数', '分数',
  '是否达标', '用时秒数', '提交时间', '练习提交编号', '设备ID',
  '姓名', '手机号', '岗位',
];
const MISTAKE_FIELD_NAMES = [
  '记录时间', '错选', '正确答案', '解析', '题库', '知识点',
  '考试提交编号', '题目', '姓名', '手机号', '岗位',
];
const QUESTION_CHANGE_FIELD_NAMES = [
  '题目ID', '状态', '修改内容', '修改时间', '修改人', '修改人手机',
];
const tableFieldsReady = new Map();

async function listFields(tableId) {
  const token = await getTenantToken();
  const data = await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/fields?page_size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data?.data?.items || [];
}

async function ensureAccountFields() {
  if (accountFieldsReady) return accountFieldsReady;
  accountFieldsReady = (async () => {
    const tableId = await employeeTableId();
    const fields = await listFields(tableId);
    const existing = new Set(fields.map((field) => String(field.field_name || '')));
    const token = await getTenantToken();
    for (const fieldName of ACCOUNT_TEXT_FIELDS) {
      if (existing.has(fieldName)) continue;
      try {
        await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ field_name: fieldName, type: 1 }),
        });
      } catch (error) {
        if (error?.code !== '1254067' && !String(error?.message || '').toLowerCase().includes('duplicate')) throw error;
      }
    }
    return tableId;
  })();
  try {
    return await accountFieldsReady;
  } catch (error) {
    accountFieldsReady = null;
    throw error;
  }
}

const accountTableId = () => ensureAccountFields();

async function ensureTableFields(tableIdPromise, fieldNames) {
  const tableId = await tableIdPromise;
  const cacheKey = `${tableId}:${fieldNames.join('|')}`;
  if (tableFieldsReady.has(cacheKey)) return tableId;
  const fields = await listFields(tableId);
  const existing = new Set(fields.map((field) => String(field.field_name || '')));
  const token = await getTenantToken();
  for (const fieldName of fieldNames) {
    if (existing.has(fieldName)) continue;
    try {
      await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ field_name: fieldName, type: 1 }),
      });
    } catch (error) {
      if (error?.code !== '1254067' && !String(error?.message || '').toLowerCase().includes('duplicate')) throw error;
    }
  }
  tableFieldsReady.set(cacheKey, true);
  return tableId;
}

let practiceTablePromise = null;
let questionChangeTablePromise = null;

async function practiceTableId() {
  if (practiceTablePromise) return practiceTablePromise;
  practiceTablePromise = (async () => {
    try {
      return await resolveTableId(PRACTICE_TABLE_ID, [
        '练习成绩记录', '练习记录', '员工练习记录',
      ]);
    } catch (error) {
      if (error?.code !== 'TABLE_NOT_FOUND') throw error;
      const token = await getTenantToken();
      const data = await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          table: {
            name: '练习成绩记录',
            default_view_name: '练习记录',
            fields: PRACTICE_FIELD_NAMES.map((fieldName) => ({ field_name: fieldName, type: 1 })),
          },
        }),
      });
      const tableId = data?.data?.table?.table_id || data?.data?.table_id;
      if (!tableId) throw new FeishuApiError('练习成绩记录表创建失败', { code: 'PRACTICE_TABLE_CREATE_FAILED', status: 500 });
      cachedTables = null;
      cachedTablesExpireAt = 0;
      return tableId;
    }
  })();
  try {
    return await practiceTablePromise;
  } catch (error) {
    practiceTablePromise = null;
    throw error;
  }
}

async function questionChangeTableId() {
  if (questionChangeTablePromise) return questionChangeTablePromise;
  questionChangeTablePromise = (async () => {
    try {
      return await resolveTableId('', ['题库修改记录', '题库管理记录']);
    } catch (error) {
      if (error?.code !== 'TABLE_NOT_FOUND') throw error;
      const token = await getTenantToken();
      const data = await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          table: {
            name: '题库修改记录',
            default_view_name: '题库修改',
            fields: QUESTION_CHANGE_FIELD_NAMES.map((fieldName) => ({ field_name: fieldName, type: 1 })),
          },
        }),
      });
      const tableId = data?.data?.table?.table_id || data?.data?.table_id;
      if (!tableId) throw new FeishuApiError('题库修改记录表创建失败', { code: 'QUESTION_CHANGE_TABLE_CREATE_FAILED', status: 500 });
      cachedTables = null;
      cachedTablesExpireAt = 0;
      return tableId;
    }
  })();
  try {
    return await questionChangeTablePromise;
  } catch (error) {
    questionChangeTablePromise = null;
    throw error;
  }
}

const examTableReady = () => ensureTableFields(examTableId(), EXAM_FIELD_NAMES);
const practiceTableReady = () => ensureTableFields(practiceTableId(), PRACTICE_FIELD_NAMES);
const mistakeTableReady = () => ensureTableFields(mistakeTableId(), MISTAKE_FIELD_NAMES);
const questionChangeTableReady = () => ensureTableFields(questionChangeTableId(), QUESTION_CHANGE_FIELD_NAMES);

const allowedRoles = new Set([
  '运营', '客服', '美工', '主播', '中控', '采购', '财务', '行政', '审单', '仓储', '管理', '新员工',
]);

const PRODUCT_QUESTION_PATH = path.join(__dirname, '..', 'outputs', 'product_quiz', '金尊产品知识库题库.json');
const ROLE_QUESTION_PATH = path.join(__dirname, '..', 'outputs', 'role_quiz', '岗位学习考核题库.json');
let serverQuestionsPromise = null;
let questionChangesCache = null;
let questionChangesExpireAt = 0;

function loadJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadBaseServerQuestions() {
  if (!serverQuestionsPromise) {
    serverQuestionsPromise = Promise.resolve([
      ...loadJsonFile(PRODUCT_QUESTION_PATH),
      ...loadJsonFile(ROLE_QUESTION_PATH),
    ]);
  }
  return serverQuestionsPromise;
}

async function loadQuestionChanges() {
  if (questionChangesCache && Date.now() < questionChangesExpireAt) return questionChangesCache;
  const tableId = await questionChangeTableReady();
  const records = await listRecords(tableId);
  questionChangesCache = records.flatMap((record) => {
    const id = String(record['题目ID'] || '').trim();
    if (!id) return [];
    let patch = {};
    try {
      patch = JSON.parse(String(record['修改内容'] || '{}'));
    } catch {
      patch = {};
    }
    return [{
      id,
      status: String(record['状态'] || '启用') === '删除' ? 'deleted' : 'active',
      patch: patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {},
      updatedAt: record['修改时间'] || '',
      updatedBy: record['修改人'] || '',
    }];
  });
  questionChangesExpireAt = Date.now() + 15_000;
  return questionChangesCache;
}

function applyQuestionChanges(questions, changes, includeDeleted = false) {
  const byId = new Map(changes.map((change) => [String(change.id), change]));
  return questions.flatMap((question) => {
    const change = byId.get(String(question.id));
    if (!change) return [{ ...question, _changeStatus: 'original' }];
    const merged = { ...question, ...change.patch, _changeStatus: change.status, _updatedAt: change.updatedAt, _updatedBy: change.updatedBy };
    if (change.status === 'deleted' && !includeDeleted) return [];
    return [merged];
  });
}

async function loadServerQuestions() {
  const [questions, changes] = await Promise.all([loadBaseServerQuestions(), loadQuestionChanges()]);
  return applyQuestionChanges(questions, changes);
}

const publicQuestion = (question) => {
  const { answer, answerText, explanation, source, note, ...safeQuestion } = question;
  return safeQuestion;
};

const shuffleServer = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const MOONCAKE_IMAGE_POINTS = new Set(['看图片选货号', '看货号选图片']);
const MOONCAKE_FLAVOR_POINTS = new Set(['内配/口味', '口味个数']);

const takeExamQuestions = (pool, count, selectedIds) => {
  const available = pool.filter((question) => !selectedIds.has(String(question.id)));
  const picked = shuffleServer(available).slice(0, Math.max(0, count));
  picked.forEach((question) => selectedIds.add(String(question.id)));
  return picked;
};

function selectMooncakeExamQuestions(pool, requestedSize) {
  const size = Math.min(requestedSize, pool.length);
  const imageTotal = Math.round(size * 0.7);
  const flavorTotal = Math.round(size * 0.1);
  const otherTotal = size - imageTotal - flavorTotal;
  const codeToImageTarget = Math.floor(imageTotal / 2);
  const imageToCodeTarget = imageTotal - codeToImageTarget;
  const selectedIds = new Set();
  const selected = [];
  const codeToImage = pool.filter((question) => question.knowledgePoint === '看货号选图片');
  const imageToCode = pool.filter((question) => question.knowledgePoint === '看图片选货号');
  const flavor = pool.filter((question) => MOONCAKE_FLAVOR_POINTS.has(question.knowledgePoint));
  const other = pool.filter((question) => !MOONCAKE_IMAGE_POINTS.has(question.knowledgePoint)
    && !MOONCAKE_FLAVOR_POINTS.has(question.knowledgePoint));

  selected.push(...takeExamQuestions(codeToImage, codeToImageTarget, selectedIds));
  selected.push(...takeExamQuestions(imageToCode, imageToCodeTarget, selectedIds));
  selected.push(...takeExamQuestions([...codeToImage, ...imageToCode], imageTotal - selected.length, selectedIds));
  selected.push(...takeExamQuestions(flavor, flavorTotal, selectedIds));
  selected.push(...takeExamQuestions(other, otherTotal, selectedIds));
  selected.push(...takeExamQuestions(pool, size - selected.length, selectedIds));

  return shuffleServer(selected.slice(0, size));
}

function selectExamQuestions(pool, payload, requestedSize) {
  if (payload.mode === 'product' && payload.bank === '月饼题库') {
    return selectMooncakeExamQuestions(pool, requestedSize);
  }
  return shuffleServer(pool).slice(0, Math.min(requestedSize, pool.length));
}

const normalizeName = (value) => String(value || '').trim();
const validatePassword = (value) => typeof value === 'string'
  && value.length >= 8 && value.length <= 64 && /[A-Za-z]/.test(value) && /\d/.test(value);

const b64url = (value) => Buffer.from(value).toString('base64url');
const signToken = (payload) => {
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
};
const sessionKey = () => crypto.createHash('sha256').update(AUTH_SECRET).digest();
const sealExamSession = (payload) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
};
const openExamSession = (token) => {
  try {
    const [ivText, tagText, encryptedText] = String(token || '').split('.');
    if (!ivText || !tagText || !encryptedText) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    const raw = Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]);
    const payload = JSON.parse(raw.toString('utf8'));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
};
const verifyToken = (token) => {
  if (!AUTH_SECRET || typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
};

const passwordHash = (password) => bcrypt.hash(`${password}${PASSWORD_PEPPER}`, 12);
const passwordMatches = (password, hash) => bcrypt.compare(`${password}${PASSWORD_PEPPER}`, hash);

const authUserFromRecord = (record) => ({
  id: record['员工ID'] || record.record_id,
  name: record['姓名'] || '',
  phone: cleanPhone(record['手机号']),
  role: record['岗位'] || '',
  isAdmin: isAdminValue(record['是否管理员']),
  sessionVersion: String(record['会话版本'] || '1'),
});

const nextSessionVersion = (record) => record?.['会话版本']
  ? String(num(record['会话版本'], 1) + 1)
  : '2';

const authTokenFor = (user) => signToken({ ...user, exp: Date.now() + AUTH_TOKEN_TTL_MS });

const getBearer = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const tokenUser = (req, payload = {}) => verifyToken(payload.token || getBearer(req));

const clientIp = (req) => String(
  req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown',
).split(',')[0].trim();

function enforceRateLimit(req, action) {
  const limit = RATE_LIMITS[action];
  if (!limit) return;
  const key = `${action}:${clientIp(req)}`;
  const now = Date.now();
  const current = rateLimitBuckets.get(key);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > limit) throw httpError(429, '请求过于频繁，请稍后再试');
}

async function findAccountByPhone(phone) {
  const tableId = await accountTableId();
  const records = await searchRecords(tableId, '手机号', phone);
  const matched = records.find((record) => cleanPhone(record['手机号']) === phone);
  if (matched) return matched;
  // Existing Bases may store 手机号 as a number or formatted text, so the
  // typed search can miss an otherwise exact account.
  const allRecords = await listRecords(tableId);
  return allRecords.find((record) => cleanPhone(record['手机号']) === phone) || null;
}

async function findAccountsByName(name) {
  const tableId = await accountTableId();
  const records = await searchRecords(tableId, '姓名', name);
  const matched = records.filter((record) => normalizeName(record['姓名']) === name);
  if (matched.length) return matched;
  return (await listRecords(tableId)).filter((record) => normalizeName(record['姓名']) === name);
}

const httpError = (status, message, code = '') => Object.assign(new Error(message), { status, code });

async function handleRegister(payload) {
  if (!authConfigured()) throw httpError(503, 'Account service is not configured');
  const name = normalizeName(payload.name);
  const phone = cleanPhone(payload.phone);
  const role = normalizeName(payload.role);
  const password = String(payload.password || '');
  if (String(payload.registerCode || '').trim() !== EMPLOYEE_REGISTER_CODE) throw httpError(403, '公司注册口令错误');
  if (!name || name.length > 30) throw httpError(400, '姓名格式不正确');
  if (!/^1\d{10}$/.test(phone)) throw httpError(400, '手机号格式不正确');
  if (!allowedRoles.has(role)) throw httpError(400, '岗位信息不正确');
  if (!validatePassword(password)) throw httpError(400, '密码至少8位，并包含字母和数字');
  const tableId = await accountTableId();
  const existing = await findAccountByPhone(phone);
  if (existing) {
    if (!existing['姓名'] || !existing['岗位']
      || normalizeName(existing['姓名']) !== name
      || normalizeName(existing['岗位']) !== role) {
      throw httpError(409, '原员工姓名或岗位不匹配，无法激活该手机号');
    }
    if (existing['密码哈希']) throw httpError(409, '该手机号已经注册，请使用登录或忘记密码');
    if (String(existing['账号状态'] || '正常') !== '正常') {
      throw httpError(403, '当前账号已停用，请联系管理员');
    }
  }
  const hash = await passwordHash(password);
  const employeeId = existing?.['员工ID'] || crypto.randomUUID();
  const sessionVersion = existing ? nextSessionVersion(existing) : '1';
  const fields = {
    '员工ID': employeeId,
    '姓名': name,
    '手机号': phone,
    '岗位': role,
    '密码哈希': hash,
    '账号状态': '正常',
    '是否管理员': isAdminValue(existing?.['是否管理员']) ? '是' : '否',
    '注册时间': existing?.['注册时间'] || dt(new Date()),
    '最后登录时间': dt(new Date()),
    '登录失败次数': '0',
    '锁定截止时间': '',
    '密码更新时间': dt(new Date()),
    '客户端标识': String(payload.clientId || '').slice(0, 500),
    '会话版本': sessionVersion,
    '备注': '知识库账号注册/旧员工激活',
  };
  const record = existing
    ? await updateRecord(tableId, existing.record_id, fields)
    : await createRecord(tableId, fields);
  const user = authUserFromRecord({ ...fields, record_id: record?.record_id || existing?.record_id });
  return { ok: true, token: authTokenFor(user), user };
}

async function handlePasswordLogin(payload) {
  if (!authConfigured()) throw httpError(503, 'Account service is not configured');
  const account = normalizeName(payload.account);
  const password = String(payload.password || '');
  let record = null;
  if (/^1\d{10}$/.test(account)) {
    record = await findAccountByPhone(account);
  } else {
    const matches = await findAccountsByName(account);
    if (matches.length > 1) throw httpError(409, '存在同名员工，请使用手机号登录');
    record = matches[0] || null;
  }
  if (!record || !record['密码哈希']) throw httpError(401, '账号或密码错误');
  const status = String(record['账号状态'] || '正常');
  if (status !== '正常') throw httpError(403, '当前账号已停用，请联系管理员');
  const lockedUntil = Date.parse(String(record['锁定截止时间'] || ''));
  if (lockedUntil > Date.now()) throw httpError(429, '账号暂时锁定，请稍后重试');
  const valid = await passwordMatches(password, record['密码哈希']);
  const tableId = await accountTableId();
  if (!valid) {
    const failures = num(record['登录失败次数'], 0) + 1;
    const lockMs = failures >= 20
      ? 24 * 60 * 60 * 1000
      : failures >= 10
        ? 2 * 60 * 60 * 1000
        : failures >= 5
          ? 15 * 60 * 1000
          : 0;
    const updates = {
      '登录失败次数': String(failures),
      '锁定截止时间': lockMs ? dt(new Date(Date.now() + lockMs)) : '',
      '客户端标识': String(payload.clientId || '').slice(0, 500),
    };
    if (failures >= 20) {
      updates['账号状态'] = '正常';
      updates['备注'] = `异常登录尝试达到${failures}次，已锁定24小时：${dt(new Date())}`;
    }
    await updateRecord(tableId, record.record_id, updates);
    throw httpError(401, lockMs ? '账号或密码错误，账号已暂时锁定' : '账号或密码错误');
  }
  const user = authUserFromRecord(record);
  await updateRecord(tableId, record.record_id, {
    '最后登录时间': dt(new Date()),
    '登录失败次数': '0',
    '锁定截止时间': '',
    '客户端标识': String(payload.clientId || '').slice(0, 500),
  });
  return { ok: true, token: authTokenFor(user), user };
}

async function handlePasswordReset(payload) {
  if (!authConfigured()) throw httpError(503, 'Account service is not configured');
  const name = normalizeName(payload.name);
  const phone = cleanPhone(payload.phone);
  const role = normalizeName(payload.role);
  const password = String(payload.password || '');
  if (String(payload.registerCode || '').trim() !== EMPLOYEE_REGISTER_CODE) throw httpError(403, '公司注册口令错误');
  if (!name || name.length > 30) throw httpError(400, '姓名格式不正确');
  if (!/^1\d{10}$/.test(phone)) throw httpError(400, '手机号格式不正确');
  if (!allowedRoles.has(role)) throw httpError(400, '岗位信息不正确');
  if (!validatePassword(password)) throw httpError(400, '密码至少8位，并包含字母和数字');
  const existing = await findAccountByPhone(phone);
  if (!existing) throw httpError(404, '未找到该手机号对应的账号，请先注册');
  if (normalizeName(existing['姓名']) !== name || normalizeName(existing['岗位']) !== role) {
    throw httpError(403, '姓名、手机号或岗位与员工资料不一致');
  }
  if (String(existing['账号状态'] || '正常') !== '正常') throw httpError(403, '当前账号已停用，请联系管理员');
  const tableId = await accountTableId();
  const fields = {
    '密码哈希': await passwordHash(password),
    '登录失败次数': '0',
    '锁定截止时间': '',
    '密码更新时间': dt(new Date()),
    '客户端标识': String(payload.clientId || '').slice(0, 500),
    '会话版本': nextSessionVersion(existing),
    '备注': `员工使用内部口令重置密码：${dt(new Date())}`,
  };
  await updateRecord(tableId, existing.record_id, fields);
  const user = authUserFromRecord({ ...existing, ...fields });
  return { ok: true, token: authTokenFor(user), user };
}

async function requireActiveUser(req, payload) {
  const user = tokenUser(req, payload);
  if (!user) throw httpError(401, 'Unauthorized');
  const record = await findAccountByPhone(cleanPhone(user.phone));
  if (!record || String(record['账号状态'] || '正常') !== '正常') throw httpError(401, '账号已失效，请重新登录');
  if (String(record['会话版本'] || '1') !== String(user.sessionVersion || '1')) {
    throw httpError(401, '登录状态已更新，请重新登录');
  }
  const currentIsAdmin = isAdminValue(record['是否管理员']);
  return authUserFromRecord(record);
}

async function requireAdmin(req, payload) {
  const user = await requireActiveUser(req, payload);
  if (!user.isAdmin) throw httpError(403, '管理员权限不足');
  return user;
}
const adminEmployeeView = (record) => ({
  record_id: record.record_id,
  name: record['姓名'] || '',
  phone: cleanPhone(record['手机号']),
  role: record['岗位'] || '',
  status: record['账号状态'] || '正常',
  isAdmin: isAdminValue(record['是否管理员']),
  registeredAt: record['注册时间'] || '',
  lastLoginAt: record['最后登录时间'] || '',
});
async function handleAdminList() {
  const tableId = await accountTableId();
  return { ok: true, employees: (await listRecords(tableId)).map(adminEmployeeView) };
}
async function handleAdminAdd(payload) {
  const name = normalizeName(payload.name), phone = cleanPhone(payload.phone), role = normalizeName(payload.role), password = String(payload.password || '');
  if (!name || !/^1\d{10}$/.test(phone) || !allowedRoles.has(role) || !validatePassword(password)) throw httpError(400, '请填写正确的姓名、手机号、岗位和密码');
  const tableId = await accountTableId();
  if (await findAccountByPhone(phone)) throw httpError(409, '该手机号已经存在');
  const now = dt(new Date());
  const record = await createRecord(tableId, { '员工ID': crypto.randomUUID(), '姓名': name, '手机号': phone, '岗位': role, '密码哈希': await passwordHash(password), '账号状态': '正常', '是否管理员': '否', '注册时间': now, '登录失败次数': '0', '锁定截止时间': '', '密码更新时间': now, '客户端标识': '管理员添加', '会话版本': '1', '备注': '管理员添加员工账号' });
  return { ok: true, employee: adminEmployeeView({ ...record, '姓名': name, '手机号': phone, '岗位': role, '账号状态': '正常', '是否管理员': '否', '注册时间': now }) };
}
async function handleAdminDelete(payload, user) {
  const phone = cleanPhone(payload.phone);
  if (!phone) throw httpError(400, '手机号不正确');
  if (phone === cleanPhone(user.phone)) throw httpError(400, '不能删除当前管理员账号');
  const tableId = await accountTableId(), record = await findAccountByPhone(phone);
  if (!record) throw httpError(404, '未找到员工账号');
  await deleteRecord(tableId, record.record_id);
  return { ok: true, phone };
}
async function handleAdminPassword(payload) {
  const phone = cleanPhone(payload.phone), password = String(payload.password || '');
  if (!phone || !validatePassword(password)) throw httpError(400, '密码至少8位，并包含字母和数字');
  const tableId = await accountTableId(), record = await findAccountByPhone(phone);
  if (!record) throw httpError(404, '未找到员工账号');
  await updateRecord(tableId, record.record_id, { '密码哈希': await passwordHash(password), '登录失败次数': '0', '锁定截止时间': '', '密码更新时间': dt(new Date()), '会话版本': nextSessionVersion(record), '备注': '管理员修改员工密码' });
  return { ok: true, phone };
}

const QUESTION_EDITABLE_FIELDS = [
  'bank', 'code', 'knowledgePoint', 'question',
  'optionA', 'optionB', 'optionC', 'optionD', 'answer', 'explanation',
];

function questionPatchFromPayload(payload, original) {
  const input = payload.question && typeof payload.question === 'object' ? payload.question : {};
  const patch = {};
  for (const field of QUESTION_EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const limit = field === 'explanation' ? 3000 : field.startsWith('option') || field === 'question' ? 1000 : 200;
    patch[field] = String(input[field] ?? '').trim().slice(0, limit);
  }
  const merged = { ...original, ...patch };
  if (!merged.bank || !merged.question || !merged.optionA || !merged.optionB || !merged.optionC || !merged.optionD) {
    throw httpError(400, '题库、题干和四个选项不能为空');
  }
  if (!['A', 'B', 'C', 'D'].includes(merged.answer)) throw httpError(400, '正确答案必须是 A、B、C 或 D');
  patch.answerText = merged[`option${merged.answer}`];
  return patch;
}

async function saveQuestionChange(id, status, patch, user) {
  const tableId = await questionChangeTableReady();
  const existing = await searchRecordsReliable(tableId, '题目ID', id);
  const fields = {
    '题目ID': id,
    '状态': status === 'deleted' ? '删除' : '启用',
    '修改内容': JSON.stringify(patch || {}),
    '修改时间': dt(new Date()),
    '修改人': user.name || '',
    '修改人手机': cleanPhone(user.phone),
  };
  const saved = existing[0]?.record_id
    ? await updateRecord(tableId, existing[0].record_id, fields)
    : await createRecord(tableId, fields);
  questionChangesCache = null;
  questionChangesExpireAt = 0;
  return saved;
}

async function handleAdminQuestions(payload, user) {
  const operation = String(payload.operation || 'list');
  if (operation === 'list') {
    const [questions, changes] = await Promise.all([loadBaseServerQuestions(), loadQuestionChanges()]);
    return { ok: true, total: questions.length, changes };
  }
  const id = String(payload.id || '').trim().slice(0, 120);
  if (!id) throw httpError(400, '题目ID不正确');
  const questions = await loadBaseServerQuestions();
  const original = questions.find((question) => String(question.id) === id);
  if (!original) throw httpError(404, '未找到该题目');
  const existingChange = (await loadQuestionChanges()).find((change) => String(change.id) === id);
  if (operation === 'update') {
    const patch = questionPatchFromPayload(payload, { ...original, ...(existingChange?.patch || {}) });
    await saveQuestionChange(id, 'active', { ...(existingChange?.patch || {}), ...patch }, user);
  } else if (operation === 'delete') {
    await saveQuestionChange(id, 'deleted', existingChange?.patch || {}, user);
  } else if (operation === 'restore') {
    await saveQuestionChange(id, 'active', existingChange?.patch || {}, user);
  } else {
    throw httpError(400, '不支持的题库管理操作');
  }
  const change = (await loadQuestionChanges()).find((item) => String(item.id) === id);
  return { ok: true, change };
}

async function createRecord(tableId, fields) {
  const token = await getTenantToken();
  const data = await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields }),
  });
  return data?.data?.record || data?.data;
}

async function updateRecord(tableId, recordId, fields) {
  const token = await getTenantToken();
  const data = await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/records/${recordId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields }),
  });
  return data?.data?.record || data?.data;
}

async function deleteRecord(tableId, recordId) {
  const token = await getTenantToken();
  await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/records/${recordId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
}

async function searchRecords(tableId, fieldName, fieldValue) {
  const token = await getTenantToken();
  const data = await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/records/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      page_size: 20,
      filter: {
        conjunction: 'and',
        conditions: [{ field_name: fieldName, operator: 'is', value: [String(fieldValue)] }],
      },
    }),
  });
  return (data?.data?.items || []).map((item) => ({ record_id: item.record_id, ...item.fields }));
}

async function listRecords(tableId) {
  const token = await getTenantToken();
  const items = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ page_size: '500' });
    if (pageToken) query.set('page_token', pageToken);
    const data = await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/records?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    items.push(...(data?.data?.items || []));
    pageToken = data?.data?.has_more ? String(data?.data?.page_token || '') : '';
  } while (pageToken);
  return items.map((item) => ({ record_id: item.record_id, ...item.fields }));
}

async function searchRecordsReliable(tableId, fieldName, fieldValue) {
  const records = await searchRecords(tableId, fieldName, fieldValue);
  if (records.length) return records;
  return (await listRecords(tableId)).filter((record) => String(record[fieldName] || '') === String(fieldValue));
}

function examPool(questions, payload, user) {
  const mode = ['random', 'product', 'role'].includes(payload.mode) ? payload.mode : 'random';
  const bank = String(payload.bank || '').trim();
  const productBanks = new Set(['月饼题库', '日常年货题库', '业务场景题库', '品牌知识题库', '商家编码题库']);
  const coreBanks = new Set(['月饼题库', '日常年货题库', '业务场景题库']);
  const eligible = (question) => !question.role
    || (question.verificationStatus === 'verified'
      && question.effectiveForFormalExam === true
      && question.sourceConflict === false
      && question.semanticDuplicate === false
      && question.humanReviewStatus === 'approved');
  if (mode === 'random') return questions.filter((question) => coreBanks.has(question.bank) && eligible(question) && productQuestionAllowedForRole(question, user.role));
  if (mode === 'role') {
    if (!bank || productBanks.has(bank)) throw httpError(400, '岗位考试题库不正确');
    return questions.filter((question) => question.bank === bank
      && (question.role === user.role || question.role === '全员')
      && eligible(question));
  }
  if (!bank || !productBanks.has(bank)) throw httpError(400, '产品考试题库不正确');
  return questions.filter((question) => question.bank === bank && eligible(question) && productQuestionAllowedForRole(question, user.role));
}

function productQuestionAllowedForRole(question, role) {
  if (!['月饼题库', '日常年货题库', '商家编码题库'].includes(question.bank)) return true;
  const point = String(question.knowledgePoint || '');
  const basic = new Set(['产品名称', '克重/净重', '内配/口味', '口味个数', '保质期']);
  const logistics = new Set(['箱规', '单位', '条码']);
  if (basic.has(point)) return true;
  if (['看图片选货号', '看货号选图片'].includes(point)) return ['客服', '主播', '运营', '美工'].includes(role);
  if (logistics.has(point)) return ['仓储', '采购', '审单', '运营'].includes(role);
  if (point.includes('商家编码') || question.bank === '商家编码题库') return ['运营', '审单'].includes(role);
  if (point.includes('包装') || point.includes('盒型') || point.includes('产品线')) return ['美工', '客服', '运营'].includes(role);
  return ['客服', '主播', '运营'].includes(role);
}

async function handleExamStart(payload, user) {
  const size = Math.min(100, Math.max(1, Number(payload.size) || 50));
  const questions = await loadServerQuestions();
  const pool = examPool(questions, payload, user);
  if (pool.length < 1) {
    if (payload.mode === 'role') {
      const matching = questions.filter((question) => question.bank === String(payload.bank || '').trim()
        && (question.role === user.role || question.role === '全员'));
      if (matching.length) throw httpError(409, '当前岗位题库尚未完成审核，仅支持练习模式');
      throw httpError(400, '当前账号岗位没有该题库的可用题目，请重新选择岗位题库');
    }
    throw httpError(400, '当前岗位在该产品题库中没有可用题目，请重新选择题库');
  }
  const selected = selectExamQuestions(pool, payload, size);
  const examId = crypto.randomUUID();
  const startedAt = Date.now();
  const deadlineAt = startedAt + Math.max(60, Math.round(selected.length * 24)) * 1000;
  const sessionToken = sealExamSession({
    kind: 'exam', examId, uid: user.id, phone: user.phone,
    sessionVersion: user.sessionVersion, bank: payload.bank || '产品题库',
    mode: ['random', 'product', 'role'].includes(payload.mode) ? payload.mode : 'random',
    startedAt, deadlineAt,
    questions: selected.map((question) => ({ id: question.id, answer: question.answer })), exp: deadlineAt + 30_000,
  });
  return { ok: true, examId, sessionToken, startedAt, deadlineAt, expiresAt: deadlineAt + 30_000, bank: payload.bank || '综合产品题库', questions: selected.map(publicQuestion) };
}

async function writeMistakeRecords(user, items, submissionId = '') {
  const normalized = Array.isArray(items) ? items.slice(0, 100) : [];
  if (!normalized.length) return [];
  const tableId = await mistakeTableReady();
  const existing = submissionId ? await searchRecordsReliable(tableId, '考试提交编号', submissionId) : [];
  const existingByKey = new Map(existing.map((record) => [`${record['错题编号'] || ''}:${record['错选'] || ''}`, record.record_id]));
  const recordIds = [];
  for (const item of normalized) {
    const key = `${item.id || ''}:${item.selected || ''}`;
    if (existingByKey.has(key)) {
      recordIds.push(existingByKey.get(key));
      continue;
    }
    const created = await createRecord(tableId, {
      '记录时间': dt(item.savedAt || new Date()), '姓名': user.name, '手机号': cleanPhone(user.phone),
      '岗位': user.role || '', '错题编号': item.id || '', '题目': item.question || '',
      '错选': item.selected || '', '正确答案': item.answer ? `${item.answer} ${item.answerText || ''}`.trim() : '',
      '解析': item.explanation || '', '题库': item.bank || '', '知识点': item.knowledgePoint || '',
      '考试提交编号': submissionId,
    });
    if (!created?.record_id) throw httpError(503, '错题记录未返回记录ID');
    recordIds.push(created.record_id);
  }
  return recordIds;
}

async function handleMistakes(payload, user) {
  const recordIds = await writeMistakeRecords(user, payload.items, payload.submissionId || '');
  return { ok: true, record_ids: recordIds };
}

async function handleExamSubmit(payload, user) {
  const sessionHint = openExamSession(payload.sessionToken);
  const lockKey = sessionHint?.examId ? `${user.id}:${sessionHint.examId}` : `${user.id}:invalid`;
  const previous = examSubmitLocks.get(lockKey) || Promise.resolve();
  const current = previous.catch(() => undefined).then(() => handleExamSubmitOnce(payload, user));
  examSubmitLocks.set(lockKey, current);
  try {
    return await current;
  } finally {
    if (examSubmitLocks.get(lockKey) === current) examSubmitLocks.delete(lockKey);
  }
}

async function handleExamSubmitOnce(payload, user) {
  const session = openExamSession(payload.sessionToken);
  if (!session || session.kind !== 'exam' || session.uid !== user.id || session.phone !== user.phone
    || session.sessionVersion !== user.sessionVersion) throw httpError(401, '考试会话已失效，请重新开始考试');
  const examSessionId = String(session.examId || '').trim();
  if (!examSessionId) throw httpError(400, '考试会话ID无效');
  const submittedAt = Date.now();
  if (submittedAt > Number(session.deadlineAt || 0) + 30_000) throw httpError(408, '考试已超时，请重新开始考试');
  const duration = Math.max(0, Math.round((submittedAt - Number(session.startedAt || submittedAt)) / 1000));
  const examTable = await examTableReady();
  const existingBySession = await searchRecordsReliable(examTable, '考试会话ID', examSessionId);
  if (existingBySession[0]?.record_id) {
    const record = existingBySession[0];
    return {
      ok: true,
      duplicate: true,
      record_id: record.record_id,
      score: num(record['分数']),
      correct: num(record['答对数']),
      wrong: num(record['答错数']),
      total: num(record['总题数']),
      duration: num(record['用时秒数']),
      wrong_details: [],
    };
  }
  const submissionId = String(payload.submissionId || '').trim();
  const answers = new Map((Array.isArray(payload.answers) ? payload.answers : [])
    .map((item) => [String(item.id), String(item.answer || '')]));
  const questions = session.questions || [];
  const correct = questions.reduce((count, question) => count + (answers.get(String(question.id)) === String(question.answer) ? 1 : 0), 0);
  const total = questions.length;
  const wrong = total - correct;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const allQuestions = await loadServerQuestions();
  const questionMap = new Map(allQuestions.map((question) => [String(question.id), question]));
  const wrongItems = questions.filter((question) => answers.get(String(question.id)) !== String(question.answer))
    .map((question) => ({ ...questionMap.get(String(question.id)), selected: answers.get(String(question.id)) || '未作答', savedAt: new Date().toISOString() }));
  const mistakeIds = await writeMistakeRecords(user, wrongItems, submissionId || examSessionId);
  const fields = {
    '提交时间': dt(new Date()), '姓名': user.name, '手机号': cleanPhone(user.phone), '岗位': user.role || '',
    '考试名称': '金尊产品知识库学习考核', '考核类型': '正式考试', '题库': session.bank || '',
    '总题数': total, '答对数': correct, '答错数': wrong, '分数': percent,
    '是否通过': percent >= 80 ? '通过' : '未通过', '用时秒数': duration,
    '考试提交编号': submissionId || examSessionId, '考试会话ID': examSessionId, '设备ID': String(payload.deviceId || '').slice(0, 500),
  };
  const created = await createRecord(examTable, fields);
  if (!created?.record_id) throw httpError(503, '考试记录未返回记录ID');
  return {
    ok: true,
    record_id: created.record_id,
    mistake_record_ids: mistakeIds,
    wrong_details: wrongItems.map((item) => ({
      id: item.id, bank: item.bank, type: item.type, knowledgePoint: item.knowledgePoint,
      question: item.question, answer: item.answer, answerText: item.answerText,
      explanation: item.explanation, selected: item.selected, savedAt: item.savedAt,
    })),
    score: percent,
    correct,
    wrong,
    total,
    duration,
  };
}

async function handlePracticeSubmit(payload, user) {
  const submissionId = String(payload.submissionId || '').trim();
  if (!submissionId || submissionId.length > 100) throw httpError(400, '练习提交编号无效');
  const lockKey = `${user.id}:${submissionId}`;
  const previous = practiceSubmitLocks.get(lockKey) || Promise.resolve();
  const current = previous.catch(() => undefined).then(() => handlePracticeSubmitOnce(payload, user));
  practiceSubmitLocks.set(lockKey, current);
  try {
    return await current;
  } finally {
    if (practiceSubmitLocks.get(lockKey) === current) practiceSubmitLocks.delete(lockKey);
  }
}

async function handlePracticeSubmitOnce(payload, user) {
  const submissionId = String(payload.submissionId || '').trim();
  const total = Math.round(num(payload.total, -1));
  const correct = Math.round(num(payload.correct, -1));
  const wrong = Math.round(num(payload.wrong, total - correct));
  const duration = Math.round(num(payload.duration, 0));
  if (total < 1 || total > 1000 || correct < 0 || correct > total || wrong < 0 || wrong !== total - correct) {
    throw httpError(400, '练习成绩数据无效');
  }
  if (duration < 0 || duration > 24 * 60 * 60) throw httpError(400, '练习用时数据无效');
  const tableId = await practiceTableReady();
  const existing = await searchRecordsReliable(tableId, '练习提交编号', submissionId);
  if (existing[0]?.record_id) {
    const record = existing[0];
    return {
      ok: true,
      duplicate: true,
      record_id: record.record_id,
      score: num(record['分数']),
      correct: num(record['答对数']),
      wrong: num(record['答错数']),
      total: num(record['总题数']),
      duration: num(record['用时秒数']),
    };
  }
  const percent = Math.round((correct / total) * 100);
  const practiceType = String(payload.practiceType || '') === '红线规则练习' ? '红线规则练习' : '练习模式';
  const fields = {
    '提交时间': dt(new Date()),
    '姓名': user.name,
    '手机号': cleanPhone(user.phone),
    '岗位': user.role || '',
    '练习名称': String(payload.practiceName || '金尊知识库练习').trim().slice(0, 200),
    '练习类型': practiceType,
    '题库': String(payload.bank || '').trim().slice(0, 200),
    '总题数': String(total),
    '答对数': String(correct),
    '答错数': String(wrong),
    '分数': String(percent),
    '是否达标': percent >= (practiceType === '红线规则练习' ? 100 : 80) ? '达标' : '未达标',
    '用时秒数': String(duration),
    '练习提交编号': submissionId,
    '设备ID': String(payload.deviceId || '').slice(0, 500),
  };
  const created = await createRecord(tableId, fields);
  if (!created?.record_id) throw httpError(503, '练习记录未返回记录ID');
  return { ok: true, record_id: created.record_id, score: percent, correct, wrong, total, duration };
}

async function handleStats() {
  const entries = await Promise.allSettled([
    employeeTableId().then((tableId) => listRecords(tableId)),
    examTableId().then((tableId) => listRecords(tableId)),
    practiceTableId().then((tableId) => listRecords(tableId)),
    mistakeTableId().then((tableId) => listRecords(tableId)),
  ]);
  const [employeeRecords, examRecords, practiceRecords, mistakeRecords] = entries.map((entry) => entry.status === 'fulfilled' ? entry.value : []);
  const employees = employeeRecords.map((record) => ({
    record_id: record.record_id,
    姓名: record['姓名'] || '',
    手机号: cleanPhone(record['手机号']),
    岗位: record['岗位'] || '',
    最后登录时间: record['最后登录时间'] || '',
  }));
  const exams = examRecords.filter((record) => String(record['考核类型'] || '') === '正式考试').map((record) => ({
    record_id: record.record_id,
    姓名: record['姓名'] || '',
    手机号: cleanPhone(record['手机号']),
    岗位: record['岗位'] || '',
    考试名称: record['考试名称'] || '',
    考核类型: record['考核类型'] || '',
    题库: record['题库'] || '',
    总题数: num(record['总题数']),
    答对数: num(record['答对数']),
    答错数: num(record['答错数']),
    分数: num(record['分数']),
    是否通过: record['是否通过'] || '',
    用时秒数: num(record['用时秒数']),
    提交时间: record['提交时间'] || '',
    考试提交编号: record['考试提交编号'] || '',
    考试会话ID: record['考试会话ID'] || '',
  }));
  const practices = practiceRecords.map((record) => ({
    record_id: record.record_id,
    姓名: record['姓名'] || '',
    手机号: cleanPhone(record['手机号']),
    岗位: record['岗位'] || '',
    练习名称: record['练习名称'] || '',
    练习类型: record['练习类型'] || '练习模式',
    题库: record['题库'] || '',
    总题数: num(record['总题数']),
    答对数: num(record['答对数']),
    答错数: num(record['答错数']),
    分数: num(record['分数']),
    是否达标: record['是否达标'] || '',
    用时秒数: num(record['用时秒数']),
    提交时间: record['提交时间'] || '',
    练习提交编号: record['练习提交编号'] || '',
  }));
  const mistakes = mistakeRecords.map((record) => ({
    record_id: record.record_id,
    姓名: record['姓名'] || '',
    手机号: cleanPhone(record['手机号']),
    岗位: record['岗位'] || '',
    题目: record['题目'] || '',
    错选: record['错选'] || '',
    正确答案: record['正确答案'] || '',
    解析: record['解析'] || '',
    题库: record['题库'] || '',
    知识点: record['知识点'] || '',
    记录时间: record['记录时间'] || '',
    考试提交编号: record['考试提交编号'] || '',
  }));
  const errors = entries
    .map((entry, index) => entry.status === 'rejected' ? {
      table: ['employees', 'exams', 'practices', 'mistakes'][index],
      code: entry.reason?.code || '',
      status: entry.reason?.status || 0,
      message: entry.reason?.message || 'Feishu API error',
    } : null)
    .filter(Boolean);
  return { ok: true, employees, exams, practices, mistakes, ...(errors.length ? { errors } : {}) };
}

async function handleRanking(user) {
  const records = await listRecords(await examTableId());
  const formal = records.filter((record) => String(record['考核类型'] || '') === '正式考试').map((record) => ({
    name: record['姓名'] || '',
    phone: cleanPhone(record['手机号']),
    role: record['岗位'] || '',
    bank: record['题库'] || '',
    total: num(record['总题数']),
    percent: num(record['分数']),
    duration: num(record['用时秒数']),
    finishedAt: record['提交时间'] || '',
  }));
  const byPhone = new Map();
  for (const record of formal) {
    if (!record.phone) continue;
    const current = byPhone.get(record.phone);
    if (!current) {
      byPhone.set(record.phone, { ...record, totalExams: 1 });
      continue;
    }
    current.totalExams += 1;
    if (record.percent > current.percent || (record.percent === current.percent && record.duration < current.duration)) {
      const totalExams = current.totalExams;
      byPhone.set(record.phone, { ...record, totalExams });
    }
  }
  const ranking = [...byPhone.values()]
    .sort((left, right) => right.percent - left.percent || left.duration - right.duration)
    .map(({ phone, ...record }) => record);
  const ownHistory = formal.filter((record) => record.phone === cleanPhone(user.phone))
    .sort((left, right) => new Date(right.finishedAt || 0).getTime() - new Date(left.finishedAt || 0).getTime())
    .slice(0, 50)
    .map(({ phone, name, role, ...record }) => record);
  return { ok: true, ranking, ownHistory };
}

module.exports = async (req, res) => {
  const origin = String(req.headers.origin || '');
  if (req.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, res, 403, { ok: false, error: 'Origin not allowed' });
    return json(req, res, 204, {});
  }
  if (!configured()) return json(req, res, 503, { ok: false, error: 'Cloud service disabled' });
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action') || url.pathname.split('/').pop();
    if (req.method === 'GET' && action === 'stats') {
      const user = await requireActiveUser(req, {});
      if (!user || !user.isAdmin) return json(req, res, 403, { ok: false, error: '管理员权限不足' });
      return json(req, res, 200, await handleStats());
    }
    if (req.method !== 'POST') return json(req, res, 405, { ok: false, error: 'Method not allowed' });
    if (!writeAuthorized(req)) return json(req, res, 401, { ok: false, error: 'Unauthorized' });
    const payload = await readBody(req);
    enforceRateLimit(req, action);
    if (action === 'internal-practice-setup') {
      if (!authorized(req)) return json(req, res, 401, { ok: false, error: 'Unauthorized' });
      const [tableId, questionTableId] = await Promise.all([practiceTableReady(), questionChangeTableReady()]);
      return json(req, res, 200, {
        ok: true,
        table_id: tableId,
        table_name: '练习成绩记录',
        question_table_id: questionTableId,
        question_table_name: '题库修改记录',
      });
    }
    if (action === 'session') {
      const user = await requireActiveUser(req, payload);
      return json(req, res, 200, { ok: true, token: authTokenFor(user), user });
    }
    if (action === 'questions') {
      await requireActiveUser(req, payload);
      return json(req, res, 200, { ok: true, changes: await loadQuestionChanges() });
    }
    if (action.startsWith('admin-')) {
      const user = await requireAdmin(req, payload);
      if (action === 'admin-list') return json(req, res, 200, await handleAdminList());
      if (action === 'admin-add') return json(req, res, 200, await handleAdminAdd(payload));
      if (action === 'admin-delete') return json(req, res, 200, await handleAdminDelete(payload, user));
      if (action === 'admin-password') return json(req, res, 200, await handleAdminPassword(payload));
      if (action === 'admin-questions') return json(req, res, 200, await handleAdminQuestions(payload, user));
    }
    if (action === 'reset') return json(req, res, 200, await handlePasswordReset(payload));
    if (action === 'register') return json(req, res, 200, await handleRegister(payload));
    if (action === 'login' && Object.prototype.hasOwnProperty.call(payload, 'account')) {
      return json(req, res, 200, await handlePasswordLogin(payload));
    }
    if (action === 'exam-start') {
      const user = await requireActiveUser(req, payload);
      return json(req, res, 200, await handleExamStart(payload, user));
    }
    if (action === 'ranking') {
      const user = await requireActiveUser(req, payload);
      return json(req, res, 200, await handleRanking(user));
    }
    if (action === 'exam-submit') {
      const user = await requireActiveUser(req, payload);
      return json(req, res, 200, await handleExamSubmit(payload, user));
    }
    if (action === 'practice-submit') {
      const user = await requireActiveUser(req, payload);
      return json(req, res, 200, await handlePracticeSubmit(payload, user));
    }
    if (action === 'mistakes') {
      const user = await requireActiveUser(req, payload);
      return json(req, res, 200, await handleMistakes(payload, user));
    }
    return json(req, res, 404, { ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error(error);
    const status = [400, 401, 403, 404, 408, 409, 429, 500, 503].includes(Number(error?.status)) ? Number(error.status) : 400;
    return json(req, res, status, {
      ok: false,
      error: error?.message || 'Request rejected',
      code: error?.code || '',
    });
  }
};

module.exports._test = {
  selectExamQuestions, selectMooncakeExamQuestions, examPool, productQuestionAllowedForRole,
  handlePracticeSubmitOnce, applyQuestionChanges, questionPatchFromPayload,
};

