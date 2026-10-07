import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('supabase/personal_baseline/027_production_readiness_acl_hardening.sql');
const sql = fs.readFileSync(file, 'utf8');
const required = [
  'validate_ootie_saved_outfit_target()',
  'guard_ootie_ootd_item_ownership()',
  'FROM PUBLIC, anon, authenticated, service_role'
];

for (const fragment of required) {
  if (!sql.includes(fragment)) throw new Error(`027 missing required ACL hardening: ${fragment}`);
}
if (!/BEGIN;[\s\S]*COMMIT;/.test(sql)) throw new Error('027 must be transaction-bounded');

console.log('PASS migration 027 production-readiness ACL hardening validation');
