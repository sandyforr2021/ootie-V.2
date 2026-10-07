import { expect, test } from '@playwright/test';

const email = process.env.OOTIE_DEMO_EMAIL;
const password = process.env.OOTIE_DEMO_PASSWORD;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test.beforeEach(() => {
  test.skip(!email || !password, 'Development presentation credentials are provided only at runtime.');
});

test('Try-on sends an owner-scoped remote clothing UUID and explains safety rejection without retry', async ({ page }) => {
  let capturedRequest = null;
  let generationRequests = 0;
  await page.route('**/v1/capabilities', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      imageGenerationEnabled: true,
      maxImagesPerUserPerDay: null,
      quotaExempt: true,
      pointsCost: { singleTryOn: 8, outfitPreview: 12 }
    })
  }));
  await page.route('**/v1/person-photos', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      photos: [{ id: 'e2e-person-photo', path: 'person/e2e-owner/e2e-person-photo.png', createdAt: '2026-10-02T00:00:00.000Z' }]
    })
  }));
  await page.route('**/v1/private-images/**', async (route) => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  }));
  await page.route(/\/v1\/generations$/, async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ generations: [] })
  }));
  await page.route('**/v1/generations/single-try-on', async (route) => {
    generationRequests += 1;
    capturedRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'SAFETY_REJECTION', details: {
        safetyReason: 'AGE_RESTRICTED', supportCodes: ['58061214']
      } } })
    });
  });

  await page.goto('/tryon');
  await page.getByRole('button', { name: /登入 \/ 註冊|會員登入/ }).first().click();
  await page.getByLabel('電子郵件').fill(email);
  await page.getByLabel('密碼').fill(password);
  await page.getByRole('button', { name: '立即登入' }).click();
  await expect(page.getByRole('button', { name: '會員功能' })).toBeVisible();

  await page.goto('/tryon');
  const generateButton = page.getByRole('button', { name: '生成試穿' });
  await expect(page.locator('.service-banner.ready')).toContainText('此帳號不受每日圖片額度限制');
  await expect(page.locator('.clothing-card.active')).toHaveCount(1);
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  await expect.poll(() => capturedRequest).not.toBeNull();
  expect(capturedRequest.clothingItemIds).toHaveLength(1);
  expect(capturedRequest.clothingItemIds[0]).toMatch(UUID_PATTERN);
  await expect(page.getByRole('heading', { name: '未通過安全檢查' })).toBeVisible();
  await expect(page.locator('.error-state')).toContainText('Google 將輸入或生成結果判為不符合成人限制');
  await expect(page.locator('.photo-guidance')).toBeVisible();
  await page.getByRole('button', { name: '重新選擇照片與衣物' }).click();
  await expect(page.getByRole('heading', { name: '等你確認照片與單品' })).toBeVisible();
  expect(generationRequests).toBe(1);
});

