import {test} from 'node:test';
import assert from 'node:assert/strict';
import {retractReviewedShare,REVIEWED_SHARE as target} from '../../scripts/release/retract-reviewed-share.mjs';
const setup=()=>{
 const calls=[];
 const job={status:'succeeded',result_path:'private/original.jpg',result_data:{}};
 const repository={job:async()=>job,post:async()=>({user_id:target.userId,source_url:target.sourceUrl}),removePost:async(...args)=>{calls.push(['removePost',...args]);return true;},request:async(table,filter,options)=>{calls.push(['marker',options.body]);return [{...job,...options.body}];}};
 const storage={deleteObject:async(...args)=>calls.push(['deleteObject',...args])};
 return {calls,job,repository,storage};
};
test('approved withdrawal removes only the public copy and preserves the private result',async()=>{
 const f=setup();assert.equal(await retractReviewedShare(f),'withdrawn');
 assert.deepEqual(f.calls[0],['deleteObject','ootie-shop-shares',`${target.userId}/${target.id}.jpg`]);
 assert.equal(f.job.result_path,'private/original.jpg');
 assert.deepEqual(f.calls[2][1],{result_data:{[target.marker]:true}});
});
test('completion marker permits intentional future republishing',async()=>{
 const f=setup();f.job.result_data[target.marker]=true;assert.equal(await retractReviewedShare(f),'already-completed');assert.equal(f.calls.length,0);
});
test('wrong owner or changed source cannot be withdrawn by the release',async()=>{
 const f=setup();f.repository.post=async()=>({user_id:'other',source_url:target.sourceUrl});await assert.rejects(retractReviewedShare(f),/identity mismatch/);assert.equal(f.calls.length,0);
});
test('a storage error leaves the post for a safe retry and never marks completion',async()=>{
 const f=setup();f.storage.deleteObject=async()=>{throw new Error('storage unavailable');};await assert.rejects(retractReviewedShare(f),/storage unavailable/);assert.equal(f.calls.length,0);
});
