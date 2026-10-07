import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (...segments) => fs.readFileSync(path.resolve(process.cwd(), ...segments), 'utf8');
const topbar = read('src', 'components', 'layout', 'AppTopbar.vue');
const auth = read('src', 'components', 'modal', 'AuthModal.vue');

describe('human identity and auth UI contract', () => {
  it('uses a real circular account button with a clipped cover avatar', () => {
    expect(topbar).toContain('class="account-trigger"');
    expect(topbar).toContain('class="avatar is-logged-in"');
    expect(topbar).toMatch(/\.avatar\s*\{[^}]*aspect-ratio:\s*1;/s);
    expect(topbar).toMatch(/\.avatar\s*\{[^}]*overflow:\s*hidden;/s);
    expect(topbar).toMatch(/\.avatar\s*\{[^}]*border-radius:\s*50%;/s);
    expect(topbar).toMatch(/\.avatar img\s*\{[^}]*object-fit:\s*cover;/s);
  });

  it('keeps authentication to Google and email without prototype labels', () => {
    expect(auth).toContain('class="google-mark"');
    expect(auth).toContain('使用 Google 登入');
    expect(auth).toContain('或使用電子郵件');
    expect(auth).not.toMatch(/Facebook|Guest-First Access|Demo|DEMO|模擬/);
  });
});
