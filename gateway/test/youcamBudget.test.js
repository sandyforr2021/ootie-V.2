import test from 'node:test';
import assert from 'node:assert/strict';
import { YouCamClient } from '../src/commerce/youcamClient.js';

const expiry = 2000000000000;
function fixture({ balance = 1000, cost = 2, failCredit = false, knownExpiry = expiry, alternateBalance = 500 } = {}) {
  const calls = [];
  const client = new YouCamClient({ apiKey: 'test-only', freeCreditExpiry: knownExpiry, now: () => expiry - 1000,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('client/credit')) {
        if (failCredit) throw new Error('offline');
        return new Response(JSON.stringify({ status: 200, results: [
          { type: 'ApiPaygToken', amount_dec: balance, expiry },
          { type: 'ApiPaygToken', amount_dec: alternateBalance, expiry: expiry + 1000000 }
        ] }));
      }
      if (url.includes('feature-cost')) return new Response(JSON.stringify({ status: 200, result: { next_token: null, skus: [
        { amount: cost, unit: 'result_image', proc_unit: 1, run_task_url: 'https://yce-api-01.makeupar.com/s2s/v2.0/task/cloth-v3' }
      ] } }));
      return new Response(JSON.stringify({ status: 200, data: { task_id: 'created-once' } }));
    }
  });
  return { client, calls };
}
test('a task requires sufficient verified free credits and unchanged feature cost', async () => {
  const f = fixture();
  assert.equal(await f.client.submit({ kind: 'try_on', garment_category: 'upper_body' }, 'person', 'product'), 'created-once');
  assert.equal(f.calls.filter(({options}) => options.method === 'POST').length, 1);
  assert.ok(f.calls.slice(0, -1).every(({options}) => options.method === 'GET'));
});
test('other credit batches cannot bypass exhausted, expired or unverified free credits', async () => {
  for (const options of [{ balance: 0 }, { knownExpiry: 0 }, { knownExpiry: expiry - 1000 }, { failCredit: true }]) {
    const f = fixture(options);
    await assert.rejects(f.client.submit({ kind: 'try_on' }, 'person', 'product'), (e) => e.code === 'YOUCAM_FREE_CREDITS_UNAVAILABLE' && e.requestNotSent);
    assert.equal(f.calls.filter(({options}) => options.method === 'POST').length, 0);
  }
});
test('a changed cost stops generation instead of silently exceeding its reservation', async () => {
  const f = fixture({ cost: 3 });
  await assert.rejects(f.client.submit({ kind: 'try_on' }, 'person', 'product'), (e) => e.code === 'YOUCAM_COST_CHANGED' && e.requestNotSent);
  assert.equal(f.calls.filter(({options}) => options.method === 'POST').length, 0);
});
