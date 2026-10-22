import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, enableAutoUnmount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import AuthModal from '../AuthModal.vue';
import { useAuthStore } from '@/stores/auth';
import { installI18n, setLocale } from '@/i18n';
enableAutoUnmount(afterEach);
beforeEach(()=>{setActivePinia(createPinia());setLocale('en');});
afterEach(()=>setLocale('zh-TW'));
async function setup(){
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{template:'<div />'}}]});
  await router.push('/');
  const auth=useAuthStore();auth.isAuthModalOpen=true;
  const wrapper=mount(AuthModal,{global:{plugins:[router,{install:installI18n}],stubs:{Teleport:true}}});
  return {auth,wrapper};
}
describe('available account options',()=>{
  it('keeps Google registration while hiding email creation until reliable SMTP exists',async()=>{
    const {auth,wrapper}=await setup();
    const provider=vi.spyOn(auth,'signInWithProvider').mockResolvedValue(false);
    await wrapper.findAll('.auth-tab')[1].trigger('click');
    expect(wrapper.find('#authEmail').exists()).toBe(false);
    expect(wrapper.find('#authPassword').exists()).toBe(false);
    expect(wrapper.text()).toContain('Create an account with Google');
    await wrapper.find('.google-auth-button').trigger('click');
    expect(provider).toHaveBeenCalledWith('google','/');
  });
  it('preserves an existing jury email login and a user draft across language changes',async()=>{
    const {auth,wrapper}=await setup();
    const login=vi.spyOn(auth,'login').mockResolvedValue(false);
    await wrapper.find('#authEmail').setValue('member@example.com');
    await wrapper.find('#authPassword').setValue('a-user-entered-password');
    setLocale('ja');await wrapper.vm.$nextTick();
    expect(wrapper.find('#authEmail').element.value).toBe('member@example.com');
    expect(wrapper.text()).toContain('ログイン');
    await wrapper.find('form').trigger('submit');
    expect(login).toHaveBeenCalledWith('member@example.com','a-user-entered-password');
  });
});
