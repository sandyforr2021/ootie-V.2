import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mainCss = readFileSync(resolve(process.cwd(), 'src/assets/main.css'), 'utf8');

describe('product image presentation contract', () => {
  it('uses a shared contain rule for complete product imagery', () => {
    expect(mainCss).toContain('.product-image');
    expect(mainCss).toMatch(/\.product-image\s*\{[\s\S]*?object-fit:\s*contain;/);
    expect(mainCss).toMatch(/\.item-image img\.product-image[\s\S]*?object-fit:\s*contain;/);
    expect(mainCss).toMatch(/\.suggestion-item img[\s\S]*?object-fit:\s*contain;/);
  });

  it('keeps lifestyle OOTD imagery on the photo cover contract', () => {
    expect(mainCss).toMatch(/\.ootd-photo\s*\{[\s\S]*?object-fit:\s*cover;/);
  });

  it('uses responsive SOS selection grids without fixed-width overflow', () => {
    expect(mainCss).toMatch(/\.sos-selection-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit/);
    expect(mainCss).toMatch(/\.sos-card-clothing-list\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit/);
  });
});
