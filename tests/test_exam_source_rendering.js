const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const list = { innerHTML: '' };
const row = { name: '测试员工', role: '运营', bank: '日常年货题库', totalExams: 2, total: 50, percent: 96, duration: 192,
  source: { baseToken: 'actual-base', tableId: 'actual-table', tableName: '考试成绩记录-续表-1', recordId: 'actual-record' } };
const context = vm.createContext({
  state: { companyRanking: [row], ownFormalHistory: [row], rankingSources: [{ ...row.source, formalCount: 2 }], rankingLoading: false, rankingError: '' },
  storage: { examRecords: [] }, rankSortMode: 'score',
  document: { querySelector: () => list, querySelectorAll: () => [] },
  formatTime: value => String(value), examTimeLabel: value => value,
});
const helperStart = source.indexOf('function renderFeishuSource(');
const start = helperStart < 0 ? source.indexOf('function renderRanking(') : helperStart;
vm.runInContext(source.slice(source.indexOf('const escapeHtml ='), source.indexOf('const ', source.indexOf('const escapeHtml =') + 6)) +
  source.slice(start, source.indexOf('let adminEmployees =')), context);
vm.runInContext('renderRanking()', context);
assert.ok(list.innerHTML.includes('https://dcnz34opa4ey.feishu.cn/base/actual-base?table=actual-table'), 'links use actual API-provided base/table, not the user-supplied target or hardcoded base');
assert.ok(list.innerHTML.includes('考试成绩记录-续表-1'));
assert.ok(list.innerHTML.includes('2 次正式考试'), 'summary counts attempts, not ranked employees');
assert.ok(list.innerHTML.includes('查看飞书原表'));
assert.ok(list.innerHTML.includes('rel="noopener noreferrer"'));
assert.equal(vm.runInContext('renderFeishuSource(null)', context), '', 'old API responses remain renderable');
assert.equal(vm.runInContext('renderFeishuSource({baseToken:"javascript:alert(1)",tableId:"x"})', context), '', 'malformed source identifiers cannot become links');
context.state.rankingSources = [{ ...row.source, tableName: '<script>alert(1)</script>', formalCount: 2 }];
vm.runInContext('renderRanking()', context);
assert.ok(!list.innerHTML.includes('<script>'), 'Feishu table labels are escaped');
context.state.examStorage = {source:{...row.source,tableName:'考试成绩记录（新版）'},migrated:10,pending:3,error:''};
vm.runInContext('renderRanking()', context);
assert.ok(list.innerHTML.includes('考试成绩记录（新版）'),'replacement table is visible even before all records finish copying');
assert.ok(list.innerHTML.includes('3 条历史成绩'),'partial migration must show remaining work');
context.state.examStorage.error='<script>Forbidden</script>';
vm.runInContext('renderRanking()', context);
assert.ok(list.innerHTML.includes('补入未完成'),'failed historical copies must not be labeled complete');
assert.ok(!list.innerHTML.includes('<script>'));
console.log('exam Feishu source link rendering tests passed');
