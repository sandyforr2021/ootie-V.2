import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.zip':'application/zip','.txt':'text/plain; charset=utf-8'};
const routes=/^\/(?:|home|shop|explore|closet|sos|profile|profile\/help-history|bookmarks|stats|settings|ai|tryon|membership|legal\/(?:privacy|terms|ai)|auth\/callback|ootd\/[\da-f-]{36})$/i;
export function createStaticSite(root,{revision}={}){
 const base=resolve(root);
 const releaseHeaders=/^[0-9a-f]{40}$/i.test(revision||'')?{'X-OOTIE-Revision':revision}:{};
 return async function serve(path,method='GET'){
  if(!['GET','HEAD'].includes(method)||path.startsWith('/api/')||path.startsWith('/v1/')||['/health','/healthz'].includes(path))return null;
  let decoded;try{decoded=decodeURIComponent(path);}catch{return null;}
  if(decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').some(part=>part==='..'||part.startsWith('.')))return null;
  let file=resolve(base,'.'+decoded);
  if(file!==base&&!file.startsWith(base+sep))return null;
  try{if(!(await stat(file)).isFile())throw new Error('not-file');}
  catch{if(!routes.test(decoded))return null;file=resolve(base,'index.html');}
  const actual=await realpath(file);
  if(!actual.startsWith((await realpath(base))+sep))return null;
  const mime=types[extname(actual).toLowerCase()];if(!mime)return null;
  const bytes=await readFile(actual);
  return {status:200,headers:{...releaseHeaders,'Content-Type':mime,'Content-Length':bytes.length,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':decoded.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'},rawBody:method==='HEAD'?Buffer.alloc(0):bytes};
 };
}
