import {genuineContent} from './contentAuthenticity';
import {supabase} from './supabase';
export async function searchProfiles(query,client=supabase){
 const term=String(query||'').trim().replace(/^@/,'').slice(0,80);
 if(!term)return [];
 const pattern='%'+term.replace(/[\\%_]/g,'\\$&')+'%';
 const results=await Promise.all(['username','display_name'].map(field=>client.from('ootie_profiles').select('id,username,display_name,avatar_url').ilike(field,pattern).limit(20)));
 if(results.some(r=>r.error))throw new Error('PROFILE_SEARCH_FAILED');
 return [...new Map(genuineContent(results.flatMap(r=>r.data||[])).map(p=>[p.id,{...p,user_id:p.id}])).values()];
}
