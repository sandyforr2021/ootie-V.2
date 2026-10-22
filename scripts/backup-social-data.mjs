// Read-only export before the editorial launch. Credentials never enter the backup.
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '../gateway/src/config.js';
import { SupabaseGateway } from '../gateway/src/services/supabaseGateway.js';
const config = loadConfig();
if (new URL(config.supabase.url).hostname !== 'hoxkrmadzjnyjaqjbyxc.supabase.co') throw new Error('Wrong project');
const db = new SupabaseGateway({config});
const snapshot = { project: 'hoxkrmadzjnyjaqjbyxc', capturedAt: new Date().toISOString(), tables: {} };
for (const table of ['ootie_ootd_posts', 'ootie_post_likes']) {
  const rows = [];
  for (let offset=0;;offset+=500) {
    const batch = await db.serviceRequest(`/rest/v1/${table}?select=*&order=id&limit=500&offset=${offset}`);
    rows.push(...batch);
    if (batch.length < 500) break;
  }
  snapshot.tables[table] = rows;
}
await mkdir('backups', {recursive:true});
const path = `backups/social-${Date.now()}.json`;
await writeFile(path, JSON.stringify(snapshot,null,2),{flag:'wx'});
console.log(JSON.stringify({path, counts:Object.fromEntries(Object.entries(snapshot.tables).map(([name, rows])=>[name,rows.length]))}));
