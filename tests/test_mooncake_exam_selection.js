const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _test } = require('../api/cloud.js');
const { addDailyImageQuestions } = require('../scripts/daily_image_quiz');

const makeQuestions = (knowledgePoint, count, prefix) => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index}`,
  knowledgePoint,
  answer: 'A',
}));

const pool = [
  ...makeQuestions('看货号选图片', 60, 'code-image'),
  ...makeQuestions('看图片选货号', 60, 'image-code'),
  ...makeQuestions('内配/口味', 50, 'flavor'),
  ...makeQuestions('产品名称', 100, 'other'),
];

for (const size of [10, 20, 30, 50, 100]) {
  const selected = _test.selectExamQuestions(pool, { mode: 'product', bank: '月饼题库' }, size);
  const counts = selected.reduce((result, question) => {
    if (question.knowledgePoint === '看货号选图片') result.codeToImage += 1;
    else if (question.knowledgePoint === '看图片选货号') result.imageToCode += 1;
    else if (question.knowledgePoint === '内配/口味') result.flavor += 1;
    else result.other += 1;
    return result;
  }, { codeToImage: 0, imageToCode: 0, flavor: 0, other: 0 });

  assert.equal(selected.length, size);
  assert.equal(counts.codeToImage + counts.imageToCode, Math.round(size * 0.7));
  assert.ok(Math.abs(counts.codeToImage - counts.imageToCode) <= 1);
  assert.equal(counts.flavor, Math.round(size * 0.1));
  assert.equal(counts.other, size - Math.round(size * 0.7) - Math.round(size * 0.1));
  assert.equal(new Set(selected.map((question) => question.id)).size, size);
}

const realQuestions = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'outputs', 'product_quiz', '金尊产品知识库题库.json'),
  'utf8',
));
const realMooncakePool = realQuestions.filter((question) => question.bank === '月饼题库');
for (const size of [10, 20, 30, 50, 100]) {
  const selected = _test.selectExamQuestions(realMooncakePool, { mode: 'product', bank: '月饼题库' }, size);
  const imageCount = selected.filter((question) => ['看货号选图片', '看图片选货号'].includes(question.knowledgePoint)).length;
  const flavorCount = selected.filter((question) => ['内配/口味', '口味个数'].includes(question.knowledgePoint)).length;
  assert.equal(selected.length, size);
  assert.equal(imageCount, Math.min(Math.round(size * 0.7), 47), '同产品图片识别只能考一次，最多47个不同月饼产品');
  assert.equal(flavorCount, Math.round(size * 0.1));
}

console.log('Mooncake exam selection verification passed');

for (const size of [10, 20, 30, 50]) {
  const selected = _test.selectExamQuestions(pool, { mode: 'product', bank: '日常年货题库' }, size);
  const imageCount = selected.filter(q => ['看货号选图片', '看图片选货号'].includes(q.knowledgePoint)).length;
  assert.equal(imageCount, Math.round(size * 0.7), '年货正式考试必须使用与月饼一致的图片比例');
  assert.equal(selected.filter(q => q.knowledgePoint === '内配/口味').length, Math.round(size * 0.1));
  assert.equal(new Set(selected.map(q => q.id)).size, size);
}

const dailyPool = realQuestions.filter(q => q.bank === '日常年货题库');
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'products.json'), 'utf8'));
const roleQuestions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'outputs/role_quiz/岗位学习考核题库.json'), 'utf8'));
assert.deepEqual(addDailyImageQuestions(realQuestions, products, roleQuestions), realQuestions,
  '重复发布不能重复添加图片题或改动原题');
const withoutNewImages = realQuestions.filter(q => !(q.bank === '日常年货题库' && q.knowledgePoint === '看货号选图片'));
const extended = addDailyImageQuestions(withoutNewImages, products, roleQuestions);
assert.deepEqual(extended.slice(0, withoutNewImages.length), withoutNewImages, '新增图片题必须保留现有题目内容与答案');
assert.deepEqual(extended, realQuestions, '重新构建必须生成相同题目和答案');
for (const size of [10, 20, 30, 50, 100, 300]) {
  const selected = _test.selectExamQuestions(dailyPool, { mode: 'product', bank: '日常年货题库' }, size);
  const expectedSize = Math.min(size, dailyPool.length - 25); // 25 products each have two reciprocal image questions.
  const imageCount = selected.filter(q => ['看货号选图片', '看图片选货号'].includes(q.knowledgePoint)).length;
  assert.equal(selected.length, expectedSize);
  assert.equal(imageCount, Math.min(Math.round(expectedSize * 0.7), 25));
  assert.equal(new Set(selected.map(q => q.id)).size, expectedSize, '图片题不足时应从其他题补足且不重复');
}
console.log('Daily image exam selection verification passed');
