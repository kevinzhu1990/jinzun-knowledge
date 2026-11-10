const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.join(__dirname, '../knowledge-core.js');
assert.ok(fs.existsSync(modulePath), 'shared catalogue and progress rules must exist');
const core = require(modulePath);
assert.equal(typeof core.fingerprintSource,'function','content fingerprint must ignore JSON response formatting');
assert.equal(core.fingerprintSource(['{\n  "x": 1\n}\n','[]\n']),'{"x":1}[]');
assert.equal(core.fingerprintSource(['{"x":1}','[]']),'{"x":1}[]');
const products = [
  {code:'2642',name:'2642曲奇礼盒',line:'糕点礼盒类',barcode:'6924535426422',net:'612g',status:'active',aliases:['2580'],compareCodes:['2381']},
  {code:'2381',name:'2381四宝礼盒',line:'糕点礼盒类',barcode:'123',status:'active'},
  {code:'2601',name:'2601停售产品',status:'retired'},
];
const questions = [
  {id:'one',bank:'日常年货题库',code:'2642',productName:'旧名',productLine:'旧分类',knowledgePoint:'产品名称',question:'2642名称？',answer:'B',answerText:'旧名',optionA:'2381四宝礼盒',optionB:'旧名',optionC:'2601停售产品',optionD:'别的产品'},
  {id:'two',bank:'日常年货题库',code:'2381',productName:'2381四宝礼盒',knowledgePoint:'产品名称',answer:'A',answerText:'2381四宝礼盒',optionA:'2381四宝礼盒',optionB:'额外选项',optionC:'新选项',optionD:'备用选项'},
  {id:'retired',bank:'日常年货题库',code:'2601',answerText:'2601停售产品'},
  {id:'combo',bank:'商家编码题库',code:'JZ-2601+2381',answerText:'JZ-2601+2381'},
];
const projected = core.projectQuestions(questions, products);
assert.deepEqual(projected.map(q=>q.id), ['one','two']);
assert.equal(projected[0].productName, '2642曲奇礼盒');
assert.equal(projected[0].answerText, projected[0].optionB);
assert.equal(projected[0].productLine, '糕点礼盒类');
assert.ok(!JSON.stringify(projected).includes('2601'));
assert.equal(new Set('ABCD'.split('').map(l=>projected[0]['option'+l])).size,4);
assert.deepEqual(core.projectQuestions(projected,products),projected,'projection is idempotent');
assert.equal(core.resolveProduct(products,'2580').code,'2642');
assert.equal(core.resolveProduct(products,'6924535426422').code,'2642');
assert.equal(core.resolveProduct(products,'2601').status,'retired');
const now=Date.parse('2026-11-10T01:00:00Z');
const a={x:{status:'learned',updatedAt:'2026-11-09T01:00:00Z'}};
const b={x:{status:'review',updatedAt:'2026-11-10T00:00:00Z'},bad:{status:'wrong',updatedAt:'2026-11-09T01:00:00Z'},future:{status:'learned',updatedAt:'2099-01-01T00:00:00Z'}};
const merged=core.mergeProgress(a,b,now);
assert.equal(merged.x.status,'review');
assert.ok(!merged.bad && !merged.future);
assert.deepEqual(core.mergeProgress(b,a,now),merged);
assert.throws(()=>core.validateProduct({...products[0],barcode:'bad'}),/条码/);
assert.throws(()=>core.validateProduct({...products[0],code:'2642+2601'}),/货号/);
assert.equal(core.versionsMatch({buildVersion:'new',productHash:'a'},{buildVersion:'new',productHash:'b'}),false);
assert.equal(core.versionsMatch({buildVersion:'new',productHash:'a'},{buildVersion:'new',productHash:'a'}),true);
console.log('growth features tests passed');
