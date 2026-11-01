import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261101193000_sos_cover_separation_and_current_public_wardrobe.sql'),
  'utf8'
);

describe('SOS empty public wardrobe migration', () => {
  it('allows an empty array while retaining visibility, ownership, and hidden-item checks', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.ootie_validate_sos_shared_items\(\)/i);
    expect(migration).toMatch(/NEW\.user_id\s*<>\s*NEW\.closet_owner_id/i);
    expect(migration).toMatch(/profile\.public_closet IS TRUE/i);
    expect(migration).toMatch(/item\.owner_id = NEW\.user_id/i);
    expect(migration).toMatch(/item\.hidden IS FALSE/i);
    expect(migration).toMatch(/unnest\(NEW\.closet_item_ids\)/i);
    expect(migration).toMatch(/NEW\.cover_item_id IS NOT NULL/i);
    expect(migration).toMatch(/item\.id = NEW\.cover_item_id/i);
    expect(migration).toMatch(/DROP CONSTRAINT IF EXISTS ootie_sos_cover_consistent/i);
    expect(migration).not.toMatch(/cover_item_id\s*=\s*ANY\s*\(\s*closet_item_ids\s*\)/i);
    expect(migration).not.toMatch(/cardinality\s*\(\s*NEW\.closet_item_ids\s*\)\s*=\s*0/i);
    expect(migration).not.toMatch(/\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i);
  });
});
