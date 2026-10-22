// Insert only the additional source-backed jury pieces. Never reset existing items.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadConfig } from '../gateway/src/config.js';
import { SupabaseGateway } from '../gateway/src/services/supabaseGateway.js';
const sharp = createRequire(new URL('../gateway/package.json', import.meta.url))('sharp');
const config = loadConfig();
if (new URL(config.supabase.url).hostname !== 'hoxkrmadzjnyjaqjbyxc.supabase.co') throw new Error('Wrong project');
const db = new SupabaseGateway({ config });
const account = JSON.parse(await readFile('backups/judge-account.local.json','utf8'));
const sources = JSON.parse(await readFile('src/data/juryWardrobeExtras.json','utf8'));
const current = await db.serviceRequest(`/rest/v1/ootie_clothing_items?owner_id=eq.${account.profileId}&select=*`);
await writeFile(`backups/jury-before-extension-${Date.now()}.local.json`,JSON.stringify(current,null,2));
let inserted = 0;
for (const source of sources) {
  const hash = createHash('sha256').update(`ootie-jury-v1:${account.userId}:${source.key}`).digest('hex');
  const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
  if (current.some(row=>row.id===id)) continue;
  const image = new URL(source.image);
  if (image.protocol !== 'https:' || image.hostname !== 'cdn.shopify.com' || !image.pathname.startsWith('/s/files/1/0053/5615/9064/')) throw new Error('Unverified catalog photo');
  const response = await fetch(image,{signal:AbortSignal.timeout(30000)});
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Photo unavailable ${source.key}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length>5*1024*1024) throw new Error('Photo too large');
  const metadata = await sharp(bytes).metadata(); // Inspection only. Preserve merchant pixels.
  if (!['jpeg','png','webp'].includes(metadata.format) || !metadata.width || !metadata.height) throw new Error('Invalid photo');
  const path = `closet/${account.userId}/${id}/merchant-v3/display.${metadata.format}`;
  const mime = `image/${metadata.format}`;
  await db.serviceRequest(`/storage/v1/object/ootie-closet-media/${path}`,{method:'POST',headers:{'Content-Type':mime,'x-upsert':'true'},body:bytes});
  const rows = await db.serviceRequest('/rest/v1/ootie_clothing_items',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({
    id,owner_id:account.profileId,name:source.title,name_zh:source.zh,brand:source.brand,category:source.category,primary_color:source.color,color_hex:source.hex,
    source_url:source.url,source_domain:'colorfulstandard.com',photo:null,photo_original_path:path,photo_display_path:path,photo_mime_type:mime,
    photo_width:metadata.width,photo_height:metadata.height,photo_file_size:bytes.length,photo_processing_status:'READY',photo_updated_at:new Date().toISOString(),
    price:null,currency:'TWD',purchase_date:null,wear_count:0,last_worn:null,hidden:false,favorite:false,style:'Casual',season:'All year',created_at:new Date().toISOString()
  })});
  if (rows.length!==1 || rows[0].owner_id!==account.profileId) throw new Error('Insert not confirmed');
  inserted++; console.log(JSON.stringify({key:source.key,saved:true,bytes:bytes.length}));
}
const verified = await db.serviceRequest(`/rest/v1/ootie_clothing_items?owner_id=eq.${account.profileId}&select=id,hidden,currency,source_url`);
if (verified.filter(x=>!x.hidden).length<20) throw new Error('Wardrobe below requested minimum');
console.log(JSON.stringify({inserted,total:verified.length,existingRowsPreserved:true,scope:'OOTIE Jury only'}));
