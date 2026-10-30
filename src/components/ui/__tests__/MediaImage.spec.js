import {describe,it,expect,vi,afterEach} from 'vitest';
import {mount,flushPromises} from '@vue/test-utils';
import MediaImage from '../MediaImage.vue';
import {registerMedia,clearMediaMemory} from '@/services/mediaMemory';
let wrapper;afterEach(()=>{wrapper?.unmount();clearMediaMemory();vi.unstubAllGlobals();});
describe('visible media',()=>{
 it('does not download private media until it approaches the viewport',async()=>{
  let intersection;vi.stubGlobal('IntersectionObserver',class{constructor(callback){intersection=callback;}observe(){}disconnect(){}});
  const load=vi.fn(async()=>'blob:visible');const id=registerMedia('member','image:v1',load);
  wrapper=mount(MediaImage,{props:{src:id},attrs:{alt:'Private garment',class:'product-image'}});
  await flushPromises();expect(load).not.toHaveBeenCalled();expect(wrapper.find('img').attributes('src')).toBeUndefined();
  intersection([{isIntersecting:true}]);await flushPromises();expect(load).toHaveBeenCalledTimes(1);
  expect(wrapper.find('img').attributes('src')).toBe('blob:visible');expect(wrapper.find('img').attributes('alt')).toBe('Private garment');
  clearMediaMemory();await flushPromises();expect(wrapper.find('img').attributes('src')).toBeUndefined();
 });
});
