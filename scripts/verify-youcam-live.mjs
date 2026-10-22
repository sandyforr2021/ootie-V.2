// Explicit live acceptance against the existing jury account. Never prints credentials.
// Commands: prepare | try_on | skin_tone | status. Saved batch IDs prevent duplicate submission.
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {loadConfig} from '../gateway/src/config.js';
const config=loadConfig();
if(new URL(config.supabase.url).hostname!=='hoxkrmadzjnyjaqjbyxc.supabase.co') throw new Error('Wrong project');
const account=JSON.parse(await readFile('backups/judge-account.local.json','utf8'));
const authRes=await fetch(`${config.supabase.url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:config.supabase.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});
const auth=await authRes.json();
if(!authRes.ok||auth.user?.id!==account.userId) throw new Error('Jury authentication failed');
const path='backups/youcam-live-acceptance.local.json';
let run;
try{run=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;run={startedAt:new Date().toISOString(),input:'OOTIE AI editorial model look-1; not a real person',batches:{}};}
const save=()=>writeFile(path,JSON.stringify(run,null,2));
const base='http://127.0.0.1:8080';
async function api(route,body){
 const res=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${auth.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
 const data=await res.json();if(!res.ok) throw new Error(`${route}: ${res.status} ${data?.error?.code}`); return data;
}
const mode=process.argv[2]||'status';
if(mode==='prepare'){
 if(!run.personPath){
  const bytes=await readFile('public/images/editorial/look-1.png');
  const photo=await api('/v1/person-photos',{photoId:randomUUID(),imageData:`data:image/png;base64,${bytes.toString('base64')}`});run.personPath=photo.path;await save();
 }
 if(!run.productId){
  const sources=JSON.parse(await readFile('src/data/juryWardrobeSources.json','utf8'));const source=sources.find(row=>row.key==='03');
  const existing=(await api('/v1/shop/products')).products.find(row=>row.source_url===source.url);
  const product=existing||(await api('/v1/shop/products',{title:source.title,sourceUrl:source.url,imageUrl:source.image,category:'upper_body',color:source.hex})).product;
  run.productId=product.id;await save();
 }
 console.log(JSON.stringify({prepared:true,person:!!run.personPath,product:!!run.productId,capabilities:await api('/v1/shop/capabilities')}));
}else if(mode==='prepare-portrait'){
 if(!run.portraitPath){const bytes=await readFile('public/images/editorial/portrait-1.png');const photo=await api('/v1/person-photos',{photoId:randomUUID(),imageData:`data:image/png;base64,${bytes.toString('base64')}`});run.portraitPath=photo.path;await save();}
 console.log(JSON.stringify({portraitPrepared:!!run.portraitPath}));
}else if(['try_on','skin_tone','skin_tone_portrait'].includes(mode)){
 if(!run.personPath||!run.productId)throw new Error('Prepare first');
 if(!run.batches[mode]){run.batches[mode]=randomUUID();await save();}
 const kind=mode==='skin_tone_portrait'?'skin_tone':mode;
 const jobs=await api('/v1/shop/jobs',{batchId:run.batches[mode],kind,personPath:mode==='skin_tone_portrait'?run.portraitPath:run.personPath,productIds:kind==='try_on'?[run.productId]:[],consent:true});
 console.log(JSON.stringify({kind:mode,jobs:jobs.jobs.map(j=>({id:j.id,status:j.status}))}));
}else if(mode==='verify'){
 const before=await api('/v1/shop/capabilities');
 const original=(await api('/v1/shop/jobs')).jobs.find(j=>j.batch_id===run.batches.try_on);
 if(original?.status!=='succeeded'||!original.result_path)throw new Error('Try-on not ready');
 const replay=await api('/v1/shop/jobs',{batchId:run.batches.try_on,kind:'try_on',personPath:run.personPath,productIds:[run.productId],consent:true});
 const after=await api('/v1/shop/capabilities');
 if(replay.jobs.length!==1||replay.jobs[0].id!==original.id||before.remainingUnits!==after.remainingUnits)throw new Error('Replay was not idempotent');
 const imageRoute=base+'/v1/private-images/'+encodeURIComponent(original.result_path);
 const privateResult=await fetch(imageRoute,{headers:{Authorization:`Bearer ${auth.access_token}`}});
 if(!privateResult.ok||!privateResult.headers.get('content-type')?.startsWith('image/'))throw new Error('Private image unavailable');
 const bytes=Buffer.from(await privateResult.arrayBuffer());await writeFile('backups/youcam-live-result.jpg',bytes);
 const anonymous=await fetch(imageRoute);if(![401,403].includes(anonymous.status))throw new Error('Private image leaked');
 const anonRows=await fetch(config.supabase.url+'/rest/v1/ootie_youcam_jobs?select=id',{headers:{apikey:config.supabase.publishableKey}});
 if(anonRows.ok&&(await anonRows.json()).length)throw new Error('Anonymous job exposure');
 run.verification={checkedAt:new Date().toISOString(),idempotentReplay:true,privateImageReadable:true,anonymousImageStatus:anonymous.status,anonymousJobsHidden:true,imageBytes:bytes.length};await save();console.log(JSON.stringify(run.verification));
}else if(mode==='status'){
 const jobs=(await api('/v1/shop/jobs')).jobs;
 const relevant=jobs.filter(j=>Object.values(run.batches).includes(j.batch_id));
 run.jobs=relevant;run.checkedAt=new Date().toISOString();await save();
 console.log(JSON.stringify({jobs:relevant.map(j=>({id:j.id,kind:j.kind,status:j.status,error:j.error_code,hasImage:!!j.result_path,colors:j.result_data})),capabilities:await api('/v1/shop/capabilities')},null,2));
}else throw new Error('Unknown command');
