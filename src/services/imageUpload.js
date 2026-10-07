export const PERSON_IMAGE_RULES = Object.freeze({
  acceptedMimeTypes: ['image/jpeg', 'image/png'],
  maxSourceBytes: 20 * 1024 * 1024,
  maxOutputBytes: 7 * 1024 * 1024,
  maxEdge: 2048,
  minEdge: 256,
  jpegQuality: 0.9
});

const isJpeg = (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
const isPng = (bytes) => bytes.length >= 8
  && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);

export async function validateBrowserImageFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('請選擇圖片檔案。');
  if (!PERSON_IMAGE_RULES.acceptedMimeTypes.includes(file.type)) throw new Error('僅支援 JPEG 或 PNG 圖片。');
  if (file.size <= 0 || file.size > PERSON_IMAGE_RULES.maxSourceBytes) throw new Error('原始照片需小於 20 MB。');
  const bytes = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  const detectedMime = isJpeg(bytes) ? 'image/jpeg' : isPng(bytes) ? 'image/png' : '';
  if (!detectedMime || detectedMime !== file.type) throw new Error('圖片內容與副檔名不一致。');
  return detectedMime;
}

const blobToDataUrl = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
};

export async function preprocessPersonImage(file, dependencies = {}) {
  await validateBrowserImageFile(file);
  const createBitmap = dependencies.createImageBitmap || globalThis.createImageBitmap;
  if (typeof createBitmap !== 'function') throw new Error('此瀏覽器無法安全處理照片方向。');

  const bitmap = await createBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (bitmap.width < PERSON_IMAGE_RULES.minEdge || bitmap.height < PERSON_IMAGE_RULES.minEdge) {
      throw new Error('照片解析度至少需要 256 × 256。');
    }
    const scale = Math.min(1, PERSON_IMAGE_RULES.maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const documentRef = dependencies.document || globalThis.document;
    const canvas = documentRef.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (output) => output ? resolve(output) : reject(new Error('照片前處理失敗。')),
        'image/jpeg',
        PERSON_IMAGE_RULES.jpegQuality
      );
    });
    if (blob.size > PERSON_IMAGE_RULES.maxOutputBytes) {
      throw new Error('處理後照片仍超過 7 MB，請改用較小的照片。');
    }
    return {
      dataUrl: await blobToDataUrl(blob),
      mimeType: blob.type,
      bytes: blob.size,
      width,
      height
    };
  } finally {
    bitmap.close?.();
  }
}
