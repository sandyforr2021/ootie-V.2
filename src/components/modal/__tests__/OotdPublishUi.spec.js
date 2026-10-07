import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());
const modal = readFileSync(resolve(root, 'src/components/modal/OotdFormModal.vue'), 'utf8');
const detail = readFileSync(resolve(root, 'src/components/ootd/PostDetailContent.vue'), 'utf8');
const shareSheet = readFileSync(resolve(root, 'src/components/ootd/OotdShareSheet.vue'), 'utf8');
const store = readFileSync(resolve(root, 'src/stores/ootd.js'), 'utf8');
const css = readFileSync(resolve(root, 'src/assets/main.css'), 'utf8');

describe('OOTD publish image and clothing tag UI contract', () => {
  it('keeps the preview bounded and fully visible without distortion', () => {
    expect(css).toMatch(/\.ootd-upload-preview\s*\{[\s\S]*height:\s*min\([\s\S]*object-fit:\s*contain/i);
    expect(css).toMatch(/\.ootd-photo\.ootd-detail-image\s*\{[\s\S]*object-fit:\s*contain/i);
    expect(modal).toContain("accept=\"image/jpeg,image/png,image/webp\"");
  });

  it('uses a product-image selector and keeps each clothing tag on one line', () => {
    expect(modal).toContain('remoteClosetItems');
    expect(modal).toContain('getCurrentUserItems(authStore.profileId)');
    expect(modal).toContain('class="product-image"');
    expect(modal).toContain('ootd-item-tag');
    expect(detail).toContain('本套使用單品');
    expect(css).toMatch(/\.ootd-item-tag\s*\{[\s\S]*white-space:\s*nowrap/i);
  });

  it('keeps submit disabled while publishing to prevent duplicate posts', () => {
    expect(modal).toContain(':disabled="ootdStore.publishing || imageStatus === \'loading\'"');
  });

  it('provides social fallbacks without claiming direct Instagram publishing', () => {
    for (const label of ['Facebook', 'Threads', 'LINE', 'Instagram', '複製連結']) {
      expect(shareSheet).toContain(label);
    }
    expect(store).toContain('www.facebook.com/sharer/sharer.php');
    expect(store).toContain('www.threads.net/intent/post');
    expect(store).toContain('social-plugins.line.me/lineit/share');
    expect(store).toContain('連結已複製，可貼到 Instagram 分享。');
    expect(store).not.toContain('已發布到 Instagram');
  });
});
