import { describe, expect, it } from 'vitest';
import { removeUniformBackground } from '../simpleBackgroundRemoval';

function image(width, height, background, foreground) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const inside = x >= 2 && x < width - 2 && y >= 2 && y < height - 2;
    pixels.set([...(inside ? foreground : background), 255], (y * width + x) * 4);
  }
  return pixels;
}

describe('local background removal', () => {
  it('removes connected plain background and preserves the garment and original pixels', () => {
    const pixels = image(10, 10, [255, 255, 255], [20, 40, 90]);
    const result = removeUniformBackground({ pixels, width: 10, height: 10 });
    expect(result[3]).toBe(0);
    expect(result[(5 * 10 + 5) * 4 + 3]).toBe(255);
    expect(pixels[3]).toBe(255);
  });
  it('refuses busy borders and blank images instead of silently damaging them', () => {
    const busy = image(10, 10, [255, 255, 255], [20, 40, 90]);
    for (let i = 0; i < 10; i++) busy.set([40, 40, 40, 255], i * 4);
    expect(removeUniformBackground({ pixels: busy, width: 10, height: 10 })).toBeNull();
    const blank = image(10, 10, [255, 255, 255], [255, 255, 255]);
    expect(removeUniformBackground({ pixels: blank, width: 10, height: 10 })).toBeNull();
  });
});
