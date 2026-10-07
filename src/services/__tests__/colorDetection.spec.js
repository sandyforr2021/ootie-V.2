import { describe, expect, it } from 'vitest';
import { analyzePixelData } from '../colorDetection';

const rgba = (r, g, b, a = 255) => [r, g, b, a];

const makePixels = (width, height, pixel) => {
  const data = [];
  for (let index = 0; index < width * height; index += 1) data.push(...pixel);
  return data;
};

describe('local primary color detection', () => {
  it('maps a blue garment sample to the existing blue family', () => {
    const result = analyzePixelData(makePixels(4, 4, rgba(59, 89, 152)), 4, 4);

    expect(result.primaryColor).toBe('丹寧藍');
    expect(result.colorFamily).toBe('藍綠冷色系');
  });

  it('maps a red garment sample to the existing red family', () => {
    const result = analyzePixelData(makePixels(4, 4, rgba(200, 90, 112)), 4, 4);

    expect(result.primaryColor).toBe('玫瑰紅');
    expect(result.colorFamily).toBe('紫紅神秘系');
  });

  it('does not let a white background hide a colored garment', () => {
    const pixels = makePixels(4, 4, rgba(255, 255, 255));
    const garment = rgba(200, 90, 112);
    [5, 6, 9, 10].forEach((cell) => {
      pixels.splice(cell * 4, 4, ...garment);
    });

    const result = analyzePixelData(pixels, 4, 4);

    expect(result.primaryColor).toBe('玫瑰紅');
    expect(result.primaryColor).not.toBe('白色');
  });

  it('returns no suggestion for invalid pixel input', () => {
    expect(analyzePixelData(null, 0, 0)).toBeNull();
  });
});
