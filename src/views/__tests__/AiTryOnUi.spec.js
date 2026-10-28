import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const viewsRoot = path.resolve(process.cwd(), 'src', 'views');
const aiSource = fs.readFileSync(path.join(viewsRoot, 'AiView.vue'), 'utf8');
const shopSource = fs.readFileSync(path.join(viewsRoot, 'ShopView.vue'), 'utf8');

describe('AI styling and try-on UI contract', () => {
  it('distinguishes precise single-item mode from outfit visualization', () => {
    expect(shopSource).toContain("t('試穿結果'");
    expect(shopSource).not.toContain("<small v-if=\"job.status==='succeeded'\" class=\"shop-hint\">");
    expect(shopSource).toContain('尺寸請查看商品資訊');
  });

  it('contains explicit paused, quota, provider and safety states without fake progress', () => {
    expect(shopSource).toContain('REVIEWER_RESERVE_PROTECTED');
    expect(shopSource).toContain('capabilities.value.remainingUnits');
    expect(shopSource).toContain('等待中的工作');
    expect(shopSource).toContain('服務正在核對這筆工作');
  });

  it('keeps provider model IDs and obsolete provider references out of Vue components', () => {
    const combined = `${aiSource}\n${shopSource}`;
    expect(combined).not.toMatch(/virtual-try-on-001|gemini-3\.1-flash-image/i);
    expect(aiSource).toContain(':disabled="isLoading || appStore.items.length === 0"');
    expect(aiSource).toContain('文字建議不會自動生成圖片。');
    expect(shopSource).toContain('URL.revokeObjectURL');
  });

  it('keeps private photo and result deletion accessible with a simplified album', () => {
    expect(shopSource).toContain('aiGateway.deletePersonPhoto(identity.accessToken,photo.id)');
    expect(shopSource).toContain('刪除這張照片');
    expect(shopSource).toContain('@click="removeResult(job)"');
    expect(shopSource).toContain('取消公開');
    expect(shopSource).toContain('更換或管理照片');
    expect(shopSource).not.toContain('class="shop-triptych"');
  });
});
