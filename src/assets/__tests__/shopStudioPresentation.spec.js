import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const shopView = readFileSync(resolve(process.cwd(), 'src/views/ShopView.vue'), 'utf8');
const headingCss = readFileSync(resolve(process.cwd(), 'src/assets/page-headings.css'), 'utf8');

describe('shopping studio presentation contract', () => {
  it('keeps product images contained in a responsive frame separate from item names', () => {
    expect(shopView).toMatch(/\.shop-view\s+\.shop-product-image\{height:auto!important;min-height:0;aspect-ratio:4\/5;overflow:visible\}/);
    expect(shopView).toMatch(/\.shop-view\s+\.shop-product-image\s+:deep\(img\)\{display:block;width:100%;height:100%;max-height:100%;object-fit:contain\}/);
    expect(shopView).toMatch(/class="shop-product-image"[\s\S]*?<\/button>\s*<div class="shop-product-info">/);
  });

  it('uses the compact points balance while preserving shared banner geometry', () => {
    expect(shopView).toContain('class="balance-card"');
    expect(shopView).toContain('class="personal-balance"');
    expect(shopView).toContain('to="/credits#point-history"');
    expect(shopView).not.toContain('studio-balance-card');
    expect(headingCss).toMatch(/#main-content\s+\.ootie-page-heading\s*\{[^}]*min-height:116px/);
  });
});
