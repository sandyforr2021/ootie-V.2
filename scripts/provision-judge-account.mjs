// Run only for the explicitly requested jury account. Never lists existing Auth users.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {loadConfig} from '../gateway/src/config.js';
import {SupabaseGateway} from '../gateway/src/services/supabaseGateway.js';
const config=loadConfig();
if(new URL(config.supabase.url).hostname!=='hoxkrmadzjnyjaqjbyxc.supabase.co') throw new Error('Wrong project');
const db=new SupabaseGateway({config});
const statePath='backups/judge-account.local.json';
await mkdir('backups',{recursive:true});
let account;
try {account=JSON.parse(await readFile(statePath,'utf8'));} catch(error) {if(error.code!=='ENOENT') throw error;}
if(!account){
  // .example is reserved: no mail is delivered to an invented third-party address.
  const email='judge@ootie.example';const password=`Ot!${randomBytes(24).toString('base64url')}`;
  const user=await db.serviceRequest('/auth/v1/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{display_name:'OOTIE Jury'}})});
  account={email,password,userId:user.id,profileId:randomUUID(),createdAt:new Date().toISOString()};
  await writeFile(statePath,JSON.stringify(account,null,2),{flag:'wx'});
}
const existing=await db.serviceRequest(`/rest/v1/ootie_profiles?user_id=eq.${account.userId}&select=id,display_name,name,initials,username`);
if(existing.length > 1) throw new Error('Ambiguous jury profile');
if(existing.length) {
  account.profileId=existing[0].id;
  // Older database signup triggers may supply a fixture persona. Replace it only
  // on this explicitly provisioned account, not on other members' profiles.
  if (!existing[0].display_name || existing[0].display_name === 'Hayley Lin' || existing[0].name === 'Hayley Lin') {
    await db.serviceRequest(`/rest/v1/ootie_profiles?id=eq.${account.profileId}&user_id=eq.${account.userId}`, {
      method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({display_name:'OOTIE Jury',name:'OOTIE Jury',username:'@ootie_jury',initials:'OJ',avatar_url:null,bio:'Explore your wardrobe. Try something new.',slogan:'Explore your wardrobe. Try something new.',public_closet:false})
    });
  }
}
else await db.serviceRequest('/rest/v1/ootie_profiles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:account.profileId,user_id:account.userId,username:'ootie_jury',display_name:'OOTIE Jury',name:'OOTIE Jury',initials:'OJ',bio:'Explore your wardrobe. Try something new.',public_closet:false,created_at:account.createdAt})});
await writeFile(statePath,JSON.stringify(account,null,2));
const catalog=JSON.parse(await readFile('src/data/juryWardrobeSources.json','utf8'));
await import('./refresh-judge-wardrobe.mjs');
const signIn=await fetch(`${config.supabase.url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:config.supabase.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});
const session=await signIn.json();if(!signIn.ok || session.user?.id!==account.userId) throw new Error('Judge login verification failed');
const wardrobe=await fetch(`${config.supabase.url}/rest/v1/ootie_clothing_items?select=id,owner_id&owner_id=eq.${account.profileId}`,{headers:{apikey:config.supabase.publishableKey,Authorization:`Bearer ${session.access_token}`}});
const rows=await wardrobe.json();if(!wardrobe.ok || rows.some(x=>x.owner_id!==account.profileId)||rows.length!==catalog.length)throw new Error('Judge wardrobe isolation failed');
const anonymous=await fetch(`${config.supabase.url}/rest/v1/ootie_clothing_items?select=id&owner_id=eq.${account.profileId}`,{headers:{apikey:config.supabase.publishableKey}});
if(anonymous.ok && (await anonymous.json()).length) throw new Error('Judge wardrobe publicly visible');
await writeFile('JUDGE_ACCESS.local.md',`# OOTIE jury access\n\nWebsite: http://127.0.0.1:5173/\n\nLogin ID: ${account.email}\n\nPassword: ${account.password}\n\nThis is a working Supabase email/password account. The .example address is a login identifier, not an email inbox. The team manages its password. Eight curated wardrobe pieces are provided; purchase and wear history remain empty.\n\nThe website currently runs on this computer. Replace this address with the deployed HTTPS URL before sending to remote judges.\n\nKeep this file private and out of Git. Share credentials only with the judging panel.\n`);
console.log(JSON.stringify({accountProvisioned:true,loginVerified:true,wardrobeItems:rows.length,isolationVerified:true,accessFile:'JUDGE_ACCESS.local.md'}));
