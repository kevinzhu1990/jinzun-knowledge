const BASE_TOKEN = 'JFGvbh608a5bqksc0WQcEeTlnne';
const EMPLOYEE_TABLE_ID = 'tblSwMwUdLM9cxHR';
const EXAM_TABLE_ID = 'tbln21myi7ysV9LI';
const MISTAKE_TABLE_ID = 'tblmRBFD1V6ScIdL';

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
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const dt = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

async function upsertEmployee(user, patch = {}) {
  const phone = String(user?.phone || '').replace(/\D/g, '');
  if (!phone) return null;
  const fields = {
    '姓名': user.name || '',
    '手机号': phone,
    '岗位': user.role || '新员工',
    '最近登录时间': dt(),
    '状态': '正常',
    ...patch,
  };
  if (!patch['最近考试时间']) fields['首次登录时间'] = dt();
  return { fields };
}

async function handleLogin(payload) {
  const employee = await upsertEmployee(payload.user || payload);
  return { ok: true, employee, baseToken: BASE_TOKEN, tableId: EMPLOYEE_TABLE_ID };
}

async function handleExam(payload) {
  const user = payload.user || {};
  const record = payload.record || payload;
  const fields = {
    '姓名': user.name || record.name || '',
    '手机号': String(user.phone || record.phone || '').replace(/\D/g, ''),
    '岗位': user.role || record.role || '',
    '考核类型': record.type || record.examType || '练习模式',
    '题库': record.bank || '',
    '分数': Number(record.percent ?? record.score ?? 0),
    '答对题数': Number(record.score ?? 0),
    '总题数': Number(record.total ?? 0),
    '错题数': Number(record.wrong ?? Math.max(0, Number(record.total || 0) - Number(record.score || 0))),
    '是否通过': Number(record.percent ?? 0) >= 80 ? '是' : '否',
    '用时秒': Number(record.duration ?? 0),
    '完成时间': dt(record.finishedAt || new Date()),
    '设备信息': payload.userAgent || '',
  };
  await upsertEmployee(user, { '最近考试时间': fields['完成时间'] });
  return { ok: true, record: { fields }, baseToken: BASE_TOKEN, tableId: EXAM_TABLE_ID };
}

async function handleMistakes(payload) {
  const user = payload.user || {};
  const items = Array.isArray(payload.items) ? payload.items : [payload.item || payload];
  const records = items.filter(Boolean).map((q) => ({
    '姓名': user.name || q.name || '',
    '手机号': String(user.phone || q.phone || '').replace(/\D/g, ''),
    '岗位': user.role || q.role || '',
    '题目ID': String(q.id || q.questionId || ''),
    '题库': q.bank || '',
    '知识点': q.knowledgePoint || '',
    '题目': q.question || '',
    '错选答案': q.selected || '',
    '正确答案': `${q.answer || ''} ${q.answerText || ''}`.trim(),
    '解析': q.explanation || '',
    '出错时间': dt(q.savedAt || new Date()),
    '错题次数': 1,
  }));
  await upsertEmployee(user);
  return { ok: true, count: records.length, records, baseToken: BASE_TOKEN, tableId: MISTAKE_TABLE_ID };
}

async function handleStats() {
  return { ok: true, employees: [], exams: [], mistakes: [], note: 'GitHub Pages 静态版通过本地记录展示；飞书 Base 已创建，可后续接入云函数实时汇总。' };
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
    console.error(error);
    return json(res, 500, { ok: false, error: error.message });
  }
};
