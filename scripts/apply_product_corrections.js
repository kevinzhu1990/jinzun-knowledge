const fs = require('node:fs');
const path = require('node:path');

const CANONICAL_CODE = '2608';
const RETIRED_CODE = '2576';
const CANONICAL_NAME = '杏仁饼258g';
const MERCHANT_1940_1392 = '1940金尊陈皮豆沙月饼100g 散饼5个+1392金尊黄油椰蓉月饼100g 散饼5个';

function replaceLegacyText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replaceAll(RETIRED_CODE, CANONICAL_CODE)
    .replaceAll('2608粒粒杏仁饼小盒装258g', CANONICAL_NAME)
    .replaceAll('2608粒粒杏仁饼258g', CANONICAL_NAME)
    .replaceAll('2608杏仁饼258g', CANONICAL_NAME);
}

function normalize2608Question(question) {
  const normalized = {};
  for (const [key, value] of Object.entries(question)) normalized[key] = replaceLegacyText(value);
  if (String(normalized.code || '') !== CANONICAL_CODE) return normalized;

  normalized.code = CANONICAL_CODE;
  normalized.productName = CANONICAL_NAME;
  normalized.questionImage = replaceLegacyText(normalized.questionImage || '');
  for (const letter of 'ABCD') {
    const imageKey = `option${letter}Image`;
    normalized[imageKey] = replaceLegacyText(normalized[imageKey] || '');
  }

  if (normalized.knowledgePoint === '产品名称') {
    normalized.question = `${CANONICAL_CODE} 对应的产品名称是什么？`;
    normalized.answerText = CANONICAL_NAME;
    normalized[`option${normalized.answer}`] = CANONICAL_NAME;
    normalized.explanation = `${CANONICAL_CODE} 对应的产品名称是：${CANONICAL_NAME}。`;
  }
  return normalized;
}

function normalize0206Question(question) {
  if (String(question.code || '') !== '0206' || question.knowledgePoint !== '克重/净重') return question;
  const normalized = { ...question, answerText: '800g', explanation: '0206 的克重/净重是800g。' };
  const existing = [...'ABCD'].find((letter) => normalized[`option${letter}`] === '800g');
  if (existing) normalized.answer = existing;
  else normalized[`option${normalized.answer}`] = '800g';
  return normalized;
}

function normalizeMerchantQuestion(question) {
  if (question.answerText !== 'JZ-1940*5+1392*5') return question;
  const text = `“${MERCHANT_1940_1392}”对应的商家编码是什么？`;
  return {
    ...question,
    productName: MERCHANT_1940_1392,
    question: text,
    explanation: `${text.slice(0, -1)}：JZ-1940*5+1392*5。`,
  };
}

function merchantCodeReferences(value) {
  return [...String(value || '').matchAll(/(?<!\d)(\d{4})(?!\d)/g)].map((match) => match[1]);
}

function merchantNameReferences(value) {
  return [...String(value || '').matchAll(/(?:^|\D)(\d{4})(?!\d)(?!\s*(?:g|克|cm|年|款))/gi)].map((match) => match[1]);
}

function correctProductQuestions(questions) {
  if (!Array.isArray(questions)) throw new TypeError('Product questions must be an array');
  const normalized = questions.map((question) => normalizeMerchantQuestion(normalize0206Question(normalize2608Question(question))));
  const activeCodes = new Set(normalized
    .filter((question) => ['月饼题库', '日常年货题库'].includes(question.bank) && question.knowledgePoint === '产品名称')
    .map((question) => String(question.code || '')));
  return normalized.filter((question) => {
    if (question.bank !== '商家编码题库') return true;
    const codeReferences = merchantCodeReferences(question.answerText);
    const references = [...new Set([...codeReferences, ...merchantNameReferences(question.productName)])];
    return codeReferences.length > 0 && references.every((code) => activeCodes.has(code));
  });
}

function findProductQuizFile(root) {
  const directory = path.join(root, 'outputs', 'product_quiz');
  const files = fs.readdirSync(directory).filter((name) => name.endsWith('.json') && name.includes('知识库题库'));
  if (files.length !== 1) throw new Error(`Expected one product quiz JSON, found ${files.length}`);
  return path.join(directory, files[0]);
}

function migrate2608Image(root) {
  const directory = path.join(root, 'assets', 'product-images', 'daily');
  const retired = path.join(directory, `${RETIRED_CODE}.jpg`);
  const canonical = path.join(directory, `${CANONICAL_CODE}.jpg`);
  if (fs.existsSync(retired)) {
    if (!fs.existsSync(canonical)) fs.copyFileSync(retired, canonical);
    fs.unlinkSync(retired);
  }
}

function applyProductCorrections(root = path.resolve(__dirname, '..')) {
  const quizFile = findProductQuizFile(root);
  const original = JSON.parse(fs.readFileSync(quizFile, 'utf8'));
  const corrected = correctProductQuestions(original);
  fs.writeFileSync(quizFile, `${JSON.stringify(corrected, null, 2)}\n`, 'utf8');
  migrate2608Image(root);

  const serialized = JSON.stringify(corrected);
  const net0206 = corrected.find((q) => String(q.code) === '0206' && q.knowledgePoint === '克重/净重')?.answerText || '';
  return {
    has2608: corrected.some((q) => String(q.code) === CANONICAL_CODE),
    has2576: serialized.includes(RETIRED_CODE),
    has2545: corrected.some((q) => String(q.code) === '2545'),
    net0206,
  };
}

if (require.main === module) {
  const result = applyProductCorrections();
  if (!result.has2608 || result.has2576 || !result.has2545 || result.net0206 !== '800g') {
    throw new Error(`Product correction verification failed: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify(result));
}

module.exports = { correctProductQuestions, applyProductCorrections, merchantCodeReferences, merchantNameReferences };
