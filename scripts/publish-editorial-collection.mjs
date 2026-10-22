import {readFile} from 'node:fs/promises';
import {loadConfig} from '../gateway/src/config.js';
import {SupabaseGateway} from '../gateway/src/services/supabaseGateway.js';
const config=loadConfig();
if(new URL(config.supabase.url).hostname!=='hoxkrmadzjnyjaqjbyxc.supabase.co') throw new Error('Wrong project');
const db=new SupabaseGateway({config});
const authorId=process.argv[2];
if(!/^[0-9a-f-]{36}$/i.test(authorId || '')) throw new Error('Pass the verified team profile ID');
const profiles=await db.serviceRequest(`/rest/v1/ootie_profiles?id=eq.${authorId}&select=id,user_id`);
if(profiles.length!==1) throw new Error('Team profile not uniquely found');
const author=await db.serviceRequest(`/auth/v1/admin/users/${profiles[0].user_id}`);
if(author.email!=='sandyforr2021@gmail.com') throw new Error('Incorrect team author');
const looks=JSON.parse(await readFile('src/data/editorialLooks.json','utf8'));
const rows=looks.map(look=>({id:look.id,user_id:profiles[0].id,image:look.image,caption:look.caption,
  hashtags:['#OOTIEEdit'],wearing:[],item_ids:[],likes:0,comments:0,created_at:new Date().toISOString()}));
// Ignore existing IDs on retries, preserving real subsequent comments and likes.
await db.serviceRequest('/rest/v1/ootie_ootd_posts?on_conflict=id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(rows)});
const result=await db.serviceRequest(`/rest/v1/ootie_ootd_posts?select=id,ootie_post_comments(count),ootie_post_likes(count)&id=in.(${looks.map(x=>x.id).join(',')})`);
if(result.length!==looks.length) throw new Error('Incomplete editorial collection');
console.log(JSON.stringify({published:result.length,realInteractionCounts:result.map(x=>({comments:x.ootie_post_comments[0].count,likes:x.ootie_post_likes[0].count}))}));
