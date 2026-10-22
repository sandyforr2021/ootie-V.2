import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { assertOotieProject, OOTIE_PROJECT_REF } from '../src/contracts/projectBoundary.js';

const clientFiles = [
  'src/services/supabase.js',
];

function evaluateClient(file, env, calls = []) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    .replace(/^import \{ createClient \} from '@supabase\/supabase-js';?\r?\n/m, '')
    .replace(/^import \{ assertOotieProject \} from '@\/contracts\/projectBoundary';?\r?\n/m, '')
    .replaceAll('import.meta.env', 'env')
    .replace(/^export /gm, '');

  runInNewContext(source, {
    env,
    assertOotieProject,
    createClient: (...args) => {
      calls.push(args);
      return {};
    },
    console,
  }, { filename: file });

  return calls;
}

for (const file of clientFiles) {
  test(`${file} fails before creating a client when the URL is missing`, () => {
    const calls = [];
    assert.throws(() => evaluateClient(file, {}, calls), /VITE_SUPABASE_URL/);
    assert.equal(calls.length, 0);
  });

  test(`${file} fails before creating a client when the key is missing`, () => {
    const calls = [];
    assert.throws(
      () => evaluateClient(file, { VITE_SUPABASE_URL: 'https://personal.example' }, calls),
      /VITE_SUPABASE_PUBLISHABLE_KEY/,
    );
    assert.equal(calls.length, 0);
  });

  test(`${file} creates a client only with the supplied environment values`, () => {
    const calls = evaluateClient(file, {
      VITE_SUPABASE_URL: `https://${OOTIE_PROJECT_REF}.supabase.co`,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    });
    assert.deepEqual(calls, [[`https://${OOTIE_PROJECT_REF}.supabase.co`, 'test-publishable-key']]);
  });

  test(`${file} rejects the unrelated database before creating a client`, () => {
    const calls = [];
    assert.throws(() => evaluateClient(file, {
      VITE_SUPABASE_URL: 'https://iaswunanvtuwgmxpdbdd.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key'
    }, calls), /OOTIE_PROJECT_MISMATCH/);
    assert.equal(calls.length, 0);
  });
}
