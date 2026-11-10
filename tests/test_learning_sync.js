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
  const user={phone:'13000000001'};
  await handleLearningProgress({deviceId:'phone',progress:{x:{status:'learned',updatedAt:'2026-01-01T00:00:00Z'}}},user,dependencies);
  await handleLearningProgress({deviceId:'desktop',progress:{y:{status:'review',updatedAt:'2026-01-02T00:00:00Z'}}},user,dependencies);
  const merged=await handleLearningProgress({deviceId:'phone'},user,dependencies);
  assert.equal(merged.progress.x.status,'learned');assert.equal(merged.progress.y.status,'review');
  assert.equal(records.length,2,'devices keep separate records');
  const other=await handleLearningProgress({deviceId:'phone',phone:user.phone},{phone:'13000000002'},dependencies);
  assert.deepEqual(other.progress,{},'payload phone cannot select another employee');
  await handleLearningProgress({deviceId:'phone',progress:{x:{status:'review',updatedAt:'2026-01-03T00:00:00Z'}}},user,dependencies);
  assert.equal(records.length,2,'same device updates its existing row');
  assert.equal((await handleLearningProgress({deviceId:'desktop'},user,dependencies)).progress.x.status,'review');
  const products=activeProducts([{id:'product:2642',patch:{name:'已确认新名称',status:'retired',code:'9999'}}]);
  assert.equal(products.find(p=>p.code==='2642').name,'已确认新名称');
  assert.equal(products.find(p=>p.code==='2642').status,'retired');
  console.log('learning sync isolation and device merge tests passed');
})().catch(error=>{console.error(error);process.exit(1)});
