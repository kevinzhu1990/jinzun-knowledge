const BASE_TOKEN = process.env.LARK_BASE_TOKEN || 'EAF6bIYugafViQsVYmZccrhkndd';
const EXAM_TABLE_ID = process.env.LARK_EXAM_TABLE_ID || 'tbltXwPPYSVkhL6d';
const LARK_APP_ID = process.env.LARK_APP_ID || '';
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || '';

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const dt = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const shanghai = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${shanghai.getUTCFullYear()}-${pad(shanghai.getUTCMonth() + 1)}-${pad(shanghai.getUTCDate())} ${pad(shanghai.getUTCHours())}:${pad(shanghai.getUTCMinutes())}:${pad(shanghai.getUTCSeconds())}`;
};

const cleanPhone = (value) => String(value || '').replace(/\D/g, '');
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

let cachedToken = null;
let cachedTokenExpireAt = 0;

async function larkApi(path, options = {}) {
  const res = await fetch(`https://open.feishu.cn/open-apis${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.code && data.code !== 0)) {
    throw new Error(data.msg || data.error?.message || `Feishu API error ${res.status}`);
  }
  return data;
}

async function getTenantToken() {
  if (cachedToken && Date.now() < cachedTokenExpireAt) return cachedToken;
  if (!LARK_APP_ID || !LARK_APP_SECRET) throw new Error('缺少 LARK_APP_ID / LARK_APP_SECRET 环境变量');
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
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields }),
  });
  return data?.data?.record || data?.data;
}

async function listRecords(tableId, pageSize = 200) {
  const token = await getTenantToken();
  const data = await larkApi(`/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/records?page_size=${pageSize}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (data?.data?.items || []).map((item) => ({ record_id: item.record_id, ...item.fields }));
}

async function handleLogin(payload) {
  const user = payload.user || payload;
  return { ok: true, user: { name: user.name || '', phone: cleanPhone(user.phone), role: user.role || '' } };
}

function wrongText(items, mode = 'ids') {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '';
  if (mode === 'ids') {
    return list.map((q, index) => q.id ? `第${q.id}题` : `错题${index + 1}`).join('、');
  }
  return list.map((q, index) => {
    const title = q.question || q.title || `错题${index + 1}`;
    const selected = q.selected ? `错选：${q.selected}` : '';
    const answer = q.answer ? `正确：${q.answer} ${q.answerText || ''}`.trim() : '';
    return [`${index + 1}. ${title}`, selected, answer].filter(Boolean).join('；');
  }).join('\n');
}

async function handleExam(payload) {
  const user = payload.user || {};
  const record = payload.record || payload;
  const percent = num(record.percent ?? record.score, 0);
  const total = num(record.total, 0);
  const correct = num(record.score, 0);
  const wrong = num(record.wrong, Math.max(0, total - correct));
  const duration = num(record.duration, 0);
  const fields = {
    '提交时间': dt(record.finishedAt || new Date()),
    '姓名': user.name || record.name || '',
    '手机号': cleanPhone(user.phone || record.phone),
    '岗位': user.role || record.role || '',
    '考试名称': record.bank || record.examName || record.type || '金尊产品知识考试',
    '总题数': total,
    '答对数': correct,
    '答错数': wrong,
    '分数': percent,
    '是否通过': percent >= 80 ? '通过' : '未通过',
    '用时秒数': duration,
    '用时分钟': duration ? Math.round((duration / 60) * 10) / 10 : 0,
    '错题编号': wrongText(record.wrongDetails || payload.wrongDetails, 'ids'),
    '错题明细': wrongText(record.wrongDetails || payload.wrongDetails, 'details'),
    '设备ID': payload.deviceId || payload.userAgent || '',
  };
  const examRecord = await createRecord(EXAM_TABLE_ID, fields);
  return { ok: true, record: { fields, record_id: examRecord?.record_id } };
}

async function handleMistakes(payload) {
  return { ok: true, skipped: true, note: '当前版本只记录考试成绩，错题明细随考试记录一起保存。' };
}

async function handleStats() {
  const exams = await listRecords(EXAM_TABLE_ID);
  return { ok: true, employees: [], exams, mistakes: [] };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action') || url.pathname.split('/').pop();
    if (req.method === 'GET' && action === 'stats') return json(res, 200, await handleStats());
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
    const payload = await readBody(req);
    if (action === 'login') return json(res, 200, await handleLogin(payload));
    if (action === 'exam') return json(res, 200, await handleExam(payload));
    if (action === 'mistakes') return json(res, 200, await handleMistakes(payload));
    return json(res, 404, { ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error(error.response || error);
    return json(res, 500, { ok: false, error: error.message });
  }
};
