import {afterEach,describe,expect,it,vi} from 'vitest';
import {mount,flushPromises} from '@vue/test-utils';
import {setLocale,t} from '@/i18n';
import TranslatedText from '../TranslatedText.vue';
let wrapper;
afterEach(()=>{wrapper?.unmount();vi.unstubAllGlobals();setLocale('zh-TW');});
describe('profile translation disclosure',()=>{
 it('starts with the original caption, opens source options only on request and collapses on return',async()=>{
  setLocale('zh-TW');
  const request=vi.fn(async()=>({ok:true,json:async()=>({text:'綠色層次的週末',provider:'test'})}));
  vi.stubGlobal('fetch',request);
  wrapper=mount(TranslatedText,{props:{contentId:'post-one',text:'Green layers for the weekend.',revealSourceOnTranslate:true},global:{mocks:{$t:t}}});
  expect(wrapper.find('.content-copy').text()).toBe('Green layers for the weekend.');
  expect(wrapper.find('select').exists()).toBe(false);expect(request).not.toHaveBeenCalled();
  await wrapper.find('button').trigger('click');await flushPromises();
  expect(wrapper.find('select').exists()).toBe(true);expect(wrapper.find('.content-copy').text()).toBe('綠色層次的週末');
  await wrapper.find('button').trigger('click');
  expect(wrapper.find('select').exists()).toBe(false);expect(wrapper.find('.content-copy').text()).toBe('Green layers for the weekend.');
  expect(request).toHaveBeenCalledTimes(1);
 });
 it('resets disclosure when the post changes and ignores a late translation for the previous post',async()=>{
  setLocale('zh-TW');let finish;
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve;})));
  wrapper=mount(TranslatedText,{props:{contentId:'post-one',text:'First post.',revealSourceOnTranslate:true},global:{mocks:{$t:t}}});
  await wrapper.find('button').trigger('click');expect(wrapper.find('select').exists()).toBe(true);
  await wrapper.setProps({contentId:'post-two',text:'Next original caption.'});
  finish({ok:true,json:async()=>({text:'上一則貼文的翻譯'})});await flushPromises();
  expect(wrapper.find('select').exists()).toBe(false);expect(wrapper.find('.content-copy').text()).toBe('Next original caption.');
 });
});
