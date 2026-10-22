import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppStore } from '../app';
import { useSosStore } from '../sos';

describe('SOS Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
  });

  it('should filter SOS posts by search query', () => {
    const sosStore = useSosStore();

    sosStore.searchQuery = '約會';
    expect(sosStore.filteredSosPosts.every((p) => p.title.includes('約會') || p.occasion.includes('約會'))).toBe(true);
  });

  it('should create a new SOS post', () => {
    const appStore = useAppStore();
    const sosStore = useSosStore();

    const initialCount = appStore.sosPosts.length;

    sosStore.createSosPost({
      title: '參加喜宴該怎麼搭配？',
      details: '朋友的室外婚禮，希望能端莊大方。',
      occasion: '聚餐',
      weather: '晴天',
      when_label: '週末',
      vibes: ['Elegant', 'Soft']
    });

    expect(appStore.sosPosts.length).toBe(initialCount + 1);
    const newest = appStore.sosPosts[0];
    expect(newest.title).toBe('參加喜宴該怎麼搭配？');
    expect(newest.vibes).toEqual(['Elegant', 'Soft']);
    expect(newest.username).toBe(appStore.profile.username);
  });

  it('should submit an outfit suggestion for an SOS post', () => {
    const appStore = useAppStore();
    const sosStore = useSosStore();

    const targetSosId = appStore.sosPosts[0].id;
    const initialHelped = appStore.profile.helped;
    const initialSuggestionsCount = appStore.outfitSuggestions.length;

    sosStore.submitSuggestion({
      sosId: targetSosId,
      selectedIds: [appStore.items[0].id, appStore.items[1].id],
      message: '這兩件疊穿非常好看又不失正式感！'
    });

    expect(appStore.outfitSuggestions.length).toBe(initialSuggestionsCount + 1);
    expect(appStore.profile.helped).toBe(initialHelped + 1);

    const newestSuggestion = appStore.outfitSuggestions[0];
    expect(newestSuggestion.sos_id).toBe(targetSosId);
    expect(newestSuggestion.item_ids).toEqual([appStore.items[0].id, appStore.items[1].id]);
  });

  it('should reject items that are not in the SOS shared closet', async () => {
    const appStore = useAppStore();
    const sosStore = useSosStore();
    const initialSuggestionsCount = appStore.outfitSuggestions.length;

    const success = await sosStore.submitSuggestion({
      sosId: 'sos-01',
      selectedIds: ['8'],
      message: '不應使用未公開衣物'
    });

    expect(success).toBe(false);
    expect(appStore.outfitSuggestions.length).toBe(initialSuggestionsCount);
  });

  it('should reject publishing a SOS with only foreign closet items', async () => {
    const appStore = useAppStore();
    const sosStore = useSosStore();
    appStore.items.push({ id: 'foreign-item', owner_id: 'profile-other', name: '他人的衣物' });
    const initialSosCount = appStore.sosPosts.length;

    const success = await sosStore.createSosPost({
      title: '不應公開他人衣物',
      details: '測試 ownership validation',
      occasion: '約會',
      weather: '涼爽',
      when_label: '明天',
      vibes: ['Soft'],
      closet_item_ids: ['foreign-item']
    });

    expect(success).toBe(false);
    expect(appStore.sosPosts.length).toBe(initialSosCount);
  });

  it('does not create a second suggestion for the same responder and SOS', async () => {
    const appStore = useAppStore();
    const sosStore = useSosStore();

    await sosStore.submitSuggestion({
      sosId: 'sos-01',
      selectedIds: ['1', '2'],
      message: '第一次建議'
    });
    const afterFirstSubmit = appStore.outfitSuggestions.length;

    await sosStore.submitSuggestion({
      sosId: 'sos-01',
      selectedIds: ['2', '3'],
      message: '更新同一份建議'
    });

    expect(appStore.outfitSuggestions.length).toBe(afterFirstSubmit);
    expect(appStore.outfitSuggestions[0].item_ids).toEqual(['2', '3']);
  });
});
