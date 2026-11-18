const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const apiPath = path.resolve(__dirname, '../api/cloud.js');

function fixture(existingTable) {
  const fields = new Set(existingTable ? ['手机号', '设备ID', '学习进度', '更新时间'] : []);
  const tables = existingTable ? [{ table_id: 'learning', name: '员工学习进度' }] : [];
  const rows = existingTable ? [{ record_id: 'old', fields: { 手机号: '13000000001', 设备ID: 'phone', 学习进度: '{}', 更新时间: '2026-11-01 12:00:00' } }] : [];
  const createdFields = [];
  const reply = data => ({ ok: true, status: 200, json: async () => ({ code: 0, data }) });
  const fetch = async (url, options = {}) => {
    const parsed = new URL(url), body = JSON.parse(options.body || '{}');
    if (parsed.pathname.endsWith('/auth/v3/tenant_access_token/internal')) return { ok: true, json: async () => ({ code: 0, tenant_access_token: 'test-token', expire: 7200 }) };
    if (parsed.pathname.endsWith('/tables') && options.method === 'POST') {
      assert.equal(body.table.name, '员工学习进度');
      for (const field of body.table.fields) { assert.equal(field.type, 1); fields.add(field.field_name); }
      tables.push({ table_id: 'learning', name: body.table.name });
      return reply({ table_id: 'learning' });
    }
    if (parsed.pathname.endsWith('/tables')) return reply({ items: tables, has_more: false });
    if (parsed.pathname.endsWith('/fields') && options.method === 'POST') {
      assert.equal(body.type, 1);
      fields.add(body.field_name);
      createdFields.push(body.field_name);
      return reply({ field: { field_name: body.field_name, type: body.type } });
    }
    if (parsed.pathname.endsWith('/fields')) return reply({ items: [...fields].map(field_name => ({ field_name, type: 1 })) });
    if (parsed.pathname.endsWith('/records/search')) {
      const condition = body.filter.conditions[0];
      return reply({ items: rows.filter(row => row.fields[condition.field_name] === condition.value[0]), has_more: false });
    }
    if (parsed.pathname.endsWith('/records') && (!options.method || options.method === 'GET')) return reply({ items: rows, has_more: false });
    if (options.method === 'POST' || options.method === 'PUT') {
      for (const name of Object.keys(body.fields)) assert.ok(fields.has(name), `field must exist before record write: ${name}`);
      if (options.method === 'PUT') {
        const row = rows.find(row => row.record_id === parsed.pathname.split('/').pop());
        assert.ok(row, 'only update a known progress row');
        Object.assign(row.fields, body.fields);
        return reply({ record: row });
      }
      const row = { record_id: `new-${rows.length}`, fields: body.fields };
      rows.push(row);
      return reply({ record: row });
    }
    throw new Error(`Unexpected request: ${options.method || 'GET'} ${parsed.pathname}`);
  };
  const context = vm.createContext({ module: { exports: {} }, require: createRequire(apiPath), __dirname: path.dirname(apiPath),
    process: { env: { LARK_BASE_TOKEN: 'test-base', LARK_APP_ID: 'test-app', LARK_APP_SECRET: 'test-secret' } },
    fetch, URL, URLSearchParams, Buffer, AbortSignal, setTimeout, clearTimeout, console });
  vm.runInContext(fs.readFileSync(apiPath, 'utf8'), context);
  return { sync: context.module.exports._test.handleLearningProgress, fields, rows, createdFields, tables };
}

(async () => {
  const user = { phone: '13000000001', name: '朱飞龙' };
  for (const existing of [true, false]) {
    const f = fixture(existing);
    await f.sync({ deviceId: 'phone', ...(existing ? {} : { progress: { x: { status: 'learned' } } }) }, user);
    assert.ok(f.fields.has('姓名'), 'existing learning table must gain the name field, and new tables include it');
    assert.equal(f.rows[0].fields['姓名'], '朱飞龙');
    assert.equal(f.tables.length, 1, 'schema upgrade must reuse the existing learning table');
    if (existing) {
      assert.deepEqual(f.createdFields, ['姓名'], 'only the missing field is added');
      assert.equal(f.rows[0].fields['更新时间'], '2026-11-01 12:00:00');
      assert.equal(f.rows[0].fields['学习进度'], '{}');
    }
    await f.sync({ deviceId: 'desktop', progress: { y: { status: 'review' } } }, user);
    assert.equal(f.rows[1].fields['姓名'], '朱飞龙');
    assert.equal(f.createdFields.length, existing ? 1 : 0, 'repeat sync must not create duplicate name columns');
  }
  console.log('learning name schema upgrade and existing row backfill tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
