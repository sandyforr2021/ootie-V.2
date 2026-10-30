import test from 'node:test';
import assert from 'node:assert/strict';
import {CommerceService} from '../src/commerce/service.js';
import {CommerceRepository} from '../src/commerce/repository.js';

function service(pointBalance){
 return new CommerceService({enabled:true,repository:{
  budget:async()=>({unit_limit:100,allocated_units:0,reviewer_reserve_units:0,expires_at:new Date(Date.now()+60000).toISOString()}),
  userQuota:async()=>({dailyLimit:30,dailyUsed:0,activeCount:0,activeLimit:3}),pointBalance
 },provider:{balanceSnapshot:async()=>100}});
}
test('personal point balance stays separate from provider capacity',async()=>{
 const result=await service(async()=>4).capabilities({id:'user'});
 assert.equal(result.pointBalance,4);assert.equal(result.remainingUnits,30);
 assert.equal(result.platformPointsPerImage,2);assert.equal(result.enabled,true);
});
test('unavailable points disable generation without hiding the rest of the studio',async()=>{
 for(const read of [async()=>{throw new Error('unavailable');},async()=>null,async()=>NaN]){
  const result=await service(read).capabilities({id:'user'});
  assert.equal(result.enabled,false);assert.equal(result.pointBalance,null);
 }
});
test('repository does not convert a missing point balance to zero',async()=>{
 const repository=new CommerceRepository({serviceRequest:async()=>null});
 await assert.rejects(repository.pointBalance('user'),{code:'POINTS_UNAVAILABLE'});
});
test('daily submission exhaustion disables generation without hiding balance',async()=>{
 const app=service(async()=>100);
 app.repository.userQuota=async()=>({dailyLimit:30,dailyUsed:4,activeCount:0,activeLimit:3,generationLimit:2,generationUsed:2});
 const result=await app.capabilities({id:'user'});
 assert.equal(result.enabled,false);assert.equal(result.dailyGenerationRemaining,0);assert.equal(result.pointBalance,100);
});

test('new policy: paid generations bypass the daily count and legacy per-user units',async()=>{
 const app=service(async()=>100);
 app.repository.userQuota=async()=>({generationPolicyVersion:2,freeGenerationUsed:2,dailyLimit:2,dailyUsed:80,activeCount:0,activeLimit:3});
 const result=await app.capabilities({id:'user'});
 assert.equal(result.enabled,true);assert.equal(result.pointGenerationsUnlimited,true);
 assert.equal(result.dailyFreeGenerationRemaining,0);assert.equal(result.remainingUnits,100);
});
test('new policy: zero points uses free images and stops at two',async()=>{
 const app=service(async()=>0);
 let used=0;
 app.repository.userQuota=async()=>({generationPolicyVersion:2,freeGenerationUsed:used,dailyLimit:2,dailyUsed:20,activeCount:0,activeLimit:3});
 assert.equal((await app.capabilities({id:'user'})).enabled,true);
 used=2;const result=await app.capabilities({id:'user'});
 assert.equal(result.enabled,false);assert.equal(result.dailyFreeGenerationRemaining,0);
});
test('new policy still stops when provider budget, points lookup or free quota is unavailable',async()=>{
 const app=service(async()=>0);
 app.repository.userQuota=async()=>({generationPolicyVersion:2,activeCount:0,activeLimit:3});
 assert.equal((await app.capabilities({id:'user'})).enabled,false);
 app.repository.userQuota=async()=>({generationPolicyVersion:2,freeGenerationUsed:0,activeCount:0,activeLimit:3});
 app.provider.balanceSnapshot=async()=>0;
 assert.equal((await app.capabilities({id:'user'})).enabled,false);
});
