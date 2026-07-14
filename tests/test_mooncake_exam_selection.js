const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _test } = require('../api/cloud.js');

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
  assert.equal(counts.codeToImage + counts.imageToCode, Math.round(size * 0.6));
  assert.ok(Math.abs(counts.codeToImage - counts.imageToCode) <= 1);
  assert.equal(counts.flavor, Math.round(size * 0.2));
  assert.equal(counts.other, size - Math.round(size * 0.6) - Math.round(size * 0.2));
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
  assert.equal(imageCount, Math.round(size * 0.6));
  assert.equal(flavorCount, Math.round(size * 0.2));
}

console.log('Mooncake exam selection verification passed');
