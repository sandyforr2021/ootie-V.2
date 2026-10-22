import { vi } from 'vitest';
import { useAppStore } from '@/stores/app';
import { useOotdStore } from '@/stores/ootd';
import * as remote from '@/services/supabase';
import { defaultItems, defaultProfile, defaultOotdPosts, defaultSosPosts } from '@/constants';

// Explicit fixtures for isolated interaction tests. Production starts empty.
export function installLocalInteractionFixtures() {
  const app = useAppStore();
  const clone = value => JSON.parse(JSON.stringify(value));
  app.items = clone(defaultItems);
  app.profile = clone(defaultProfile);
  app.ootdPosts = clone(defaultOotdPosts);
  app.sosPosts = clone(defaultSosPosts);
  vi.spyOn(useOotdStore(), 'loadRemotePosts').mockResolvedValue(false);
  vi.spyOn(remote, 'fetchSosPostsFromSupabase').mockResolvedValue(null);
  vi.spyOn(remote, 'fetchOutfitSuggestionsFromSupabase').mockResolvedValue(null);
  return app;
}
