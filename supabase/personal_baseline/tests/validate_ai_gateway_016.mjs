import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(here, '..', '016_ootie_ai_gateway.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const runtimeGrants = fs.readFileSync(
  path.resolve(here, '..', '017_ootie_ai_gateway_runtime_grants.sql'),
  'utf8'
);

const expectations = [
  ['ledger table', /CREATE TABLE public\.ootie_ai_generations/i],
  ['RLS enabled', /ALTER TABLE public\.ootie_ai_generations ENABLE ROW LEVEL SECURITY/i],
  ['own select policy', /user_id = \(SELECT auth\.uid\(\)\)/i],
  ['private bucket', /'ootie-ai-private'[\s\S]*?false,/i],
  ['private owner path', /split_part\(name, '\/', 2\) = \(SELECT auth\.uid\(\)::text\)/i],
  ['idempotent quota function', /CREATE FUNCTION public\.claim_ootie_ai_generation/i],
  ['quota lock', /pg_advisory_xact_lock/i],
  ['service role only execute', /GRANT EXECUTE[\s\S]*?TO service_role/i],
  ['generation type set', /'styling', 'single_try_on', 'outfit_preview'/i],
  ['no data URL result path', /result_path text CHECK \(result_path IS NULL OR result_path !~\* '\^data:'/i],
  ['no image data in metadata', /result_metadata::text !~\* 'data:image'/i]
];

const failures = expectations.filter(([, pattern]) => !pattern.test(sql)).map(([label]) => label);
if (/GRANT\s+(?:INSERT|UPDATE|DELETE)[\s\S]*ootie_ai_generations[\s\S]*authenticated/i.test(sql)) failures.push('client write grant present');
if (/CREATE POLICY[\s\S]*ootie_ai_private[\s\S]*FOR INSERT TO authenticated/i.test(sql)) failures.push('client storage insert policy present');
if (!/GRANT USAGE ON SCHEMA public TO service_role/i.test(runtimeGrants)) failures.push('017 service role schema usage');
if (!/GRANT SELECT ON TABLE[\s\S]*public\.ootie_profiles[\s\S]*public\.ootie_clothing_items[\s\S]*public\.ootie_ai_generations[\s\S]*TO service_role/i.test(runtimeGrants)) failures.push('017 service role read scope');
if (!/GRANT UPDATE ON TABLE public\.ootie_ai_generations TO service_role/i.test(runtimeGrants)) failures.push('017 ledger update grant');
if (/GRANT\s+(?:ALL|INSERT|DELETE)[\s\S]*TO service_role/i.test(runtimeGrants)) failures.push('017 broad service role mutation grant');
if (failures.length) {
  console.error(`AI_GATEWAY_016_STATIC_VALIDATION=FAIL: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('AI_GATEWAY_016_STATIC_VALIDATION=PASS');
console.log('AI_GATEWAY_017_STATIC_VALIDATION=PASS');
