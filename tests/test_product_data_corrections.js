const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  correctProductQuestions,
  applyProductCorrections,
} = require('../scripts/apply_product_corrections');

const fixture = [
  {
    id: 'P-LEGACY-2576',
    bank: '日常年货题库',
    code: '2576',
    productName: '2608杏仁饼258g',
    knowledgePoint: '产品名称',
    question: '2576 对应的产品名称是什么？',
    optionA: '2608杏仁饼258g',
    optionB: '其他产品',
    optionC: '2576粒粒杏仁饼258g',
    optionD: '另一产品',
    answer: 'A',
    answerText: '2608杏仁饼258g',
    explanation: '2576 对应的产品名称是2608杏仁饼258g。',
    questionImage: 'assets/product-images/daily/2576.jpg',
    optionAImage: '',
    optionBImage: '',
    optionCImage: '',
    optionDImage: '',
  },
  {
    id: 'P-0206-NET',
    bank: '月饼题库',
    code: '0206',
    productName: '0206金秋贡月800g（配礼袋）',
    knowledgePoint: '克重/净重',
    question: '0206 的克重/净重是多少？',
    optionA: '900g',
    optionB: '800g',
    optionC: '600g',
    optionD: '1000g',
    answer: 'A',
    answerText: '900g',
    explanation: '0206 的克重/净重是900g。',
  },
  {
    id: 'P-2545',
    bank: '月饼题库',
    code: '2545',
    productName: '2545在售产品',
    knowledgePoint: '产品名称',
    question: '2545 对应的产品名称是什么？',
    optionA: '2545在售产品',
    optionB: 'A',
    optionC: 'B',
    optionD: 'C',
    answer: 'A',
    answerText: '2545在售产品',
    explanation: '2545为在售产品。',
  },
  {
    id: 'P-MERCHANT-2576',
    bank: '商家编码题库',
    code: 'JZ-2576*2+2545',
    productName: '2576杏仁饼两盒+2545在售产品',
    knowledgePoint: '商家编码',
    question: '组合对应的商家编码是什么？',
    optionA: 'JZ-2576*2+2545',
    optionB: 'JZ-2576+2545*2',
    optionC: 'JZ-2576*4',
    optionD: 'JZ-2545*4',
    answer: 'A',
    answerText: 'JZ-2576*2+2545',
    explanation: '组合编码为JZ-2576*2+2545。',
  },
  {
    id: 'P-MERCHANT-INACTIVE',
    bank: '商家编码题库',
    code: 'JZ-9999*2',
    productName: '停售产品两盒',
    knowledgePoint: '商家编码',
    question: '停售组合对应的商家编码是什么？',
    optionA: 'JZ-9999*2',
    optionB: 'JZ-9999*4',
    optionC: 'JZ-2545*2',
    optionD: 'JZ-2608*2',
    answer: 'A',
    answerText: 'JZ-9999*2',
    explanation: '停售编码。',
  },
  {
    id: 'P-MERCHANT-INACTIVE-NAME',
    bank: '商家编码题库',
    code: 'JZ-2608*2+LD',
    productName: '2608杏仁饼两盒+2490礼袋',
    knowledgePoint: '商家编码',
    question: '含停售礼袋货号的组合编码是什么？',
    optionA: 'JZ-2608*2+LD',
    optionB: 'JZ-2608*4',
    optionC: 'JZ-2545*2',
    optionD: 'JZ-2608+2545',
    answer: 'A',
    answerText: 'JZ-2608*2+LD',
    explanation: '组合名称包含停售货号。',
  },
];

const corrected = correctProductQuestions(fixture);
const almond = corrected.find((question) => question.code === '2608');
assert.ok(almond, '旧货号2576必须转换为2608');
assert.equal(almond.productName, '杏仁饼258g');
assert.equal(almond.question, '2608 对应的产品名称是什么？');
assert.equal(almond.answerText, '杏仁饼258g');
assert.equal(almond.questionImage, 'assets/product-images/daily/2608.jpg');
assert.equal(JSON.stringify(corrected).includes('2576'), false, '题库不得残留2576');
assert.equal(corrected.some((question) => question.code === '2545'), true, '2545必须保留在售');
const merchant2608 = corrected.find((question) => question.id === 'P-MERCHANT-2608');
assert.ok(merchant2608, '含2576的组合编码必须更新为2608后保留');
assert.equal(merchant2608.answerText, 'JZ-2608*2+2545');
assert.equal(corrected.some((question) => question.id === 'P-MERCHANT-INACTIVE'), false, '停售货号商家编码必须删除');
assert.equal(corrected.some((question) => question.id === 'P-MERCHANT-INACTIVE-NAME'), false, '组合名称含停售货号也必须删除');

const mooncake = corrected.find((question) => question.id === 'P-0206-NET');
assert.equal(mooncake.answerText, '800g');
assert.equal(mooncake[`option${mooncake.answer}`], '800g');
assert.match(mooncake.explanation, /800g/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jinzun-product-correction-'));
fs.mkdirSync(path.join(root, 'outputs/product_quiz'), { recursive: true });
fs.mkdirSync(path.join(root, 'assets/product-images/daily'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'outputs/product_quiz/金尊产品知识库题库.json'),
  JSON.stringify(fixture),
  'utf8',
);
fs.writeFileSync(path.join(root, 'assets/product-images/daily/2576.jpg'), 'image');

const result = applyProductCorrections(root);
const deployed = JSON.parse(
  fs.readFileSync(path.join(root, 'outputs/product_quiz/金尊产品知识库题库.json'), 'utf8'),
);
assert.equal(JSON.stringify(deployed).includes('2576'), false);
assert.equal(fs.existsSync(path.join(root, 'assets/product-images/daily/2576.jpg')), false);
assert.equal(fs.existsSync(path.join(root, 'assets/product-images/daily/2608.jpg')), true);
assert.equal(result.has2608, true);
assert.equal(result.has2576, false);
assert.equal(result.has2545, true);
assert.equal(result.net0206, '800g');

console.log('product data correction tests passed');
