import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import router from '../index';
import { MOBILE_MORE_ITEMS, MOBILE_PRIMARY_ITEMS, NAVIGATION_ITEMS } from '../navigation';

const mainCss = readFileSync(resolve(process.cwd(), 'src/assets/main.css'), 'utf8');

describe('shared navigation information architecture', () => {
  it('maps every destination to an existing named route', () => {
    const routeNames = new Set(router.getRoutes().map((route) => route.name));
    for (const item of NAVIGATION_ITEMS) {
      expect(routeNames.has(item.routeName), `${item.routeName} must exist`).toBe(true);
    }
  });

  it('keeps all desktop destinations reachable from mobile navigation', () => {
    const mobileNames = new Set([...MOBILE_PRIMARY_ITEMS, ...MOBILE_MORE_ITEMS].map((item) => item.routeName));
    expect(mobileNames).toEqual(new Set(NAVIGATION_ITEMS.map((item) => item.routeName)));
  });

  it('keeps primary and secondary mobile destinations mutually exclusive', () => {
    const primaryNames = new Set(MOBILE_PRIMARY_ITEMS.map((item) => item.routeName));
    expect(MOBILE_PRIMARY_ITEMS.map((item) => item.shortLabel)).toEqual(['首頁', '試穿', '探索', '衣櫥']);
    expect(MOBILE_MORE_ITEMS.every((item) => !primaryNames.has(item.routeName))).toBe(true);
  });

  it('uses unique route names, paths, and labels', () => {
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.routeName)).size).toBe(NAVIGATION_ITEMS.length);
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.path)).size).toBe(NAVIGATION_ITEMS.length);
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.label)).size).toBe(NAVIGATION_ITEMS.length);
  });

  it('uses a clothing-semantic icon for the Closet destination without changing its route', () => {
    const closet = NAVIGATION_ITEMS.find((item) => item.routeName === 'Closet');
    expect(closet).toMatchObject({ path: '/closet', icon: '👚' });
  });

  it('keeps desktop and mobile navigation mutually exclusive at the mobile breakpoint', () => {
    expect(mainCss).toMatch(/\.bottom-nav\s*\{\s*display:\s*none;/);
    expect(mainCss).toMatch(/\.sidebar\s*\{\s*display:\s*none;/);
    expect(mainCss).toMatch(/\.bottom-nav\s*\{[\s\S]*?display:\s*flex;/);
    expect(mainCss).toContain('padding: 20px 16px calc(92px + env(safe-area-inset-bottom));');
    expect(mainCss).toContain('bottom: calc(10px + env(safe-area-inset-bottom));');
    expect(mainCss).toContain('max-height: min(calc(100dvh - 112px - env(safe-area-inset-bottom)), 660px);');
    expect(mainCss).toContain('overflow-y: auto;');
  });
});
