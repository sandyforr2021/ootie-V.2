// One-off local processing, never imported by the Render web service.
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const origin='https://hoxkrmadzjnyjaqjbyxc.supabase.co';
if(process.env.SUPABASE_URL!==origin)throw Error('OOTIE project boundary mismatch');
const client=createClient(origin,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const writePrivate=process.argv.includes('--write-private');
sharp.cache(false);sharp.concurrency(1);
const directory='public/assets/media-thumbs';await mkdir(directory,{recursive:true});
const cache='artifacts/thumbnail-sources';await mkdir(cache,{recursive:true});
const manifestPath='src/data/publicThumbnailManifest.json';
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const publicSources=new Set();
for(const [table,field] of [['ootie_ootd_posts','image'],['ootie_profiles','avatar_url']]){
 const {data,error}=await client.from(table).select(field).limit(1000);if(error)throw error;
 for(const row of data||[])if(row[field])publicSources.add(row[field]);
}
let publicMade=0,privateMade=0,inputBytes=0,outputBytes=0,skipped=0;
async function bounded(response){
 if(!response.ok)throw Error(`Source HTTP ${response.status}`);
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>10*1024*1024){await response.body.cancel().catch(()=>{});throw Error('Source exceeds limit');}chunks.push(chunk);}return Buffer.concat(chunks);
}
for(const source of publicSources){
 let url;try{url=new URL(source);}catch{skipped++;continue;}
 if(url.origin!==origin||!/^\/storage\/v1\/object\/public\/(ootie-ootd-images|ootie-profile-avatars)\//.test(url.pathname)){skipped++;continue;}
 const recipe=url.pathname.includes('/ootie-profile-avatars/')?'avatar-160-v1':'post-640-v1';
 const id=createHash('sha256').update(source+recipe).digest('hex');const target=`${directory}/${id}.webp`;
 try{await stat(target);if(manifest[source])continue;}catch{}
 const localSource=`${cache}/${createHash('sha256').update(source).digest('hex')}.bin`;
 let bytes;try{bytes=await readFile(localSource);}catch{const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(response.status===404){skipped++;continue;}bytes=await bounded(response);await writeFile(localSource,bytes);}
 const edge=recipe.startsWith('avatar')?160:640;
 const output=await sharp(bytes,{limitInputPixels:40000000}).rotate().resize(edge,edge,{fit:'inside',withoutEnlargement:true}).webp({quality:74}).toBuffer();
 await writeFile(target,output);manifest[source]={thumbnail:`/assets/media-thumbs/${id}.webp`,originalBytes:bytes.length,thumbnailBytes:output.length};
 inputBytes+=bytes.length;outputBytes+=output.length;publicMade++;
}
if(writePrivate){
 const {data,error}=await client.from('ootie_clothing_items').select('photo_display_path').not('photo_display_path','is',null).limit(1000);if(error)throw error;
 for(const path of new Set((data||[]).map(row=>row.photo_display_path))){
  if(!/^closet\/[\da-f-]+\/[\da-f-]+\/[^/]+\/display\.(webp|png|jpe?g)$/.test(path))continue;
  const target=path.replace(/\/display\.[^.]+$/,'/display.list-v1.webp');
  const folder=target.slice(0,target.lastIndexOf('/')),filename=target.split('/').at(-1);
  const existing=await client.storage.from('ootie-closet-media').list(folder,{search:filename,limit:10});if(existing.error)throw existing.error;
  if(existing.data?.some(file=>file.name===filename))continue;
  const {data:blob,error:downloadError}=await client.storage.from('ootie-closet-media').download(path);if(downloadError)throw downloadError;
  const bytes=Buffer.from(await blob.arrayBuffer());
  const output=await sharp(bytes,{limitInputPixels:40000000}).rotate().resize(480,480,{fit:'inside',withoutEnlargement:true}).webp({quality:76}).toBuffer();
  const {error:uploadError}=await client.storage.from('ootie-closet-media').upload(target,output,{contentType:'image/webp',cacheControl:'3600',upsert:false});if(uploadError)throw uploadError;
  inputBytes+=bytes.length;outputBytes+=output.length;privateMade++;
 }
}
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({publicMade,privateMade,skipped,inputBytes,outputBytes,publicMappings:Object.keys(manifest).length,originalsPreserved:true,concurrency:1}));
