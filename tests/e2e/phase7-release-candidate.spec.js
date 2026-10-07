import { expect, test } from '@playwright/test';

const email = process.env.OOTIE_DEMO_EMAIL;
const password = process.env.OOTIE_DEMO_PASSWORD;

const login = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: /登入 \/ 註冊|會員登入/ }).first().click();
  await page.getByLabel('電子郵件').fill(email);
  await page.getByLabel('密碼').fill(password);
  await page.getByRole('button', { name: '立即登入' }).click();
  await expect(page.getByRole('button', { name: '會員功能' })).toBeVisible();
};

test('branded not-found state offers working recovery routes', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page).toHaveTitle('找不到頁面｜OOTIE');
  await expect(page.getByRole('heading', { name: '這一頁不在衣櫥裡' })).toBeVisible();
  await expect(page.getByRole('link', { name: '返回首頁' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: '探索 OOTD' })).toHaveAttribute('href', '/explore');
  await page.screenshot({ path: 'test-results/phase7-404-desktop.png', fullPage: true });
});

test('notification target resolves, marks read and survives refresh', async ({ page }) => {
  test.skip(!email || !password, 'Development presentation credentials are provided only at runtime.');
  await login(page);
  await page.getByRole('button', { name: '通知' }).click();
  const first = page.locator('.notification-item').first();
  await expect(first).toBeVisible();
  const wasUnread = await first.evaluate((node) => node.classList.contains('unread'));
  await first.click();
  await expect(page).toHaveURL(/\/(ootd\/|sos\?|profile\?|membership|tryon)/);
  if (wasUnread) {
    await page.reload();
    await expect(page.getByRole('button', { name: '會員功能' })).toBeVisible();
    await page.getByRole('button', { name: '通知' }).click();
    await expect(page.locator('.notification-item').first()).not.toHaveClass(/unread/);
  }
});

test('release candidate visual checkpoints render without overflow', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ootie:brand-opening:v2', 'played'));
  for (const [width, path, name] of [
    [1440, '/', 'home-desktop'],
    [390, '/', 'home-mobile'],
    [390, '/explore', 'explore-mobile']
  ]) {
    await page.setViewportSize({ width, height: width > 500 ? 1000 : 844 });
    await page.goto(path);
    await page.locator('main').waitFor({ state: 'visible' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/phase7-${name}.png`, fullPage: true });
  }
});
