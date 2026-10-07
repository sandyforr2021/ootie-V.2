import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const outputDir = path.join(root, 'test-results');
await mkdir(outputDir, { recursive: true });

const makeSheet = async (page, kind, count) => {
  const cards = [];
  for (let index = 1; index <= count; index += 1) {
    const number = String(index).padStart(2, '0');
    const bytes = await readFile(path.join(root, 'public', 'demo', kind, `${number}.webp`));
    cards.push(`<article><strong>${number}</strong><img src="data:image/webp;base64,${bytes.toString('base64')}" alt="${kind} ${number}"></article>`);
  }
  await page.setContent(`
    <style>
      body { margin: 16px; background: #ddd8d1; font: 14px Arial, sans-serif; }
      main { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
      article { padding: 8px; border-radius: 8px; background: white; }
      strong { display: block; margin-bottom: 6px; }
      img { display: block; width: 100%; height: 210px; object-fit: contain; background: #f6f3ee; }
    </style>
    <main>${cards.join('')}</main>
  `);
  await page.screenshot({ path: path.join(outputDir, `${kind}-audit-sheet.png`), fullPage: true });
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1800 } });
  await makeSheet(page, 'garments', 43);
  await makeSheet(page, 'ootd', 36);
} finally {
  await browser.close();
}
