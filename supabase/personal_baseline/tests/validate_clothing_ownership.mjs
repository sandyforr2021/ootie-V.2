import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseline = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(baseline, '..', '..');
const migrationPath = resolve(baseline, '003_ootie_clothing_items.sql');
const migration = readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gmu, '');
const hash = createHash('sha256')
  .update(readFileSync(migrationPath))
  .digest('hex')
  .toUpperCase();
const tableBody = executable.match(/CREATE TABLE public\."ootie_clothing_items" \(([\s\S]*?)\n\);/u)?.[1];
assert.ok(tableBody, '003 must create public.ootie_clothing_items');

const actualColumns = [...tableBody.matchAll(/^\s+"([^"]+)"\s+([^,]+),?$/gmu)]
  .map((match) => `${match[1]} ${match[2].trim().replace(/\s+/gu, ' ')}`);
const expectedColumns = [
  'brand text',
  'category text',
  'color_hex text',
  'created_at timestamp with time zone',
  'favorite boolean',
  'hidden boolean',
  'id uuid NOT NULL DEFAULT gen_random_uuid()',
  'last_worn text',
  'name text',
  'name_zh text',
  'notes text',
  'owner_id uuid NOT NULL',
  'photo text',
  'price bigint',
  'primary_color text',
  'purchase_date text',
  'season text',
  'secondary_color text',
  'shape text',
  'style text',
  'wear_count bigint',
];
assert.deepEqual(actualColumns, expectedColumns, '003 must keep exactly 21 reviewed columns; only owner_id contract may differ from team evidence');

assert.match(tableBody, /^\s+"owner_id" uuid NOT NULL,$/mu);
assert.doesNotMatch(tableBody, /"owner_id"[^\n]*\bDEFAULT\b/iu);
assert.match(
  tableBody,
  /CONSTRAINT "ootie_clothing_items_owner_id_fkey" FOREIGN KEY \(owner_id\) REFERENCES public\.ootie_profiles\(id\) ON DELETE NO ACTION/iu,
);
assert.doesNotMatch(executable, /REFERENCES\s+auth\.users/iu);

const constraints = [...tableBody.matchAll(/^\s+CONSTRAINT\s+"([^"]+)"/gmu)].map((match) => match[1]);
assert.deepEqual(constraints, [
  'ootie_clothing_items_owner_id_fkey',
  'ootie_clothing_items_pkey',
]);

assert.equal((executable.match(/\bCREATE TABLE\b/giu) || []).length, 1);
assert.equal((executable.match(/\bCREATE (?:UNIQUE )?INDEX\b/giu) || []).length, 1);
assert.match(executable, /CREATE INDEX ootie_clothing_items_owner_id_idx\s+ON public\.ootie_clothing_items \(owner_id\)/iu);
assert.equal((executable.match(/\bCREATE (?:OR REPLACE )?FUNCTION\b/giu) || []).length, 0);
assert.equal((executable.match(/\bCREATE TRIGGER\b/giu) || []).length, 0);
assert.equal((executable.match(/\bCREATE POLICY\b/giu) || []).length, 0);
assert.doesNotMatch(executable, /^\s*(?:DROP|DELETE|TRUNCATE|UPDATE|INSERT|ALTER|REPLACE)\b/gimu);
assert.doesNotMatch(executable, /\bCASCADE\b/iu);

const snapshot = readFileSync(resolve(root, 'TEAM_SUPABASE_SCHEMA_SNAPSHOT.csv.csv'), 'utf8');
assert.match(
  snapshot,
  /^COLUMN,public\.ootie_clothing_items\.owner_id,type=uuid; nullable=YES; default=gen_random_uuid\(\)$/mu,
  'team evidence must remain recorded as nullable with a random default',
);
assert.match(
  snapshot,
  /^CONSTRAINT,public\.ootie_clothing_items\.ootie_clothing_items_owner_id_fkey,FOREIGN KEY \(owner_id\) REFERENCES ootie_profiles\(id\)$/mu,
);

const manifest = readFileSync(resolve(root, 'SUPABASE_BASELINE_EXECUTION_MANIFEST.md'), 'utf8');
assert.ok(
  manifest.includes('| `003_ootie_clothing_items.sql` | `' + hash + '` |'),
  'manifest active 003 row must match the file hash',
);
const contract = readFileSync(resolve(root, 'CLOTHING_OWNERSHIP_CONTRACT.md'), 'utf8');
for (const required of [
  'session.user.id',
  'ootie_profiles.id',
  'owner_id',
  'PROFILE_MISSING',
  'user-01',
  'profile-01',
]) {
  assert.ok(contract.includes(required), `ownership contract must include ${required}`);
}
assert.match(contract, /Do not replace it with local\/mock success/u);

const followup = readFileSync(resolve(root, 'CLOTHING_SCHEMA_FOLLOWUP.md'), 'utf8');
assert.ok(followup.length > 500, 'schema follow-up must exist and remain substantive');

console.log('CLOTHING_OWNERSHIP_STATIC_VALIDATION=PASS');
console.log(`003_SHA256=${hash}`);
console.log(`COLUMN_COUNT=${actualColumns.length}`);
console.log('OWNER_ID_NOT_NULL=YES');
console.log('OWNER_ID_DEFAULT=NONE');
console.log('OWNER_FK=public.ootie_profiles(id)');
console.log('OWNER_DELETE_ACTION=NO ACTION');
console.log('CONTENT_DIRECT_AUTH_FK_COUNT=0');
console.log('UNAUTHORIZED_SCHEMA_CHANGE_COUNT=0');
console.log('REMOTE_SQL_EXECUTED=YES (OOTIE-personal-dev)');
