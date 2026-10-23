// Exact prepared identities only. No new customer accounts, messages or paid APIs.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadConfig } from '../gateway/src/config.js';
import { SupabaseGateway } from '../gateway/src/services/supabaseGateway.js';
const config=loadConfig();
if(new URL(config.supabase.url).hostname!=='hoxkrmadzjnyjaqjbyxc.supabase.co')throw Error('Wrong project');
const db=new SupabaseGateway({config});
const crew=JSON.parse(await readFile('src/data/styleCrewExpansion.json','utf8'));
const accounts=JSON.parse(await readFile('backups/style-crew-accounts.local.json','utf8'));
const jury=JSON.parse(await readFile('backups/judge-account.local.json','utf8'));
const uuid=key=>{const h=createHash('sha256').update('ootie-crew-expansion-v2:'+key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const oldUuid=key=>{const h=createHash('sha256').update('ootie-style-crew-20261023:'+key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const jsonHeaders={'Content-Type':'application/json'};
const now=new Date().toISOString();
async function patch(table,filter,body){return db.serviceRequest(`/rest/v1/${table}?${filter}`,{method:'PATCH',headers:jsonHeaders,body:JSON.stringify(body)});}
async function insert(table,rows,conflict='id'){
 if(rows.length)await db.serviceRequest(`/rest/v1/${table}?on_conflict=${conflict}`,{method:'POST',headers:{...jsonHeaders,Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(rows)});
}
async function upload(person,key,image){
 const path=`ootd/${accounts[person.key].userId}/${uuid('asset-'+key)}.webp`;
 const bytes=await readFile('public'+image);
 if(bytes.length<10000)throw Error('Invalid image '+key);
 await db.serviceRequest(`/storage/v1/object/ootie-ootd-images/${path}`,{method:'POST',headers:{'Content-Type':'image/webp','x-upsert':'true'},body:bytes});
 return {url:`${config.supabase.url}/storage/v1/object/public/ootie-ootd-images/${path}`,path};
}
// Validate every required local asset and every identity before any write.
for(const person of crew){
 const a=accounts[person.key];if(!a?.userId||!a?.profileId||a.profileId===jury.profileId)throw Error('Invalid prepared identity');
 const p=await db.serviceRequest(`/rest/v1/ootie_profiles?id=eq.${a.profileId}&user_id=eq.${a.userId}&select=id,username`);
 if(p.length!==1||![person.username,`ootie_edit_${person.name.toLowerCase()}`].includes(p[0].username.replace(/^@/,'')))throw Error('Unexpected profile');
 for(const image of [person.avatar,...person.wardrobe.map(x=>x.image),...person.extraPosts.map(x=>x.image)])await readFile('public'+image);
}
const backup={at:now,profiles:[],posts:[],sos:[],clothes:[]};
for(const person of crew){
 const owner=accounts[person.key].profileId;
 for(const [table,field,target] of [['ootie_profiles','id','profiles'],['ootie_ootd_posts','user_id','posts'],['ootie_sos_posts','user_id','sos'],['ootie_clothing_items','owner_id','clothes']]){
  backup[target].push(...await db.serviceRequest(`/rest/v1/${table}?${field}=eq.${owner}&select=*`));
 }
}
backup.jurySos=await db.serviceRequest('/rest/v1/ootie_sos_posts?id=eq.dfb783f8-63ad-4321-88f5-3d50a8411693&select=*');
await writeFile('backups/style-crew-expansion-before.local.json',JSON.stringify(backup,null,2));
const counts=[];
for(const [i,person] of crew.entries()){
 const owner=accounts[person.key].profileId;
 const avatar=await upload(person,person.key+'-avatar',person.avatar);
 await patch('ootie_profiles',`id=eq.${owner}&user_id=eq.${accounts[person.key].userId}`,{username:person.username,display_name:person.name,name:person.name,initials:person.initials,avatar_url:avatar.url});
 const items=[];
 for(const garment of person.wardrobe){
  const media=await upload(person,garment.key,garment.image);
  const category=({'上身':'Tops','外套':'Outerwear','下身':'Bottoms','配件':'Accessories','鞋子':'Shoes','洋裝':'Dresses'})[garment.category];
  items.push({id:uuid('piece-'+garment.key),owner_id:owner,name:garment.name,category,photo:media.url,price:null,currency:'USD',wear_count:0,hidden:false,favorite:false,notes:'OOTIE team-curated fictional garment. AI-assisted personal wardrobe photography.',created_at:now});
 }
 await insert('ootie_clothing_items',items);
 // Hide only the exact old copied catalogue pieces; preserve original rows and history.
 for(const key of person.itemKeys)await patch('ootie_clothing_items',`id=eq.${oldUuid(`piece-${person.key}-${key}`)}&owner_id=eq.${owner}`,{hidden:true});
 await patch('ootie_sos_posts',`id=eq.${person.sosId}&user_id=eq.${owner}`,{status:'CLOSED'});
 const sosId=uuid('sos-'+person.key);
 await insert('ootie_sos_posts',[{id:sosId,user_id:owner,closet_owner_id:owner,title:person.title,details:person.details+' — OOTIE Style Crew, a team-curated styling brief.',occasion:person.occasion,weather:person.weather,when_label:'本週末',vibes:['Casual','Colorful'],closet_item_ids:items.map(x=>x.id),liked_suggestion_ids:[],status:'OPEN',created_at:now}]);
 const tagged=(selected)=>({item_ids:selected.map(x=>x.id),wearing:selected.map(x=>({id:x.id,name:x.name,category:x.category,photo:x.photo}))});
 const primaryCounts=[3,4,5,4,4,3];
 await patch('ootie_ootd_posts',`id=eq.${person.postId}&user_id=eq.${owner}`,tagged(items.slice(0,primaryCounts[i])));
 for(const [j,story] of person.extraPosts.entries()){
  const media=await upload(person,story.key,story.image);
  // Each photo uses only garments in its owner's capsule, never the jury closet.
  const indices=[[[0,1,2],[1,2]],[[0,1,2,3],[1,2,3]],[[0,1,2,3,4],[1,2,4]],[[0,1,2,3,5],[1,2,3,5]],[[0,1,2,3],[4,5,6,3]],[[0,1,2,6],[5,8]]][i][j];
  const postId=uuid('post-'+story.key);
  await insert('ootie_ootd_posts',[{id:postId,user_id:owner,image:media.url,image_storage_path:media.path,caption:story.caption,hashtags:['#OOTIEStyleCrew'],...tagged(indices.map(n=>items[n])),likes:0,comments:0,created_at:now}]);
  const likes=[],comments=[],saves=[];
  const commentText=[
   'The colors work so well in this setting. I would keep the lighter layer for the afternoon.',
   'I like how comfortable this looks. Those shoes make sense for a day of walking.',
   'The texture is the detail I noticed first. A small bag would keep the silhouette easy.',
   'I would try that top with the trousers again on a cooler day. Such a useful pairing.'
  ];
  for(let n=1;n<=2+(i+j)%4;n++){
   const actor=accounts[crew[(i+n)%crew.length].key].profileId;
   likes.push({id:uuid(`like-${story.key}-${n}`),post_id:postId,user_id:actor,created_at:now});
   if(n<=1+(i+j)%3)comments.push({id:uuid(`comment-${story.key}-${n}`),post_id:postId,profile_id:actor,body:commentText[(i+j+n)%commentText.length],created_at:now});
   if(n<=(i+j)%4)saves.push({id:uuid(`save-${story.key}-${n}`),profile_id:actor,target_type:'OOTD',target_id:postId,created_at:now});
  }
  await insert('ootie_post_likes',likes,'post_id,user_id');await insert('ootie_post_comments',comments);await insert('ootie_saved_outfits',saves,'profile_id,target_type,target_id');
 }
 const suggestions=[];
 for(let n=1;n<=2+(i%2);n++){
  const actor=accounts[crew[(i+n)%crew.length].key].profileId;
  const chosen=n===1?items.slice(0,Math.min(3,items.length)):items.slice(-Math.min(3,items.length));
  suggestions.push({id:uuid(`suggestion-${person.key}-${n}`),sos_id:sosId,user_id:actor,item_ids:chosen.map(x=>x.id),message:n===1?'I would start with '+chosen.map(x=>x.name).join(' + ')+'. Keep the layers easy for your plans.':'Another option from your shared pieces: '+chosen.map(x=>x.name).join(' + ')+'. Let one color lead.',hearts:0,created_at:now});
 }
 await insert('ootie_outfit_suggestions',suggestions,'sos_id,user_id');
 counts.push({name:person.name,owner,publicItems:items.length,sosId,postId:person.postId,itemIds:items.map(x=>x.id)});
 console.log(JSON.stringify({published:person.name,publicItems:items.length,posts:3}));
}
await patch('ootie_sos_posts',`id=eq.dfb783f8-63ad-4321-88f5-3d50a8411693&user_id=eq.${jury.profileId}`,{status:'CLOSED'});
await writeFile('backups/style-crew-expansion-publication.local.json',JSON.stringify({at:now,counts},null,2));
console.log(JSON.stringify({profiles:counts.length,uniqueGarments:counts.reduce((sum,x)=>sum+x.publicItems,0),additionalPosts:12,attribution:'team-curated',noCustomerAdoptionClaim:true}));
