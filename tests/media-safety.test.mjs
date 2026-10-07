import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOrphanMedia } from '../scripts/orphanMediaAuditContract.mjs';

test('orphan audit protects originals for existing items and flags stale derivatives', () => {
  const now = Date.parse('2026-10-02T00:00:00Z');
  const old = '2026-09-20T00:00:00Z';
  const objects = [
    { path: 'closet/user/item/op/original.jpg', userId: 'user', itemId: 'item', createdAt: old },
    { path: 'closet/user/item/op/display.webp', userId: 'user', itemId: 'item', createdAt: old },
    { path: 'closet/user/missing/op/display.webp', userId: 'user', itemId: 'missing', createdAt: old }
  ];
  const report = classifyOrphanMedia({
    objects,
    existingItemKeys: new Set(['user/item']),
    referencedPaths: new Set(),
    thresholdHours: 168,
    now
  });
  assert.equal(report[0].retainedOriginal, true);
  assert.equal(report[0].candidate, false);
  assert.equal(report[1].candidate, true);
  assert.equal(report[2].candidate, true);
});

test('current database references are never cleanup candidates', () => {
  const path = 'closet/user/item/op/display.webp';
  const [row] = classifyOrphanMedia({
    objects: [{ path, userId: 'user', itemId: 'item', createdAt: '2026-01-01T00:00:00Z' }],
    existingItemKeys: new Set(['user/item']),
    referencedPaths: new Set([path]),
    thresholdHours: 24,
    now: Date.parse('2026-10-02T00:00:00Z')
  });
  assert.equal(row.isCurrent, true);
  assert.equal(row.candidate, false);
});

