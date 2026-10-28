import test from 'node:test';
import assert from 'node:assert/strict';
import { CommerceJobWorker } from '../src/commerce/jobWorker.js';
import { YouCamClient } from '../src/commerce/youcamClient.js';
import { isPublicAddress, publicHttpUrl, safeDownload } from '../src/commerce/safeDownload.js';

function workerFixture(overrides={}) {
  const job={id:'job',user_id:'owner',kind:'try_on',person_path:'person/owner/a.jpg',product_path:'shop/owner/b.jpg',status:'preparing',poll_errors:0,created_at:new Date().toISOString(),...overrides};
  const calls=[];
  const repository={claim:async()=>['preparing','processing'].includes(job.status)?job:null,updateJob:async(_id,_lease,patch)=>{calls.push(['update',patch]);Object.assign(job,patch);},releaseReservation:async(_id,_lease,code)=>{calls.push(['release',code]);Object.assign(job,{status:'failed',credit_state:'released',error_code:code});return true;}};
  const storage={downloadPrivate:async()=>({buffer:Buffer.from('image'),mimeType:'image/jpeg'}),uploadPrivate:async(path)=>calls.push(['save',path])};
  const provider={upload:async(_image,name)=>name,submit:async()=>{calls.push(['submit']);return 'task';},poll:async()=>({task_status:'success',results:{url:'https://image.example/result.jpg'}}),resultImage:async()=>({buffer:Buffer.from('result'),mimeType:'image/jpeg'})};
  return {job,calls,repository,storage,provider,worker:new CommerceJobWorker({repository,storage,provider})};
}
test('worker stores task ID and saves results before reporting success; polling never resubmits',async()=>{
  const f=workerFixture();await f.worker.tick();assert.equal(f.job.provider_task_id,'task');assert.equal(f.job.status,'processing');
  await f.worker.tick();assert.equal(f.job.status,'succeeded');assert.equal(f.calls.filter(c=>c[0]==='submit').length,1);
  assert.equal(f.calls.find(c=>c[0]==='save')[1],'ai-generated/owner/job.jpg');
  assert.ok(f.calls.findIndex(c=>c[0]==='save')<f.calls.findIndex(c=>c[1]?.status==='succeeded'));
});
test('uncertain paid POST moves to review and cannot automatically submit twice',async()=>{
  const f=workerFixture();let attempts=0;f.provider.submit=async()=>{attempts++;throw new Error('timeout after acceptance');};
  await f.worker.tick();await f.worker.tick();assert.equal(f.job.status,'needs_review');assert.equal(attempts,1);
});
test('a preflight failure releases its reservation without retrying the provider task',async()=>{
  const f=workerFixture();f.provider.submit=async()=>{const error=new Error('no verified credits');error.code='YOUCAM_FREE_CREDITS_UNAVAILABLE';error.requestNotSent=true;throw error;};
  await f.worker.tick();
  assert.equal(f.job.status,'failed');assert.equal(f.job.credit_state,'released');
  assert.equal(f.calls.filter(c=>c[0]==='release').length,1);
});
test('storage failure retries existing result without generating another image',async()=>{
  const f=workerFixture({provider_task_id:'existing-task',status:'processing'});let uploads=0;
  f.storage.uploadPrivate=async()=>{if(++uploads===1)throw new Error('temporary outage');};
  await f.worker.tick();assert.equal(f.job.status,'processing');assert.equal(f.job.poll_errors,1);
  await f.worker.tick();assert.equal(f.job.status,'succeeded');assert.equal(f.calls.filter(c=>c[0]==='submit').length,0);
});
test('skin-tone result retains only validated colors',async()=>{
  const f=workerFixture({provider_task_id:'tone',kind:'skin_tone',status:'processing'});
  f.provider.poll=async()=>({task_status:'success',results:{color:{skin_color:'#ae8766',hair_color:'invalid',secret:'discard'}}});
  await f.worker.tick();assert.deepEqual(f.job.result_data,{skin_color:'#ae8766'});
});
test('YouCam uploads image bytes without leaking API credentials to signed storage',async()=>{
  const calls=[];const client=new YouCamClient({apiKey:'test-only-secret',fetchImpl:async(url,options)=>{
    calls.push({url,options});return calls.length===1?{ok:true,json:async()=>({status:200,data:{files:[{file_id:'file-1',requests:[{method:'PUT',url:'https://bucket.s3.amazonaws.com/signed'}]}]}})}:{ok:true};
  }});
  assert.equal(await client.upload({buffer:Buffer.from('real-bytes'),mimeType:'image/jpeg'},'portrait.jpg'),'file-1');
  assert.equal(calls[0].options.headers.Authorization,'Bearer test-only-secret');
  assert.equal(calls[1].options.headers.Authorization,undefined);assert.equal(calls[1].options.body.toString(),'real-bytes');
  assert.equal(calls[1].options.redirect,'error');
});
test('product import rejects internal, mapped and metadata addresses before network access',async()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.0.2','172.16.1.1','::ffff:127.0.0.1','100.64.0.1'])assert.equal(isPublicAddress(ip),false);
  assert.equal(isPublicAddress('8.8.8.8'),true);
  assert.throws(()=>publicHttpUrl('https://secret:password@example.com'),/HTTP/);
  await assert.rejects(safeDownload('https://example.com',{lookup:async()=>[{address:'127.0.0.1',family:4}]}),/內部/);
});
test('an undetected face gives actionable feedback without resubmission',async()=>{
 const f=workerFixture({provider_task_id:'tone',kind:'skin_tone',status:'processing'});
 f.provider.poll=async()=>({task_status:'error',error_message:'No face was detected in the source image.'});
 await f.worker.tick();await f.worker.tick();
 assert.equal(f.job.status,'failed');assert.equal(f.job.error_code,'YOUCAM_FACE_NOT_DETECTED');
 assert.equal(f.calls.filter(c=>c[0]==='submit').length,0);
});

test('a sequential layer uses the previous output without resubmitting previous garments',async()=>{
 const f=workerFixture({input_result_path:'ai-generated/owner/previous.jpg',sequence_index:2,sequence_total:3});const downloaded=[];
 f.storage.downloadPrivate=async path=>{downloaded.push(path);return {buffer:Buffer.from('image'),mimeType:'image/jpeg'};};
 await f.worker.tick();assert.deepEqual(downloaded,['ai-generated/owner/previous.jpg','shop/owner/b.jpg']);assert.equal(f.calls.filter(c=>c[0]==='submit').length,1);
});
