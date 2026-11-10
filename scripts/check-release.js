const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8'));
const health=require('../api/health').dataHealth();
assert.equal(manifest.productHash,health.productHash,'数据修改后必须运行 npm run build:data 更新版本校验值');
console.log('release manifest hash verified');
