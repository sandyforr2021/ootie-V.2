import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const email = process.env.OOTIE_DEMO_EMAIL;
const password = process.env.OOTIE_DEMO_PASSWORD;
const profileId = process.env.OOTIE_DEMO_PROFILE_ID;
const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

const login = async (page, returnPath = '/') => {
  await page.goto(returnPath);
  await page.getByRole('button', { name: /登入 \/ 註冊|會員登入/ }).first().click();
  await page.getByLabel('電子郵件').fill(email);
  await page.getByLabel('密碼').fill(password);
  await page.getByRole('button', { name: '立即登入' }).click();
  await expect(page.getByRole('button', { name: '會員功能' })).toBeVisible();
};

test.beforeEach(() => {
  test.skip(!email || !password, 'Development presentation credentials are provided only at runtime.');
});

test('guest Home to Explore to Login gate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /穿出自己的節奏/ })).toBeVisible();
  await page.getByRole('link', { name: '看看大家怎麼穿' }).click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.locator('.ootd-card').first()).toBeVisible();
  await page.getByRole('button', { name: '登入 / 註冊' }).click();
  await expect(page.getByRole('dialog')).toContainText('歡迎回來');
  await expect(page.getByRole('button', { name: '使用 Google 帳號登入' })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toContainText(/Facebook/i);
});

test('member core journey preserves remote social interactions', async ({ page }) => {
  await login(page);
  for (const [path, heading] of [
    ['/closet', '我的衣櫥'], ['/ai', /從你的衣櫥/], ['/tryon', /先選一件，或搭一整套/], ['/sos', '穿搭求救'],
    ['/profile', '個人檔案'], ['/membership', '方案與 OOTIE 點數']
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  }

  await page.goto('/explore');
  const card = page.locator('.ootd-card').filter({ has: page.locator('.follow-button:not([disabled])') }).first();
  await expect(card).toBeVisible();
  const like = card.locator('.ootd-action').nth(0);
  const save = card.locator('.ootd-action').nth(2);
  const follow = card.locator('.follow-button');
  const postId = await card.getAttribute('data-post-id');
  const likeBefore = await like.getAttribute('aria-pressed');
  const saveBefore = await save.getAttribute('aria-pressed');
  const followBefore = await follow.getAttribute('aria-pressed');
  await like.click();
  await expect(like).not.toHaveAttribute('aria-pressed', likeBefore);
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', likeBefore);
  await save.click();
  await expect(save).not.toHaveAttribute('aria-pressed', saveBefore);
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', saveBefore);
  await follow.click();
  await expect(follow).not.toHaveAttribute('aria-pressed', followBefore);
  await page.reload();
  const persistedFollow = page.locator(`[data-post-id="${postId}"] .follow-button`);
  await expect(persistedFollow).not.toHaveAttribute('aria-pressed', followBefore);
  await persistedFollow.click();

  await page.getByRole('button', { name: '通知' }).click();
  await expect(page.getByRole('dialog')).toContainText('通知');
  await page.getByRole('button', { name: '關閉' }).click();
  await page.getByRole('button', { name: '會員功能' }).click();
  await page.getByRole('button', { name: '登出' }).click();
  await expect(page.getByRole('button', { name: '登入 / 註冊' })).toBeVisible();
});

test('external product preview saves and converts to a sourced closet item', async ({ page }) => {
  test.skip(!publishableKey || !supabaseUrl || !profileId, 'Development Supabase runtime configuration is required.');
  const sourceUrl = `https://example.com/products/oxford-shirt-${Date.now()}`;
  const memberApi = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: apiLoginError } = await memberApi.auth.signInWithPassword({ email, password });
  expect(apiLoginError).toBeNull();
  await login(page, '/bookmarks');
  await page.route('**/v1/product-import/preview', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      title: 'Cotton Oxford Shirt', brand: 'OOTIE Studio', image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800',
      sourceUrl, sourceDomain: 'example.com', price: '1680', currency: 'TWD', parser: 'json-ld', needsManualInput: false
    }) });
  });
  try {
    await page.locator('#productImportUrl').fill(sourceUrl);
    await page.getByRole('button', { name: '讀取商品' }).click();
    await expect(page.locator('.import-preview')).toContainText('Cotton Oxford Shirt');
    await page.getByRole('button', { name: '使用此商品' }).click();
    await expect(page.getByRole('dialog')).toContainText('建立書籤');
    await expect(page.getByLabel('商品名稱 *')).toHaveValue('Cotton Oxford Shirt');
    await expect(page.getByLabel('商品頁網址')).toHaveValue(sourceUrl);
    await page.getByRole('button', { name: '儲存書籤' }).click();
    const bookmarkCard = page.locator('.bookmark-card').filter({ hasText: 'Cotton Oxford Shirt' }).first();
    await expect(bookmarkCard).toBeVisible();
    await bookmarkCard.click();
    await page.getByRole('button', { name: '已購買，加入我的衣櫥' }).click();
    await expect(page.locator('.toast')).toContainText('已加入我的衣櫥');
    const { data: closetRows, error: closetReadError } = await memberApi.from('ootie_clothing_items').select('id,source_url').eq('owner_id', profileId).eq('source_url', sourceUrl);
    const { data: bookmarkRows, error: bookmarkReadError } = await memberApi.from('ootie_bookmarks').select('id,product_url').eq('owner_id', profileId).eq('product_url', sourceUrl);
    expect(closetReadError).toBeNull();
    expect(bookmarkReadError).toBeNull();
    expect(closetRows).toHaveLength(1);
    expect(bookmarkRows).toHaveLength(1);
  } finally {
    await memberApi.from('ootie_clothing_items').delete().eq('owner_id', profileId).eq('source_url', sourceUrl);
    await memberApi.from('ootie_bookmarks').delete().eq('owner_id', profileId).eq('product_url', sourceUrl);
    await memberApi.auth.signOut();
  }
});

test('content polish surfaces real saved, SOS, notification and statistics data', async ({ page }) => {
  await login(page);

  await page.goto('/sos');
  await expect(page.locator('.sos-card-clothing-thumb').first()).toBeVisible();
  expect(await page.locator('.sos-feed-card').first().locator('.sos-card-clothing-thumb').count()).toBeGreaterThanOrEqual(3);

  await page.goto('/bookmarks?tab=outfits');
  await expect(page.locator('.saved-outfit-card').first()).toBeVisible();
  expect(await page.locator('.saved-outfit-card').count()).toBeGreaterThanOrEqual(8);

  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: '衣櫥統計' })).toBeVisible();
  await expect(page.locator('.stats-card').first()).toBeVisible();

  await page.goto('/membership');
  await page.locator('.plan-card').filter({ hasText: 'OOTIE Pro' }).getByRole('button', { name: '升級方案' }).click();
  await expect(page.getByRole('dialog', { name: '訂閱方案確認' })).toContainText('訂單摘要');
  await page.getByRole('button', { name: '返回' }).click();

  await page.getByRole('button', { name: '通知' }).click();
  await expect(page.locator('.notification-item').first()).toBeVisible();
  await expect(page.locator('.notification-badge').first()).toBeVisible();
});

test('presentation pages do not overflow at supported mobile widths', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  for (const width of [1440, 1024, 768, 390, 375]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['/explore', '/closet', '/sos', '/bookmarks', '/stats', '/membership', '/settings']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1);
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
        window.scrollTo(0, 0);
      });
      expect(await page.locator('img:visible').evaluateAll((images) => images.filter((image) => image.complete && image.naturalWidth === 0).length)).toBe(0);
    }
  }
});

test('presentation routes keep baseline accessibility semantics', async ({ page }) => {
  await login(page);
  for (const path of ['/', '/explore', '/closet', '/ai', '/tryon', '/sos', '/profile', '/membership', '/settings']) {
    await page.goto(path);
    await expect(page.locator('main#main-content')).toBeVisible();
    expect(await page.locator('img:not([alt])').count(), `${path} images require alt text`).toBe(0);
    const unnamed = await page.locator('button:visible').evaluateAll((buttons) => buttons.filter((button) => {
      const name = button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent?.trim();
      return !name;
    }).length);
    expect(unnamed, `${path} visible buttons require an accessible name`).toBe(0);
  }
  await page.keyboard.press('Home');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
});

test('member settings, legal drafts and private account boundary are coherent', async ({ page }) => {
  await login(page, '/settings');
  await expect(page.getByRole('heading', { name: '帳號設定' })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByText('私人資料不會顯示在公開個人檔案。')).toBeVisible();
  await expect(page.getByRole('link', { name: '前往方案與點數' })).toHaveAttribute('href', '/membership');

  for (const [path, title] of [
    ['/legal/privacy', '隱私權說明'], ['/legal/terms', '使用條款'], ['/legal/ai', 'AI 圖像使用說明']
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText(/尚未經法律專業人員審閱/)).toBeVisible();
  }

  await page.goto('/settings');
  await page.getByRole('button', { name: '登出' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: '登入後管理帳號設定' })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toHaveCount(0);
});

test('browser branding, manifest and offline-safe shell are available', async ({ page, request }) => {
  await page.goto('/explore');
  await expect(page).toHaveTitle('探索 OOTD｜OOTIE');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe('standalone');
  const serviceWorker = await request.get('/sw.js');
  expect(serviceWorker.ok()).toBeTruthy();
  expect(await serviceWorker.text()).toContain("request.headers.has('authorization')");
});

test('Google OAuth entry preserves the configured provider redirect', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /登入 \/ 註冊|會員登入/ }).first().click();
  await Promise.all([
    page.waitForURL((url) => url.hostname.includes('accounts.google.com') || (url.hostname.includes('supabase.co') && url.pathname.includes('/auth/v1/authorize')), { timeout: 15_000 }),
    page.getByRole('button', { name: '使用 Google 帳號登入' }).click()
  ]);
  expect(['accounts.google.com', 'hoxkrmadzjnyjaqjbyxc.supabase.co']).toContain(new URL(page.url()).hostname);
});
