import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Profile metric labels', () => {
  it('treats saved outfits as a private self-profile metric instead of received hearts', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/ProfileView.vue'), 'utf8');
    expect(source).toContain('我收藏的穿搭');
    expect(source).not.toContain('收到的 Hearts');
    expect(source).toContain('v-if="isSelf"');
    expect(source).toContain('countSavedOutfits(profileId)');
    expect(source).not.toContain('listSavedOutfits(profileId)');
  });
});
