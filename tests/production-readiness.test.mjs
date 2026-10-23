import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateMigrationSources } from '../scripts/lib/migrationSources.mjs';

const baseline = Array.from({ length: 27 }, (_, i) => `${String(i + 1).padStart(3, '0')}_baseline.sql`);
const manifest = {
  sourceRange: '001-027',
  supplementalSources: [
    { file: '029_wardrobe_currency.sql', action: 'REVIEW_APPLY' },
    { file: '030_public_post_counts.sql', action: 'REVIEW_APPLY' }
  ]
};
const files = [...baseline, ...manifest.supplementalSources.map(source => source.file)];

describe('migration source inventory', () => {
  it('accepts the registered baseline and later additions without inventing migration 028', () => {
    assert.deepEqual(validateMigrationSources(files, manifest), []);
  });

  it('rejects a missing baseline file or an unregistered addition', () => {
    assert.ok(validateMigrationSources(files.slice(1), manifest).length);
    assert.ok(validateMigrationSources([...files, '031_unreviewed.sql'], manifest).length);
  });

  it('rejects duplicate numbers and a replacement using the wrong registered filename', () => {
    assert.ok(validateMigrationSources([...files, '029_duplicate.sql'], manifest).length);
    assert.ok(validateMigrationSources(files.map(file => file === '030_public_post_counts.sql' ? '030_different.sql' : file), manifest).length);
  });

  it('requires valid metadata and an explicit review action for additions', () => {
    assert.ok(validateMigrationSources(files, { ...manifest, sourceRange: '' }).length);
    assert.ok(validateMigrationSources(files, { sourceRange: '001-027' }).length);
    assert.ok(validateMigrationSources(files, { ...manifest, supplementalSources: [{ file: '029_wardrobe_currency.sql' }] }).length);
  });
});
