const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const BASE_TOKEN = process.env.LARK_BASE_TOKEN || '';
const EMPLOYEE_TABLE_ID = process.env.LARK_EMPLOYEE_TABLE_ID || '';
const EXAM_TABLE_ID = process.env.LARK_EXAM_TABLE_ID || '';
const MISTAKE_TABLE_ID = process.env.LARK_MISTAKE_TABLE_ID || '';
const LARK_APP_ID = process.env.LARK_APP_ID || '';
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || '';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://kevinzhu1990.github.io';
const AUTH_SECRET = process.env.AUTH_SECRET || '';
const EMPLOYEE_REGISTER_CODE = process.env.EMPLOYEE_REGISTER_CODE || '';
const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || '';
const AUTH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const json = (req, res, status, body) => {
  const origin = String(req.headers.origin || '');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (origin === ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', origin);
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

const sameOrigin = (req) => String(req.headers.origin || '') === ALLOWED_ORIGIN;

const writeAuthorized = (req) => sameOrigin(req) || authorized(req);

const configured = () => Boolean(
  BASE_TOKEN && EMPLOYEE_TABLE_ID && EXAM_TABLE_ID && MISTAKE_TABLE_ID &&
  LARK_APP_ID && LARK_APP_SECRET
);

const authConfigured = () => Boolean(AUTH_SECRET && EMPLOYEE_REGISTER_CODE && PASSWORD_PEPPER);

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

let cachedToken = null;
let cachedTokenExpireAt = 0;
let cachedTables = null;
let cachedTablesExpireAt = 0;

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
  '登录失败次数', '锁定截止时间', '密码更新时间', '客户端标识',
];
let accountFieldsReady = null;

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

const allowedRoles = new Set([
  '运营', '客服', '美工', '主播', '中控', '采购', '财务', '行政', '审单', '仓储', '管理', '新员工',
]);

const normalizeName = (value) => String(value || '').trim();
const validatePassword = (value) => typeof value === 'string'
  && value.length >= 8 && value.length <= 64 && /[A-Za-z]/.test(value) && /\d/.test(value);

const b64url = (value) => Buffer.from(value).toString('base64url');
const signToken = (payload) => {
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
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
  isAdmin: String(record['是否管理员']).toLowerCase() === 'true',
});

const authTokenFor = (user) => signToken({ ...user, exp: Date.now() + AUTH_TOKEN_TTL_MS });

const getBearer = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const tokenUser = (req, payload = {}) => verifyToken(payload.token || getBearer(req));

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
  const hash = await passwordHash(password);
  const employeeId = existing?.['员工ID'] || crypto.randomUUID();
  const fields = {
    '员工ID': employeeId,
    '姓名': name,
    '手机号': phone,
    '岗位': role,
    '密码哈希': hash,
    '账号状态': '正常',
    '是否管理员': String(existing?.['是否管理员']).toLowerCase() === 'true' ? 'true' : 'false',
    '注册时间': existing?.['注册时间'] || dt(new Date()),
    '最后登录时间': dt(new Date()),
    '登录失败次数': '0',
    '锁定截止时间': '',
    '密码更新时间': dt(new Date()),
    '客户端标识': String(payload.clientId || '').slice(0, 500),
    '备注': '知识库账号注册',
  };
  if (existing?.['密码哈希']) throw httpError(409, '该手机号已经注册，请直接登录');
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
    const lockMs = failures >= 10 ? 2 * 60 * 60 * 1000 : failures >= 5 ? 15 * 60 * 1000 : 0;
    const updates = {
      '登录失败次数': String(failures),
      '锁定截止时间': lockMs ? dt(new Date(Date.now() + lockMs)) : '',
      '客户端标识': String(payload.clientId || '').slice(0, 500),
    };
    if (failures >= 20) updates['账号状态'] = '停用';
    await updateRecord(tableId, record.record_id, updates);
    throw httpError(failures >= 20 ? 403 : 401, failures >= 20 ? '当前账号已停用，请联系管理员' : '账号或密码错误');
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

function requireUser(req, payload) {
  const user = tokenUser(req, payload);
  if (!user) throw httpError(401, 'Unauthorized');
  if (payload.user?.phone && cleanPhone(payload.user.phone) !== cleanPhone(user.phone)) throw httpError(403, 'Unauthorized');
  return user;
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

async function findEmployeeByPhone(phone) {
  try {
    const records = await searchRecords(await employeeTableId(), '手机号', phone);
    return records.find((record) => cleanPhone(record['手机号']) === phone) || null;
  } catch (error) {
    // Keep compatibility with older Base permissions that allow list but not search.
    if (error?.status === 400 || error?.status === 403) {
      const records = await listRecords(await employeeTableId());
      return records.find((record) => cleanPhone(record['手机号']) === phone) || null;
    }
    throw error;
  }
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

async function handleLogin(payload) {
  const user = payload.user || payload;
  const phone = cleanPhone(user.phone);
  if (!user.name || phone.length !== 11 || !user.role) throw new Error('Invalid user data');
  const fields = {
    '最后登录时间': dt(new Date()),
    '姓名': user.name,
    '手机号': phone,
    '岗位': user.role,
    '设备ID': payload.deviceId || '',
    '备注': '网页登录/进入学习',
  };
  const existing = await findEmployeeByPhone(phone);
  const tableId = await employeeTableId();
  const record = existing
    ? await updateRecord(tableId, existing.record_id, fields)
    : await createRecord(tableId, fields);
  return { ok: true, record_id: record?.record_id || existing?.record_id || '' };
}

const wrongText = (items, mode = 'ids') => (Array.isArray(items) ? items : []).map((question, index) => {
  if (mode === 'ids') return question.id ? `第${question.id}题` : `错题${index + 1}`;
  return [
    `${index + 1}. ${question.question || question.title || `错题${index + 1}`}`,
    question.selected ? `错选：${question.selected}` : '',
    question.answer ? `正确：${question.answer} ${question.answerText || ''}`.trim() : '',
  ].filter(Boolean).join('；');
}).join(mode === 'ids' ? '、' : '\n');

async function handleExam(payload) {
  const user = payload.user || {};
  const record = payload.record || payload;
  const total = num(record.total, 0);
  const correct = num(record.score, 0);
  const wrong = num(record.wrong, Math.max(0, total - correct));
  const percent = num(record.percent, total ? Math.round((correct / total) * 100) : 0);
  if (!user.name || cleanPhone(user.phone).length !== 11 || total < 1 || correct < 0 || correct > total || wrong !== total - correct) {
    throw new Error('Invalid exam data');
  }
  const fields = {
    '提交时间': dt(record.finishedAt || new Date()),
    '姓名': user.name,
    '手机号': cleanPhone(user.phone),
    '岗位': user.role || '',
    '考试名称': record.bank || '金尊产品知识考试',
    '总题数': total,
    '答对数': correct,
    '答错数': wrong,
    '分数': percent,
    '是否通过': percent >= 80 ? '通过' : '未通过',
    '用时秒数': num(record.duration, 0),
    '错题编号': wrongText(record.wrongDetails, 'ids'),
    '错题明细': wrongText(record.wrongDetails, 'details'),
    '设备ID': payload.deviceId || '',
  };
  const created = await createRecord(await examTableId(), fields);
  return { ok: true, record_id: created?.record_id || '' };
}

async function handleMistakes(payload) {
  const user = payload.user || {};
  const items = Array.isArray(payload.items) ? payload.items.slice(0, 20) : [];
  if (!user.name || cleanPhone(user.phone).length !== 11) throw new Error('Invalid user data');
  const tableId = await mistakeTableId();
  for (const item of items) {
    await createRecord(tableId, {
      '记录时间': dt(item.savedAt || new Date()),
      '姓名': user.name,
      '手机号': cleanPhone(user.phone),
      '岗位': user.role || '',
      '错题编号': item.id ? `第${item.id}题` : '',
      '题目': item.question || '',
      '错选': item.selected || '',
      '正确答案': item.answer ? `${item.answer} ${item.answerText || ''}`.trim() : '',
      '题库': item.bank || '',
      '知识点': item.knowledgePoint || '',
      '设备ID': payload.deviceId || '',
    });
  }
  return { ok: true, created: items.length };
}

async function handleStats() {
  const [employeeId, examId, mistakeId] = await Promise.all([
    employeeTableId(),
    examTableId(),
    mistakeTableId(),
  ]);
  const entries = await Promise.allSettled([
    listRecords(employeeId),
    listRecords(examId),
    listRecords(mistakeId),
  ]);
  const [employees, exams, mistakes] = entries.map((entry) => entry.status === 'fulfilled' ? entry.value : []);
  const errors = entries
    .map((entry, index) => entry.status === 'rejected' ? {
      table: ['employees', 'exams', 'mistakes'][index],
      code: entry.reason?.code || '',
      status: entry.reason?.status || 0,
      message: entry.reason?.message || 'Feishu API error',
    } : null)
    .filter(Boolean);
  return { ok: true, employees, exams, mistakes, ...(errors.length ? { errors } : {}) };
}

module.exports = async (req, res) => {
  const origin = String(req.headers.origin || '');
  if (req.method === 'OPTIONS') {
    if (origin && origin !== ALLOWED_ORIGIN) return json(req, res, 403, { ok: false, error: 'Origin not allowed' });
    return json(req, res, 204, {});
  }
  if (!configured()) return json(req, res, 503, { ok: false, error: 'Cloud service disabled' });
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action') || url.pathname.split('/').pop();
    if (req.method === 'GET' && action === 'stats') {
      const user = tokenUser(req, {});
      if (!user || !user.isAdmin) return json(req, res, 403, { ok: false, error: '管理员权限不足' });
      return json(req, res, 200, await handleStats());
    }
    if (req.method !== 'POST') return json(req, res, 405, { ok: false, error: 'Method not allowed' });
    if (!writeAuthorized(req)) return json(req, res, 401, { ok: false, error: 'Unauthorized' });
    const payload = await readBody(req);
    if (action === 'register') return json(req, res, 200, await handleRegister(payload));
    if (action === 'login' && Object.prototype.hasOwnProperty.call(payload, 'account')) {
      return json(req, res, 200, await handlePasswordLogin(payload));
    }
    if (action === 'login') return json(req, res, 200, await handleLogin(payload));
    if (action === 'exam') {
      requireUser(req, payload);
      return json(req, res, 200, await handleExam(payload));
    }
    if (action === 'mistakes') {
      requireUser(req, payload);
      return json(req, res, 200, await handleMistakes(payload));
    }
    return json(req, res, 404, { ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error(error);
    const status = [400, 401, 403, 409, 429, 500, 503].includes(Number(error?.status)) ? Number(error.status) : 400;
    return json(req, res, status, {
      ok: false,
      error: error?.message || 'Request rejected',
      code: error?.code || '',
    });
  }
};

