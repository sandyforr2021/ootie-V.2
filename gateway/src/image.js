import { GatewayError, assert } from './errors.js';
import sharp from 'sharp';
import {createWorkLimiter} from './workLimiter.js';
sharp.cache(false);
sharp.concurrency(1);
const conversions=createWorkLimiter({concurrency:1,maxQueue:16});

export const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
export const MIN_IMAGE_EDGE = 256;
export const MAX_IMAGE_EDGE = 4096;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);
const GARMENT_SOURCE_MIME = new Set([...ALLOWED_MIME, 'image/webp']);

const readPngDimensions = (buffer) => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20)
});

const readJpegDimensions = (buffer) => {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    if (!Number.isFinite(length) || length < 2) break;
    offset += 2 + length;
  }
  throw new GatewayError('INVALID_IMAGE', 400, 'JPEG dimensions could not be read');
};

export const detectMime = (buffer) => {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  if (buffer.length >= 12 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
};

const validateByteEnvelope = (buffer) => {
  assert(Buffer.isBuffer(buffer), 'INVALID_IMAGE', 400, 'Image bytes are required');
  assert(buffer.length > 0 && buffer.length <= MAX_IMAGE_BYTES, 'IMAGE_TOO_LARGE', 413, 'Image must be at most 7 MB');
};

const validateDimensions = ({ width, height }) => {
  assert(Number.isInteger(width) && Number.isInteger(height), 'INVALID_IMAGE', 400, 'Image dimensions could not be read');
  assert(
    width >= MIN_IMAGE_EDGE && height >= MIN_IMAGE_EDGE,
    'IMAGE_RESOLUTION_TOO_SMALL',
    400,
    'Image must be at least 256 x 256'
  );
  assert(
    width <= MAX_IMAGE_EDGE && height <= MAX_IMAGE_EDGE,
    'IMAGE_RESOLUTION_TOO_LARGE',
    400,
    'Image must not exceed 4096 px on either edge'
  );
};

export function validateImageBytes(buffer, claimedMime = '') {
  validateByteEnvelope(buffer);

  const mimeType = detectMime(buffer);
  assert(mimeType && ALLOWED_MIME.has(mimeType), 'INVALID_IMAGE_MIME', 400, 'Only JPEG and PNG are accepted');
  if (claimedMime) {
    assert(claimedMime === mimeType, 'INVALID_IMAGE_MIME', 400, 'Declared MIME does not match image bytes');
  }

  const dimensions = mimeType === 'image/png' ? readPngDimensions(buffer) : readJpegDimensions(buffer);
  validateDimensions(dimensions);

  return { buffer, mimeType, ...dimensions };
}

export async function normalizeGarmentImageForAi(buffer, claimedMime = '') {
  validateByteEnvelope(buffer);
  const sourceMime = detectMime(buffer);
  assert(sourceMime && GARMENT_SOURCE_MIME.has(sourceMime), 'CLOTHING_IMAGE_INVALID', 422, 'Selected clothing image must be JPEG, PNG, or WebP');
  if (claimedMime && claimedMime !== 'application/octet-stream') {
    assert(claimedMime === sourceMime, 'CLOTHING_IMAGE_INVALID', 422, 'Clothing image metadata does not match its bytes');
  }

  if (ALLOWED_MIME.has(sourceMime)) return validateImageBytes(buffer, sourceMime);

  return conversions.run(async () => {
  try {
    const image = sharp(buffer, {
      failOn: 'warning',
      limitInputPixels: MAX_IMAGE_EDGE * MAX_IMAGE_EDGE,
      pages: 1
    });
    const metadata = await image.metadata();
    assert(metadata.format === 'webp', 'CLOTHING_IMAGE_INVALID', 422, 'Selected clothing image is not a valid WebP file');
    assert(!metadata.pages || metadata.pages === 1, 'CLOTHING_IMAGE_INVALID', 422, 'Animated clothing images are not supported');
    validateDimensions({ width: metadata.width, height: metadata.height });

    const converted = await image
      .autoOrient()
      .resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true})
      .flatten({ background: '#fffdf8' })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
      .toBuffer();
    return validateImageBytes(converted, 'image/jpeg');
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    throw new GatewayError('CLOTHING_IMAGE_INVALID', 422, 'Selected clothing image could not be prepared for AI');
  }
  });
}

export function parseImageDataUrl(value) {
  assert(typeof value === 'string', 'INVALID_IMAGE', 400, 'Image data URL is required');
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  assert(match, 'INVALID_IMAGE', 400, 'Only Base64 JPEG/PNG data URLs are accepted');
  let buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    throw new GatewayError('INVALID_IMAGE', 400, 'Image Base64 is invalid');
  }
  return validateImageBytes(buffer, match[1]);
}

export function extensionForMime(mimeType) {
  return mimeType === 'image/png' ? 'png' : 'jpg';
}

// Stop oversized Storage objects before collecting the whole upstream response.
export async function readBoundedImage(response,maxBytes=MAX_IMAGE_BYTES){
 if(Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel?.();throw new GatewayError('IMAGE_TOO_LARGE',413,'Image must be at most 7 MB');}
 if(!response.body){const bytes=Buffer.from(await response.arrayBuffer());assert(bytes.length<=maxBytes,'IMAGE_TOO_LARGE',413);return bytes;}
 const chunks=[];let total=0;
 for await(const chunk of response.body){total+=chunk.byteLength;if(total>maxBytes)throw new GatewayError('IMAGE_TOO_LARGE',413,'Image must be at most 7 MB');chunks.push(Buffer.from(chunk));}
 return Buffer.concat(chunks,total);
}
