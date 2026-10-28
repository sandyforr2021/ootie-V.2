import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppStore } from '../app';
import { useClosetStore } from '../closet';
import { useStatsStore } from '../stats';
import { GUEST_CLOSET_STORAGE_KEY } from '@/services/guestAccess';
import { defaultItems } from '@/constants';
import { useAuthStore } from '@/stores/auth';
import { IDENTITY_STATUS } from '@/services/identityResolver';
import * as clothingRepository from '@/services/clothingRepository';

describe('Stats Store & Aizhen Features', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
    localStorage.setItem(GUEST_CLOSET_STORAGE_KEY, JSON.stringify(defaultItems));
  });

  it('should calculate closet stats distributions', async () => {
    const statsStore = useStatsStore();
    const stats = await statsStore.getClosetStats();

    expect(stats).toHaveProperty('colorStats');
    expect(stats).toHaveProperty('colorFamilyStats');
    expect(stats).toHaveProperty('styleStats');
    expect(stats).toHaveProperty('categoryStats');
    expect(stats.colorStats.length).toBeGreaterThan(0);
    expect(stats.categoryStats.length).toBeGreaterThan(0);
  });

  it('uses the named color for chart segments even when an old saved hex is wrong', async () => {
    localStorage.setItem(GUEST_CLOSET_STORAGE_KEY, JSON.stringify([
      { ...defaultItems[0], primary_color: '黑色', color_hex: '#ff0000' },
      { ...defaultItems[1], primary_color: 'Blue', color_hex: '#ff0000' }
    ]));
    const { colorStats } = await useStatsStore().getClosetStats();
    expect(colorStats.find(entry => entry.color === '黑色').color_hex).toBe('#242321');
    expect(colorStats.find(entry => entry.color === 'Blue').color_hex).toBe('#3B5998');
  });

  it('should calculate brand statistics correctly', async () => {
    const statsStore = useStatsStore();
    const brandStats = await statsStore.getBrandStats();

    expect(Array.isArray(brandStats)).toBe(true);
    expect(brandStats.length).toBeGreaterThan(0);
    expect(brandStats[0]).toHaveProperty('brand');
    expect(brandStats[0]).toHaveProperty('count');
    expect(brandStats[0]).toHaveProperty('totalWearCount');
  });

  it('should rank top worn items in descending wear count', async () => {
    const statsStore = useStatsStore();
    const topWorn = await statsStore.getTopWornItems();

    expect(topWorn.length).toBeGreaterThan(0);
    for (let i = 0; i < topWorn.length - 1; i++) {
      expect(topWorn[i].wear_count).toBeGreaterThanOrEqual(topWorn[i + 1].wear_count);
    }
  });

  it('should calculate Cost Per Wear (CPW) ranking', async () => {
    const closetStore = useClosetStore();
    const statsStore = useStatsStore();

    const sampleItem = { price: 2000, wear_count: 10 };
    expect(closetStore.calculateCostPerWear(sampleItem)).toBe(200);

    const zeroWearItem = { price: 2000, wear_count: 0 };
    expect(closetStore.calculateCostPerWear(zeroWearItem)).toBeNull();

    const ranking = await statsStore.getCostPerWearRanking();
    expect(ranking.length).toBeGreaterThan(0);
    for (let i = 0; i < ranking.length - 1; i++) {
      expect(ranking[i].cost_per_wear).toBeLessThanOrEqual(ranking[i + 1].cost_per_wear);
    }
  });

  it('should detect disused items and mark for clearance', async () => {
    const appStore = useAppStore();
    const closetStore = useClosetStore();

    expect(closetStore.disusedItems.length).toBeGreaterThan(0);

    const targetItem = closetStore.disusedItems[0];
    await closetStore.markItemForClearance(targetItem.id);

    const updatedItem = appStore.items.find((i) => i.id === targetItem.id);
    expect(updatedItem.notes).toContain('[待出清]');
  });

  it('should generate yearly summary report', () => {
    const statsStore = useStatsStore();
    const summary = statsStore.getYearlySummary(2026);

    expect(summary).toHaveProperty('year', 2026);
    expect(summary).toHaveProperty('totalPurchased');
    expect(summary).toHaveProperty('topColor');
    expect(summary).toHaveProperty('topStyle');
    expect(summary).toHaveProperty('topBrand');
  });

  it('uses the Guest closet namespace instead of fixture items', async () => {
    localStorage.setItem(GUEST_CLOSET_STORAGE_KEY, JSON.stringify([{ ...defaultItems[0], owner_id: null }]));
    const appStore = useAppStore();
    appStore.items = [];
    const statsStore = useStatsStore();

    const stats = await statsStore.getClosetStats();
    expect(stats.colorStats).toHaveLength(1);
    expect(stats.categoryStats[0].count).toBe(1);
  });

  it('does not replace the active Guest collection on every statistics read', async () => {
    const appStore = useAppStore();
    const loadGuestItems = vi.spyOn(appStore, 'loadGuestItems');
    const statsStore = useStatsStore();

    await statsStore.getClosetStats();
    const activeItems = appStore.items;
    await statsStore.getBrandStats();

    expect(loadGuestItems).toHaveBeenCalledTimes(1);
    expect(appStore.items).toBe(activeItems);
  });

  it('loads Member stats from the resolved profile remote closet', async () => {
    localStorage.clear();
    const authStore = useAuthStore();
    const profileId = '22222222-2222-4222-8222-222222222222';
    authStore.session = { user: { id: '11111111-1111-4111-8111-111111111111' } };
    authStore.user = authStore.session.user;
    authStore.profileIdentity = {
      status: IDENTITY_STATUS.PROFILE_READY,
      authUserId: authStore.user.id,
      profileId,
      profile: { id: profileId },
      error: null
    };
    vi.spyOn(clothingRepository, 'getCurrentUserItems').mockResolvedValue([{
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      owner_id: profileId,
      name: 'Remote shirt',
      category: 'Tops',
      primary_color: '丹寧藍',
      secondary_color: '藍綠冷色系',
      style: 'Casual',
      hidden: false
    }]);

    const stats = await useStatsStore().getClosetStats();
    expect(stats.categoryStats).toEqual([{ category: 'Tops', count: 1 }]);
    expect(useAppStore().items[0].owner_id).toBe(profileId);
  });

  it('keeps Member remote-empty stats empty instead of falling back to fixtures', async () => {
    localStorage.clear();
    const authStore = useAuthStore();
    authStore.session = { user: { id: '11111111-1111-4111-8111-111111111111' } };
    authStore.user = authStore.session.user;
    authStore.profileIdentity = {
      status: IDENTITY_STATUS.PROFILE_READY,
      authUserId: authStore.user.id,
      profileId: '22222222-2222-4222-8222-222222222222',
      profile: { id: '22222222-2222-4222-8222-222222222222' },
      error: null
    };
    vi.spyOn(clothingRepository, 'getCurrentUserItems').mockResolvedValue([]);

    const stats = await useStatsStore().getClosetStats();
    expect(stats.colorStats).toEqual([]);
    expect(stats.categoryStats).toEqual([]);
  });
});
