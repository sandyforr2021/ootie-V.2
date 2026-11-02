import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { setLocale } from '@/i18n';
import * as imageUpload from '@/services/imageUpload';
import ItemDetailModal from '@/components/modal/ItemDetailModal.vue';

const fixture = vi.hoisted(() => ({
  request: vi.fn(),
  deletePhoto: vi.fn(),
  credits: 100,
  points:100,
  allowance:{},
  products: [],
  jobs: [],
  saved: [],
  savedClothing: [],
  closetStore: { dataMode: 'REMOTE', loadRemoteItems: vi.fn() }
}));
vi.mock('@/services/commerce', async importOriginal => ({ ...await importOriginal(), commerceClient: { request: fixture.request } }));
vi.mock('@/services/pointAccount', () => ({ loadPointAccount: vi.fn(async () => ({ balance: 100, transactions: [] })) }));
vi.mock('@/services/aiGateway', () => ({
  createGenerationId: () => 'batch-unit-only',
  aiGateway: { listPersonPhotos: vi.fn(async () => ({ photos: [{ id:'photo-unit', path: 'person/unit/photo.jpg' }] })), deletePersonPhoto: fixture.deletePhoto, loadPrivateImage: vi.fn(async () => 'blob:unit-only'), uploadPersonPhoto: vi.fn(async()=>({path:'person/unit/new.jpg'})) }
}));
vi.mock('@/stores/closet', () => ({
  CLOSET_DATA_MODE: { REMOTE: 'REMOTE' },
  useClosetStore: () => fixture.closetStore
}));
vi.mock('@/stores/ootd', () => ({ useOotdStore: () => ({ loadRemotePosts: vi.fn(async()=>true) }) }));
vi.mock('@/services/socialMetrics', () => ({ listSavedOutfits: vi.fn(async()=>fixture.saved) }));
vi.mock('@/services/clothingRepository', async importOriginal => ({ ...await importOriginal(), getPublicItemsByIds: vi.fn(async()=>fixture.savedClothing) }));
import ShopView from '../ShopView.vue';
import CreditView from '../CreditView.vue';
import WishlistPanel from '@/components/closet/WishlistPanel.vue';
import { aiGateway } from '@/services/aiGateway';
import { loadPointAccount } from '@/services/pointAccount';
import { getPublicItemsByIds } from '@/services/clothingRepository';
import * as remotePosts from '@/services/supabase';
let wrapper;
async function render(component=ShopView, path='/shop') {
  const router = createRouter({ history:createMemoryHistory(), routes:[{path:'/shop',component:ShopView},{path:'/closet',component:WishlistPanel},{path:'/credits',component:CreditView}] });
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
    fixture.closetStore.dataMode='REMOTE';
    fixture.closetStore.loadRemoteItems.mockReset().mockResolvedValue({ok:true,data:[]});
    fixture.request.mockReset().mockImplementation(async(path,token,body)=>{
      if(path==='products')return body?{product:{...fixture.products[0],id:'new-product',title:body.title}}:{products:fixture.products};
      if(/^products\/[^/]+\/state$/.test(path) && body){
        const id=path.split('/')[1], product=fixture.products.find(item=>item.id===id);
        const changes=body.sourceUrl!==undefined?{...body,source_url:body.sourceUrl}:body;
        if(product)Object.assign(product,changes);
        return {product:{...product,...changes}};
      }
      if(path==='capabilities')return {enabled:true,remainingUnits:fixture.credits,pointBalance:fixture.points,costs:{try_on:2,skin_tone:20},...fixture.allowance};
      if(path==='jobs')return {jobs:fixture.jobs.map(job=>({...job}))}; if(path==='posts')return {posts:[]}; return {};
    });
  });
  afterEach(()=>{ wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllEnvs(); setLocale('zh-TW'); });
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
    expect(wrapper.findAll('.shop-tabs button').map(button=>button.text())).toEqual(['試穿模擬','私人相簿','個人色彩分析']);
    expect(wrapper.find('.balance-card .personal-balance').text()).toBe('100');
    expect(wrapper.find('.studio-point-balance').attributes('href')).toBe('/credits#point-history');
    expect(wrapper.find('.balance-card a:not(.studio-point-balance)').exists()).toBe(false);
    expect(wrapper.find('.studio-balance-card').exists()).toBe(false);
    expect(fixture.request).toHaveBeenCalledWith('products','unit-only',undefined);
  });
  it('keeps the personal color analysis tab selected when its route query changes',async()=>{
    await render();
    await wrapper.findAll('.shop-tabs button').find(button=>button.text()==='個人色彩分析').trigger('click');
    await flushPromises();
    expect(wrapper.vm.$route.query.tab).toBe('tone');
    expect(wrapper.find('.shop-tone-section').exists()).toBe(true);
    expect(wrapper.findAll('.shop-tabs button')[2].classes()).toContain('active');
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
  it.each([1,2])('allows a zero-point member with %i free daily images remaining',async remaining=>{
    fixture.points=0;fixture.allowance={generationPolicyVersion:2,dailyFreeGenerationRemaining:remaining};
    await render();await selectPiece();await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeUndefined();
    expect(wrapper.text()).toContain(`今日免費額度 ${remaining}／2 張`);
    expect(wrapper.find('.balance-card .studio-daily-note').text()).toContain(`今日免費額度 ${remaining}／2 張`);
    expect(wrapper.find('.shop-selection-summary').text()).toContain('本次使用免費額度 1 張');
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
  it('distinguishes shared capacity exhaustion from a member\'s free daily allowance',async()=>{
    fixture.credits=0;fixture.points=0;
    fixture.allowance={enabled:false,unavailableReason:'FREE_BUDGET_EXHAUSTED',generationPolicyVersion:2,dailyFreeGenerationRemaining:2};
    await render();await selectPiece();await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('今日免費額度 2／2 張');
    expect(wrapper.text()).toContain('網站共用生成額度不足');
    expect(wrapper.text()).not.toContain('今日免費額度已用完');
    expect(fixture.request.mock.calls.filter(([path,,body])=>path==='jobs'&&body)).toHaveLength(0);
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
    expect(wrapper.find('.balance-card .personal-balance').text()).toBe('100');
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
  it('renders wishlist cards without purchase, try-on, or delete actions',async()=>{
    await render(WishlistPanel,'/closet?tab=wishlist');
    expect(wrapper.find('.item-card').exists()).toBe(true);
    expect(wrapper.find('.item-info h3').text()).toBe('Cotton shirt');
    expect(wrapper.find('.item-card a').exists()).toBe(false);
    expect(wrapper.find('.item-card button').exists()).toBe(false);
    expect(wrapper.find('.wishlist-card-actions').exists()).toBe(false);
    await wrapper.find('.item-image').trigger('click');
    expect(useAppStore().isDetailOpen).toBe(true);
    expect(useAppStore().selectedItemId).toBe('product-unit');
  });
  it('localizes wishlist category names instead of showing internal values',async()=>{
    setLocale('en');
    fixture.products=[
      {id:'top',title:'Linen top',category:'upper_body',state:'wishlist'},
      {id:'bottom',title:'Wide trousers',category:'lower_body',state:'wishlist'},
      {id:'auto',title:'Unsorted item',category:'auto',state:'wishlist'}
    ];
    await render(WishlistPanel,'/closet?tab=wishlist');
    expect(wrapper.findAll('.item-meta').map(node=>node.text())).toEqual(['Tops','Bottoms','Auto']);
  });
  it('filters wishlist items by category and switches between rack and cards',async()=>{
    fixture.products=[
      {id:'top',title:'Linen top',category:'upper_body',state:'wishlist',image_path:'products/top.jpg'},
      {id:'bottom',title:'Wide trousers',category:'lower_body',state:'wishlist',image_path:'products/bottom.jpg'},
      {id:'outer',title:'Light jacket',category:'upper_body',outfit_layer:'outer',state:'wishlist',image_path:'products/outer.jpg'}
    ];
    await render(WishlistPanel,'/closet?tab=wishlist');
    expect(wrapper.findAll('.item-card')).toHaveLength(3);
    await wrapper.findAll('.wishlist-category-row .category').find(button=>button.text()==='外套').trigger('click');
    expect(wrapper.find('.item-info h3').text()).toBe('Light jacket');
    expect(wrapper.findAll('.item-card')).toHaveLength(1);
    await wrapper.findAll('.wishlist-category-row .category').find(button=>button.text()==='下身').trigger('click');
    expect(wrapper.findAll('.item-card')).toHaveLength(1);
    expect(wrapper.find('.item-info h3').text()).toBe('Wide trousers');
    await wrapper.findAll('.closet-view-mode button').find(button=>button.text()==='衣架').trigger('click');
    expect(wrapper.findAll('.rack-item')).toHaveLength(1);
    await wrapper.findAll('.closet-view-mode button').find(button=>button.text()==='圖卡').trigger('click');
    await wrapper.find('.item-image').trigger('click');
    expect(useAppStore().isDetailOpen).toBe(true);
    expect(useAppStore().selectedItemId).toBe('bottom');
  });
  it('edits wishlist product metadata from the item detail modal',async()=>{
    const appStore=useAppStore();
    appStore.wishlistProducts=[{id:'product-unit',title:'Cotton shirt',category:'upper_body',color:'#c8bba9',source_url:'',state:'wishlist',photo:'blob:unit-only'}];
    appStore.selectedItemId='product-unit';appStore.isDetailOpen=true;
    await render(ItemDetailModal,'/closet?tab=wishlist');
    expect(wrapper.text()).toContain('加入衣櫥');
    expect(wrapper.text()).toContain('刪除');
    expect(wrapper.find('.modal-actions .secondary').text()).toContain('加入衣櫥');
    expect(wrapper.find('.modal-actions .danger').text()).toBe('刪除');
    expect(wrapper.find('.detail-category').exists()).toBe(false);
    expect(wrapper.find('.detail-fields').text()).toContain('上衣');
    expect(wrapper.find('.detail-source-links').exists()).toBe(false);
    await wrapper.findAll('.modal-actions button').find(button=>button.text()==='編輯').trigger('click');
    await wrapper.find('.wishlist-edit-form input:not([type=color])').setValue('Linen blouse');
    await wrapper.find('.wishlist-edit-form').trigger('submit');
    await flushPromises();
    expect(fixture.request).toHaveBeenCalledWith('products/product-unit/state','unit-only',{
      title:'Linen blouse',category:'upper_body',color:'#c8bba9',sourceUrl:''
    });
    expect(appStore.wishlistProducts[0].title).toBe('Linen blouse');
    expect(wrapper.find('.wishlist-edit-form').exists()).toBe(false);
  });
  it('renders wishlist details and actions in the selected language',async()=>{
    const appStore=useAppStore();
    setLocale('en');
    appStore.wishlistProducts=[{id:'product-unit',title:'Wide trousers',category:'lower_body',state:'wishlist',photo:'blob:unit-only'}];
    appStore.selectedItemId='product-unit';appStore.isDetailOpen=true;
    await render(ItemDetailModal,'/closet?tab=wishlist');
    expect(wrapper.find('.detail-layout h2').text()).toBe('Wide trousers');
    expect(wrapper.find('.detail-fields').text()).toContain('Bottoms');
    expect(wrapper.find('.modal-actions .secondary').text()).toContain('Add to wardrobe');
    expect(wrapper.find('.modal-actions .danger').text()).toBe('Delete');
  });
  it('removes outbound product and image-search links from wardrobe details',async()=>{
    const appStore=useAppStore();
    appStore.items=[{id:'item-unit',name:'Cotton shirt',category:'Tops',source_url:'https://shop.example/item',photo:'blob:unit-only'}];
    appStore.selectedItemId='item-unit';appStore.isDetailOpen=true;
    await render(ItemDetailModal,'/closet');
    expect(wrapper.find('.detail-source-links').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('前往商品頁面');
    expect(wrapper.text()).not.toContain('Google Lens');
  });
  it('opens the closet form with product metadata instead of copying the wishlist item',async()=>{
    const appStore=useAppStore();
    appStore.wishlistProducts=[{
      id:'product-unit',title:'Cotton shirt',category:'upper_body',color:'#b5d6f3',
      source_url:'https://shop.example/item',image_path:'shop/member/item.jpg',state:'wishlist'
    }];
    appStore.selectedItemId='product-unit';appStore.isDetailOpen=true;
    await render(ItemDetailModal,'/closet?tab=wishlist');
    await wrapper.findAll('.modal-actions button').find(button=>button.text()==='加入衣櫥').trigger('click');
    await flushPromises();
    expect(wrapper.vm.$route.fullPath).toBe('/closet');
    expect(fixture.closetStore.loadRemoteItems).toHaveBeenCalledWith('profile-unit');
    expect(appStore.itemFormSourceProduct).toEqual(expect.objectContaining({
      id:'product-unit',ownerProfileId:'profile-unit',title:'Cotton shirt',category:'upper_body',color:'#b5d6f3',
      image_path:'shop/member/item.jpg',source_url:'https://shop.example/item'
    }));
    expect(appStore.isItemFormOpen).toBe(true);
    expect(appStore.isDetailOpen).toBe(false);
    expect(fixture.request).not.toHaveBeenCalledWith('products/product-unit/state',expect.anything(),{state:'purchased'});
  });
  it('keeps already purchased products out of the studio wishlist',async()=>{
    fixture.products=[
      {id:'wishlist',title:'Wishlist shirt',category:'upper_body',state:'wishlist'},
      {id:'purchased',title:'Purchased shirt',category:'upper_body',state:'purchased'}
    ];
    await render();
    expect(wrapper.text()).toContain('Wishlist shirt');
    expect(wrapper.text()).not.toContain('Purchased shirt');
  });
  it('places point history under the current balance on the credits page',async()=>{
    await render(CreditView,'/credits');
    const balance=wrapper.find('.credit-balance-value');
    expect(balance.find('.personal-balance').text()).toBe('100');
    expect(balance.find('.point-history-link').text()).toBe('查看點數紀錄');
    expect(balance.find('.credit-balance-row').text()).toContain('目前點數100');
    expect(balance.element.children[0].className).toBe('credit-balance-row');
    expect(balance.element.children[1].className).toBe('point-history-link');
  });
  it('shows a visible error instead of a points total when the balance cannot load',async()=>{
    vi.mocked(loadPointAccount).mockRejectedValueOnce(new Error('offline'));
    await render(CreditView,'/credits');
    const balance=wrapper.find('.credit-balance-value');
    expect(balance.find('.personal-balance').text()).toBe('—');
    expect(balance.find('[role="alert"]').text()).toContain('點數紀錄暫時無法載入。');
    expect(balance.find('button').text()).toBe('重試');
  });
  it('keeps wishlist details open when deleting a product fails',async()=>{
    const appStore=useAppStore();
    appStore.wishlistProducts=[{id:'product-unit',title:'Cotton shirt',category:'upper_body',state:'wishlist',photo:'blob:unit-only'}];
    appStore.selectedItemId='product-unit';appStore.isDetailOpen=true;
    await render(ItemDetailModal,'/closet?tab=wishlist');
    fixture.request.mockRejectedValueOnce(new Error('offline'));
    await wrapper.findAll('.modal-actions button').find(button=>button.text()==='刪除').trigger('click');await flushPromises();
    expect(wrapper.find('.detail-layout').exists()).toBe(true);
    expect(appStore.wishlistProducts).toHaveLength(1);
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
  it('uploads a private portrait and submits it to the existing YouCam color-analysis job',async()=>{
    vi.spyOn(imageUpload,'preprocessPersonImage').mockResolvedValue({dataUrl:'data:image/jpeg;base64,portrait'});
    vi.mocked(aiGateway.uploadPersonPhoto).mockClear();
    await render(ShopView,'/shop?tab=tone');

    const upload=wrapper.find('.shop-tone-section input[type="file"]');
    expect(upload.exists()).toBe(true);
    Object.defineProperty(upload.element,'files',{value:[new File(['portrait'],'portrait.jpg',{type:'image/jpeg'})],configurable:true});
    await upload.trigger('change');
    await flushPromises();
    expect(aiGateway.uploadPersonPhoto).toHaveBeenCalledWith('unit-only',{
      photoId:'batch-unit-only',
      imageData:'data:image/jpeg;base64,portrait'
    });

    await wrapper.find('.shop-tone-section .shop-consent input').setValue(true);
    const submit=wrapper.find('.shop-tone-section .shop-primary');
    expect(submit.attributes('disabled')).toBeUndefined();
    await submit.trigger('click');
    await flushPromises();

    const request=fixture.request.mock.calls.find(([path,,body])=>path==='jobs'&&body?.kind==='skin_tone');
    expect(request?.[2]).toEqual(expect.objectContaining({
      kind:'skin_tone',
      personPath:'person/unit/new.jpg',
      productIds:[],
      clothingItemIds:[],
      savedItems:[],
      consent:true
    }));
    expect(wrapper.vm.$route.query.tab).toBe('tone');
  });
  it('prevents color analysis when the member has fewer than the required points',async()=>{
    fixture.points=5;
    await render(ShopView,'/shop?tab=tone');
    expect(wrapper.find('.shop-tone-section').text()).toContain('平台點數不足，無法進行個人色彩分析。');
    expect(wrapper.find('.shop-tone-section .shop-primary').attributes('disabled')).toBeDefined();
    expect(fixture.request.mock.calls.filter(([path,,body])=>path==='jobs'&&body?.kind==='skin_tone')).toHaveLength(0);
  });
  it('puts personal color results before album images',async()=>{
    fixture.jobs=[{id:'tone',kind:'skin_tone',status:'succeeded',result_data:{}}];
    await render(ShopView,'/shop?tab=album');
    const html=wrapper.html();expect(html.indexOf('shop-tone-results')).toBeLessThan(html.indexOf('shop-album-grid'));
  });
});
