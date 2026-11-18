const assert=require('node:assert/strict');
const {handleLearningProgress,activeProducts}=require('../api/cloud')._test;
const records=[];
const dependencies={
  table:async()=> 'learning',
  search:async(table,field,value)=>records.filter(r=>r[field]===value),
  create:async(table,fields)=>records.push({record_id:String(records.length),...fields}),
  update:async(table,id,fields)=>Object.assign(records.find(r=>r.record_id===id),fields),
};
(async()=>{
  const user={phone:'13000000001',name:'朱飞龙'};
  await handleLearningProgress({deviceId:'phone',name:'伪造姓名',progress:{x:{status:'learned',updatedAt:'2026-01-01T00:00:00Z'}}},user,dependencies);
  assert.equal(records[0]['姓名'],'朱飞龙','new progress rows use the authenticated employee name, not payload name');
  await handleLearningProgress({deviceId:'desktop',progress:{y:{status:'review',updatedAt:'2026-01-02T00:00:00Z'}}},user,dependencies);
  const merged=await handleLearningProgress({deviceId:'phone'},user,dependencies);
  assert.equal(merged.progress.x.status,'learned');assert.equal(merged.progress.y.status,'review');
  assert.equal(records.length,2,'devices keep separate records');
  const other=await handleLearningProgress({deviceId:'phone',phone:user.phone},{phone:'13000000002'},dependencies);
  assert.deepEqual(other.progress,{},'payload phone cannot select another employee');
  await handleLearningProgress({deviceId:'phone',progress:{x:{status:'review',updatedAt:'2026-01-03T00:00:00Z'}}},user,dependencies);
  assert.equal(records.length,2,'same device updates its existing row');
  assert.equal((await handleLearningProgress({deviceId:'desktop'},user,dependencies)).progress.x.status,'review');
  const beforeBackfill=records.map(record=>({...record}));
  delete records[0]['姓名'];
  records[1]['姓名']='旧姓名';
  records.push({record_id:'other',手机号:'13000000002',姓名:'其他员工',设备ID:'phone',学习进度:'{}',更新时间:'2026-01-01 12:00:00'});
  await handleLearningProgress({deviceId:'phone',name:'伪造姓名'},user,dependencies);
  for (let index=0;index<2;index++) {
    assert.equal(records[index]['姓名'],'朱飞龙','read sync backfills missing or stale names on this employee devices');
    assert.equal(records[index]['学习进度'],beforeBackfill[index]['学习进度'],'name backfill preserves progress');
    assert.equal(records[index]['更新时间'],beforeBackfill[index]['更新时间'],'name backfill preserves progress time');
  }
  assert.equal(records.length,3,'name backfill must not create progress rows');
  assert.equal(records[2]['姓名'],'其他员工','name backfill must not touch another employee');
  let updates=0;
  await handleLearningProgress({deviceId:'phone'},user,{...dependencies,update:async()=>{updates++;}});
  assert.equal(updates,0,'up-to-date names need no extra Feishu writes');
  const products=activeProducts([{id:'product:2642',patch:{name:'已确认新名称',status:'retired',code:'9999'}}]);
  assert.equal(products.find(p=>p.code==='2642').name,'已确认新名称');
  assert.equal(products.find(p=>p.code==='2642').status,'retired');
  console.log('learning sync isolation and device merge tests passed');
})().catch(error=>{console.error(error);process.exit(1)});
