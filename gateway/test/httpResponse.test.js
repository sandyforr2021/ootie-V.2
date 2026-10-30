import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {endResponse} from '../src/httpResponse.js';
test('already disconnected image clients do not hold a media queue permit forever',async()=>{
  const response=new EventEmitter();response.destroyed=true;response.end=()=>assert.fail('must not write a closed response');
  await endResponse(response,'image');assert.equal(response.listenerCount('close'),0);
});
test('disconnect during response delivery resolves and cleans listeners',async()=>{
  const response=new EventEmitter();response.end=()=>queueMicrotask(()=>response.emit('close'));
  await endResponse(response,'image');assert.equal(response.listenerCount('close'),0);assert.equal(response.listenerCount('finish'),0);
});
