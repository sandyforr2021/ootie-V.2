import { ref } from 'vue';

// Session-only image leases. Nothing is stored in browser disk caches here.
export const mediaEpoch = ref(0);
let scope = '', serial = 0;
const entries = new Map(), keys = new Map();
const MAX_IDLE_ENTRIES = 24;
export function clearMediaMemory() {
  mediaEpoch.value++;
  for (const entry of entries.values()) if (entry.url) URL.revokeObjectURL(entry.url);
  entries.clear(); keys.clear(); scope = '';
}
export function registerMedia(owner, versionedKey, load, loadFull=load) {
  if (!owner) return '';
  if (scope && scope !== owner) return '';
  scope = owner;
  const key = `${owner}:${versionedKey}`;
  if (keys.has(key)) {const id=keys.get(key),entry=entries.get(id);entry.load=load;entry.loadFull=loadFull;return id;}
  const id = `ootie-media:${++serial}`;
  keys.set(key,id); entries.set(id,{owner,versionedKey,key,load,loadFull,url:'',promise:null,users:0,touched:Date.now()});
  return id;
}
export const isDeferredMedia = value => String(value || '').startsWith('ootie-media:');
export async function acquireMedia(id) {
  const entry = entries.get(id), epoch = mediaEpoch.value;
  if (!entry) throw new Error('MEDIA_SESSION_EXPIRED');
  entry.users++; entry.touched = Date.now();
  if (!entry.promise) entry.promise = Promise.resolve().then(entry.load).then(url => {
    if (epoch !== mediaEpoch.value || !entries.has(id)) { URL.revokeObjectURL(url); throw new Error('MEDIA_SESSION_EXPIRED'); }
    entry.url=url; return url;
  }).catch(error => { entry.promise=null; throw error; });
  try { return await entry.promise; } catch(error) { releaseMedia(id); throw error; }
}
export function releaseMedia(id) {
  const entry=entries.get(id); if(entry) entry.users=Math.max(0,entry.users-1);
  const idle=[...entries.entries()].filter(([,e])=>e.users===0 && e.url).sort((a,b)=>a[1].touched-b[1].touched);
  for(const [key,e] of idle.slice(0,Math.max(0,idle.length-MAX_IDLE_ENTRIES))) {
    URL.revokeObjectURL(e.url);e.url='';e.promise=null;
  }
}

export function fullMediaId(id){const entry=entries.get(id);return entry?registerMedia(entry.owner,`full:${entry.versionedKey}`,entry.loadFull):id;}
