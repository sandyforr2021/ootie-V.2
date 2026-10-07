import { test, expect } from '@playwright/test';

const postId = 'd374a24c-c1ea-4a64-b75a-3f50d3eb908d';
const expectedItems = ['柔粉針織開襟衫', '經典直筒牛仔褲', '白色皮革休閒鞋', '黑色月牙肩背包'];

test('Explore, OOTD Detail and Profile share one canonical outfit mapping', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ootie:brand-opening:v2', 'played'));
  await page.goto('/explore');
  const exploreCard = page.locator(`[data-post-id="${postId}"]`);
  await expect(exploreCard).toBeVisible();
  const exploreImage = await exploreCard.locator('.ootd-photo').getAttribute('src');

  await page.goto(`/ootd/${postId}?user=@sofia&from=explore`);
  await expect(page.locator('.ootd-detail-image')).toHaveAttribute('src', exploreImage);
  const tags = page.locator('.ootd-tagged-item');
  await expect(tags).toHaveCount(expectedItems.length);
  await expect(tags.locator('strong')).toHaveText(expectedItems);
  await expect.poll(() => tags.locator('img').evaluateAll((images) => images.map((image) => image.complete && image.naturalWidth > 0)))
    .toEqual(expectedItems.map(() => true));

  await page.goto('/profile?user=@sofia');
  const profilePost = page.locator('.ootd-card').filter({ has: page.locator(`a[href*="${postId}"]`) });
  await expect(profilePost).toBeVisible();
  await expect(profilePost).toContainText(expectedItems.join('、'));
});
