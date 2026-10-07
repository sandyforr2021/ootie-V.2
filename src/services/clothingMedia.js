export const CLOTHING_MEDIA_RULES = Object.freeze({
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  heicMimeTypes: ['image/heic', 'image/heif'],
  maxSourceBytes: 20 * 1024 * 1024,
  maxDisplayBytes: 6 * 1024 * 1024,
  maxEdge: 2048,
  blockingMinEdge: 128,
  warningMinShortEdge: 720,
  warningMinLongEdge: 1000,
  displayQuality: 0.88,
  analysisMaxEdge: 320
});

export const QUALITY_LEVEL = Object.freeze({
  PASS: 'PASS',
  WARNING: 'WARNING',
  BLOCKING: 'BLOCKING'
});

const signature = {
  jpeg: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  png: (bytes) => bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value),
  webp: (bytes) => bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP',
  heif: (bytes) => {
    if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== 'ftyp') return false;
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    return ['heic', 'heix', 'hevc', 'hevx', 'heif', 'mif1', 'msf1'].includes(brand);
  }
};

const detectMime = (bytes) => {
  if (signature.jpeg(bytes)) return 'image/jpeg';
  if (signature.png(bytes)) return 'image/png';
  if (signature.webp(bytes)) return 'image/webp';
  if (signature.heif(bytes)) return 'image/heic';
  return '';
};

const extensionOf = (name = '') => String(name).split('.').pop()?.toLowerCase() || '';

export async function validateClothingImageFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('請選擇圖片檔案。');
  if (file.size <= 0) throw new Error('圖片檔案是空的，請重新選擇。');
  if (file.size > CLOTHING_MEDIA_RULES.maxSourceBytes) throw new Error('原始照片需小於 20 MB。');

  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const detectedMime = detectMime(bytes);
  const extension = extensionOf(file.name);
  if (
    CLOTHING_MEDIA_RULES.heicMimeTypes.includes(file.type)
    || ['heic', 'heif'].includes(extension)
    || detectedMime === 'image/heic'
  ) {
    throw new Error('此照片格式目前無法直接處理，請改用 JPEG、PNG 或 WebP，或從相簿另存後再上傳。');
  }
  if (!CLOTHING_MEDIA_RULES.acceptedMimeTypes.includes(detectedMime)) {
    throw new Error('圖片內容無法辨識；僅支援 JPEG、PNG 或 WebP。');
  }
  if (file.type && file.type !== detectedMime) throw new Error('圖片內容與檔案格式不一致。');
  return detectedMime;
}

const luminance = (r, g, b) => (0.2126 * r) + (0.7152 * g) + (0.0722 * b);

export function assessImagePixels({ width, height, pixels }) {
  const warnings = [];
  const pixelCount = Math.max(1, width * height);
  let lumaTotal = 0;
  let brightPixels = 0;
  let laplacianTotal = 0;
  let laplacianSqTotal = 0;
  let laplacianCount = 0;

  const getLuma = (x, y) => {
    const index = ((y * width) + x) * 4;
    return luminance(pixels[index], pixels[index + 1], pixels[index + 2]);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = getLuma(x, y);
      lumaTotal += value;
      if (value > 242) brightPixels += 1;
      if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
        const laplacian = (4 * value) - getLuma(x - 1, y) - getLuma(x + 1, y) - getLuma(x, y - 1) - getLuma(x, y + 1);
        laplacianTotal += laplacian;
        laplacianSqTotal += laplacian * laplacian;
        laplacianCount += 1;
      }
    }
  }

  const averageLuma = lumaTotal / pixelCount;
  const brightRatio = brightPixels / pixelCount;
  const laplacianMean = laplacianCount ? laplacianTotal / laplacianCount : 0;
  const sharpness = laplacianCount ? (laplacianSqTotal / laplacianCount) - (laplacianMean ** 2) : 0;

  if (averageLuma < 52) warnings.push({ code: 'DARK', message: '照片有點暗，建議在亮一點的地方重拍。' });
  if (averageLuma > 232 && brightRatio > 0.55) warnings.push({ code: 'OVEREXPOSED', message: '照片可能過亮，衣物細節不容易看清楚。' });
  if (sharpness < 42) warnings.push({ code: 'BLUR', message: '圖片可能有些模糊，建議確認衣物細節是否清楚。' });

  // Conservative edge heuristic. It only warns when a large share of edge
  // pixels differs strongly from the corner-estimated background.
  const corners = [getLuma(0, 0), getLuma(width - 1, 0), getLuma(0, height - 1), getLuma(width - 1, height - 1)];
  const backgroundLuma = corners.reduce((sum, value) => sum + value, 0) / corners.length;
  let edgeSamples = 0;
  let foregroundEdgeSamples = 0;
  const inspect = (x, y) => {
    edgeSamples += 1;
    if (Math.abs(getLuma(x, y) - backgroundLuma) > 48) foregroundEdgeSamples += 1;
  };
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 80));
  for (let x = 0; x < width; x += stride) { inspect(x, 0); inspect(x, height - 1); }
  for (let y = stride; y < height - stride; y += stride) { inspect(0, y); inspect(width - 1, y); }
  if (edgeSamples && foregroundEdgeSamples / edgeSamples > 0.48) {
    warnings.push({ code: 'EDGE_CLIP_RISK', message: '衣物邊緣可能被裁到，請確認袖口、下擺或提把都有入鏡。' });
  }

  return { warnings, averageLuma, brightRatio, sharpness };
}

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('照片處理失敗，請重新選擇。')), type, quality);
});

export async function prepareClothingImage(file, dependencies = {}) {
  const mimeType = await validateClothingImageFile(file);
  const createBitmap = dependencies.createImageBitmap || globalThis.createImageBitmap;
  const documentRef = dependencies.document || globalThis.document;
  if (typeof createBitmap !== 'function' || !documentRef?.createElement) {
    throw new Error('此瀏覽器無法安全處理照片方向，請改用較新的瀏覽器。');
  }

  const bitmap = await createBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (bitmap.width < CLOTHING_MEDIA_RULES.blockingMinEdge || bitmap.height < CLOTHING_MEDIA_RULES.blockingMinEdge) {
      throw new Error('圖片解析度太低，請使用至少 128 × 128 的照片。');
    }

    const warnings = [];
    const shortEdge = Math.min(bitmap.width, bitmap.height);
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (shortEdge < CLOTHING_MEDIA_RULES.warningMinShortEdge || longEdge < CLOTHING_MEDIA_RULES.warningMinLongEdge) {
      warnings.push({ code: 'LOW_RESOLUTION', message: '解析度較低，之後放大時可能不清楚。' });
    }

    const analysisScale = Math.min(1, CLOTHING_MEDIA_RULES.analysisMaxEdge / longEdge);
    const analysisWidth = Math.max(1, Math.round(bitmap.width * analysisScale));
    const analysisHeight = Math.max(1, Math.round(bitmap.height * analysisScale));
    const analysisCanvas = documentRef.createElement('canvas');
    analysisCanvas.width = analysisWidth;
    analysisCanvas.height = analysisHeight;
    const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
    analysisContext.drawImage(bitmap, 0, 0, analysisWidth, analysisHeight);
    const analysis = assessImagePixels({
      width: analysisWidth,
      height: analysisHeight,
      pixels: analysisContext.getImageData(0, 0, analysisWidth, analysisHeight).data
    });
    warnings.push(...analysis.warnings);

    const displayScale = Math.min(1, CLOTHING_MEDIA_RULES.maxEdge / longEdge);
    const width = Math.max(1, Math.round(bitmap.width * displayScale));
    const height = Math.max(1, Math.round(bitmap.height * displayScale));
    const displayCanvas = documentRef.createElement('canvas');
    displayCanvas.width = width;
    displayCanvas.height = height;
    displayCanvas.getContext('2d', { alpha: true }).drawImage(bitmap, 0, 0, width, height);

    let displayBlob = await canvasToBlob(displayCanvas, 'image/webp', CLOTHING_MEDIA_RULES.displayQuality);
    if (displayBlob.type !== 'image/webp') {
      displayBlob = await canvasToBlob(displayCanvas, 'image/jpeg', 0.9);
    }
    if (displayBlob.size > CLOTHING_MEDIA_RULES.maxDisplayBytes) {
      throw new Error('處理後照片仍超過 6 MB，請改用較小的照片。');
    }

    return {
      originalFile: file,
      displayBlob,
      originalMimeType: mimeType,
      displayMimeType: displayBlob.type,
      originalBytes: file.size,
      displayBytes: displayBlob.size,
      width,
      height,
      warnings,
      level: warnings.length ? QUALITY_LEVEL.WARNING : QUALITY_LEVEL.PASS,
      metrics: analysis
    };
  } finally {
    bitmap.close?.();
  }
}

export const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('無法讀取處理後照片。'));
  reader.readAsDataURL(blob);
});

