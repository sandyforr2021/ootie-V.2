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
