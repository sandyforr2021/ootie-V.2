import test from 'node:test';
import assert from 'node:assert/strict';
import {CommerceService} from '../src/commerce/service.js';
const userId='12345678-1234-4123-8123-123456789000',postId='22345678-1234-4123-8123-123456789000';
test('public try-on authors come from the publisher profile and never expose Auth IDs or private fields',async()=>{
 const repository={posts:async()=>[{id:postId,user_id:userId,job_id:'private-job',title:'Shirt',caption:'A walk',image_url:'https://example.com/look.jpg'}],publicAuthors:async ids=>{assert.deepEqual(ids,[userId]);return[{user_id:userId,id:'public-profile',username:'mei',display_name:'Mei',initials:'ME',avatar_url:'https://example.com/avatar.jpg',email:'private@example.com'}];}};
 const service=new CommerceService({repository});const rows=await service.publicPosts();assert.equal(rows[0].author.displayName,'Mei');assert.equal(rows[0].author.username,'mei');assert.ok(!JSON.stringify(rows).includes(userId));assert.ok(!JSON.stringify(rows).includes('private@example'));assert.ok(!Object.hasOwn(rows[0],'job_id'));
});
test('a missing publisher profile never attributes another person to a public result',async()=>{
 const service=new CommerceService({repository:{post:async()=>({id:postId,user_id:userId,title:'Shirt'}),publicAuthors:async()=>[]}});assert.equal((await service.publicPost(postId)).author,null);
});
test('re-publishing an existing result returns the same author without another upload',async()=>{
 const service=new CommerceService({repository:{job:async()=>({id:postId,status:'succeeded',kind:'try_on',result_path:'private/result.jpg'}),post:async()=>({id:postId,user_id:userId,title:'Shirt'}),publicAuthors:async()=>[{user_id:userId,id:'profile',username:'maya',display_name:'Maya'}]},storage:{downloadPrivate:()=>{throw Error('Unexpected upload');}}});const result=await service.publish({id:userId},{jobId:postId,consent:true});assert.equal(result.id,postId);assert.equal(result.author.displayName,'Maya');
});
