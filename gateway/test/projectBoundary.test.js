import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { SupabaseGateway } from '../src/services/supabaseGateway.js';

const env = {
  SUPABASE_URL: 'https://hoxkrmadzjnyjaqjbyxc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SECRET_KEY: 'sb_secret_test'
};
test('gateway refuses the unrelated drumstand database before starting', () => {
  assert.throws(() => loadConfig({ ...env, SUPABASE_URL: 'https://iaswunanvtuwgmxpdbdd.supabase.co' }), { code: 'OOTIE_PROJECT_MISMATCH' });
  assert.equal(loadConfig(env).competitionMode, true);
  assert.equal(loadConfig(env).youcam.enabled, false);
});
test('new Supabase server keys use apikey rather than an invalid JWT header', async () => {
  let request;
  const storage = new SupabaseGateway({ config: loadConfig(env), fetchImpl: async (url, options) => {
    request = { url, ...options }; return new Response('[]');
  } });
  await storage.serviceRequest('/rest/v1/ootie_shop_products?limit=1');
  assert.equal(request.headers.apikey, env.SUPABASE_SECRET_KEY);
  assert.equal(request.headers.Authorization, undefined);
  assert.equal(new URL(request.url).hostname, 'hoxkrmadzjnyjaqjbyxc.supabase.co');
});
