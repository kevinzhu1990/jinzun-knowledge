const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const apiPath = path.resolve(__dirname, '../api/cloud.js');
const questions = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../outputs/product_quiz/金尊产品知识库题库.json'), 'utf8')).slice(0, 50);
const secret = 'exam-submit-local-regression-secret';
const user = { id: 'test-employee', name: '回归测试', phone: '13000000000', role: '运营', sessionVersion: '1' };
function fixture({ partialBatch = false, lostBatchResponse = false } = {}) {
  const records = { employees: [], exams: [], mistakes: [], changes: [] };
  const calls = [];
  const idempotentWrites = new Map();
  const fieldNames = ['员工ID', '密码哈希', '账号状态', '是否管理员', '注册时间', '最后登录时间', '登录失败次数', '锁定截止时间', '密码更新时间', '客户端标识', '会话版本', '备注',
    '考试名称', '考核类型', '题库', '总题数', '答对数', '答错数', '分数', '是否通过', '用时秒数', '提交时间', '考试提交编号', '考试会话ID', '设备ID',
    '记录时间', '错选', '正确答案', '解析', '知识点', '题目', '姓名', '手机号', '岗位', '错题编号', '题目ID', '状态', '修改内容', '修改时间', '修改人', '修改人手机'];
  records.employees.push({ record_id: 'test-employee', fields: { '员工ID': user.id, '姓名': user.name, '手机号': user.phone, '岗位': user.role, '会话版本': '1', '账号状态': '正常' } });
  const reply = data => ({ ok: true, status: 200, json: async () => ({ code: 0, data }) });
  const fakeFetch = async (url, options = {}) => {
    const parsed = new URL(url), table = parsed.pathname.match(/\/tables\/([^/]+)/)?.[1];
    const body = JSON.parse(options.body || '{}');
    calls.push({ path: parsed.pathname, method: options.method || 'GET', body, table });
    if (parsed.pathname.endsWith('/auth/v3/tenant_access_token/internal')) return { ok: true, json: async () => ({ code: 0, tenant_access_token: 'test-only-token', expire: 7200 }) };
    if (parsed.pathname.endsWith('/tables')) return reply({ items: [ ['employees', '员工信息'], ['exams', '考试成绩记录'], ['mistakes', '错题记录'], ['changes', '题库修改记录'] ].map(([table_id, name]) => ({ table_id, name })) });
    if (parsed.pathname.endsWith('/fields')) return reply({ items: fieldNames.map(field_name => ({ field_name, type: 1 })) });
    if (parsed.pathname.endsWith('/records/search')) {
      const condition = body.filter.conditions[0];
      const matches = records[table].filter(r => String(r.fields[condition.field_name] || '') === String(condition.value[0]));
      const offset = Number(parsed.searchParams.get('page_token') || 0);
      return reply({ items: matches.slice(offset, offset + 20), has_more: matches.length > offset + 20,
        page_token: matches.length > offset + 20 ? String(offset + 20) : '' });
    }
    if (parsed.pathname.endsWith('/records/batch_create')) {
      const token = parsed.searchParams.get('client_token');
      if (token && idempotentWrites.has(token)) return reply({ records: idempotentWrites.get(token) });
      const created = body.records.map((r, index) => ({ record_id: `${table}-${records[table].length + index}`, fields: r.fields }));
      records[table].push(...created);
      if (token) idempotentWrites.set(token, created);
      if (lostBatchResponse) { lostBatchResponse = false; throw new TypeError('simulated response lost after server committed'); }
      return reply({ records: partialBatch ? created.slice(0, -1) : created });
    }
    if (parsed.pathname.endsWith('/records') && options.method === 'POST') {
      const record = { record_id: `${table}-${records[table].length}`, fields: body.fields };
      records[table].push(record);
      return reply({ record });
    }
    if (parsed.pathname.endsWith('/records')) return reply({ items: records[table], has_more: false });
    throw new Error(`Unexpected external request: ${parsed.pathname}`);
  };
  const sandbox = vm.createContext({ module: { exports: {} }, require: createRequire(apiPath), __dirname: path.dirname(apiPath),
    process: { env: { AUTH_SECRET: secret, LARK_BASE_TOKEN: 'test-base', LARK_EMPLOYEE_TABLE_ID: 'employees', LARK_EXAM_TABLE_ID: 'exams', LARK_MISTAKE_TABLE_ID: 'mistakes', LARK_APP_ID: 'test-app', LARK_APP_SECRET: 'test-secret' } },
    fetch: fakeFetch, URL, URLSearchParams, Buffer, AbortSignal, setTimeout, clearTimeout, console: { error() {} } });
  vm.runInContext(fs.readFileSync(apiPath, 'utf8'), sandbox);
  const authBody = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 3600000 })).toString('base64url');
  const auth = `${authBody}.${crypto.createHmac('sha256', secret).update(authBody).digest('base64url')}`;
  function session(extra = {}) {
    const data = { kind: 'exam', uid: user.id, phone: user.phone, sessionVersion: '1', examId: 'test-exam', bank: '日常年货题库', startedAt: Date.now() - 120000, deadlineAt: Date.now() + 600000,
      exp: Date.now() + 630000, questions: questions.map(q => ({ id: q.id, answer: q.answer })), ...extra };
    const iv = crypto.randomBytes(12), key = crypto.createHash('sha256').update(secret).digest();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
  }
  async function submit(sessionToken = session()) {
    const payload = { sessionToken, submissionId: 'test-submission', answers: questions.map(q => ({ id: q.id, answer: q.answer === 'A' ? 'B' : 'A' })) };
    const req = { method: 'POST', url: '/api/exam-submit', headers: { host: 'localhost', origin: 'https://jinzun-knowledge.vercel.app', authorization: `Bearer ${auth}` }, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(payload)); } };
    const res = { statusCode: 200, setHeader() {}, end(text) { this.body = JSON.parse(text); } };
    await sandbox.module.exports(req, res);
    return { status: res.statusCode, ...res.body };
  }
  return { records, calls, session, submit };
}

(async () => {
  const f = fixture();
  const result = await f.submit();
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.total, 50);
  assert.equal(result.wrong, 50);
  assert.equal(f.records.exams.length, 1, '成绩必须真实落库后才返回成功');
  assert.equal(f.records.mistakes.length, 50);
  const coldRequestCount = f.calls.length;
  const mistakeWrites = f.calls.filter(c => c.table === 'mistakes' && c.method === 'POST' && !c.path.endsWith('/search'));
  assert.equal(mistakeWrites.length, 1, '50道错题必须合并为一次写入，避免逐条网络等待超时');
  assert.equal(f.calls.filter(c => ['exams', 'mistakes'].includes(c.table) && c.method === 'GET' && c.path.endsWith('/records')).length, 0,
    '全新考试不能扫描整张成绩表或错题表');
  assert.ok(f.calls.length * 1500 < 60000, '每次飞书请求模拟1.5秒时，冷启动50题交卷仍应在60秒内完成');
  const retry = await f.submit();
  assert.equal(retry.record_id, result.record_id);
  assert.equal(f.records.exams.length, 1, '重试不能重复写入成绩');
  assert.equal(f.records.mistakes.length, 50, '重试不能重复写入错题');
  const expiredToken = f.session({ exp: Date.now() - 1000, deadlineAt: Date.now() - 31000 });
  const recovered = await f.submit(expiredToken);
  assert.equal(recovered.status, 200, '已交卷后即使考试计时结束，也应能读取已保存的成绩');
  assert.equal(recovered.record_id, result.record_id);
  const expired = fixture();
  const rejected = await expired.submit(expired.session({ exp: Date.now() - 1000, deadlineAt: Date.now() - 31000 }));
  assert.equal(rejected.ok, false, '未交卷的过期考试不能补交答案');
  assert.equal(expired.records.exams.length, 0);
  const partial = fixture({ partialBatch: true });
  const failure = await partial.submit();
  assert.equal(failure.ok, false, '错题未确认全部写入时不可误报成功');
  assert.equal(partial.records.exams.length, 0);
  const repaired = await partial.submit();
  assert.equal(repaired.ok, true, '部分响应丢失后可查询已有错题并继续交卷');
  assert.equal(partial.records.mistakes.length, 50);
  const lost = fixture({ lostBatchResponse: true });
  const restored = await lost.submit();
  assert.equal(restored.status, 200, '批量写入成功但响应丢失时可以安全重试');
  assert.equal(lost.records.mistakes.length, 50, '网络重试应复用幂等键，不能再次新增50条错题');
  const other = fixture();
  assert.equal((await other.submit(other.session({ uid: 'different-employee' }))).status, 401);
  assert.equal(other.records.exams.length, 0, '其他员工不能提交或查询该考试会话');
  console.log(JSON.stringify({ ok: true, questions: 50, wrong: result.wrong, coldRequestCount, mistakeWriteRequests: mistakeWrites.length, simulatedNetworkMs: coldRequestCount * 1500, duplicateSafe: true, expiredRecovery: true, lostResponseSafe: true }));
})().catch(error => { console.error(error); process.exitCode = 1; });
