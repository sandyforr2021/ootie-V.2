import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import * as api from '@/services/supabase';
import { useAppStore } from '../app';
import { useAuthStore } from '../auth';
import { useSosStore } from '../sos';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const sosId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';
const suggestionId = '55555555-5555-4555-8555-555555555555';
let app, auth, store;
const input = {title:'Wedding outfit', details:'Garden wedding', closet_item_ids:[itemId], vibes:['Soft']};

beforeEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  setActivePinia(createPinia());
  vi.spyOn(api,'fetchSosPostsFromSupabase').mockResolvedValue(null);
  vi.spyOn(api,'fetchOutfitSuggestionsFromSupabase').mockResolvedValue(null);
  vi.spyOn(api,'fetchSavedSosIds').mockResolvedValue(new Set());
  app = useAppStore(); auth = useAuthStore();
  auth.session = {user:{id:'auth-user'}}; auth.user = auth.session.user;
  auth.profileIdentity = {status:'PROFILE_READY',profileId:owner,profile:{id:owner}};
  app.profile = {...app.profile,id:owner,username:'@jury'};
  app.items = [{id:itemId,owner_id:owner,name:'Cotton shirt'}];
  store = useSosStore();
  await store.initFromSupabase();
  store.sosPosts = [{id:sosId,sender_id:other,status:'OPEN',closet_item_ids:[itemId],title:'Wedding',vibes:[]}];
  store.outfitSuggestions = [];
  await nextTick();
});

describe('SOS persisted interaction contract', () => {
  it('publishes only a confirmed row and uses its canonical server ID', async () => {
    let finish;
    vi.spyOn(api,'insertSosPostToSupabase').mockImplementation(() => new Promise(resolve => {finish=resolve;}));
    const work = store.createSosPost(input);
    expect(store.sosPosts).toHaveLength(1);
    expect(await store.createSosPost(input)).toBe(false);
    finish({id:suggestionId,user_id:owner});
    expect(await work).toBe(true);
    await nextTick();
    expect(app.sosPosts[0]).toMatchObject({id:suggestionId,sender_id:owner,title:'Wedding outfit'});
  });
  it('keeps failed publishing out of both stores', async () => {
    vi.spyOn(api,'insertSosPostToSupabase').mockResolvedValue(null);
    expect(await store.createSosPost(input)).toBe(false);
    expect(store.sosPosts).toHaveLength(1);
    expect(app.toastSyncStatus).toBe('REMOTE_FAILED');
  });
  it('updates one suggestion without inventing a helped-friends count', async () => {
    const write = vi.spyOn(api,'insertOutfitSuggestionToSupabase').mockImplementation(async row => ({...row,id:suggestionId}));
    const helped = app.profile.helped;
    expect(await store.submitSuggestion({sosId,selectedIds:[itemId],message:'First'})).toBe(true);
    expect(await store.submitSuggestion({sosId,selectedIds:[itemId],message:'Revised'})).toBe(true);
    expect(write.mock.calls[1][1]).toEqual({update:true});
    expect(store.outfitSuggestions).toHaveLength(1);
    expect(store.outfitSuggestions[0].message).toBe('Revised');
    expect(app.profile.helped).toBe(helped);
  });
  it('rejects suggestions containing unshared items', async () => {
    const write = vi.spyOn(api,'insertOutfitSuggestionToSupabase');
    expect(await store.submitSuggestion({sosId,selectedIds:[other],message:'No'})).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
  it('does not publish somebody else’s wardrobe items', async () => {
    app.items[0].owner_id = other;
    const write = vi.spyOn(api,'insertSosPostToSupabase');
    expect(await store.createSosPost(input)).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
  it('leaves status and adoption unchanged after denied updates', async () => {
    store.sosPosts[0].sender_id = owner;
    store.outfitSuggestions = [{id:suggestionId,sos_id:sosId,responder_id:other}];
    vi.spyOn(api,'updateSosStatusInSupabase').mockResolvedValue(false);
    vi.spyOn(api,'updateAdoptedSuggestionInSupabase').mockResolvedValue(false);
    expect(await store.closeSosPost(sosId)).toBe(false);
    expect(await store.adoptSuggestion({sosId,suggestionId})).toBe(false);
    expect(store.sosPosts[0].status).toBe('OPEN');
    expect(store.sosPosts[0].adopted_suggestion_id).toBeUndefined();
  });
  it('rehydrates saved SOS state from the signed-in account', async () => {
    api.fetchSosPostsFromSupabase.mockResolvedValue([{id:sosId,user_id:other,closet_item_ids:[]}]);
    api.fetchSavedSosIds.mockResolvedValue(new Set([sosId]));
    await store.initFromSupabase();
    expect(store.sosPosts[0].saved).toBe(true);
    expect(api.fetchSavedSosIds).toHaveBeenLastCalledWith(owner);
  });
  it('does not apply a pending write to a different signed-in account', async () => {
    let finish;
    vi.spyOn(api,'insertSosPostToSupabase').mockImplementation(() => new Promise(resolve => {finish=resolve;}));
    const work = store.createSosPost(input);
    auth.profileIdentity = {status:'PROFILE_READY',profileId:other,profile:{id:other}};
    finish({id:suggestionId,user_id:owner});
    expect(await work).toBe(false);
    expect(store.sosPosts.some(row => row.id === suggestionId)).toBe(false);
  });
});
