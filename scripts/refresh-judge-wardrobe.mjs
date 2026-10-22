// Replace only the eight team-prepared jury pieces with source-backed product photos.
// Does not enumerate Auth accounts or touch other users' wardrobes.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadConfig } from '../gateway/src/config.js';
import { SupabaseGateway } from '../gateway/src/services/supabaseGateway.js';
const sharp = createRequire(new URL('../gateway/package.json', import.meta.url))('sharp');
const config = loadConfig();
if (new URL(config.supabase.url).hostname !== 'hoxkrmadzjnyjaqjbyxc.supabase.co') throw new Error('Wrong project');
const db = new SupabaseGateway({ config });
const account = JSON.parse(await readFile('backups/judge-account.local.json', 'utf8'));
const sources = JSON.parse(await readFile('src/data/juryWardrobeSources.json', 'utf8'));
const allowedHosts = new Set(['colorfulstandard.com', 'media.veja-store.com', 'img17.shop-pro.jp']);
const current = await db.serviceRequest(`/rest/v1/ootie_clothing_items?owner_id=eq.${account.profileId}&select=*`);
await writeFile(`backups/judge-wardrobe-before-${Date.now()}.json`, JSON.stringify(current, null, 2));
await mkdir('backups/jury-product-photos', { recursive: true });
for (const source of sources) {
  const hash = createHash('sha256').update(`ootie-jury-v1:${account.userId}:${source.key}`).digest('hex');
  const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
  const exists = current.some(row => row.id === id);
  const imageUrl = new URL(source.image);
  if (imageUrl.protocol !== 'https:' || !allowedHosts.has(imageUrl.hostname)) throw new Error('Unverified media host');
  const cachePath = `backups/jury-product-photos/${source.key}.image`;
  let bytes;
  try { bytes = await readFile(cachePath); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30000), headers: { Accept: 'image/jpeg,image/png,image/webp' } });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Product image unavailable: ${source.key}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 10 * 1024 * 1024) throw new Error('Product photo too large');
    await writeFile(cachePath, bytes);
  }
  // Inspect only; original product pixels are not cropped or re-generated.
  const metadata = await sharp(bytes).metadata();
  if (!['jpeg','png','webp'].includes(metadata.format) || !metadata.width || !metadata.height) throw new Error('Invalid photo');
  const mime = `image/${metadata.format}`;
  const path = `closet/${account.userId}/${id}/merchant-v2/display.${metadata.format}`;
  await db.serviceRequest(`/storage/v1/object/ootie-closet-media/${path}`, { method:'POST', headers:{'Content-Type':mime, 'x-upsert':'true'}, body:bytes });
  const updated = await db.serviceRequest(exists ? `/rest/v1/ootie_clothing_items?id=eq.${id}&owner_id=eq.${account.profileId}` : '/rest/v1/ootie_clothing_items', {
    method:exists ? 'PATCH' : 'POST', headers:{'Content-Type':'application/json',Prefer:'return=representation'}, body:JSON.stringify({
      ...(!exists ? {id,owner_id:account.profileId,hidden:false,favorite:false,style:'Casual',season:'All year',created_at:new Date().toISOString()} : {}),
      name:source.title,name_zh:source.zh,brand:source.brand,category:source.category,primary_color:source.color,color_hex:source.hex,
      notes:source.material,source_url:source.url,source_domain:new URL(source.url).hostname,
      photo:null,photo_original_path:path,photo_display_path:path,photo_mime_type:mime,photo_width:metadata.width,photo_height:metadata.height,
      photo_file_size:bytes.length,photo_processing_status:'READY',photo_updated_at:new Date().toISOString(),
      price:null,purchase_date:null,wear_count:0,last_worn:null
    })
  });
  if (updated.length !== 1 || updated[0].source_url !== source.url) throw new Error('Product update not confirmed');
  console.log(JSON.stringify({item:source.key,brand:source.brand,width:metadata.width,height:metadata.height,saved:true}));
}
console.log(JSON.stringify({updated:sources.length,scope:'jury-only',originalPhotosPreserved:true}));
