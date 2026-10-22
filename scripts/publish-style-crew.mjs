// Team-authored, explicitly attributed styling stories and persisted interactions.
// Accounts are non-deliverable, banned editorial identities, not customer accounts.
// Idempotent inserts preserve later visitor interactions. No emails or paid APIs.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { loadConfig } from '../gateway/src/config.js';
import { SupabaseGateway } from '../gateway/src/services/supabaseGateway.js';
const config=loadConfig();
if(new URL(config.supabase.url).hostname!=='hoxkrmadzjnyjaqjbyxc.supabase.co')throw new Error('Wrong project');
const db=new SupabaseGateway({config});
const collection=JSON.parse(await readFile('src/data/styleCrewCollection.json','utf8'));
const sources=JSON.parse(await readFile('src/data/juryWardrobeExtras.json','utf8'));
const manifestPath='backups/style-crew-accounts.local.json';
let accounts={};try{accounts=JSON.parse(await readFile(manifestPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const uuid=key=>{const h=createHash('sha256').update('ootie-style-crew-20261023:'+key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
async function insert(table,rows,conflict='id'){
 if(!rows.length)return;
 await db.serviceRequest(`/rest/v1/${table}?on_conflict=${conflict}`,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(rows)});
}
const now=new Date().toISOString();
for(const story of collection){
 if(!accounts[story.key]){
  const user=await db.serviceRequest('/auth/v1/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`style-crew-${story.key}@ootie.example`,password:randomBytes(40).toString('base64url'),email_confirm:true,ban_duration:'876000h',user_metadata:{display_name:`OOTIE Edit · ${story.name}`,team_curated:true}})});
  accounts[story.key]={userId:user.id};
  await writeFile(manifestPath,JSON.stringify(accounts,null,2));
 }
 const account=accounts[story.key];
 const verified=await db.serviceRequest(`/auth/v1/admin/users/${account.userId}`);
 if(!verified.banned_until || new Date(verified.banned_until)<new Date('2050-01-01'))throw new Error('Editorial sign-in must stay disabled');
 const profiles=await db.serviceRequest(`/rest/v1/ootie_profiles?user_id=eq.${account.userId}&select=id,username`);
 if(profiles.length>1)throw new Error('Ambiguous identity');
 account.profileId=profiles[0]?.id||uuid('profile-'+story.key);
 await writeFile(manifestPath,JSON.stringify(accounts,null,2));
 const profile={username:story.username,display_name:`OOTIE Edit · ${story.name}`,name:`OOTIE Edit · ${story.name}`,initials:story.initials,slogan:'OOTIE team-curated styling character. AI-assisted imagery; conversations prepared by the team.',bio:'OOTIE Style Crew — team-curated styling stories, not a customer testimonial.',public_closet:false};
 if(!profiles.length)await insert('ootie_profiles',[{...profile,id:account.profileId,user_id:account.userId,created_at:now}]);
 else if(!profiles[0].username)await db.serviceRequest(`/rest/v1/ootie_profiles?id=eq.${account.profileId}&user_id=eq.${account.userId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});
 story.items=story.itemKeys.map(key=>{
  const source=sources.find(source=>source.key===key);if(!source)throw new Error('Missing source');
  return {id:uuid(`piece-${story.key}-${key}`),owner_id:account.profileId,name:source.title,name_zh:source.zh,brand:source.brand,category:source.category,primary_color:source.color,color_hex:source.hex,photo:source.image,source_url:source.url,source_domain:'colorfulstandard.com',price:null,currency:'TWD',wear_count:0,hidden:false,favorite:false,created_at:now};
 });
 await insert('ootie_clothing_items',story.items);
 const imagePath=`ootd/${account.userId}/${uuid('image-'+story.key)}.png`;
 const imageBytes=await readFile(`public/images/editorial/scene-${story.key}.png`);
 await db.serviceRequest(`/storage/v1/object/ootie-ootd-images/${imagePath}`,{method:'POST',headers:{'Content-Type':'image/png','x-upsert':'true'},body:imageBytes});
 const imageUrl=`${config.supabase.url}/storage/v1/object/public/ootie-ootd-images/${imagePath}`;
 await insert('ootie_ootd_posts',[{id:story.postId,user_id:account.profileId,image:imageUrl,image_storage_path:imagePath,caption:story.caption,hashtags:['#OOTIEStyleCrew'],item_ids:[],wearing:[],likes:0,comments:0,created_at:now}]);
 // Repair only the initial local asset URL while the hosting build is pending.
 await db.serviceRequest(`/rest/v1/ootie_ootd_posts?id=eq.${story.postId}&user_id=eq.${account.profileId}&image=eq.${encodeURIComponent(story.image)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imageUrl,image_storage_path:imagePath})});
 await insert('ootie_sos_posts',[{id:story.sosId,user_id:account.profileId,closet_owner_id:account.profileId,title:story.title,details:story.details+' — OOTIE Style Crew, a team-curated styling brief.',occasion:story.occasion,weather:story.weather,when_label:'本週末',vibes:['Casual','Colorful'],closet_item_ids:story.items.map(item=>item.id),liked_suggestion_ids:[],status:'OPEN',created_at:now}]);
}
const comments=[
 ['The emerald and lilac combination feels fresh. I would keep the accessories simple.','The clean trouser line makes this work beautifully for the office.','A lightweight layer would make the morning commute easier.'],
 ['The blue outer layer is such a good focal point on a grey day.','I would add a compact umbrella and shoes with good grip.','The stripe underneath adds just enough detail.'],
 ['Coral and teal make a lovely pair for a morning train ride.','A roomy tote leaves space for a cardigan when the afternoon warms up.','This feels comfortable enough for the commute and a cafe stop.'],
 ['The lilac and olive mix feels relaxed but considered.','Comfortable shoes are a good choice for a long gallery afternoon.','I like the simple silhouette against the sculpture garden.'],
 ['Yellow and lavender make this feel like a sunny weekend.','A soft layer is handy for a breezy market morning.','The woven bag ties the colors together without competing.'],
 ['Teal linen and raspberry sneakers are a cheerful coastal pairing.','An extra light layer would be useful when the sea breeze picks up.','The cream trousers keep the whole palette soft.']
];
const likes=[],saves=[],replies=[],follows=[],suggestions=[];
for(let i=0;i<collection.length;i++){
 const story=collection[i],owner=accounts[story.key].profileId;
 for(let step=1;step<=4;step++){
  const actor=accounts[collection[(i+step)%collection.length].key].profileId;
  likes.push({id:uuid(`like-${i}-${step}`),post_id:story.postId,user_id:actor,created_at:now});
  if(step<=2)saves.push({id:uuid(`save-${i}-${step}`),profile_id:actor,target_type:'OOTD',target_id:story.postId,created_at:now});
  if(step<=3)replies.push({id:uuid(`comment-${i}-${step}`),post_id:story.postId,profile_id:actor,body:comments[i][step-1],created_at:now});
  if(step<=2){
   follows.push({id:uuid(`follow-${i}-${step}`),follower_id:actor,following_id:owner,created_at:now});
   suggestions.push({id:uuid(`suggestion-${i}-${step}`),sos_id:story.sosId,user_id:actor,item_ids:story.items.map(item=>item.id),message:step===1?'Start with these two pieces, then choose a comfortable shoe that suits your plans.':'Let one color lead and keep the other layer simple. Add a compact bag for the day.',hearts:0,created_at:now});
  }
 }
}
await insert('ootie_post_likes',likes,'post_id,user_id');
await insert('ootie_saved_outfits',saves,'profile_id,target_type,target_id');
await insert('ootie_post_comments',replies);
await insert('ootie_profile_follows',follows,'follower_id,following_id');
await insert('ootie_outfit_suggestions',suggestions,'sos_id,user_id');
const posts=await db.serviceRequest(`/rest/v1/ootie_ootd_posts?select=id,ootie_post_likes(count),ootie_post_comments(count)&id=in.(${collection.map(x=>x.postId).join(',')})`);
if(posts.length!==collection.length || posts.some(post=>post.ootie_post_likes[0].count<4 || post.ootie_post_comments[0].count<3))throw new Error('Interaction rows do not match');
await writeFile('backups/style-crew-publication.local.json',JSON.stringify({at:now,storyIds:collection.map(story=>story.postId),sosIds:collection.map(story=>story.sosId),profileIds:Object.values(accounts).map(account=>account.profileId),comments:replies.map(row=>row.id),likes:likes.map(row=>row.id),saves:saves.map(row=>row.id),suggestions:suggestions.map(row=>row.id)},null,2));
console.log(JSON.stringify({stories:posts.length,stylingBriefs:collection.length,likes:likes.length,comments:replies.length,saves:saves.length,suggestions:suggestions.length,teamCurated:true,customerAdoptionClaim:false,noEmailSent:true}));
