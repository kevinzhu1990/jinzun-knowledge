const assert = require('node:assert/strict');
const { _test } = require('../api/cloud.js');

const question = (knowledgePoint, bank = '月饼题库') => ({ bank, knowledgePoint });

assert.equal(_test.productQuestionAllowedForRole(question('产品名称'), '财务'), true);
assert.equal(_test.productQuestionAllowedForRole(question('保质期'), '新员工'), true);
assert.equal(_test.productQuestionAllowedForRole(question('看图片选货号'), '客服'), true);
assert.equal(_test.productQuestionAllowedForRole(question('看图片选货号'), '仓储'), false);
assert.equal(_test.productQuestionAllowedForRole(question('箱规'), '仓储'), true);
assert.equal(_test.productQuestionAllowedForRole(question('箱规'), '主播'), false);
assert.equal(_test.productQuestionAllowedForRole(question('商家编码', '商家编码题库'), '运营'), true);
assert.equal(_test.productQuestionAllowedForRole(question('商家编码', '商家编码题库'), '客服'), false);

console.log('岗位产品题适配检查通过');
