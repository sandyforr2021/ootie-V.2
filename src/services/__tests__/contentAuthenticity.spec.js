import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { genuineContent, isFixtureContent } from '../contentAuthenticity';
import fixtureIds from '@/contracts/legacyFixtureIds.json';
import { useAppStore } from '@/stores/app';
import { useOotdStore } from '@/stores/ootd';
import * as remote from '@/services/supabase';
import { STORAGE_KEY, defaultItems, defaultProfile, defaultOotdPosts, defaultNotifications } from '@/constants';

describe('Live content provenance', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); });
  it('excludes exact seed records and their references even if display copy changes', () => {
    expect(isFixtureContent({ id: fixtureIds.ootd[0], caption: 'New name' })).toBe(true);
    expect(isFixtureContent({ id: 'a-save', target_id: fixtureIds.ootd[0] })).toBe(true);
    expect(isFixtureContent({ id: 'a-post', image: 'https://host/ootd/user/demo-feed/look-01.webp' })).toBe(true);
    expect(isFixtureContent({ id: 'notice', meta: '{"demo":true}' })).toBe(true);
    expect(isFixtureContent({ id: 'history', result_metadata: { demoSeed: true } })).toBe(true);
  });
  it('preserves genuine user content including words that resemble development labels', () => {
    const row = { id: 'user-created', caption: 'My demo outfit test', username: '@minji', image: 'https://host/ootd/upload.webp', likes: 0 };
    expect(genuineContent([row])).toEqual([row]);
    expect(genuineContent(null)).toBeNull();
  });
  it('does not restore old bundled identities or activity from browser storage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: defaultItems, profile: defaultProfile, ootdPosts: defaultOotdPosts, notifications: defaultNotifications }));
    const app = useAppStore();
    expect(app.items).toEqual([]);
    expect(app.ootdPosts).toEqual([]);
    expect(app.notifications).toEqual([]);
    expect(app.profile.username).toBe('');
  });
  it('an authoritative empty feed clears stale posts instead of keeping fixture activity', async () => {
    vi.spyOn(remote, 'fetchProfileOotdPosts').mockResolvedValue([]);
    const app = useAppStore();
    app.ootdPosts = [{ id: 'stale', caption: 'Removed remotely' }];
    await useOotdStore().loadRemotePosts();
    expect(app.ootdPosts).toEqual([]);
  });
});
