import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import BrandMark from '../BrandMark.vue';

describe('shared OOTie brand mark', () => {
  it('keeps the current text identity until a formal asset is provided', () => {
    expect(BrandMark).toBeTruthy();
    expect(readFileSync(resolve(process.cwd(), 'src/components/layout/AppSidebar.vue'), 'utf8'))
      .toContain('<BrandMark class="brand" />');
    expect(readFileSync(resolve(process.cwd(), 'src/components/layout/AppTopbar.vue'), 'utf8'))
      .toContain('<BrandMark class="mobile-brand" />');
    expect(readFileSync(resolve(process.cwd(), 'src/components/layout/BrandMark.vue'), 'utf8'))
      .toContain('OOTie');
  });
});
