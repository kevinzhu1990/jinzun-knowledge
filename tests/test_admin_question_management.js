const assert = require('node:assert/strict');
const { _test } = require('../api/cloud');

const base = [
  { id: 'Q-1', bank: '月饼题库', question: '原题1', optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1', answer: 'A' },
  { id: 'Q-2', bank: '月饼题库', question: '原题2', optionA: 'A2', optionB: 'B2', optionC: 'C2', optionD: 'D2', answer: 'B' },
];
const changes = [
  { id: 'Q-1', status: 'active', patch: { question: '已修改', answer: 'C', answerText: 'C1' } },
  { id: 'Q-2', status: 'deleted', patch: {} },
];

const active = _test.applyQuestionChanges(base, changes);
assert.equal(active.length, 1);
assert.equal(active[0].id, 'Q-1');
assert.equal(active[0].question, '已修改');
assert.equal(active[0].answer, 'C');

const all = _test.applyQuestionChanges(base, changes, true);
assert.equal(all.length, 2);
assert.equal(all[1]._changeStatus, 'deleted');

const patch = _test.questionPatchFromPayload({
  question: { optionA: '新A', optionB: '新B', optionC: '新C', optionD: '新D', answer: 'D' },
}, base[0]);
assert.equal(patch.answer, 'D');
assert.equal(patch.answerText, '新D');

console.log('admin question management tests passed');
