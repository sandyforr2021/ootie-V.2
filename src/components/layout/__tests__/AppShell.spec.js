import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '@/App.vue';
import { useAuthStore } from '@/stores/auth';
import { useSocialStore } from '@/stores/social';

let wrapper;
const stubs={
  AppSidebar:{template:'<aside data-shell="sidebar" />'},
  AppTopbar:{template:'<header data-shell="topbar" />'},
  AppBottomNav:{template:'<nav data-shell="mobile" />'},
  BrandOpening:true, GlobalStatus:true, DeferredModal:true, BaseToast:true
};
async function render(path='/') {
  const router=createRouter({history:createMemoryHistory(),routes:[
    {path:'/',name:'Home',component:{template:'<h1>Home</h1>'}},
    {path:'/closet',name:'Closet',component:{template:'<h1>Closet</h1>'}},
    {path:'/welcome',name:'BrandHome',component:{template:'<h1>Brand</h1>'}}
  ]});
  await router.push(path); await router.isReady();
  wrapper=mount(App,{global:{plugins:[router],stubs}});
  await flushPromises();return router;
}
describe('public and member application shell',()=>{
  beforeEach(()=>{
    localStorage.clear();setActivePinia(createPinia());
    vi.spyOn(useAuthStore(),'initAuth').mockResolvedValue();
    vi.spyOn(useAuthStore(),'consumeOAuthReturnTo').mockReturnValue(null);
    vi.spyOn(useSocialStore(),'refresh').mockResolvedValue();
  });
  afterEach(()=>{wrapper?.unmount();vi.restoreAllMocks();});
  it('restores the session without mounting the topbar and reacts to a restored account',async()=>{
    const auth=useAuthStore();await render();
    expect(auth.initAuth).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-shell="topbar"]').exists()).toBe(false);
    expect(wrapper.find('[data-shell="sidebar"]').exists()).toBe(false);
    auth.user={id:'unit-user'};auth.session={user:auth.user};
    await flushPromises();
    expect(wrapper.find('[data-shell="topbar"]').exists()).toBe(true);
    expect(wrapper.find('[data-shell="sidebar"]').exists()).toBe(true);
    expect(auth.initAuth).toHaveBeenCalledTimes(1);
  });
  it('handles a stored OAuth destination even when entering the public homepage',async()=>{
    const auth=useAuthStore();auth.user={id:'oauth-user'};auth.session={user:auth.user};
    vi.mocked(auth.consumeOAuthReturnTo).mockReturnValue('/closet');
    const router=await render();await flushPromises();
    expect(router.currentRoute.value.path).toBe('/closet');
    expect(wrapper.find('[data-shell="sidebar"]').exists()).toBe(true);
  });
  it('keeps the brand introduction reachable without signing a member out',async()=>{
    const auth=useAuthStore();auth.user={id:'unit-user'};auth.session={user:auth.user};
    await render('/welcome');
    expect(auth.isLoggedIn).toBe(true);
    expect(wrapper.find('[data-shell="sidebar"]').exists()).toBe(true);
    expect(wrapper.find('[data-shell="topbar"]').exists()).toBe(false);
  });
});
