import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('local clothing cutout queue', () => {
  let workers;
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers(); workers = [];
    vi.stubGlobal('Worker', class {
      constructor() { workers.push(this); this.postMessage = vi.fn(); this.terminate = vi.fn(); }
      answer(data) { this.onmessage({ data }); }
    });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('serializes inference and reuses the worker instead of loading several models at once', async () => {
    const { removeClothingBackground } = await import('../clothingCutout');
    const first = removeClothingBackground(new Blob(['first']));
    const second = removeClothingBackground(new Blob(['second']));
    expect(workers).toHaveLength(1);
    expect(workers[0].postMessage).toHaveBeenCalledTimes(1);
    workers[0].answer({ id: 1, state: 'done', result: 'one' });
    await expect(first).resolves.toBe('one');
    expect(workers[0].postMessage).toHaveBeenCalledTimes(2);
    workers[0].answer({ id: 2, state: 'done', result: 'two' });
    await expect(second).resolves.toBe('two');
    vi.advanceTimersByTime(45000);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
  it('cancels a stale upload without returning its image to the next request', async () => {
    const { removeClothingBackground } = await import('../clothingCutout');
    const controller = new AbortController();
    const first = removeClothingBackground(new Blob(['first']), { signal: controller.signal });
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const second = removeClothingBackground(new Blob(['second']));
    controller.abort();
    await rejected;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    workers[0].answer({ id: 1, state: 'done', result: 'stale' });
    workers[1].answer({ id: 2, state: 'done', result: 'current' });
    await expect(second).resolves.toBe('current');
  });
});
