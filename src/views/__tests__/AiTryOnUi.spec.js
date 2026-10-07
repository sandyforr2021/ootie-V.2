import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const viewsRoot = path.resolve(process.cwd(), 'src', 'views');
const aiSource = fs.readFileSync(path.join(viewsRoot, 'AiView.vue'), 'utf8');
const tryonSource = fs.readFileSync(path.join(viewsRoot, 'TryonView.vue'), 'utf8');

describe('AI styling and try-on UI contract', () => {
  it('distinguishes precise single-item mode from outfit visualization', () => {
    expect(tryonSource).toContain('虛擬試穿');
    expect(tryonSource).toContain('AI 穿搭預覽');
    expect(tryonSource).toContain('AI 圖像為視覺模擬，實際版型、尺寸、材質、垂墜感與色彩可能不同。');
  });

  it('contains explicit paused, quota, provider and safety states without fake progress', () => {
    expect(tryonSource).toContain('AI 圖像功能目前暫停');
    expect(tryonSource).toContain('今日額度已用完');
    expect(tryonSource).toContain('Virtual Try-On 目前不可用');
    expect(tryonSource).toContain('未通過安全檢查');
    expect(tryonSource).toContain('目前沒有顯示不實百分比');
  });

  it('keeps provider model IDs and obsolete provider references out of Vue components', () => {
    const combined = `${aiSource}\n${tryonSource}`;
    expect(combined).not.toMatch(/virtual-try-on-001|gemini-3\.1-flash-image/i);
    expect(combined).toContain(':disabled="!canGenerate"');
    expect(combined).toContain('只有按下此按鈕才會建立付費 AI Request');
    expect(tryonSource).toContain('URL.revokeObjectURL');
  });

  it('makes private-photo deletion and the 1-to-5 outfit selection explicit', () => {
    expect(tryonSource).toContain("aiGateway.deletePersonPhoto(accessToken.value, photo.id)");
    expect(tryonSource).toContain('AI 穿搭預覽 · 可選 1–5 件');
    expect(tryonSource).toContain('`${selectedItemIds.length} / 5`');
    expect(tryonSource).toContain('class="selected-tray"');
    expect(tryonSource).toContain("mode.value === 'single'");
    expect(tryonSource).toContain('validSelectedItemIds.value.length === 1');
    expect(tryonSource).toContain('validSelectedItemIds.value.length >= 1 && validSelectedItemIds.value.length <= 5');
  });
});
