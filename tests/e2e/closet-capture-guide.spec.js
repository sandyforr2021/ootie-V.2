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

test('demo closet uses varied real-world captures and offers optional photo guidance', async ({ page }) => {
  test.skip(!email || !password, 'Development presentation credentials are provided only at runtime.');
  await page.addInitScript(() => {
    sessionStorage.setItem('ootie:brand-opening:v2', 'played');
    localStorage.removeItem('ootie:capture-guide-seen:v1');
  });
  await login(page);
  await page.goto('/closet');
  await expect(page.locator('.item-card')).toHaveCount(43);
  await expect(page.locator('.item-card .product-image').first()).toBeVisible();
  await page.waitForFunction(() => [...document.querySelectorAll('.item-card .product-image')]
    .slice(0, 12)
    .every((image) => image.complete && image.naturalWidth > 0));
  await page.screenshot({ path: 'test-results/closet-real-captures-desktop.png', fullPage: true });

  await page.getByRole('button', { name: /新增單品/ }).first().click();
  await expect(page.getByRole('heading', { name: '讓衣服完整入鏡就好' })).toBeVisible();
  await expect(page.getByRole('button', { name: '開始拍照' })).toBeVisible();
  await expect(page.getByRole('button', { name: '從相簿選擇' }).first()).toBeVisible();
  await expect(page.locator('input[capture="environment"]')).toHaveCount(1);
  await expect(page.locator('input[type="file"]:not([capture])')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/closet-capture-guide-desktop.png' });
});

test('capture guidance remains usable on a 390px phone viewport', async ({ page }) => {
  test.skip(!email || !password, 'Development presentation credentials are provided only at runtime.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    sessionStorage.setItem('ootie:brand-opening:v2', 'played');
    localStorage.removeItem('ootie:capture-guide-seen:v1');
  });
  await login(page);
  await page.goto('/closet');
  await page.getByRole('button', { name: /新增單品/ }).first().click();
  await expect(page.getByRole('heading', { name: '讓衣服完整入鏡就好' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/closet-capture-guide-mobile.png' });
});
