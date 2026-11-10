const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function dataHealth() {
  const root = path.resolve(__dirname, '..');
  const files = ['products.json', 'outputs/product_quiz/金尊产品知识库题库.json', 'outputs/role_quiz/岗位学习考核题库.json'];
  const hash = crypto.createHash('sha256');
  for (const file of files) hash.update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'));
  return {ok:true,buildVersion:JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8')).buildVersion,productHash:hash.digest('hex')};
}
module.exports = (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(dataHealth()));
};
module.exports.dataHealth = dataHealth;
