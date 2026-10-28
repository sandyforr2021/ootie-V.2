// This checks local source inventory only. It never executes SQL or declares
// an unapplied migration safe for a remote database.
export function validateMigrationSources(files, manifest) {
  const range = /^(\d{3})-(\d{3})$/.exec(manifest.sourceRange || '');
  if (!range || Number(range[1]) !== 1 || Number(range[2]) < 1) {
    return ['Invalid migration sourceRange: expected a range starting at 001.'];
  }
  if (!Array.isArray(manifest.supplementalSources)) {
    return ['Migration manifest must explicitly list supplementalSources.'];
  }

  const errors = [];
  const last = Number(range[2]);
  const expected = Array.from({ length: last }, (_, i) => i + 1);
  for (const source of manifest.supplementalSources) {
    const match = /^(\d{3})_[a-z0-9_]+\.sql$/.exec(source.file || '');
    if (!match || Number(match[1]) <= last || !['REVIEW_APPLY', 'APPLY', 'REPLACE', 'EXCLUDE', 'REBASE'].includes(source.action)) {
      errors.push(`Invalid supplemental migration entry: ${source.file || '(missing filename)'}`);
      continue;
    }
    expected.push(Number(match[1]));
    if (!files.includes(source.file)) errors.push(`Missing registered migration: ${source.file}`);
  }
  if (new Set(expected).size !== expected.length) errors.push('Duplicate migration number in source manifest.');

  const actual = files.map(file => Number(file.slice(0, 3))).sort((a, b) => a - b);
  expected.sort((a, b) => a - b);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`Migration sources differ from manifest: expected ${expected.join(',')}; found ${actual.join(',')}. Register reviewed additions in supplementalSources.`);
  }
  return errors;
}
