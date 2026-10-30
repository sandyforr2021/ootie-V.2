import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {mount,flushPromises} from '@vue/test-utils';
import {createPinia,setActivePinia} from 'pinia';
import HomeWeather from '../HomeWeather.vue';
import {useWeatherStore} from '@/stores/weather';
import {getBrowserPosition} from '@/services/weather';
vi.mock('@/services/weather',async original=>({...await original(),getBrowserPosition:vi.fn()}));
let wrapper;
describe('home weather location controls',()=>{
 beforeEach(()=>{setActivePinia(createPinia());useWeatherStore().current={temperature:23,summary:'晴朗',city:'台北市'};});
 afterEach(()=>{wrapper?.unmount();vi.restoreAllMocks();});
 it('requests a fresh location on demand without replacing a selected city with cached coordinates',async()=>{
  vi.mocked(getBrowserPosition).mockResolvedValue({latitude:25,longitude:121});
  const select=vi.spyOn(useWeatherStore(),'selectPlace').mockResolvedValue();
  wrapper=mount(HomeWeather);await wrapper.find('.weather-relocate').trigger('click');await flushPromises();
  expect(getBrowserPosition).toHaveBeenCalledWith(undefined,{fresh:true});
  expect(select).toHaveBeenCalledWith({latitude:25,longitude:121,label:'Current location'});
 });
 it('keeps the last real weather and offers city search when permission is denied',async()=>{
  vi.mocked(getBrowserPosition).mockRejectedValue(new Error('定位未授權，請手動選擇城市。'));
  wrapper=mount(HomeWeather);await wrapper.find('.weather-relocate').trigger('click');await flushPromises();
  expect(wrapper.text()).toContain('23°C');expect(wrapper.find('[role=alert]').text()).toContain('定位未授權');
  expect(wrapper.find('input').exists()).toBe(true);
 });
});
