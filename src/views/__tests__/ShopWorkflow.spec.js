import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { setLocale } from '@/i18n';
import * as imageUpload from '@/services/imageUpload';

const fixture = vi.hoisted(() => ({ request: vi.fn(), deletePhoto: vi.fn(), credits: 100, points:100, allowance:{}, products: [], jobs: [], saved: [], savedClothing: [] }));
vi.mock('@/services/commerce', async importOriginal => ({ ...await importOriginal(), commerceClient: { request: fixture.request } }));
vi.mock('@/services/aiGateway', () => ({
  createGenerationId: () => 'batch-unit-only',
  aiGateway: { listPersonPhotos: vi.fn(async () => ({ photos: [{ id:'photo-unit', path: 'person/unit/photo.jpg' }] })), deletePersonPhoto: fixture.deletePhoto, loadPrivateImage: vi.fn(async () => 'blob:unit-only'), uploadPersonPhoto: vi.fn(async()=>({path:'person/unit/new.jpg'})) }
}));
vi.mock('@/stores/closet', () => ({ useClosetStore: () => ({ loadRemoteItems: vi.fn() }) }));
vi.mock('@/stores/ootd', () => ({ useOotdStore: () => ({ loadRemotePosts: vi.fn(async()=>true) }) }));
vi.mock('@/services/socialMetrics', () => ({ listSavedOutfits: vi.fn(async()=>fixture.saved) }));
vi.mock('@/services/clothingRepository', async importOriginal => ({ ...await importOriginal(), getPublicItemsByIds: vi.fn(async()=>fixture.savedClothing) }));
import ShopView from '../ShopView.vue';
import WishlistPanel from '@/components/closet/WishlistPanel.vue';
import { aiGateway } from '@/services/aiGateway';
import { getPublicItemsByIds } from '@/services/clothingRepository';
import * as remotePosts from '@/services/supabase';
let wrapper;
async function render(component=ShopView, path='/shop') {
  const router = createRouter({ history:createMemoryHistory(), routes:[{path:'/shop',component:ShopView},{path:'/closet',component:WishlistPanel}] });
  await router.push(path); wrapper=mount(component,{global:{plugins:[router]}}); await flushPromises(); return wrapper;
}
async function selectPiece() {
  await wrapper.find('.shop-product-image').trigger('click');
  await wrapper.find('.studio-sidebar-next button').trigger('click');
  await wrapper.find('.shop-fitting .shop-wide').trigger('click');
}
describe('Shopping studio workflow', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia()); setLocale('zh-TW');
    const auth=useAuthStore(); auth.initialized=true; auth.session={access_token:'unit-only',user:{id:'user-unit'}}; auth.user=auth.session.user;
    auth.profileIdentity={status:'PROFILE_READY',profileId:'profile-unit',profile:{id:'profile-unit'}};
    fixture.credits=100; fixture.points=100; fixture.allowance={}; fixture.jobs=[]; fixture.saved=[]; fixture.savedClothing=[]; fixture.products=[{id:'product-unit',title:'Cotton shirt',state:'wishlist',image_path:'products/unit.jpg'}];
    fixture.request.mockReset().mockImplementation(async(path,token,body)=>{
      if(path==='products')return body?{product:{...fixture.products[0],id:'new-product',title:body.title}}:{products:fixture.products};
      if(path==='capabilities')return {enabled:true,remainingUnits:fixture.credits,pointBalance:fixture.points,costs:{try_on:2,skin_tone:20},...fixture.allowance};
      if(path==='jobs')return {jobs:fixture.jobs.map(job=>({...job}))}; if(path==='posts')return {posts:[]}; return {};
    });
  });
  afterEach(()=>{ wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  it('opens shopping activity directly and restores the studio when returning',async()=>{
    vi.mocked(aiGateway.listPersonPhotos).mockClear();
    await render(ShopView,'/shop?tab=activity');
    expect(wrapper.find('h1').text()).toBe('購物足跡');
    expect(wrapper.find('.shop-tabs').exists()).toBe(false);
    expect(fixture.request).toHaveBeenCalledWith('metrics','unit-only',undefined);
    expect(fixture.request.mock.calls.some(([path])=>path==='products')).toBe(false);
    expect(aiGateway.listPersonPhotos).not.toHaveBeenCalled();
    await wrapper.vm.$router.push('/shop');await flushPromises();
    expect(wrapper.find('h1').text()).toBe('試穿工作室');
    expect(wrapper.find('.shop-tabs').exists()).toBe(true);
    expect(fixture.request).toHaveBeenCalledWith('products','unit-only',undefined);
  });
  it('resolves saved public clothing independently of the general feed image limit',async()=>{
    vi.stubEnv('VITE_SUPABASE_URL','https://project.supabase.co');
    const item={id:'saved-shirt',name:'Posted green top',category:'Tops',photo:'https://project.supabase.co/storage/v1/object/public/ootie-ootd-images/ootd/top.webp'};
    fixture.saved=[{target_type:'OOTD',target_id:'saved-post'}]; fixture.savedClothing=[item];
    useAppStore().ootdPosts=[{id:'saved-post',item_ids:[item.id],wearing:[item],tagged_items:[]}];
    vi.spyOn(remotePosts,'fetchOotdPostsByIds').mockImplementation(async ids=>useAppStore().ootdPosts.filter(post=>ids.includes(post.id)));
    await render(); await wrapper.findAll('.studio-source-tabs button')[2].trigger('click');
    expect(getPublicItemsByIds).toHaveBeenCalledWith([item.id],undefined,{defer:true});
    expect(wrapper.text()).toContain(item.name);
    await wrapper.find('.shop-product-image').trigger('click');
    await wrapper.find('.studio-sidebar-next button').trigger('click');
    expect(wrapper.text()).toContain('選擇模特兒');
    expect(fixture.request.mock.calls.filter(([path,,body])=>path==='jobs' && body)).toEqual([]);
  });
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
  it('does not treat provider units as personal points',async()=>{
    fixture.points=1; await render(); await selectPiece();
    await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('平台點數不足');
    expect(fixture.request.mock.calls.filter(([path,,body])=>path==='jobs' && body)).toEqual([]);
  });
  it('does not submit when the personal point balance is unavailable',async()=>{
    fixture.points=null; await render(); await selectPiece();
    await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('點數紀錄暫時無法載入。');
  });
  it('allows a zero-point member to submit with a free daily image',async()=>{
    fixture.points=0;fixture.allowance={generationPolicyVersion:2,dailyFreeGenerationRemaining:2};
    await render();await selectPiece();await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeUndefined();
    expect(wrapper.text()).toContain('今日免費額度 2／2 張');
    expect(wrapper.find('.shop-selection-summary').text()).toContain('免費額度 1 張');
    expect(wrapper.find('.shop-selection-summary').text()).not.toContain('2 平台點數');
    await wrapper.find('.shop-fitting .shop-wide').trigger('click');await flushPromises();
    expect(fixture.request.mock.calls.filter(([path,,body])=>path==='jobs'&&body)).toHaveLength(1);
  });
  it('blocks a zero-point member after the free allowance is spent',async()=>{
    fixture.points=0;fixture.allowance={generationPolicyVersion:2,dailyFreeGenerationRemaining:0};
    await render();await selectPiece();await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('今日免費額度已用完');
  });
  it('allows points after the daily free allowance has been spent',async()=>{
    fixture.points=2;fixture.allowance={generationPolicyVersion:2,dailyFreeGenerationRemaining:0,dailyGenerationRemaining:0};
    await render();await selectPiece();await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeUndefined();
    expect(wrapper.text()).toContain('點數生成不限每日張數');
  });
  it('opens the wishlist form and preserves a blocked product URL for manual upload',async()=>{
    await render(WishlistPanel,'/closet?tab=wishlist');
    await wrapper.find('.wishlist-toolbar-actions .primary').trigger('click');
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
    await wrapper.find('.studio-sidebar-next button').trigger('click');
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
    await wrapper.find('.wishlist-toolbar-actions .primary').trigger('click');
    await wrapper.findAll('.wishlist-method button')[1].trigger('click');
    const input=wrapper.find('.wishlist-dialog input[type=file]');
    Object.defineProperty(input.element,'files',{value:[new File(['image'],'private.jpg',{type:'image/jpeg'})]});
    await input.trigger('change');
    const auth=useAuthStore(); auth.session={access_token:'other-token',user:{id:'other-user'}}; auth.user=auth.session.user;
    auth.profileIdentity={status:'PROFILE_READY',profileId:'other-profile',profile:{id:'other-profile'}};
    finish({dataUrl:'data:image/jpeg;base64,cHJpdmF0ZQ=='});
    await flushPromises();
    expect(wrapper.find('.wishlist-dialog').exists()).toBe(false);
    await wrapper.find('.wishlist-toolbar-actions .primary').trigger('click');
    expect(wrapper.find('.wishlist-preview').exists()).toBe(false);
    expect(wrapper.find('.wishlist-dialog input[maxlength]').element.value).toBe('');
  });
  it('does not jump back to step 02 after a refresh', async () => {
    await render();
    await wrapper.findAll('.studio-steps button')[0].trigger('click');
    await wrapper.vm.refresh();
    await flushPromises();
    expect(wrapper.find('.studio-shortlist').exists()).toBe(true);
    expect(wrapper.find('.studio-credit-summary').text()).toContain('100');
    await wrapper.find('.shop-product-image').trigger('click');
    await wrapper.findAll('.studio-steps button')[1].trigger('click');
    await wrapper.vm.refresh();await flushPromises();
    expect(wrapper.find('.shop-fitting').exists()).toBe(true);
  });
  it('lets a member remove a person photo from the current studio flow', async () => {
    fixture.deletePhoto.mockResolvedValue({ id: 'photo-unit', path: 'person/unit/photo.jpg' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await render();
    await wrapper.find('.shop-product-image').trigger('click');
    await wrapper.findAll('.studio-steps button')[1].trigger('click');
    await wrapper.findAll('button').find(button=>button.text()==='更換或管理照片').trigger('click');
    await wrapper.find('.shop-photo-delete').trigger('click');
    await flushPromises();
    expect(fixture.deletePhoto).toHaveBeenCalledWith('unit-only', 'photo-unit');
  });
  it('shows only the final outfit and removes its comparison and card after deletion and refresh', async () => {
    fixture.jobs=[1,2,3].map(index=>({id:`job-${index}`,kind:'try_on',status:'succeeded',batch_id:'outfit-batch',sequence_index:index,sequence_total:3,result_path:`ai-generated/unit/${index}.jpg`,created_at:'2026-10-28T00:00:00Z'}));
    vi.spyOn(window,'confirm').mockReturnValue(true);
    const request=fixture.request.getMockImplementation();
    fixture.request.mockImplementation(async(path,...args)=>{
      if(path==='jobs/job-3/result') { fixture.jobs[2].result_deleted_at='2026-10-28T01:00:00Z'; return {deleted:true}; }
      return request(path,...args);
    });
    await render(ShopView,'/shop?tab=album');
    expect(wrapper.findAll('.shop-album-grid .shop-result')).toHaveLength(1);
    await wrapper.find('.shop-result-actions button').trigger('click');
    expect(wrapper.find('.shop-comparison').exists()).toBe(true);
    await wrapper.findAll('.shop-result-actions button').find(button=>button.text()==='刪除').trigger('click');
    await flushPromises();
    expect(fixture.request).toHaveBeenCalledWith('jobs/job-3/result','unit-only',null,{method:'DELETE'});
    expect(wrapper.find('.shop-comparison').exists()).toBe(false);
    expect(wrapper.findAll('.shop-album-grid .shop-result')).toHaveLength(0);
    await wrapper.vm.refresh();await flushPromises();
    expect(wrapper.findAll('.shop-album-grid .shop-result')).toHaveLength(0);
  });
  it('keeps a completed result if the deletion request fails',async()=>{
    fixture.jobs=[{id:'job-final',kind:'try_on',status:'succeeded',batch_id:'batch',result_path:'ai-generated/unit/result.jpg',created_at:'2026-10-28T00:00:00Z'}];
    vi.spyOn(window,'confirm').mockReturnValue(true);
    await render(ShopView,'/shop?tab=album');
    fixture.request.mockImplementationOnce(async()=>{throw new Error('offline');});
    await wrapper.findAll('.shop-result-actions button').find(button=>button.text()==='刪除').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.shop-album-grid .shop-result')).toHaveLength(1);
    expect(wrapper.find('[role=alert]').exists()).toBe(true);
  });
  it('removes and restores a wishlist product through its owner-scoped state endpoint',async()=>{
    await render(WishlistPanel,'/closet?tab=wishlist');
    await wrapper.find('.wishlist-delete').trigger('click');await flushPromises();
    expect(fixture.request).toHaveBeenCalledWith('products/product-unit/state','unit-only',{state:'dismissed'});
    expect(wrapper.find('.wishlist-card').exists()).toBe(false);
    await wrapper.find('.wishlist-undo button').trigger('click');await flushPromises();
    expect(fixture.request).toHaveBeenCalledWith('products/product-unit/state','unit-only',{state:'wishlist'});
    expect(wrapper.find('.wishlist-card').exists()).toBe(true);
  });
  it('keeps a wishlist product visible when removal fails',async()=>{
    await render(WishlistPanel,'/closet?tab=wishlist');
    fixture.request.mockRejectedValueOnce(new Error('offline'));
    await wrapper.find('.wishlist-delete').trigger('click');await flushPromises();
    expect(wrapper.find('.wishlist-card').exists()).toBe(true);expect(wrapper.find('[role=alert]').exists()).toBe(true);
  });
  it('hides unsupported shoes from try-on without removing them from the wishlist',async()=>{
    fixture.products.push({id:'shoe',title:'Boots',category:'shoes',state:'wishlist'});
    await render();expect(wrapper.findAll('.shop-product-image')).toHaveLength(1);expect(wrapper.text()).not.toContain('Boots');
    wrapper.unmount();await render(WishlistPanel,'/closet?tab=wishlist');expect(wrapper.text()).toContain('Boots');
  });
  it('lets the member remove a selected garment at the final step without deleting it',async()=>{
    await render();await selectPiece();await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    await wrapper.find('.studio-selected-product>button').trigger('click');await flushPromises();
    expect(wrapper.find('.studio-selected-product').exists()).toBe(false);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeDefined();
    expect(fixture.request.mock.calls.filter(([path,,body])=>path==='jobs'&&body)).toHaveLength(0);
  });
  it('puts personal color results before album images',async()=>{
    fixture.jobs=[{id:'tone',kind:'skin_tone',status:'succeeded',result_data:{}}];
    await render(ShopView,'/shop?tab=album');
    const html=wrapper.html();expect(html.indexOf('shop-tone-results')).toBeLessThan(html.indexOf('shop-album-grid'));
  });
});
