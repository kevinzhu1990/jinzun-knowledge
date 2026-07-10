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

const configured = () => Boolean(
  BASE_TOKEN && EMPLOYEE_TABLE_ID && EXAM_TABLE_ID && MISTAKE_TABLE_ID &&
  LARK_APP_ID && LARK_APP_SECRET && INTERNAL_API_TOKEN
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

async function larkApi(path, options = {}) {
  const response = await fetch(`https://open.feishu.cn/open-apis${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data.code && data.code !== 0)) {
    throw new Error(data.msg || data.error?.message || `Feishu API error ${response.status}`);
  }
  return data;
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
  const employees = await listRecords(EMPLOYEE_TABLE_ID);
  const existing = employees.find((record) => cleanPhone(record['手机号']) === phone);
  const record = existing
    ? await updateRecord(EMPLOYEE_TABLE_ID, existing.record_id, fields)
    : await createRecord(EMPLOYEE_TABLE_ID, fields);
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
  const created = await createRecord(EXAM_TABLE_ID, fields);
  return { ok: true, record_id: created?.record_id || '' };
}

async function handleMistakes(payload) {
  const user = payload.user || {};
  const items = Array.isArray(payload.items) ? payload.items.slice(0, 20) : [];
  if (!user.name || cleanPhone(user.phone).length !== 11) throw new Error('Invalid user data');
  for (const item of items) {
    await createRecord(MISTAKE_TABLE_ID, {
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
  const [employees, exams, mistakes] = await Promise.all([
    listRecords(EMPLOYEE_TABLE_ID),
    listRecords(EXAM_TABLE_ID),
    listRecords(MISTAKE_TABLE_ID),
  ]);
  return { ok: true, employees, exams, mistakes };
}

module.exports = async (req, res) => {
  const origin = String(req.headers.origin || '');
  if (req.method === 'OPTIONS') {
    if (origin && origin !== ALLOWED_ORIGIN) return json(req, res, 403, { ok: false, error: 'Origin not allowed' });
    return json(req, res, 204, {});
  }
  if (!configured()) return json(req, res, 503, { ok: false, error: 'Cloud service disabled' });
  if (!authorized(req)) return json(req, res, 401, { ok: false, error: 'Unauthorized' });
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action') || url.pathname.split('/').pop();
    if (req.method === 'GET' && action === 'stats') return json(req, res, 200, await handleStats());
    if (req.method !== 'POST') return json(req, res, 405, { ok: false, error: 'Method not allowed' });
    const payload = await readBody(req);
    if (action === 'login') return json(req, res, 200, await handleLogin(payload));
    if (action === 'exam') return json(req, res, 200, await handleExam(payload));
    if (action === 'mistakes') return json(req, res, 200, await handleMistakes(payload));
    return json(req, res, 404, { ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error(error);
    return json(req, res, 400, { ok: false, error: 'Request rejected' });
  }
};
