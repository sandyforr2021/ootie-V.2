import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia,setActivePinia} from 'pinia';
import {nextTick} from 'vue';
import * as api from '@/services/supabase';
import {useAuthStore} from '../auth';
import {useBookmarksStore} from '../bookmarks';
const owner='11111111-1111-4111-8111-111111111111';
const id='22222222-2222-4222-8222-222222222222';
let store,auth;
beforeEach(() => {
  vi.restoreAllMocks(); localStorage.clear(); setActivePinia(createPinia());
  vi.spyOn(api,'fetchBookmarksFromSupabase').mockResolvedValue([]);
  auth=useAuthStore(); auth.session={user:{id:'auth-user'}};auth.user=auth.session.user;
  auth.profileIdentity={status:'PROFILE_READY',profileId:owner,profile:{id:owner}};
  store=useBookmarksStore();
  store.bookmarks=[{id,owner_id:owner,title:'Original shirt'}];
});
describe('member bookmarks confirmed persistence',()=>{
  it('keeps failed inserts and edits out of the visible collection',async()=>{
    vi.spyOn(api,'insertBookmarkToSupabase').mockResolvedValue(null);
    vi.spyOn(api,'updateBookmarkInSupabase').mockResolvedValue(null);
    expect(await store.addBookmark({owner_id:owner,title:'Unsaved'})).toBeNull();
    expect(await store.updateBookmark(id,{title:'Unsaved edit'})).toBeNull();
    expect(store.bookmarks).toHaveLength(1);
    expect(store.bookmarks[0].title).toBe('Original shirt');
    expect(store.lastMutationSyncStatus).toBe('REMOTE_FAILED');
  });
  it('keeps failed deletions and the selection available to retry',async()=>{
    vi.spyOn(api,'deleteBookmarkFromSupabase').mockResolvedValue(false);
    vi.spyOn(api,'deleteBatchBookmarksFromSupabase').mockResolvedValue(false);
    store.selectedBookmarkIds=[id];
    expect(await store.deleteBookmark(id)).toBeNull();
    expect(await store.deleteSelectedBookmarks()).toBe(0);
    expect(store.bookmarks).toHaveLength(1);
    expect(store.selectedBookmarkIds).toEqual([id]);
  });
  it('clears the private collection on logout and never persists it to guest storage',async()=>{
    await nextTick();
    expect(localStorage.getItem('weary-bookmarks-v1')||'').not.toContain('Original shirt');
    auth.profileIdentity={status:'SIGNED_OUT',profileId:null};auth.session=null;auth.user=null;
    await nextTick();
    expect(store.bookmarks).toEqual([]);
  });
});
