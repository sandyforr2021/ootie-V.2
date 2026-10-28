import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { setLocale } from '@/i18n';
import * as imageUpload from '@/services/imageUpload';

const fixture = vi.hoisted(() => ({ request: vi.fn(), credits: 100, products: [] }));
vi.mock('@/services/commerce', async importOriginal => ({ ...await importOriginal(), commerceClient: { request: fixture.request } }));
vi.mock('@/services/aiGateway', () => ({
  createGenerationId: () => 'batch-unit-only',
  aiGateway: { listPersonPhotos: vi.fn(async () => ({ photos: [{ path: 'person/unit/photo.jpg' }] })), loadPrivateImage: vi.fn(async () => 'blob:unit-only'), uploadPersonPhoto: vi.fn(async()=>({path:'person/unit/new.jpg'})) }
}));
vi.mock('@/stores/closet', () => ({ useClosetStore: () => ({ loadRemoteItems: vi.fn() }) }));
vi.mock('@/stores/ootd', () => ({ useOotdStore: () => ({ loadRemotePosts: vi.fn(async()=>true) }) }));
vi.mock('@/services/socialMetrics', () => ({ listSavedOutfits: vi.fn(async()=>[]) }));
import ShopView from '../ShopView.vue';
import WishlistPanel from '@/components/closet/WishlistPanel.vue';
import { aiGateway } from '@/services/aiGateway';
let wrapper;
async function render(component=ShopView, path='/shop') {
  const router = createRouter({ history:createMemoryHistory(), routes:[{path:'/shop',component:ShopView},{path:'/closet',component:WishlistPanel}] });
  await router.push(path); wrapper=mount(component,{global:{plugins:[router]}}); await flushPromises(); return wrapper;
}
async function selectPiece() {
  await wrapper.find('.shop-product-image').trigger('click');
  await wrapper.find('.studio-next button').trigger('click');
  await wrapper.find('.shop-fitting .shop-wide').trigger('click');
}
describe('Shopping studio workflow', () => {
  beforeEach(() => {
    localStorage.clear(); setActivePinia(createPinia()); setLocale('zh-TW');
    const auth=useAuthStore(); auth.session={access_token:'unit-only',user:{id:'user-unit'}}; auth.user=auth.session.user;
    auth.profileIdentity={status:'PROFILE_READY',profileId:'profile-unit',profile:{id:'profile-unit'}};
    fixture.credits=100; fixture.products=[{id:'product-unit',title:'Cotton shirt',state:'wishlist',image_path:'products/unit.jpg'}];
    fixture.request.mockReset().mockImplementation(async(path,token,body)=>{
      if(path==='products')return body?{product:{...fixture.products[0],id:'new-product',title:body.title}}:{products:fixture.products};
      if(path==='capabilities')return {enabled:true,remainingUnits:fixture.credits,costs:{try_on:2,skin_tone:20}};
      if(path==='jobs')return {jobs:[]}; if(path==='posts')return {posts:[]}; return {};
    });
  });
  afterEach(()=>{ wrapper?.unmount(); vi.restoreAllMocks(); });
  it('does not allow progressing to a photo or submitting without an item',async()=>{
    await render();
    expect(wrapper.findAll('.studio-steps button')[1].attributes('disabled')).toBeDefined();
    expect(wrapper.findAll('.studio-steps button')[2].attributes('disabled')).toBeDefined();
    expect(fixture.request.mock.calls.filter(([path,,body])=>path==='jobs' && body)).toEqual([]);
  });
  it('requires consent and queues the selected product with the chosen photo',async()=>{
    await render(); await selectPiece();
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeDefined();
    await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    const submit=wrapper.find('.shop-fitting .shop-wide'); expect(submit.attributes('disabled')).toBeUndefined();
    await submit.trigger('click'); await flushPromises();
    expect(fixture.request).toHaveBeenCalledWith('jobs','unit-only',{kind:'try_on',productIds:['product-unit'],clothingItemIds:[],savedItems:[],personPath:'person/unit/photo.jpg',consent:true,batchId:'batch-unit-only'});
  });
  it('blocks submission when available shared credits cannot cover it',async()=>{
    fixture.credits=1; await render(); await selectPiece();
    await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('額度不足');
  });
  it('opens the wishlist form and preserves a blocked product URL for manual upload',async()=>{
    await render(WishlistPanel,'/closet?tab=wishlist');
    await wrapper.find('.wishlist-heading .primary').trigger('click');
    fixture.request.mockImplementationOnce(async()=>{throw new Error('Merchant blocked');});
    const url='https://www.net-fashion.net/product/692239';
    await wrapper.find('.wishlist-link input').setValue(url); await wrapper.find('.wishlist-link button').trigger('click'); await flushPromises();
    expect(wrapper.find('.wishlist-link input').element.value).toBe(url);
    expect(wrapper.find('input[type=file]').exists()).toBe(true);
    expect(wrapper.text()).toContain('商家限制自動讀取');
    expect(fixture.request.mock.calls.filter(([path,,body])=>path==='products' && body)).toEqual([]);
  });
  it('opens extension handoff as a wishlist import dialog without generating',async()=>{
    await render(WishlistPanel,'/closet?tab=wishlist&quick=add-product&title=Linen%20shirt&image=https%3A%2F%2Fstore.example%2Fshirt.jpg');
    expect(wrapper.find('.wishlist-dialog').exists()).toBe(true);
    expect(wrapper.find('.wishlist-dialog input[maxlength]').element.value).toBe('Linen shirt');
    expect(fixture.request.mock.calls.filter(([path,,body])=>path==='jobs' && body)).toEqual([]);
  });
  it('never uploads a photo with the next account after a switch during preprocessing',async()=>{
    let finish;
    vi.spyOn(imageUpload,'preprocessPersonImage').mockReturnValue(new Promise(resolve=>{finish=resolve;}));
    aiGateway.uploadPersonPhoto.mockClear();
    await render();
    await wrapper.find('.shop-product-image').trigger('click');
    await wrapper.find('.studio-next button').trigger('click');
    const input=wrapper.find('.shop-person-upload input');
    Object.defineProperty(input.element,'files',{value:[new File(['image'],'private.jpg',{type:'image/jpeg'})]});
    await input.trigger('change');
    const auth=useAuthStore(); auth.session={access_token:'other-token',user:{id:'other-user'}}; auth.user=auth.session.user;
    auth.profileIdentity={status:'PROFILE_READY',profileId:'other-profile',profile:{id:'other-profile'}};
    finish({dataUrl:'data:image/jpeg;base64,cHJpdmF0ZQ=='});
    await flushPromises();
    expect(aiGateway.uploadPersonPhoto).not.toHaveBeenCalled();
  });
  it('discards the previous account’s pending wishlist photo when switching accounts',async()=>{
    let finish;
    vi.spyOn(imageUpload,'preprocessPersonImage').mockReturnValue(new Promise(resolve=>{finish=resolve;}));
    await render(WishlistPanel,'/closet?tab=wishlist');
    await wrapper.find('.wishlist-heading .primary').trigger('click');
    await wrapper.findAll('.wishlist-method button')[1].trigger('click');
    const input=wrapper.find('.wishlist-dialog input[type=file]');
    Object.defineProperty(input.element,'files',{value:[new File(['image'],'private.jpg',{type:'image/jpeg'})]});
    await input.trigger('change');
    const auth=useAuthStore(); auth.session={access_token:'other-token',user:{id:'other-user'}}; auth.user=auth.session.user;
    auth.profileIdentity={status:'PROFILE_READY',profileId:'other-profile',profile:{id:'other-profile'}};
    finish({dataUrl:'data:image/jpeg;base64,cHJpdmF0ZQ=='});
    await flushPromises();
    expect(wrapper.find('.wishlist-dialog').exists()).toBe(false);
    await wrapper.find('.wishlist-heading .primary').trigger('click');
    expect(wrapper.find('.wishlist-preview').exists()).toBe(false);
    expect(wrapper.find('.wishlist-dialog input[maxlength]').element.value).toBe('');
  });
});
