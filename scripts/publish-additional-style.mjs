import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {loadConfig} from '../gateway/src/config.js';
import {SupabaseGateway} from '../gateway/src/services/supabaseGateway.js';
const config=loadConfig();if(new URL(config.supabase.url).hostname!=='hoxkrmadzjnyjaqjbyxc.supabase.co')throw Error('Wrong project');
const db=new SupabaseGateway({config}),people=JSON.parse(await readFile('src/data/additionalStyleProfiles.json','utf8'));
const file='backups/additional-style-accounts.local.json';let accounts={};try{accounts=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const crew=Object.values(JSON.parse(await readFile('backups/style-crew-accounts.local.json','utf8')));
const uuid=k=>{const h=createHash('sha256').update('ootie-additional-style-20261023:'+k).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const headers={'Content-Type':'application/json'},now=new Date().toISOString();
async function insert(table,rows,conflict='id'){if(rows.length)await db.serviceRequest(`/rest/v1/${table}?on_conflict=${conflict}`,{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(rows)});}
for(const p of people)for(const key of ['look','avatar',...p.items.map((_,i)=>`piece-${i+1}`)])await readFile(`public/images/style-crew/${p.key}-${key}.webp`);
async function upload(p,key){const path=`ootd/${accounts[p.key].userId}/${uuid(p.key+'-'+key)}.webp`;await db.serviceRequest(`/storage/v1/object/ootie-ootd-images/${path}`,{method:'POST',headers:{'Content-Type':'image/webp','x-upsert':'true'},body:await readFile(`public/images/style-crew/${p.key}-${key}.webp`)});return{path,url:`${config.supabase.url}/storage/v1/object/public/ootie-ootd-images/${path}`};}
for(const [index,p] of people.entries()){
 if(!accounts[p.key]){
  const user=await db.serviceRequest('/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email:`styling-${p.key}@ootie.example`,password:randomBytes(40).toString('base64url'),email_confirm:true,ban_duration:'876000h',user_metadata:{display_name:p.name,name:p.name,team_curated:true}})});
  accounts[p.key]={userId:user.id};await writeFile(file,JSON.stringify(accounts,null,2));
 }
 const a=accounts[p.key],check=await db.serviceRequest(`/auth/v1/admin/users/${a.userId}`);if(!check.banned_until||Date.parse(check.banned_until)<Date.parse('2050-01-01'))throw Error('Prepared identity sign-in must stay disabled');
 const rows=await db.serviceRequest(`/rest/v1/ootie_profiles?user_id=eq.${a.userId}&select=id,display_name,display_name_changed_at`);if(rows.length>1)throw Error('Ambiguous profile');a.profileId=rows[0]?.id||uuid('profile-'+p.key);await writeFile(file,JSON.stringify(accounts,null,2));
 const avatar=await upload(p,'avatar');
 const profile={username:p.username,display_name:p.name,name:p.name,initials:p.initials,avatar_url:avatar.url,bio:`Fictional styling character created by the OOTIE team. ${p.city} outfit stories. AI-assisted imagery; prepared conversations.`,slogan:`${p.city} · ${p.country}`,public_closet:false};
 if(!rows.length)await insert('ootie_profiles',[{...profile,id:a.profileId,user_id:a.userId,created_at:now}]);
 else {if(rows[0].display_name!==p.name && rows[0].display_name_changed_at)throw Error('Existing profile name must not be changed during cooldown');await db.serviceRequest(`/rest/v1/ootie_profiles?id=eq.${a.profileId}&user_id=eq.${a.userId}`,{method:'PATCH',headers,body:JSON.stringify(profile)});}
 const items=[];
 for(const [i,[name,category]] of p.items.entries()){const media=await upload(p,`piece-${i+1}`);items.push({id:uuid(`piece-${p.key}-${i+1}`),owner_id:a.profileId,name,category,photo:media.url,price:null,currency:'USD',wear_count:0,hidden:false,favorite:false,notes:'Fictional personal garment; AI-assisted wardrobe photo.',created_at:now});}
 await insert('ootie_clothing_items',items);const photo=await upload(p,'look'),postId=uuid('post-'+p.key);
 await insert('ootie_ootd_posts',[{id:postId,user_id:a.profileId,image:photo.url,image_storage_path:photo.path,caption:p.caption,hashtags:['#CityStyle'],item_ids:items.map(x=>x.id),wearing:items.map(x=>({id:x.id,name:x.name,category:x.category,photo:x.photo})),likes:0,comments:0,created_at:now}]);
 const comments=[['I love the blue knit with the light pleats. Comfortable flats make this an easy walking outfit.','The shape of that skirt is lovely in the afternoon light.'],['That warm rust shade works beautifully with the cream layer.','Loafers are a practical choice for all those steps.'],['Linen and wide trousers are such a useful warm-weather combination.','The mint color keeps the outfit feeling fresh.'],['The green and raspberry combination is so joyful.','Those boots balance the flowing skirt beautifully.']][index];
 await insert('ootie_post_comments',comments.map((body,i)=>({id:uuid(`comment-${p.key}-${i}`),post_id:postId,profile_id:crew[(index+i)%crew.length].profileId,body,created_at:now})));
 await insert('ootie_post_likes',[0,1,2].map(i=>({id:uuid(`like-${p.key}-${i}`),post_id:postId,user_id:crew[(index+i)%crew.length].profileId,created_at:now})),'post_id,user_id');
 await insert('ootie_saved_outfits',[{id:uuid('save-'+p.key),profile_id:crew[(index+3)%crew.length].profileId,target_type:'OOTD',target_id:postId,created_at:now}],'profile_id,target_type,target_id');
 console.log(JSON.stringify({published:p.name,clothes:items.length,comments:comments.length,likes:3,fictional:true}));
}
await writeFile('backups/additional-style-publication.local.json',JSON.stringify({at:now,postIds:people.map(p=>uuid('post-'+p.key)),fictional:true,paidApiCalls:0},null,2));
