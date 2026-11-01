import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mainCss = readFileSync(resolve(process.cwd(), 'src/assets/main.css'), 'utf8');
const headingCss = readFileSync(resolve(process.cwd(), 'src/assets/page-headings.css'), 'utf8');
const sosListView = readFileSync(resolve(process.cwd(), 'src/views/SosView.vue'), 'utf8');
const sosCreateView = readFileSync(resolve(process.cwd(), 'src/views/SosCreateView.vue'), 'utf8');
const sosDetailView = readFileSync(resolve(process.cwd(), 'src/views/SosDetailView.vue'), 'utf8');

describe('SOS presentation contract', () => {
  it('removes SOS hero decoration and inherits the shared page heading background', () => {
    expect(sosListView).toMatch(/core-page-hero\s+sos-page-hero\s+ootie-page-heading/);
    expect(sosCreateView).toMatch(/core-page-hero\s+sos-page-hero\s+sos-create-hero/);
    expect(headingCss).toMatch(/#main-content\s+\.sos-page-hero\.ootie-page-heading::after\s*\{\s*content:none\s*\}/);
    expect(headingCss).not.toMatch(/#main-content\s+\.sos-page-hero\.ootie-page-heading\s*\{[^}]*background:/);
    expect(headingCss).toMatch(/#main-content\s+\.ootie-page-heading\s*\{[^}]*background:var\(--gradient-celebration\)/);
    expect(mainCss).toMatch(/\.core-page-hero::after\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*\.45\)/);
  });

  it('limits and centers SOS detail at the OOTD detail width while inheriting parent gutters', () => {
    expect(mainCss).toMatch(/#sharedOotdPage\s*\{[^}]*max-width:\s*820px/);
    expect(mainCss).toMatch(/#main-content\s+#sosDetailPage\s*\{[^}]*width:\s*100%;\s*max-width:\s*820px;\s*margin-inline:\s*auto;\s*padding-inline:\s*0/);
    expect(sosDetailView).toMatch(/\.sos-detail-page\s*\{[^}]*max-width:\s*820px/);
    expect(sosDetailView).toMatch(/padding:\s*16px 0 60px/);
    expect(headingCss).toMatch(/#main-content\s+\.app-page\s*\{\s*max-width:1260px/);
  });
});
