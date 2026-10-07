import { describe, expect, it } from 'vitest';
import { withDevelopmentDemoMediaRevision } from '../mediaUrl';

describe('development demo media revision', () => {
  it('cache-busts only versioned Development feed assets', () => {
    expect(withDevelopmentDemoMediaRevision('https://example.supabase.co/storage/demo-feed/look-08.webp'))
      .toContain('ootie_media=presentation-v2');
    expect(withDevelopmentDemoMediaRevision('https://example.com/member-upload.webp'))
      .toBe('https://example.com/member-upload.webp');
  });

  it('preserves an existing query string', () => {
    expect(withDevelopmentDemoMediaRevision('https://example.com/demo-feed/look.webp?download=1'))
      .toContain('&ootie_media=presentation-v2');
  });
});
