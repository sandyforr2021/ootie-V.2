import { test, expect } from '@playwright/test';

const primaryLabels = ['首頁', '探索', '衣櫥', 'SOS'];
const secondaryDestinations = [
  ['個人檔案', '/profile'],
  ['書籤', '/bookmarks'],
  ['衣櫥統計', '/stats'],
  ['AI 助手', '/ai'],
  ['虛擬試穿', '/tryon'],
  ['方案與點數', '/membership']
];

const openMore = async (page) => {
  await page.getByRole('navigation', { name: '手機版導覽' }).getByRole('button', { name: '更多', exact: true }).click();
  return page.getByRole('dialog', { name: '更多功能' });
};

for (const width of [375, 390, 768]) {
  test(`mobile navigation is unique and usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 667 });
    await page.goto('/');

    const bottomNav = page.getByRole('navigation', { name: '手機版導覽' });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole('link')).toHaveCount(4);
    for (const label of primaryLabels) await expect(bottomNav.getByRole('link', { name: label, exact: true })).toHaveCount(1);
    await expect(bottomNav.getByRole('button', { name: '更多', exact: true })).toHaveCount(1);

    const menu = await openMore(page);
    await expect(menu).toBeVisible();
    for (const label of primaryLabels) {
      await expect(menu.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }
    for (const [label] of secondaryDestinations) {
      await expect(menu.getByRole('link', { name: label, exact: true })).toHaveCount(1);
    }
    await expect(menu.getByRole('button', { name: '通知', exact: true })).toHaveCount(1);

    const quickAdd = menu.getByLabel('建立內容');
    await expect(quickAdd.getByRole('button')).toHaveCount(4);
    for (const label of ['加入單品', '發布 OOTD', '發布求救', '加入書籤']) {
      await expect(quickAdd.getByRole('button', { name: new RegExp(`^${label}`) })).toHaveCount(1);
    }
    await expect(quickAdd).not.toContainText('AI 助手');

    const geometry = await menu.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      right: element.getBoundingClientRect().right,
      left: element.getBoundingClientRect().left
    }));
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    if (geometry.scrollHeight > geometry.clientHeight) {
      await menu.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      expect(await menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    }

    await page.screenshot({ path: testInfo.outputPath(`mobile-more-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const navBox = await bottomNav.boundingBox();
    expect(navBox).not.toBeNull();
    expect(navBox.y + navBox.height).toBeLessThanOrEqual((width === 768 ? 1024 : 667));
  });
}

test('secondary routes and Quick Add actions keep their real destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [label, path] of secondaryDestinations) {
    await page.goto('/');
    const menu = await openMore(page);
    const link = menu.getByRole('link', { name: label, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}(?:$|\\?)`));
  }

  for (const [label, expectedUrl] of [
    ['加入單品', /\/closet\?quick=add-item/],
    ['發布求救', /\/sos\?quick=add-sos/],
    ['加入書籤', /\/bookmarks\?quick=add-bookmark/]
  ]) {
    await page.goto('/');
    const menu = await openMore(page);
    await menu.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    await expect(page).toHaveURL(expectedUrl);
  }

  await page.goto('/');
  const menu = await openMore(page);
  await menu.getByRole('button', { name: /^發布 OOTD/ }).click();
  await expect(page.getByRole('dialog')).toContainText('登入後發布 OOTD');
});

for (const width of [375, 390, 768]) {
  test(`authentication UI stays clean and unclipped at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 667 });
    await page.goto('/');
    await page.getByRole('button', { name: '登入 / 註冊' }).click();

    const dialog = page.getByRole('dialog', { name: '歡迎回來' });
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText(/facebook/i);
    const googleButton = dialog.getByRole('button', { name: '使用 Google 帳號登入' });
    await expect(googleButton).toBeVisible();
    await expect(googleButton.locator('.google-mark')).toBeVisible();
    await expect(dialog.getByLabel('電子郵件')).toBeVisible();
    await expect(dialog.getByLabel('密碼')).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}
