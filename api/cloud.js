const BASE_TOKEN = process.env.LARK_BASE_TOKEN || '';
const EMPLOYEE_TABLE_ID = process.env.LARK_EMPLOYEE_TABLE_ID || '';
const EXAM_TABLE_ID = process.env.LARK_EXAM_TABLE_ID || '';
const MISTAKE_TABLE_ID = process.env.LARK_MISTAKE_TABLE_ID || '';
const LARK_APP_ID = process.env.LARK_APP_ID || '';
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || '';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://kevinzhu1990.github.io';

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
      if (!authorized(req) && !sameOrigin(req)) return json(req, res, 401, { ok: false, error: 'Unauthorized' });
      return json(req, res, 200, await handleStats());
    }
    if (req.method !== 'POST') return json(req, res, 405, { ok: false, error: 'Method not allowed' });
    if (!writeAuthorized(req)) return json(req, res, 401, { ok: false, error: 'Unauthorized' });
    const payload = await readBody(req);
    if (action === 'login') return json(req, res, 200, await handleLogin(payload));
    if (action === 'exam') return json(req, res, 200, await handleExam(payload));
    if (action === 'mistakes') return json(req, res, 200, await handleMistakes(payload));
    return json(req, res, 404, { ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error(error);
    return json(req, res, error?.status === 429 ? 429 : 400, {
      ok: false,
      error: error?.message || 'Request rejected',
      code: error?.code || '',
    });
  }
};

