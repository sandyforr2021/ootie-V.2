import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import BrandStudioDemo from '../BrandStudioDemo.vue';
let wrapper,intersection,motionChange;
const disconnect=vi.fn();
beforeEach(()=>{
 vi.useFakeTimers();
 vi.stubGlobal('IntersectionObserver',class{constructor(callback){intersection=callback;}observe(){}disconnect(){disconnect();}});
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:(_event,callback)=>{motionChange=callback;},removeEventListener:vi.fn()})));
});
afterEach(()=>{wrapper?.unmount();vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();});
it('advances only while visible, stops offscreen and releases its timer on unmount',async()=>{
 wrapper=mount(BrandStudioDemo);
 await vi.advanceTimersByTimeAsync(6400);expect(wrapper.classes()).toContain('demo-stage-0');
 intersection([{isIntersecting:true}]);await vi.advanceTimersByTimeAsync(3200);expect(wrapper.classes()).toContain('demo-stage-1');
 intersection([{isIntersecting:false}]);await vi.advanceTimersByTimeAsync(6400);expect(wrapper.classes()).toContain('demo-stage-1');
 intersection([{isIntersecting:true}]);wrapper.unmount();expect(vi.getTimerCount()).toBe(0);expect(disconnect).toHaveBeenCalled();
});
it('shows a static final illustration and cancels playback when reduced motion is requested',async()=>{
 wrapper=mount(BrandStudioDemo);intersection([{isIntersecting:true}]);motionChange({matches:true});await nextTick();
 expect(wrapper.classes()).toContain('demo-reduced');expect(wrapper.classes()).toContain('demo-stage-3');expect(vi.getTimerCount()).toBe(0);
});
