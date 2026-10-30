import manifest from '@/data/publicThumbnailManifest.json';
import {curatedPublicImage} from './curatedWardrobeMedia';
export function listThumbnail(source) {
 const curated=curatedPublicImage(source);if(curated)return curated;
 if(manifest[source])return manifest[source].thumbnail;
 try{const url=new URL(source);if(url.searchParams.get('ootie_list')==='v1'&&/^\/storage\/v1\/object\/public\/(ootie-ootd-images|ootie-profile-avatars)\//.test(url.pathname)){
  url.pathname=url.pathname.replace(/\.[^/.]+$/,'.list-v1.webp');url.searchParams.delete('ootie_list');return url.href;
 }}catch{/* Local and blob images use their existing source. */}
 return source||'';
}
export function fullImage(source){return curatedPublicImage(source,true)||source||'';}
