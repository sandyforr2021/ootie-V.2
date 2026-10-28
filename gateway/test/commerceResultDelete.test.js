import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CommerceService } from '../src/commerce/service.js';

const owner = randomUUID(), other = randomUUID(), id = randomUUID();
function fixture() {
  const state = { result_path: `ai-generated/${owner}/${id}.jpg`, kind: 'try_on', status: 'succeeded' };
  const calls = [];
  const repository = {
    async job(jobId, userId) { return jobId === id && userId === owner ? { ...state } : undefined; },
    async clearJobResult(jobId, userId, path) {
      if (jobId !== id || userId !== owner || path !== state.result_path) return undefined;
      state.result_path = null; return { ...state };
    }
  };
  const storage = { bucket: 'private-bucket', async serviceRequest(path, options) { calls.push({path, options}); } };
  return { service: new CommerceService({repository, storage}), state, calls };
}

test('owner deletes one result and replay remains safe', async () => {
  const {service, state, calls} = fixture();
  assert.deepEqual(await service.deleteResult({id:owner}, id), {deleted:true});
  assert.equal(state.result_path, null);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].options.body).prefixes, [`ai-generated/${owner}/${id}.jpg`]);
  assert.deepEqual(await service.deleteResult({id:owner}, id), {deleted:true});
  assert.equal(calls.length, 1);
});

test('another user and unexpected storage paths cannot delete a result', async () => {
  const {service, state, calls} = fixture();
  await assert.rejects(service.deleteResult({id:other}, id), {code:'JOB_NOT_FOUND'});
  state.result_path = `ai-generated/${other}/${id}.jpg`;
  await assert.rejects(service.deleteResult({id:owner}, id), {code:'PRIVATE_IMAGE_NOT_OWNED'});
  assert.equal(calls.length, 0);
});

test('a storage failure leaves the result available for retry', async () => {
  const {service, state} = fixture();
  service.storage.serviceRequest = async () => { throw new Error('storage unavailable'); };
  await assert.rejects(service.deleteResult({id:owner}, id));
  assert.equal(state.result_path, `ai-generated/${owner}/${id}.jpg`);
});
