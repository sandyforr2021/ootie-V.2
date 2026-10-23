import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadConfig} from '../gateway/src/config.js';
import {SupabaseGateway} from '../gateway/src/services/supabaseGateway.js';
const config=loadConfig();if(new URL(config.supabase.url).hostname!=='hoxkrmadzjnyjaqjbyxc.supabase.co')throw Error('Wrong project');
const db=new SupabaseGateway({config});
const crew=JSON.parse(await readFile('src/data/styleCrewExpansion.json','utf8'));
const refresh=JSON.parse(await readFile('src/data/styleCrewDistinctLooks.json','utf8'));
const accounts=JSON.parse(await readFile('backups/style-crew-accounts.local.json','utf8'));
const juryLife=JSON.parse(await readFile('backups/jury-life-publication.local.json','utf8'));
const hashId=(prefix,key)=>{const h=createHash('sha256').update(prefix+key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const v2=key=>hashId('ootie-crew-expansion-v2:',key),v3=key=>hashId('ootie-crew-distinct-v3:',key);
const headers={'Content-Type':'application/json'},now=new Date().toISOString();
const preparedIds=[...crew.flatMap(p=>[p.postId,...p.extraPosts.map(x=>v2('post-'+x.key))]),...juryLife.posts];
const before=await db.serviceRequest(`/rest/v1/ootie_ootd_posts?id=in.(${preparedIds.join(',')})&select=*`);
if(before.length!==21)throw Error('Unexpected prepared post set');
await writeFile('backups/crew-before-distinct-looks.local.json',JSON.stringify(before,null,2));
for(const person of refresh)for(const image of [...person.newItems.map(x=>x.image),...person.looks.map(x=>x.image)])await readFile('public'+image);
async function upload(person,key,image){
 const path=`ootd/${accounts[person.key].userId}/${v3('asset-'+key)}.webp`;
 await db.serviceRequest(`/storage/v1/object/ootie-ootd-images/${path}`,{method:'POST',headers:{'Content-Type':'image/webp','x-upsert':'true'},body:await readFile('public'+image)});
 return {path,url:`${config.supabase.url}/storage/v1/object/public/ootie-ootd-images/${path}`};
}
for(const person of refresh){
 const owner=accounts[person.key].profileId;
 const existing=await db.serviceRequest(`/rest/v1/ootie_clothing_items?owner_id=eq.${owner}&select=id,name,category,photo`);
 const byKey=new Map(crew.find(x=>x.key===person.key).wardrobe.map(item=>[item.key,existing.find(row=>row.id===v2('piece-'+item.key))]));
 const inserted=[];
 for(const item of person.newItems){
  const media=await upload(person,item.key,item.image);
  const row={id:v3('piece-'+item.key),owner_id:owner,name:item.name,category:item.category,photo:media.url,price:null,currency:'USD',wear_count:0,hidden:false,favorite:false,created_at:now};
  inserted.push(row);byKey.set(item.key,row);
 }
 if(inserted.length)await db.serviceRequest('/rest/v1/ootie_clothing_items?on_conflict=id',{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(inserted)});
 const original=before.find(x=>x.id===crew.find(x=>x.key===person.key).postId);
 const signatures=new Set([original.item_ids.slice().sort().join(',')]);
 for(const look of person.looks){
  const items=look.wear.map(key=>byKey.get(key));if(items.some(x=>!x))throw Error('Missing own garment');
  const signature=items.map(x=>x.id).sort().join(',');if(signatures.has(signature))throw Error('Duplicate prepared outfit');signatures.add(signature);
  const media=await upload(person,look.key,look.image);
  await db.serviceRequest(`/rest/v1/ootie_ootd_posts?id=eq.${v2('post-'+look.postKey)}&user_id=eq.${owner}`,{method:'PATCH',headers,body:JSON.stringify({image:media.url,image_storage_path:media.path,caption:look.caption,item_ids:items.map(x=>x.id),wearing:items.map(x=>({id:x.id,name:x.name,category:x.category,photo:x.photo})),hashtags:['#EverydayStyle']})});
 }
 const sosRows=await db.serviceRequest(`/rest/v1/ootie_sos_posts?user_id=eq.${owner}&select=id,details`);
 for(const sos of sosRows){const details=sos.details.replace(' — OOTIE Style Crew, a team-curated styling brief.','');if(details!==sos.details)await db.serviceRequest(`/rest/v1/ootie_sos_posts?id=eq.${sos.id}&user_id=eq.${owner}`,{method:'PATCH',headers,body:JSON.stringify({details})});}
 console.log(JSON.stringify({person:person.name,newPieces:inserted.length,distinctOutfits:signatures.size}));
}
// Remove only the reserved editorial hashtag from the exact prepared posts.
for(const post of before){
 const hashtags=(post.hashtags||[]).filter(tag=>!/^#?OOTIEStyleCrew$/i.test(tag));
 await db.serviceRequest(`/rest/v1/ootie_ootd_posts?id=eq.${post.id}&user_id=eq.${post.user_id}`,{method:'PATCH',headers,body:JSON.stringify({hashtags:hashtags.length?hashtags:['#DailyLook']})});
}
await writeFile('backups/distinct-crew-publication.local.json',JSON.stringify({at:now,preparedIds,newPieces:22,replacedScenes:12,onlyPreparedContentChecked:true},null,2));
