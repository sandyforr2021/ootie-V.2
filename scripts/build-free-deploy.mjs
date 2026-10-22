// One free Node web service serves the built SPA and the authenticated gateway.
import {spawnSync} from 'node:child_process';
const required=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'];
for(const key of required)if(!process.env[key])throw new Error(`Missing ${key}`);
if(new URL(process.env.SUPABASE_URL).hostname!=='hoxkrmadzjnyjaqjbyxc.supabase.co')throw new Error('Wrong project');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['PATH','Path','SystemRoot','TEMP','TMP','HOME','USERPROFILE'].includes(key)));
Object.assign(env,{NODE_ENV:'production',VITE_SUPABASE_URL:process.env.SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY,VITE_OOTIE_AI_GATEWAY_URL:'/api',VITE_OOTIE_SUPABASE_PROJECT_REF:'hoxkrmadzjnyjaqjbyxc'});
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--emptyOutDir','false'],{stdio:'inherit',env});
if(result.error)throw result.error;
process.exitCode=result.status||0;
