import { describe, expect, it } from 'vitest';
import { validateBrowserImageFile } from '../imageUpload';
import {
  validateClothingImageFile,
  assessImagePixels,
  prepareClothingImage,
  QUALITY_LEVEL
} from '../clothingMedia';

const fakeFile = (type, bytes, size = bytes.length) => ({
  type,
  size,
  slice: () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer }),
  arrayBuffer: async () => Uint8Array.from(bytes).buffer
});

describe('real-user clothing media safety', () => {
  it('accepts WebP only when RIFF/WEBP magic bytes match', async () => {
    const bytes = [...'RIFFxxxxWEBP'].map((value) => value.charCodeAt(0));
    await expect(validateClothingImageFile({
      ...fakeFile('image/webp', bytes),
      name: 'wardrobe.webp'
    })).resolves.toBe('image/webp');
  });

  it('detects HEIC content and returns a truthful fallback message', async () => {
    const bytes = [0, 0, 0, 24, ...'ftypheic'.split('').map((value) => value.charCodeAt(0))];
    await expect(validateClothingImageFile({
      ...fakeFile('image/heic', bytes),
      name: 'iphone.heic'
    })).rejects.toThrow('JPEG、PNG 或 WebP');
  });

  it('reports dark and blurry images as warnings instead of blocking them', () => {
    const width = 16;
    const height = 16;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = 18;
      pixels[index + 1] = 18;
      pixels[index + 2] = 18;
      pixels[index + 3] = 255;
    }
    const report = assessImagePixels({ width, height, pixels });
    expect(report.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(['DARK', 'BLUR']));
  });

  it('normalizes orientation and warns on low resolution while preserving a Blob derivative', async () => {
    const source = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0x00])], { type: 'image/jpeg' });
    Object.defineProperty(source, 'name', { value: 'shirt.jpg' });
    const imageData = { data: new Uint8ClampedArray(400 * 300 * 4).fill(130) };
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue(imageData)
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(context),
      toBlob: vi.fn((callback, type) => callback(new Blob(['display'], { type })))
    };
    const bitmap = { width: 400, height: 300, close: vi.fn() };
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap);

    const result = await prepareClothingImage(source, {
      createImageBitmap,
      document: { createElement: vi.fn().mockReturnValue(canvas) }
    });

    expect(createImageBitmap).toHaveBeenCalledWith(source, { imageOrientation: 'from-image' });
    expect(result.displayBlob).toBeInstanceOf(Blob);
    expect(result.level).toBe(QUALITY_LEVEL.WARNING);
    expect(result.warnings.some((warning) => warning.code === 'LOW_RESOLUTION')).toBe(true);
    expect(bitmap.close).toHaveBeenCalled();
  });
});

describe('private person image preprocessing validation', () => {
  it('accepts JPEG only when magic bytes match the MIME', async () => {
    await expect(validateBrowserImageFile(fakeFile('image/jpeg', [0xff, 0xd8, 0xff, 0x00]))).resolves.toBe('image/jpeg');
  });

  it('rejects renamed files whose bytes do not match MIME', async () => {
    await expect(validateBrowserImageFile(fakeFile('image/png', [0xff, 0xd8, 0xff, 0x00]))).rejects.toThrow('不一致');
  });

  it('rejects oversized original phone photos before canvas work', async () => {
    await expect(validateBrowserImageFile(fakeFile('image/jpeg', [0xff, 0xd8, 0xff], 21 * 1024 * 1024))).rejects.toThrow('20 MB');
  });
});
