import { expect, test } from '@playwright/test';

const viewports = [
  { width: 1440, height: 1000 },
  { width: 1280, height: 900 },
  { width: 1024, height: 900 },
  { width: 768, height: 900 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 320, height: 700 }
];

const zoomLevels = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 2];
const canonicalOotdRoute = '/ootd/d374a24c-c1ea-4a64-b75a-3f50d3eb908d?user=@sofia&from=explore';
const publicRoutes = ['/', '/explore', canonicalOotdRoute, '/sos'];
const memberRoutes = ['/closet', '/bookmarks', '/profile'];
const demoEmail = process.env.OOTIE_DEMO_EMAIL;
const demoPassword = process.env.OOTIE_DEMO_PASSWORD;

const assertMediaHealth = async (page, label) => {
  const result = await page.evaluate(() => {
    const brokenImages = [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src);
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      brokenImages,
      clippedControls: [...document.querySelectorAll('button, a')].filter((node) => (
        node.scrollWidth > node.clientWidth + 2 && getComputedStyle(node).whiteSpace !== 'normal'
      )).length,
      fashionFrameFailures: [...document.querySelectorAll('#explorePage .ootd-photo-button, #sharedOotdPage .ootd-detail-image-frame')]
        .map((frame, index) => {
          const image = frame.querySelector('img');
          if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight || !image.clientWidth || !image.clientHeight) return null;
          const renderedRatio = image.clientWidth / image.clientHeight;
          const intrinsicRatio = image.naturalWidth / image.naturalHeight;
          const exceedsFrame = image.clientWidth > frame.clientWidth + 1 || image.clientHeight > frame.clientHeight + 1;
          const isExploreFrame = frame.matches('#explorePage .ootd-photo-button');
          const unsafeFit = isExploreFrame
            ? getComputedStyle(image).objectFit !== 'contain'
            : Math.abs(renderedRatio - intrinsicRatio) > 0.02;
          return exceedsFrame || unsafeFit ? {
            index,
            src: image.currentSrc || image.src,
            frame: [frame.clientWidth, frame.clientHeight],
            image: [image.clientWidth, image.clientHeight],
            intrinsic: [image.naturalWidth, image.naturalHeight]
          } : null;
        }).filter(Boolean)
    };
  });
  expect(result.overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(1);
  expect(result.brokenImages, `${label}: broken images`).toEqual([]);
  expect(result.fashionFrameFailures, `${label}: fashion image framing`).toEqual([]);
};

const login = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: /登入 \/ 註冊|會員登入/ }).first().click();
  await page.getByLabel('電子郵件').fill(demoEmail);
  await page.getByLabel('密碼').fill(demoPassword);
  await page.getByRole('button', { name: '立即登入' }).click();
  await expect(page.getByRole('button', { name: '會員功能' })).toBeVisible();
};

test('Home hero and initial Trending never repeat the same post image', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ootie:brand-opening:v2', 'played'));
  await page.goto('/');
  await expect(page.locator('.hero-photo img')).toBeVisible();
  const heroSource = await page.locator('.hero-photo img').getAttribute('src');
  const trendingSources = await page.locator('.trending-card img').evaluateAll((images) => images.map((image) => image.getAttribute('src')));
  expect(trendingSources).not.toContain(heroSource);
});

test('Opening V2 exposes readable logo, wardrobe phase and Home without replay', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('ootie:test-opening-prepared')) {
      sessionStorage.removeItem('ootie:brand-opening:v2');
      sessionStorage.setItem('ootie:test-opening-prepared', 'yes');
    }
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => nativeSetTimeout(callback, delay === 2850 ? 10_000 : delay, ...args);
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('.brand-opening').waitFor({ state: 'attached' });
  await page.locator('.brand-opening').evaluate((opening) => {
    opening.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    opening.style.visibility = 'visible';
    opening.querySelector('.brand-opening__veil').style.opacity = '1';
    opening.querySelector('.brand-opening__identity').style.cssText += ';opacity:1;transform:none';
    opening.querySelector('.brand-opening__doors').style.opacity = '0';
    opening.querySelector('.brand-opening__enter').style.opacity = '0';
  });
  await expect(page.locator('.brand-opening__mark')).toBeVisible();
  await page.screenshot({ path: 'test-results/opening-v2-logo-1440.png', fullPage: false });
  await page.locator('.brand-opening').evaluate((opening) => {
    opening.querySelector('.brand-opening__identity').style.opacity = '0';
    opening.querySelector('.brand-opening__doors').style.opacity = '1';
    opening.querySelectorAll('.brand-opening__door').forEach((door) => { door.style.cssText += ';opacity:1;transform:none'; });
    opening.querySelector('.brand-opening__enter').style.cssText += ';opacity:1;transform:translate(-50%,0)';
  });
  await expect(page.locator('.brand-opening__doors')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/opening-v2-wardrobe-1440.png', fullPage: false });
  await page.locator('.brand-opening').evaluate((opening) => {
    opening.querySelector('.brand-opening__veil').style.opacity = '0';
    opening.querySelector('.brand-opening__door--left').style.transform = 'translateX(-76%) rotateY(-8deg)';
    opening.querySelector('.brand-opening__door--right').style.transform = 'translateX(76%) rotateY(8deg)';
    opening.querySelector('.brand-opening__enter').style.opacity = '0';
  });
  await page.screenshot({ path: 'test-results/opening-v2-reveal-1440.png', fullPage: false });
  await page.reload();
  await expect(page.locator('.brand-opening')).toHaveCount(0);
});

test('public presentation media survives viewport and zoom matrix', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => sessionStorage.setItem('ootie:brand-opening:v2', 'played'));
  // CSS reflow at browser zoom is equivalent to a smaller CSS viewport. Test every
  // required viewport plus every 1440px zoom-equivalent width once, avoiding a
  // redundant 8 × 7 Cartesian product of identical layout states.
  const effectiveWidths = [
    ...viewports.map(({ width }) => width),
    ...zoomLevels.map((zoom) => Math.max(320, Math.round(1440 / zoom)))
  ];
  for (const effectiveWidth of [...new Set(effectiveWidths)]) {
    await page.setViewportSize({ width: effectiveWidth, height: effectiveWidth <= 430 ? 844 : 900 });
    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.locator('main').waitFor({ state: 'visible' });
      await page.waitForTimeout(200);
      await assertMediaHealth(page, `${route} at effective width ${effectiveWidth}px`);
    }
  }
});

test('reduced motion bypasses the opening wall', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.removeItem('ootie:brand-opening:v2'));
  await page.goto('/');
  await expect(page.locator('.brand-opening')).toHaveCount(0);
  await expect(page.locator('.guest-hero')).toBeVisible();
});

test('mobile fashion controls keep safe touch targets and canonical clothing scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/explore');
  await expect(page.locator('.ootd-card').first()).toBeVisible();
  const undersizedExploreControls = await page.locator('.ootd-card').first().locator('.ootd-action, .follow-button').evaluateAll((nodes) => (
    nodes.filter((node) => node.getBoundingClientRect().height < 43.5).map((node) => node.textContent?.trim())
  ));
  expect(undersizedExploreControls).toEqual([]);

  await page.goto(canonicalOotdRoute);
  await expect(page.locator('.ootd-tagged-item')).toHaveCount(4);
  await expect(page.locator('.ootd-tagged-items')).toHaveCSS('overflow-x', 'auto');
  const canonicalNames = await page.locator('.ootd-tagged-item strong').allTextContents();
  expect(canonicalNames).toEqual(['柔粉針織開襟衫', '經典直筒牛仔褲', '白色皮革休閒鞋', '黑色月牙肩背包']);
});

test('member Closet, Saved and Profile media remain stable across widths and zoom equivalents', async ({ page }) => {
  test.skip(!demoEmail || !demoPassword, 'Development presentation credentials are provided only at runtime.');
  test.setTimeout(180_000);
  await page.addInitScript(() => sessionStorage.setItem('ootie:brand-opening:v2', 'played'));
  await login(page);

  const effectiveWidths = [
    ...viewports.map(({ width }) => width),
    ...zoomLevels.map((zoom) => Math.max(320, Math.round(1440 / zoom)))
  ];

  for (const width of [...new Set(effectiveWidths)]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of memberRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.locator('main').waitFor({ state: 'visible' });
      await page.waitForTimeout(300);
      await assertMediaHealth(page, `${route} at effective width ${width}px`);
    }
  }
});
