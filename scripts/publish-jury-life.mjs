// The already-authorized jury account only. Preserve password, private photos and wardrobe.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadConfig} from '../gateway/src/config.js';
import {SupabaseGateway} from '../gateway/src/services/supabaseGateway.js';
const config=loadConfig();if(new URL(config.supabase.url).hostname!=='hoxkrmadzjnyjaqjbyxc.supabase.co')throw Error('Wrong project');
const db=new SupabaseGateway({config});
const account=JSON.parse(await readFile('backups/judge-account.local.json','utf8'));
const catalogue=JSON.parse(await readFile('src/data/juryWardrobeSources.json','utf8'));
const uuid=(prefix,key)=>{const h=createHash('sha256').update(prefix+key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const itemId=key=>uuid(`ootie-jury-v1:${account.userId}:`,key);
const id=key=>uuid('ootie-jury-life-v1:',key);
const headers={'Content-Type':'application/json'};
const old=await db.serviceRequest(`/rest/v1/ootie_profiles?id=eq.${account.profileId}&user_id=eq.${account.userId}&select=*`);
if(old.length!==1||!['ootie_jury','@ootie_jury','jury_maya82'].includes(old[0].username))throw Error('Unexpected jury identity');
await writeFile('backups/jury-profile-before-life.local.json',JSON.stringify(old,null,2));
const clothes=await db.serviceRequest(`/rest/v1/ootie_clothing_items?owner_id=eq.${account.profileId}&select=id,owner_id`);
for(const key of ['01','03','05','12','10','16','20','25'])if(!clothes.some(x=>x.id===itemId(key)))throw Error('Missing actual jury wardrobe item');
async function upload(key){
 const bytes=await readFile(`public/images/style-crew/${key}.webp`);
 const path=`ootd/${account.userId}/${id('asset-'+key)}.webp`;
 await db.serviceRequest(`/storage/v1/object/ootie-ootd-images/${path}`,{method:'POST',headers:{'Content-Type':'image/webp','x-upsert':'true'},body:bytes});
 return {path,url:`${config.supabase.url}/storage/v1/object/public/ootie-ootd-images/${path}`};
}
const avatar=await upload('jury-avatar');
await db.serviceRequest(`/rest/v1/ootie_profiles?id=eq.${account.profileId}&user_id=eq.${account.userId}`,{method:'PATCH',headers,body:JSON.stringify({username:'jury_maya82',name:'Maya',initials:'MY',avatar_url:avatar.url})});
const definitions=[
 {key:'jury-story-1',items:['01','12','16','20'],caption:'A white tee, olive trousers and a blue bag. A coffee stop before the rest of the day.'},
 {key:'jury-story-2',items:['03','10','16','20'],caption:'Lavender knitwear and a slow afternoon in the park. These are the pieces I keep reaching for.'},
 {key:'jury-story-3',items:['05','01','12','16','25'],caption:'Green layers and a tangerine cap for the weekend market. Room for a few more vegetables in the grocery bag.'}
];
for(const post of definitions){
 const media=await upload(post.key);
 const wearing=post.items.map(key=>{const source=catalogue.find(x=>x.key===key);return {id:itemId(key),name:source.title,photo:source.image,brand:source.brand,category:source.category};});
 await db.serviceRequest('/rest/v1/ootie_ootd_posts?on_conflict=id',{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({id:id(post.key),user_id:account.profileId,image:media.url,image_storage_path:media.path,caption:post.caption,hashtags:['#OOTIEStyleCrew'],wearing,item_ids:wearing.map(x=>x.id),likes:0,comments:0,created_at:new Date().toISOString()})});
}
await writeFile('backups/jury-life-publication.local.json',JSON.stringify({username:'jury_maya82',name:'Maya',posts:definitions.map(x=>id(x.key)),wardrobeCount:clothes.length,passwordUnchanged:true},null,2));
console.log(JSON.stringify({name:'Maya',username:'jury_maya82',posts:definitions.length,wardrobeItems:clothes.length,passwordUnchanged:true}));
