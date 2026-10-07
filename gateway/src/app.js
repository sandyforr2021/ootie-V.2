import { GatewayError, toErrorResponse } from './errors.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export function createGatewayApp({ config, supabase, provider, generationService, productImportService }) {
  const isOriginAllowed = (origin) => !origin || config.corsAllowedOrigins.includes(origin);

  const authenticate = async (headers) => {
    const user = await supabase.verifyAccessToken(headers.authorization || headers.Authorization);
    const profile = await supabase.findProfileForUser(user.id);
    return { user, profile };
  };

  const dispatch = async ({ method, path, headers = {}, body = null }) => {
    const origin = headers.origin || headers.Origin || '';
    const corsHeaders = origin && isOriginAllowed(origin)
      ? {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
      }
      : {};

    if (!isOriginAllowed(origin)) {
      return { status: 403, headers: { ...JSON_HEADERS }, body: { error: { code: 'ORIGIN_NOT_ALLOWED' } } };
    }
    if (method === 'OPTIONS') return { status: 204, headers: corsHeaders, body: null };

    try {
      if (method === 'GET' && ['/health', '/healthz'].includes(path)) {
        const health = await provider.healthCheck();
        return { status: 200, headers: { ...JSON_HEADERS, ...corsHeaders }, body: { ok: true, ...health } };
      }

      const identity = await authenticate(headers);

      if (method === 'GET' && path === '/v1/capabilities') {
        return {
          status: 200,
          headers: { ...JSON_HEADERS, ...corsHeaders },
          body: generationService.capabilities(identity.user)
        };
      }
      if (method === 'GET' && path === '/v1/person-photos') {
        return {
          status: 200,
          headers: { ...JSON_HEADERS, ...corsHeaders },
          body: { photos: await generationService.listPersonPhotos(identity.user) }
        };
      }
      const privateImageMatch = method === 'GET' && /^\/v1\/private-images\/([^/]+)$/.exec(path);
      if (privateImageMatch) {
        let storagePath;
        try {
          storagePath = decodeURIComponent(privateImageMatch[1]);
        } catch {
          throw new GatewayError('INVALID_PRIVATE_IMAGE_PATH', 400, 'Private image path is invalid');
        }
        const image = await generationService.privateImage(identity.user, storagePath);
        return {
          status: 200,
          headers: {
            'Content-Type': image.mimeType,
            'Cache-Control': 'private, no-store',
            ...corsHeaders
          },
          rawBody: image.buffer
        };
      }
      if (method === 'POST' && path === '/v1/person-photos') {
        return {
          status: 201,
          headers: { ...JSON_HEADERS, ...corsHeaders },
          body: await generationService.uploadPersonPhoto({ user: identity.user, body })
        };
      }
      const deletePersonPhotoMatch = method === 'DELETE' && /^\/v1\/person-photos\/([^/]+)$/.exec(path);
      if (deletePersonPhotoMatch) {
        let photoId;
        try {
          photoId = decodeURIComponent(deletePersonPhotoMatch[1]);
        } catch {
          throw new GatewayError('INVALID_PHOTO_ID', 400, 'Photo ID is invalid');
        }
        return {
          status: 200,
          headers: { ...JSON_HEADERS, ...corsHeaders },
          body: await generationService.deletePersonPhoto(identity.user, photoId)
        };
      }
      if (method === 'GET' && path === '/v1/generations') {
        return {
          status: 200,
          headers: { ...JSON_HEADERS, ...corsHeaders },
          body: { generations: await generationService.listGenerations(identity.user) }
        };
      }
      if (method === 'POST' && path === '/v1/recommendations') {
        return {
          status: 200,
          headers: { ...JSON_HEADERS, ...corsHeaders },
          body: await generationService.recommend({ ...identity, body })
        };
      }
      if (method === 'POST' && path === '/v1/product-import/preview') {
        if (!productImportService) throw new GatewayError('PRODUCT_IMPORT_UNAVAILABLE', 503, '商品匯入服務目前無法使用。');
        return {
          status: 200,
          headers: { ...JSON_HEADERS, ...corsHeaders },
          body: await productImportService.preview(body?.url)
        };
      }
      if (method === 'POST' && path === '/v1/generations/single-try-on') {
        return {
          status: 200,
          headers: { ...JSON_HEADERS, ...corsHeaders },
          body: await generationService.generateImage({ ...identity, body, type: 'single_try_on' })
        };
      }
      if (method === 'POST' && path === '/v1/generations/outfit-preview') {
        return {
          status: 200,
          headers: { ...JSON_HEADERS, ...corsHeaders },
          body: await generationService.generateImage({ ...identity, body, type: 'outfit_preview' })
        };
      }

      const saveMatch = method === 'POST' && /^\/v1\/generations\/([^/]+)\/save$/.exec(path);
      if (saveMatch) {
        return {
          status: 200,
          headers: { ...JSON_HEADERS, ...corsHeaders },
          body: await generationService.saveGeneration(identity.user, decodeURIComponent(saveMatch[1]))
        };
      }

      throw new GatewayError('NOT_FOUND', 404, 'Gateway route not found');
    } catch (error) {
      const response = toErrorResponse(error);
      return { ...response, headers: { ...JSON_HEADERS, ...corsHeaders } };
    }
  };

  return { dispatch };
}

export async function readJsonBody(request, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new GatewayError('REQUEST_TOO_LARGE', 413, 'Request body is too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!chunks.length) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new GatewayError('INVALID_JSON', 400, 'Request body must be valid JSON'));
      }
    });
    request.on('error', reject);
  });
}
