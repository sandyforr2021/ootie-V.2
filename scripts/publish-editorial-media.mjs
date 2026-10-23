// Preserve the exact six team editorial images, serving from their public media bucket.
import {readFile,writeFile} from 'node:fs/promises';
import {loadConfig} from '../gateway/src/config.js';
import {SupabaseGateway} from '../gateway/src/services/supabaseGateway.js';
const config=loadConfig();if(new URL(config.supabase.url).hostname!=='hoxkrmadzjnyjaqjbyxc.supabase.co')throw Error('Wrong project');
const db=new SupabaseGateway({config});const looks=JSON.parse(await readFile('src/data/editorialLooks.json','utf8'));
const posts=await db.serviceRequest(`/rest/v1/ootie_ootd_posts?id=in.(${looks.map(x=>x.id).join(',')})&select=id,user_id,image,image_storage_path`);
if(posts.length!==6)throw Error('Missing prepared posts');
await writeFile('backups/editorial-before-public-media.local.json',JSON.stringify(posts,null,2));
for(const look of looks){
 const post=posts.find(x=>x.id===look.id);const profiles=await db.serviceRequest(`/rest/v1/ootie_profiles?id=eq.${post.user_id}&select=user_id`);
 if(profiles.length!==1)throw Error('Author not found');
 const path=`ootd/${profiles[0].user_id}/${look.id}/${look.image.split('/').at(-1)}`;
 const url=`${config.supabase.url}/storage/v1/object/public/ootie-ootd-images/${path}`;
 if(post.image!==look.image&&post.image!==url)throw Error('Unexpected image; preserve author edit');
 const bytes=await readFile('public'+look.image);const type=look.image.endsWith('.png')?'image/png':'image/webp';
 await db.serviceRequest(`/storage/v1/object/ootie-ootd-images/${path}`,{method:'POST',headers:{'Content-Type':type,'x-upsert':'true'},body:bytes});
 await db.serviceRequest(`/rest/v1/ootie_ootd_posts?id=eq.${look.id}&user_id=eq.${post.user_id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:url,image_storage_path:path})});
}
console.log(JSON.stringify({publicEditorialImages:6,pixelsUnchanged:true,postsAndInteractionsPreserved:true}));
