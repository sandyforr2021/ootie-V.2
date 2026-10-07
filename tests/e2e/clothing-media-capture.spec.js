import path from 'node:path';
import { expect, test } from '@playwright/test';

const demoEmail = process.env.OOTIE_DEMO_EMAIL;
const demoPassword = process.env.OOTIE_DEMO_PASSWORD;
const garment = path.resolve('public/demo/garments/01.webp');

const login = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: /登入 \/ 註冊|會員登入/ }).first().click();
  await page.getByLabel('電子郵件').fill(demoEmail);
  await page.getByLabel('密碼').fill(demoPassword);
  await page.getByRole('button', { name: '立即登入' }).click();
  await expect(page.getByRole('button', { name: '會員功能' })).toBeVisible();
};

test.describe('clothing capture safety', () => {
  test.skip(!demoEmail || !demoPassword, 'Development presentation credentials are required');

  test('quality feedback remains usable from 320px through desktop', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('ootie:brand-opening:v2', 'played');
      localStorage.setItem('ootie:capture-guide-seen:v1', 'true');
    });
    await login(page);

    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1024, height: 900 },
      { width: 768, height: 900 },
      { width: 430, height: 932 },
      { width: 390, height: 844 },
      { width: 375, height: 812 },
      { width: 320, height: 700 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/closet');
      await page.getByRole('button', { name: /新增單品/ }).first().click();
      await page.locator('#photoFile').setInputFiles(garment);
      await expect(page.getByRole('heading', { name: '照片檢查' })).toBeVisible();
      await expect(page.getByText(/照片已準備完成|照片可使用/)).toBeVisible();
      await expect(page.getByText('我已確認畫面以一件主要衣物為主')).toBeVisible();

      const layout = await page.evaluate(() => ({
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        modalOverflow: document.querySelector('.form-modal').scrollWidth - document.querySelector('.form-modal').clientWidth
      }));
      expect(layout.documentOverflow, `${viewport.width}px document overflow`).toBeLessThanOrEqual(1);
      expect(layout.modalOverflow, `${viewport.width}px modal overflow`).toBeLessThanOrEqual(1);

      if (viewport.width === 390 || viewport.width === 375) {
        await page.screenshot({ path: `test-results/clothing-capture-${viewport.width}.png`, fullPage: false });
      }
      await page.getByRole('button', { name: '取消' }).last().click();
    }
  });

  test('HEIC is detected without pretending to convert it', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('ootie:brand-opening:v2', 'played');
      localStorage.setItem('ootie:capture-guide-seen:v1', 'true');
    });
    await login(page);
    await page.goto('/closet');
    await page.getByRole('button', { name: /新增單品/ }).first().click();
    await page.locator('#photoFile').setInputFiles({
      name: 'iphone.heic',
      mimeType: 'image/heic',
      buffer: Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypheic')])
    });
    await expect(page.getByRole('alert')).toContainText('JPEG、PNG 或 WebP');
    await expect(page.getByRole('button', { name: '重新選擇' })).toBeVisible();
  });
});
