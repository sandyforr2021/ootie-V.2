import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { setLocale } from '@/i18n';

const fixture = vi.hoisted(() => ({ request: vi.fn(), credits: 100, products: [] }));
vi.mock('@/services/commerce', async importOriginal => ({ ...await importOriginal(), commerceClient: { request: fixture.request } }));
vi.mock('@/services/aiGateway', () => ({
  createGenerationId: () => 'batch-unit-only',
  aiGateway: { listPersonPhotos: vi.fn(async () => ({ photos: [{ path: 'person/unit/photo.jpg' }] })), loadPrivateImage: vi.fn(async () => 'blob:unit-only') }
}));
vi.mock('@/stores/closet', () => ({ useClosetStore: () => ({ loadRemoteItems: vi.fn() }) }));
import ShopView from '../ShopView.vue';
let wrapper;
async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/shop', component: ShopView }] });
  await router.push('/shop');
  wrapper = mount(ShopView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}
async function selectPiece() {
  await wrapper.findAll('.studio-steps button')[1].trigger('click');
  await wrapper.find('.shop-product-image').trigger('click');
  await wrapper.find('.studio-next button').trigger('click');
}
describe('Shopping studio workflow', () => {
  beforeEach(() => {
    localStorage.clear(); setActivePinia(createPinia()); setLocale('zh-TW');
    const auth = useAuthStore();
    auth.session = { access_token: 'unit-only', user: { id: 'user-unit' } }; auth.user = auth.session.user;
    auth.profileIdentity = { status: 'PROFILE_READY', profileId: 'profile-unit', profile: { id: 'profile-unit' } };
    fixture.credits = 100;
    fixture.products = [{ id: 'product-unit', title: 'Cotton shirt', state: 'wishlist', image_path: 'products/unit.jpg' }];
    fixture.request.mockReset().mockImplementation(async (path, token, body) => {
      if (path === 'products') return body ? { product: { ...fixture.products[0], id: 'new-product', title: body.title } } : { products: fixture.products };
      if (path === 'capabilities') return { enabled: true, remainingUnits: fixture.credits, costs: { try_on: 2, skin_tone: 20 } };
      if (path === 'jobs') return { jobs: [] };
      if (path === 'posts') return { posts: [] };
      return {};
    });
  });
  afterEach(() => wrapper?.unmount());
  it('opens the photo step without a product but never permits an empty try-on batch', async () => {
    await render();
    await wrapper.findAll('.studio-steps button')[2].trigger('click');
    expect(wrapper.find('.shop-fitting').exists()).toBe(true);
    expect(wrapper.find('.shop-person-upload').exists()).toBe(true);
    await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('選擇至少一件商品，再繼續。');
    expect(fixture.request.mock.calls.filter(([path,,body]) => path === 'jobs' && body)).toEqual([]);
  });
  it('keeps a blocked merchant URL and offers a photo upload and extension instead of a false import success', async () => {
    await render();
    fixture.request.mockImplementationOnce(async()=>{throw Object.assign(new Error('Merchant blocked'),{code:'REMOTE_IMAGE_UNAVAILABLE'});});
    const url='https://www.net-fashion.net/product/692239';
    await wrapper.find('.shop-url-row input').setValue(url);
    await wrapper.find('.shop-url-row button').trigger('click'); await flushPromises();
    expect(wrapper.find('.shop-url-row input').element.value).toBe(url);
    expect(wrapper.find('.shop-image-upload input[type=file]').exists()).toBe(true);
    expect(wrapper.text()).toContain('商家限制自動讀取');
    expect(wrapper.find('.studio-form-actions .shop-primary').attributes('disabled')).toBeDefined();
    await wrapper.find('.studio-extension-entry').trigger('click');
    expect(wrapper.find('a[href="/downloads/ootie-browser-companion.zip"]').exists()).toBe(true);
    expect(fixture.request.mock.calls.filter(([path,,body]) => path === 'products' && body)).toEqual([]);
  });
  it('requires consent and queues the selected product with the chosen private photo', async () => {
    await render(); await selectPiece();
    await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    const submit = wrapper.find('.shop-fitting .shop-wide');
    expect(submit.attributes('disabled')).toBeUndefined();
    await submit.trigger('click'); await flushPromises();
    expect(fixture.request).toHaveBeenCalledWith('jobs', 'unit-only', { kind: 'try_on', productIds: ['product-unit'], personPath: 'person/unit/photo.jpg', consent: true, batchId: 'batch-unit-only' });
    expect(wrapper.find('.shop-fitting').exists()).toBe(false);
  });
  it('disables submission when available credit cannot cover the selection', async () => {
    fixture.credits = 1; await render(); await selectPiece();
    await wrapper.find('.shop-fitting .shop-consent input').setValue(true);
    expect(wrapper.find('.shop-fitting .shop-wide').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('額度不足，請減少本次試穿商品。');
  });
  it('saving a product advances to the shortlist and selects it without starting generation', async () => {
    await render();
    await wrapper.find('.shop-fields input').setValue('Linen shirt');
    await wrapper.find('.studio-details input').setValue('https://store.example/shirt.jpg');
    await wrapper.find('form').trigger('submit'); await flushPromises();
    expect(wrapper.find('.studio-shortlist').exists()).toBe(true);
    expect(wrapper.find('.shop-product.selected h3').text()).toBe('Linen shirt');
    expect(fixture.request.mock.calls.filter(([path,,body]) => path === 'jobs' && body)).toEqual([]);
  });
});
