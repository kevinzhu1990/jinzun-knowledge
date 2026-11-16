const crypto = require('node:crypto');

// Extend the published questions so current product corrections are preserved.
function addDailyImageQuestions(questions, products, roleQuestions = []) {
  const bank = '日常年货题库';
  const point = '看货号选图片';
  const daily = products.filter(p => p.status === 'active' && p.bank === bank);
  const available = daily.filter(p => p.image);
  if (available.length !== daily.length || available.length < 4) {
    throw new Error('年货图片题需要每个在售产品有图片，且至少有四款不同产品');
  }
  const result = [...questions];
  const counts = Object.fromEntries([...'ABCD'].map(letter => [letter,
    questions.concat(roleQuestions).filter(q => q.answer === letter).length]));
  const digest = text => crypto.createHash('sha1').update(text).digest('hex');
  for (const product of daily) {
    if (result.some(q => q.bank === bank && q.code === product.code && q.knowledgePoint === point)) continue;
    const source = questions.find(q => q.bank === bank && q.code === product.code && q.knowledgePoint === '看图片选货号');
    if (!source) throw new Error(`年货 ${product.code} 缺少已核对的图片识别题`);
    const peers = available.filter(p => p.code !== product.code).sort((a, b) =>
      Number(b.line === product.line) - Number(a.line === product.line)
      || digest(`${product.code}:${a.code}`).localeCompare(digest(`${product.code}:${b.code}`)));
    const answer = [...'ABCD'].reduce((best, letter) => counts[letter] < counts[best] ? letter : best, 'A');
    counts[answer] += 1;
    const text = `${product.code} 对应的产品图片是哪一张？`;
    const question = {
      ...source,
      id: `P-${digest([bank, product.code, point, text].join('|')).slice(0, 12).toUpperCase()}`,
      knowledgePoint: point,
      question: text,
      questionImage: '',
      answer,
      answerText: product.image,
      explanation: `${product.code} 对应的产品图片是选项 ${answer}。`,
    };
    let index = 0;
    for (const letter of 'ABCD') {
      question[`option${letter}`] = '';
      question[`option${letter}Image`] = letter === answer ? product.image : peers[index++].image;
    }
    result.push(question);
  }
  return result;
}

module.exports = { addDailyImageQuestions };
