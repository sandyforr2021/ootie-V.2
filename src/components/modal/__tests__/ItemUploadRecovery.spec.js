import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {mount,flushPromises} from '@vue/test-utils';
import {createPinia,setActivePinia} from 'pinia';
const fixture=vi.hoisted(()=>({signal:null}));
vi.mock('@/services/clothingMedia',async original=>({...await original(),prepareClothingImage:vi.fn(async file=>({originalFile:file,displayBlob:new Blob(['photo'],{type:'image/webp'}),width:768,height:768,warnings:[],originalBytes:4}))}));
vi.mock('@/services/colorDetection',()=>({analyzeImageColor:vi.fn(async()=>null)}));
vi.mock('@/services/clothingVision',()=>({identifyClothing:vi.fn(async()=>null)}));
vi.mock('@/services/clothingCutout',()=>({removeClothingBackground:vi.fn((_blob,{signal})=>new Promise((_resolve,reject)=>{
 fixture.signal=signal;signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});
}))}));
import ItemFormModal from '../ItemFormModal.vue';
import {useAppStore} from '@/stores/app';
let wrapper;
describe('upload remains usable when background inference is cancelled',()=>{
 beforeEach(()=>{localStorage.clear();setActivePinia(createPinia());useAppStore().isItemFormOpen=true;});
 afterEach(()=>wrapper?.unmount());
 it('stops processing, keeps the photo and unlocks save without a paid fallback',async()=>{
  wrapper=mount(ItemFormModal);const input=wrapper.find('#photoFile');
  Object.defineProperty(input.element,'files',{value:[new File(['photo'],'shirt.webp',{type:'image/webp'})]});
  await input.trigger('change');await flushPromises();
  expect(wrapper.find('button[type=submit]').element.disabled).toBe(true);
  const cancel=wrapper.findAll('button').find(button=>button.text()==='取消去背');
  expect(cancel).toBeDefined();await cancel.trigger('click');await flushPromises();
  expect(fixture.signal.aborted).toBe(true);expect(wrapper.find('.upload-preview').exists()).toBe(true);
  expect(wrapper.find('button[type=submit]').element.disabled).toBe(false);
  expect(wrapper.text()).toContain('去背已取消。');
 });
});
