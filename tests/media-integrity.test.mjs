import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('legacy media is preserved and the extension guide offers an actual package', async () => {
  const garments = (await readdir(join(root, 'public/demo/garments'))).filter((name) => name.endsWith('.webp'));
  const ootd = (await readdir(join(root, 'public/demo/ootd'))).filter((name) => name.endsWith('.webp'));
  assert.equal(garments.length, 43);
  assert.equal(ootd.length, 36);
  assert.equal(new Set(garments).size, 43);
  assert.equal(new Set(ootd).size, 36);

  const guide = await readFile(join(root, 'src/components/bookmarks/ExtensionGuide.vue'), 'utf8');
  assert.match(guide, /href="\/downloads\/ootie-browser-companion\.zip" download/);
  const archive = await readFile(join(root, 'public/downloads/ootie-browser-companion.zip'));
  assert.equal(archive.subarray(0, 4).toString('hex'), '504b0304');
});

test('Explore, Closet and OOTD Detail preserve safe fashion-media framing', async () => {
  const [explore, closet, detail, css] = await Promise.all([
    readFile(join(root, 'src/views/ExploreView.vue'), 'utf8'),
    readFile(join(root, 'src/views/ClosetView.vue'), 'utf8'),
    readFile(join(root, 'src/components/ootd/PostDetailContent.vue'), 'utf8'),
    readFile(join(root, 'src/assets/main.css'), 'utf8')
  ]);
  assert.match(explore, /class="ootd-user-row"[\s\S]*class="ootd-photo-button"[\s\S]*class="ootd-actions"/);
  assert.match(closet, /class="product-image"[\s\S]*decoding="async"/);
  assert.match(detail, /post-detail-primary-actions[\s\S]*ootd-tagged-section/);
  assert.match(css, /#explorePage \.ootd-photo-button\s*\{[\s\S]*aspect-ratio:\s*4 \/ 5/);
  assert.match(css, /#explorePage \.ootd-photo\s*\{[\s\S]*object-fit:\s*contain/);
  assert.match(css, /#sharedOotdPage \.ootd-photo\.ootd-detail-image\s*\{[\s\S]*height:\s*auto/);
  assert.match(css, /#closetPage \.item-image img\.product-image\s*\{[\s\S]*background:\s*transparent/);
});

test('Home uses a dedicated responsive hero asset while Trending keeps canonical unique posts', async () => {
  const home = await readFile(join(root, 'src/views/HomeView.vue'), 'utf8');
  const visual = await readFile(join(root, 'src/components/ui/EditorialVisual.vue'), 'utf8');
  assert.match(home, /<EditorialVisual/);
  assert.match(visual, /ootie-home-hero-v2-720\.webp 720w/);
  assert.match(visual, /ootie-home-hero-v2-1024\.webp 1024w/);
  assert.doesNotMatch(home, /:src="heroPost\?\.image"/);
  assert.match(home, /uniquePostsById\(genuineContent\(appStore\.ootdPosts\)\)/);
  assert.ok((await stat(join(root, 'public/assets/ootie-home-hero-v2-720.webp'))).size < 160_000);
  assert.ok((await stat(join(root, 'public/assets/ootie-home-hero-v2-1024.webp'))).size < 300_000);
});

test('brand opening V2 is session-only, reduced-motion aware and intentionally timed', async () => {
  const opening = await readFile(join(root, 'src/components/layout/BrandOpening.vue'), 'utf8');
  assert.match(opening, /ootie:brand-opening:v2/);
  const duration = Number(opening.match(/BRAND_OPENING_DURATION_MS = (\d+)/)?.[1]);
  assert.ok(duration >= 1500 && duration <= 3000, 'opening exits within three seconds');
  assert.match(opening, /brand-opening__door--left/);
  assert.match(opening, /brand-opening__door--right/);
  assert.match(opening, /prefers-reduced-motion: reduce/);
  assert.match(opening, /window\.location\.pathname === '\/'/);
});
