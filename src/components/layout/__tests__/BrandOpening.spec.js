import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import BrandOpening from '../BrandOpening.vue';

describe('BrandOpening', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('plays once on the first Home entry in a browser session', async () => {
    const first = mount(BrandOpening);
    await nextTick();
    expect(first.find('.brand-opening').exists()).toBe(true);
    expect(window.sessionStorage.getItem('ootie:brand-opening:v2')).toBe('played');

    await vi.advanceTimersByTimeAsync(2400);
    expect(first.find('.brand-opening').exists()).toBe(false);

    const second = mount(BrandOpening);
    expect(second.find('.brand-opening').exists()).toBe(false);
  });

  it('does not animate when reduced motion is requested', () => {
    window.matchMedia.mockReturnValue({ matches: true });
    const wrapper = mount(BrandOpening);
    expect(wrapper.find('.brand-opening').exists()).toBe(false);
    expect(window.sessionStorage.getItem('ootie:brand-opening:v2')).toBeNull();
  });

  it('keeps both wardrobe doors and lets the user replay after it finishes', async () => {
    const wrapper = mount(BrandOpening);
    await nextTick();
    expect(wrapper.findAll('.brand-opening__door')).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2400);
    window.dispatchEvent(new Event('ootie:replay-opening'));
    await nextTick();
    expect(wrapper.findAll('.brand-opening__door')).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2400);
    expect(wrapper.find('.brand-opening').exists()).toBe(false);
    wrapper.unmount();
  });

  it('does not delay a direct entry to an interior page', () => {
    window.history.replaceState({}, '', '/closet');
    const wrapper = mount(BrandOpening);
    expect(wrapper.find('.brand-opening').exists()).toBe(false);
  });
});
