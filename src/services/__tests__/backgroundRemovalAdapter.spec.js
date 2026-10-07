import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_REMOVAL_STATUS,
  backgroundRemovalAdapter,
  isBackgroundRemovalAvailable
} from '../backgroundRemovalAdapter';

describe('background removal adapter foundation', () => {
  it('reports unavailable without a configured provider and preserves the original', async () => {
    const source = 'data:image/png;base64,original';
    const result = await backgroundRemovalAdapter.process(source);

    expect(isBackgroundRemovalAvailable()).toBe(false);
    expect(result.status).toBe(BACKGROUND_REMOVAL_STATUS.UNAVAILABLE);
    expect(result.image).toBe(source);
  });

  it('returns a failure contract for missing image input', async () => {
    const result = await backgroundRemovalAdapter.process('');

    expect(result.status).toBe(BACKGROUND_REMOVAL_STATUS.FAILURE);
    expect(result.image).toBeNull();
  });
});
