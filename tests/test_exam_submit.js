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
function fixture({ partialBatch = false, lostBatchResponse = false, lostSingleResponse = false, lostTableResponse = false, recordWriteStepMs = 0, fullTables = [], denyCreate = false, denyWriteTables = [], legacyOnly = false, storage = null } = {}) {
  let clock = Date.now();
  class FixtureDate extends Date { static now() { return clock; } }
  const records = storage?.records || { employees: [], exams: [], mistakes: [], changes: [] };
  const tables = storage?.tables || [ ['employees', '员工信息'], ['exams', legacyOnly ? '考试成绩记录' : '考试成绩记录（新版）'], ['mistakes', '错题记录'], ['changes', '题库修改记录'] ].map(([table_id, name]) => ({ table_id, name }));
  const calls = [];
  const idempotentWrites = storage?.idempotentWrites || new Map();
  const fieldNames = ['员工ID', '密码哈希', '账号状态', '是否管理员', '注册时间', '最后登录时间', '登录失败次数', '锁定截止时间', '密码更新时间', '客户端标识', '会话版本', '备注',
    '考试名称', '考核类型', '题库', '总题数', '答对数', '答错数', '分数', '是否通过', '用时秒数', '提交时间', '考试提交编号', '考试会话ID', '设备ID',
    '记录时间', '错选', '正确答案', '解析', '知识点', '题目', '姓名', '手机号', '岗位', '错题编号', '题目ID', '状态', '修改内容', '修改时间', '修改人', '修改人手机', '来源记录ID'];
  if (!records.employees.length) records.employees.push({ record_id: 'test-employee', fields: { '员工ID': user.id, '姓名': user.name, '手机号': user.phone, '岗位': user.role, '会话版本': '1', '账号状态': '正常' } });
  const reply = data => ({ ok: true, status: 200, json: async () => ({ code: 0, data }) });
  const fakeFetch = async (url, options = {}) => {
    const parsed = new URL(url), table = parsed.pathname.match(/\/tables\/([^/]+)/)?.[1];
    const body = JSON.parse(options.body || '{}');
    calls.push({ path: parsed.pathname, method: options.method || 'GET', body, table });
    if (parsed.pathname.endsWith('/auth/v3/tenant_access_token/internal')) return { ok: true, json: async () => ({ code: 0, tenant_access_token: 'test-only-token', expire: 7200 }) };
    if (parsed.pathname.endsWith('/tables') && options.method === 'POST') {
      if (denyCreate) return { ok: false, status: 403, json: async () => ({ code: 91403, msg: 'Forbidden' }) };
      if (tables.some(table=>table.name===body.table.name)) return {ok:true,status:200,json:async()=>({code:1254013,msg:'TableNameDuplicated'})};
      const table_id = `overflow-${tables.length}`;
      tables.push({ table_id, name: body.table.name });
      records[table_id] = [];
      assert.ok(body.table.fields.some(f => f.field_name === '手机号'));
      if (body.table.name.startsWith('考试成绩记录')) assert.equal(body.table.fields.find(f => f.field_name === '分数').type, 2, '成绩数值字段不能误建为文本');
      if (lostTableResponse) { lostTableResponse = false; throw new TypeError('table created but response lost'); }
      return reply({ table_id });
    }
    if (parsed.pathname.endsWith('/tables')) {
      const offset = Number(parsed.searchParams.get('page_token') || 0);
      return reply({ items: tables.slice(offset, offset + 4), has_more: tables.length > offset + 4, page_token: String(offset + 4) });
    }
    if (parsed.pathname.endsWith('/fields')) return reply({ items: fieldNames.map(field_name => ({ field_name, type: 1 })) });
    if (parsed.pathname.endsWith('/records/search')) {
      const condition = body.filter.conditions[0];
      const matches = records[table].filter(r => String(r.fields[condition.field_name] || '') === String(condition.value[0]));
      const offset = Number(parsed.searchParams.get('page_token') || 0);
      return reply({ items: matches.slice(offset, offset + 20), has_more: matches.length > offset + 20,
        page_token: matches.length > offset + 20 ? String(offset + 20) : '' });
    }
    if (parsed.pathname.endsWith('/records/batch_create')) {
      if (fullTables.includes(table)) return { ok: true, status: 200, json: async () => ({ code: 1254103, msg: 'RecordExceedLimit' }) };
      const token = parsed.searchParams.get('client_token');
      if (token && idempotentWrites.has(token)) return reply({ records: idempotentWrites.get(token) });
      const created = body.records.map((r, index) => ({ record_id: `${table}-${records[table].length + index}`, fields: r.fields }));
      records[table].push(...created);
      if (token) idempotentWrites.set(token, created);
      if (lostBatchResponse) { lostBatchResponse = false; throw new TypeError('simulated response lost after server committed'); }
      return reply({ records: partialBatch ? created.slice(0, -1) : created });
    }
    if (parsed.pathname.endsWith('/records') && options.method === 'POST') {
      clock += recordWriteStepMs;
      if (denyWriteTables.includes(table)) return { ok: false, status: 403, json: async () => ({ code: 91403, msg: 'Forbidden' }) };
      if (fullTables.includes(table)) return { ok: true, status: 200, json: async () => ({ code: 1254103, msg: 'RecordExceedLimit' }) };
      const token = parsed.searchParams.get('client_token');
      if (token && idempotentWrites.has(token)) return reply({ record: idempotentWrites.get(token) });
      const record = { record_id: `${table}-${records[table].length}`, fields: body.fields };
      records[table].push(record);
      if (token) idempotentWrites.set(token, record);
      if (lostSingleResponse) { lostSingleResponse = false; throw new TypeError('simulated response lost after single record committed'); }
      return reply({ record });
    }
    if (parsed.pathname.endsWith('/records')) return reply({ items: records[table], has_more: false });
    throw new Error(`Unexpected external request: ${parsed.pathname}`);
  };
  const sandbox = vm.createContext({ module: { exports: {} }, require: createRequire(apiPath), __dirname: path.dirname(apiPath),
    process: { env: { AUTH_SECRET: secret, LARK_BASE_TOKEN: 'test-base', LARK_EMPLOYEE_TABLE_ID: 'employees', LARK_EXAM_TABLE_ID: 'exams', LARK_MISTAKE_TABLE_ID: 'mistakes', LARK_APP_ID: 'test-app', LARK_APP_SECRET: 'test-secret' } },
    fetch: fakeFetch, URL, URLSearchParams, Buffer, AbortSignal, setTimeout, clearTimeout, ...(recordWriteStepMs ? {Date:FixtureDate} : {}), console: { error() {} } });
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
  async function request(action, payload = {}, authenticated = true) {
    const req = { method: 'POST', url: `/api/${action}`, headers: { host: 'localhost', origin: 'https://jinzun-knowledge.vercel.app', ...(authenticated ? {authorization: `Bearer ${auth}`} : {}) }, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(payload)); } };
    const res = { statusCode: 200, setHeader() {}, end(text) { this.body = JSON.parse(text); } };
    await sandbox.module.exports(req, res);
    return { status: res.statusCode, ...res.body };
  }
  const submit = (sessionToken = session()) => request('exam-submit', { sessionToken, submissionId: 'test-submission', answers: questions.map(q => ({ id: q.id, answer: q.answer === 'A' ? 'B' : 'A' })) });
  return { records, tables, calls, session, submit, request, storage: { records, tables, idempotentWrites } };
}

(async () => {
  const legacy = fixture({legacyOnly:true});
  const oldFields = {'手机号':user.phone,'姓名':user.name,'岗位':'运营','考核类型':'正式考试','分数':96,'总题数':50,'答对数':48,'答错数':2,'用时秒数':192,'提交时间':'2026-11-18 12:05:22','考试会话ID':'legacy-session'};
  legacy.records.exams.push({record_id:'legacy-grade',fields:{...oldFields}});
  const upgraded = await legacy.request('ranking');
  const newTable = legacy.tables.find(table=>table.name==='考试成绩记录（新版）');
  assert.ok(newTable,'opening ranking must create the explicitly requested replacement exam table');
  assert.notEqual(newTable.table_id,'exams','replacement must not reuse the broken legacy table');
  assert.equal(legacy.records[newTable.table_id].length,1,'real historical grades are copied into the replacement table');
  for (const [key,value] of Object.entries(oldFields)) assert.equal(legacy.records[newTable.table_id][0].fields[key],value,'historical grade values must be preserved');
  assert.deepEqual(legacy.records.exams,[{record_id:'legacy-grade',fields:oldFields}],'legacy records must remain untouched');
  assert.equal(upgraded.ranking[0].totalExams,1,'old plus copied grade counts as one attempt');
  assert.equal(upgraded.ranking[0].source.tableId,newTable.table_id);
  assert.equal(upgraded.examStorage.migrated,1);
  assert.equal(upgraded.examStorage.pending,0);
  const coldLegacy = fixture({storage:legacy.storage});
  await coldLegacy.request('ranking');
  assert.equal(legacy.tables.filter(table=>table.name==='考试成绩记录（新版）').length,1,'cold starts reuse the replacement table');
  assert.equal(legacy.records[newTable.table_id].length,1,'repeat page loads cannot copy the same historical attempt twice');
  const newSaved = await coldLegacy.submit();
  assert.equal(newSaved.source.tableId,newTable.table_id,'future submissions go to the replacement, never the legacy table');
  assert.equal(legacy.records.exams.length,1);
  const deniedSetup = fixture({legacyOnly:true,denyCreate:true});
  const deniedResult = await deniedSetup.submit();
  assert.equal(deniedResult.ok,false,'without create permission do not silently keep writing the broken old table');
  assert.equal(deniedSetup.records.exams.length,0);
  const anonymous = fixture({legacyOnly:true});
  assert.equal((await anonymous.request('ranking',{},false)).status,401);
  assert.equal(anonymous.tables.length,4,'unauthenticated requests cannot create or populate a table');
  const recoverTable = fixture({legacyOnly:true,lostTableResponse:true});
  await recoverTable.request('ranking');
  assert.equal(recoverTable.tables.filter(table=>table.name==='考试成绩记录（新版）').length,1,'lost table-create responses must be looked up rather than blindly retried');
  const manyLegacy = fixture({legacyOnly:true,lostSingleResponse:true});
  for (let i=0;i<23;i++) manyLegacy.records.exams.push({record_id:`old-${i}`,fields:{...oldFields,'考试会话ID':`old-session-${i}`}});
  const firstMigration = await manyLegacy.request('ranking');
  assert.equal(firstMigration.examStorage.migrated,10,'historical copying is bounded to avoid submission timeouts');
  assert.equal(firstMigration.examStorage.pending,13);
  assert.equal(firstMigration.ranking[0].totalExams,23);
  const resumed = fixture({storage:manyLegacy.storage});
  assert.equal((await resumed.request('ranking')).examStorage.pending,3);
  assert.equal((await resumed.request('ranking')).examStorage.pending,0);
  const target = manyLegacy.tables.find(table=>table.name==='考试成绩记录（新版）');
  assert.equal(manyLegacy.records[target.table_id].length,23,'network retries and cold starts do not duplicate historical grades');
  const oldRetry = await resumed.submit(resumed.session({examId:'old-session-0'}));
  assert.equal(oldRetry.source.tableId,target.table_id,'retrying an old exam returns its migrated grade');
  assert.equal(manyLegacy.records[target.table_id].length,23);
  assert.equal(manyLegacy.calls.filter(c=>c.method==='DELETE'||c.method==='PUT').length,0,'old records and account/config data are never changed');
  const blockedCopy = fixture();
  blockedCopy.tables.push({table_id:'legacy',name:'考试成绩记录'});
  blockedCopy.records.legacy=[{record_id:'old',fields:{...oldFields}}];
  const cannotCopy = fixture({storage:blockedCopy.storage,denyWriteTables:['exams']});
  const blockedRanking = await cannotCopy.request('ranking');
  assert.ok(blockedRanking.examStorage.error,'copy errors must be explicit rather than claiming repair');
  assert.equal(blockedRanking.examStorage.pending,1);
  assert.equal(blockedRanking.ranking.length,1,'a migration error does not hide saved legacy grades');
  const fullMigration = fixture({fullTables:['exams']});
  fullMigration.tables.push({table_id:'legacy',name:'考试成绩记录'});
  fullMigration.records.legacy=[{record_id:'old',fields:{...oldFields}}];
  const concurrentFull = fixture({storage:fullMigration.storage,fullTables:['exams']});
  const fullResults = await Promise.all([fullMigration.request('ranking'),concurrentFull.request('ranking')]);
  for (const result of fullResults) {
    assert.ok(result.examStorage.error,'full canonical table must not report historical copying complete');
    assert.equal(result.examStorage.pending,1);
  }
  assert.equal(fullMigration.tables.filter(table=>table.name.startsWith('考试成绩记录（新版）-续表-')).length,0,'concurrent migrations cannot fan one history record into separate rollover tables');
  const parallelCopy = fixture();
  parallelCopy.tables.push({table_id:'legacy',name:'考试成绩记录'});
  parallelCopy.records.legacy=[{record_id:'old',fields:{...oldFields}}];
  await Promise.all([parallelCopy.request('ranking'),fixture({storage:parallelCopy.storage}).request('ranking')]);
  assert.equal(parallelCopy.records.exams.length,1,'two workers copying the same history use the same destination and idempotency token');
  const simultaneousSetup = fixture({legacyOnly:true});
  simultaneousSetup.records.exams.push({record_id:'old',fields:{...oldFields}});
  await Promise.all([simultaneousSetup.request('ranking'),fixture({storage:simultaneousSetup.storage}).request('ranking')]);
  const simultaneousTables = simultaneousSetup.tables.filter(table=>table.name==='考试成绩记录（新版）');
  assert.equal(simultaneousTables.length,1,'concurrent initial provisioning reuses the table when Feishu reports duplicate name');
  assert.equal(simultaneousSetup.records[simultaneousTables[0].table_id].length,1);
  const slowCopy = fixture({recordWriteStepMs:8000});
  slowCopy.tables.push({table_id:'legacy',name:'考试成绩记录'});
  slowCopy.records.legacy=Array.from({length:5},(_,i)=>({record_id:`slow-${i}`,fields:{...oldFields,'考试会话ID':`slow-session-${i}`}}));
  const slowResult = await slowCopy.request('ranking');
  assert.equal(slowResult.examStorage.migrated,2,'migration stops starting more writes after its time budget');
  assert.equal(slowResult.examStorage.pending,3);
  assert.equal(slowResult.examStorage.error,'','time slicing schedules continuation rather than claiming data loss');
  const f = fixture();
  const result = await f.submit();
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.total, 50);
  assert.equal(result.wrong, 50);
  assert.equal(f.records.exams.length, 1, '成绩必须真实落库后才返回成功');
  assert.ok(result.source, 'submission receipt must identify the actual Feishu storage location');
  assert.equal(result.source.tableId, 'exams', 'submission receipt identifies the actual Feishu table');
  assert.equal(result.source.recordId, result.record_id);
  assert.equal(result.source.baseToken, 'test-base');
  assert.equal(f.records.mistakes.length, 50);
  const coldRequestCount = f.calls.length;
  const mistakeWrites = f.calls.filter(c => c.table === 'mistakes' && c.method === 'POST' && !c.path.endsWith('/search'));
  assert.equal(mistakeWrites.length, 1, '50道错题必须合并为一次写入，避免逐条网络等待超时');
  assert.equal(f.calls.filter(c => ['exams', 'mistakes'].includes(c.table) && c.method === 'GET' && c.path.endsWith('/records')).length, 0,
    '全新考试不能扫描整张成绩表或错题表');
  assert.ok(f.calls.length * 1500 < 60000, '每次飞书请求模拟1.5秒时，冷启动50题交卷仍应在60秒内完成');
  const retry = await f.submit();
  assert.equal(retry.record_id, result.record_id);
  assert.deepEqual(retry.source, result.source, 'duplicate recovery preserves the original storage location');
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
  for (const fullTables of [['mistakes'], ['exams'], ['mistakes', 'exams']]) {
    const capacity = fixture({ fullTables });
    capacity.records.mistakes.push({ record_id: 'historic-mistake', fields: { '题目': '保留历史记录' } });
    const saved = await capacity.submit();
    assert.equal(saved.ok, true, `满表时应续存而不是阻止交卷: ${JSON.stringify(saved)}`);
    assert.ok(saved.record_id);
    assert.equal(capacity.records[saved.source.tableId][0].record_id, saved.record_id, 'receipt points at the real continuation row');
    assert.equal(Object.values(capacity.records).flat().filter(r => r.fields['考试会话ID'] === 'test-exam').length, 1);
    assert.equal(Object.values(capacity.records).flat().filter(r => r.fields['考试提交编号'] === 'test-submission' && r.fields['错题编号']).length, 50);
    assert.ok(capacity.records.mistakes.some(r => r.record_id === 'historic-mistake'), '历史记录不得删除');
    assert.equal(capacity.calls.filter(c => c.method === 'DELETE').length, 0);
    const cold = fixture({ fullTables, storage: capacity.storage });
    assert.equal((await cold.submit()).record_id, saved.record_id, '冷启动重试应从续表取回原成绩，不重复保存');
    const ranking = await cold.request('ranking');
    assert.equal(ranking.ownHistory.length, 1, '续表成绩必须出现在个人历史和排行中');
    assert.equal(ranking.ranking.length, 1);
    assert.equal(ranking.ownHistory[0].source.tableId, saved.source.tableId, 'old grades get their actual source without resubmitting');
    assert.equal(ranking.ranking[0].source.recordId, saved.record_id);
    const source = ranking.sources.find(source => source.tableId === saved.source.tableId);
    assert.equal(source.formalCount, 1);
    assert.equal(source.tableName, cold.tables.find(table => table.table_id === saved.source.tableId).name);
    assert.equal(source.baseToken, 'test-base');
    assert.equal(JSON.stringify(ranking).includes(user.phone), false, 'provenance must not expose employee phone numbers');
  }
  const blocked = fixture({ fullTables: ['mistakes'], denyCreate: true });
  const denied = await blocked.submit();
  assert.equal(denied.ok, false, '无续表权限时不能误报交卷成功');
  assert.match(denied.error, /错题.*满|错题.*容量/);
  assert.equal(blocked.records.exams.length, 0);
  const warm = fixture({ fullTables: ['mistakes', 'exams'] });
  await warm.request('ranking'); // Prime one server's table cache before a different server rolls over.
  const separateWorker = fixture({ fullTables: ['mistakes', 'exams'], storage: warm.storage });
  const separatelySaved = await separateWorker.submit();
  assert.equal((await warm.submit()).record_id, separatelySaved.record_id, '缓存了旧表目录的服务器也必须发现其他服务器刚创建的续表，避免重复交卷');
  assert.equal(Object.values(warm.records).flat().filter(r => r.fields['考试会话ID'] === 'test-exam').length, 1);
  const mixed = fixture();
  await mixed.submit();
  mixed.tables.push({table_id:'archive',name:'考试成绩记录-续表-1'});
  mixed.records.archive = [
    {record_id:'best',fields:{'手机号':user.phone,'姓名':user.name,'考核类型':'正式考试','分数':100,'用时秒数':60}},
    {record_id:'other',fields:{'手机号':'13000000001','姓名':'其他员工','考核类型':'正式考试','分数':98,'用时秒数':70}},
    {record_id:'practice',fields:{'手机号':user.phone,'考核类型':'练习模式','分数':100}},
  ];
  const mixedRanking = await mixed.request('ranking');
  assert.equal(mixedRanking.ranking.length,2);
  assert.equal(mixedRanking.ownHistory.length,2,'own history stays employee-isolated');
  assert.equal(mixedRanking.ranking[0].source.tableId,'exams','historical best grade now points to the verified replacement copy');
  assert.equal(mixedRanking.ranking[0].totalExams,2);
  assert.deepEqual(mixedRanking.sources.map(s=>[s.tableId,s.formalCount]),[['exams',3]],'migrated copies count once and practice records are not migrated');
  assert.equal(mixed.records.archive.length,3);
  assert.equal(mixed.records.exams.length,3);
  assert.equal(mixed.calls.filter(c=>c.method==='DELETE').length,0);
  console.log(JSON.stringify({ ok: true, questions: 50, wrong: result.wrong, coldRequestCount, mistakeWriteRequests: mistakeWrites.length, simulatedNetworkMs: coldRequestCount * 1500, duplicateSafe: true, expiredRecovery: true, lostResponseSafe: true }));
})().catch(error => { console.error(error); process.exitCode = 1; });
