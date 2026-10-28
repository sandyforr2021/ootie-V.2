import { describe, expect, it } from 'vitest';
import { suggestFromClothingFilename } from '../clothingSuggestions';

describe('clothing file name suggestions', () => {
  it('uses explicit descriptions to distinguish jeans from tops', () => {
    expect(suggestFromClothingFilename('blue-jeans.jpg')).toEqual({ name: 'blue jeans', category: 'Bottoms' });
    expect(suggestFromClothingFilename('白色襯衫.png')).toEqual({ name: '白色襯衫', category: 'Tops' });
  });
  it('does not guess from camera file names or conflicting clothing types', () => {
    expect(suggestFromClothingFilename('IMG_1234.jpg')).toBeNull();
    expect(suggestFromClothingFilename('jeans-and-shirt.jpg')).toBeNull();
  });
});
