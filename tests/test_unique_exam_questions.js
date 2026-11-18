const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../knowledge-core');
const { _test } = require('../api/cloud');

// Exercise the actual browser selector too, without launching the page/network.
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const browser = vm.createContext({ window: { KnowledgeCore: core }, Math, Set });
vm.runInContext(source.split('\n')[0] + '\n' + source.slice(source.indexOf('const shuffle ='), source.indexOf('const downloadText =')) + '\nthis.select = selectMooncakeQuizQuestions;', browser);
const product = { bank: '日常年货题库', code: '2577', type: '单选题' };
const pool = [
  { ...product, id: 'image-code', knowledgePoint: '看图片选货号', question: '这张图片对应的货号是什么？', questionImage: '2577.jpg' },
  { ...product, id: 'code-image', knowledgePoint: '看货号选图片', question: '2577 对应的产品图片是哪一张？', optionAImage: '2577.jpg', answer: 'A' },
  { ...product, id: 'shelf', knowledgePoint: '保质期', question: '2577 的保质期是多少？', answer: 'A', optionA: '12个月', optionB: '6个月' },
  { ...product, id: 'shelf-reworded', knowledgePoint: '保质期', question: '2577 可以保存多久？', answer: 'B', optionA: '6个月', optionB: '12个月' },
  { ...product, id: 'net', knowledgePoint: '克重/净重', question: '2577 的净重是多少？' },
  { id: 'role-1', bank: '旺店通客服题库', knowledgePoint: '库存', question: '查看库存时，应进入哪个菜单？', optionA: '库存查询', optionB: '报表', answer: 'A' },
  { id: 'role-2', bank: '旺店通客服题库', knowledgePoint: '库存', question: '查看库存时，应进入哪个菜单？', optionA: '报表', optionB: '库存查询', answer: 'B' },
  { id: 'role-different-options', bank: '旺店通客服题库', knowledgePoint: '库存', question: '查看库存时，应进入哪个菜单？', optionA: '库存查询', optionB: '订单查询' },
];
for (const [name, select] of [
  ['正式综合', p => _test.selectExamQuestions(p, { mode: 'random' }, 50)],
  ['正式产品', p => _test.selectExamQuestions(p, { mode: 'product', bank: '日常年货题库' }, 50)],
  ['浏览器练习', p => browser.select(p, 50)],
]) {
  const selected = select(pool);
  assert.equal(selected.length, 7, `${name}只去除题干、图片及选项内容相同的题，不合并不同问法`);
  assert.equal(selected.filter(q => ['看图片选货号', '看货号选图片'].includes(q.knowledgePoint)).length, 2, '用户确认正反向图片题均保留');
  assert.equal(selected.filter(q => q.knowledgePoint === '保质期').length, 2, '同知识点的不同问法不能合并');
  assert.ok(selected.some(q => q.id === 'role-different-options'), '选项内容不同不是完全相同的题目');
  assert.ok(selected.some(q => q.id === 'net'), '同产品的其他知识点不能被误删');
  const duplicateId = select([pool[0], { ...pool[0], question: '改过题干但仍是同一道题' }]);
  assert.equal(duplicateId.length, 1, '同题号也必须唯一');
  const distinctImages = select([pool[0], { ...pool[0], id: 'other-image', questionImage: '2578.jpg' }]);
  assert.equal(distinctImages.length, 2, '相同图片题干但图片不同，必须保留');
}
const real = JSON.parse(fs.readFileSync(require.resolve('../outputs/product_quiz/金尊产品知识库题库.json'), 'utf8'));
for (const bank of ['月饼题库', '日常年货题库']) {
  const bankPool = real.filter(q => q.bank === bank);
  for (let run = 0; run < 30; run++) {
    for (const select of [p => _test.selectExamQuestions(p, { mode: 'product', bank }, 50), p => browser.select(p, 50)]) {
      const selected = select(bankPool);
      assert.equal(selected.length, 50, '图片题不足时从其他不重复知识题补足50题');
      const images = selected.filter(q => ['看图片选货号', '看货号选图片'].includes(q.knowledgePoint));
      assert.equal(new Set(selected.map(q => q.id)).size, 50);
      assert.equal(images.length, 35, '保留不同图片题型及原70%图片题配比');
    }
  }
}
assert.equal(core.uniqueQuestions(real).length, real.length, '现有产品题无完全重复题，正反向与不同问法全部保留');
console.log('仅完全相同考题去重：正式综合、产品考试和浏览器练习均通过');
