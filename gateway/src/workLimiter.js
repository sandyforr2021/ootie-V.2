import {GatewayError} from './errors.js';
// Reserve capacity before allocating image/body buffers. Waiting requests retain no body.
export function createWorkLimiter({concurrency=2,maxQueue=16}={}){
 let active=0;const waiting=[];
 const permit=()=>{active++;let released=false;return()=>{if(released)return;released=true;active--;while(waiting.length){const next=waiting.shift();next.cleanup();if(!next.signal?.aborted){next.resolve(permit());break;}}};};
 function acquire({signal}={}){
  if(signal?.aborted)return Promise.reject(new GatewayError('REQUEST_ABORTED',499));
  if(active<concurrency)return Promise.resolve(permit());
  if(waiting.length>=maxQueue)return Promise.reject(new GatewayError('MEDIA_BUSY',503,'圖片正在依序處理，請稍後重試。'));
  return new Promise((resolve,reject)=>{const entry={resolve,reject,signal,cleanup:()=>signal?.removeEventListener('abort',cancel)};const cancel=()=>{const i=waiting.indexOf(entry);if(i>=0)waiting.splice(i,1);entry.cleanup();reject(new GatewayError('REQUEST_ABORTED',499));};waiting.push(entry);signal?.addEventListener('abort',cancel,{once:true});});
 }
 return {acquire,async run(action,options){const release=await acquire(options);try{return await action();}finally{release();}},get active(){return active;},get queued(){return waiting.length;}};
}
