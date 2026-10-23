import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkLimiter} from '../src/workLimiter.js';
import {readBoundedImage} from '../src/image.js';
import {createStaticSite} from '../src/staticSite.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
test('image slots queue before allocation, cancel disconnected work, and reject overflow',async()=>{
 const slots=createWorkLimiter({concurrency:1,maxQueue:1});const first=await slots.acquire();const cancelled=new AbortController();const pending=slots.acquire({signal:cancelled.signal});assert.equal(slots.active,1);assert.equal(slots.queued,1);await assert.rejects(slots.acquire(),e=>e.code==='MEDIA_BUSY');cancelled.abort();await assert.rejects(pending,e=>e.code==='REQUEST_ABORTED');assert.equal(slots.queued,0);first();first();assert.equal(slots.active,0);await assert.rejects(slots.run(()=>{throw Error('Failed');}));assert.equal(slots.active,0);await slots.run(async()=>assert.equal(slots.active,1));
});
test('oversized upstream images stop before collecting a complete response',async()=>{
 let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(12));c.enqueue(new Uint8Array(12));},cancel(){cancelled=true;}});await assert.rejects(readBoundedImage(new Response(stream),20),e=>e.code==='IMAGE_TOO_LARGE');assert.equal(cancelled,true);
 let read=false,stopped=false;const body=new ReadableStream({pull(){read=true;},cancel(){stopped=true;}},{highWaterMark:0});await assert.rejects(readBoundedImage(new Response(body,{headers:{'content-length':'100'}}),20),e=>e.code==='IMAGE_TOO_LARGE');assert.equal(read,false);assert.equal(stopped,true);
});
test('streaming static responses preserve metadata without retaining a whole image buffer',async()=>{
 const root=join(tmpdir(),'ootie-stream-'+randomUUID());await mkdir(root);await writeFile(join(root,'image.png'),Buffer.alloc(1024*1024));const serve=createStaticSite(root,{streamFiles:true});const result=await serve('/image.png');assert.equal(result.headers['Content-Length'],1024*1024);assert.equal(result.filePath,join(root,'image.png'));assert.equal(result.rawBody,undefined);const head=await serve('/image.png','HEAD');assert.equal(head.rawBody.length,0);assert.equal(head.headers['Content-Length'],1024*1024);assert.equal(await serve('/%2eenv'),null);
});
