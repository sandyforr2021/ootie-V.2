import http from 'node:http';
import {endResponse} from './httpResponse.js';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {createWorkLimiter} from './workLimiter.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createStaticSite } from './staticSite.js';
import { loadConfig } from './config.js';
import { createGatewayApp, readJsonBody } from './app.js';
import { createGoogleAiProvider } from './providers/index.js';
import { SupabaseGateway } from './services/supabaseGateway.js';
import { GenerationService } from './services/generationService.js';
import { toErrorResponse } from './errors.js';
import { ProductImportService } from './services/productImportService.js';
import { CommerceRepository } from './commerce/repository.js';
import { CommerceService } from './commerce/service.js';
import { YouCamClient } from './commerce/youcamClient.js';
import { CommerceJobWorker, startCommerceWorker } from './commerce/jobWorker.js';
import { createWeatherPlacesService } from './services/weatherPlacesService.js';
import { createContentTranslationService } from './services/contentTranslationService.js';

const config = loadConfig();
const webRoot = fileURLToPath(new URL('../../dist', import.meta.url));
const serveSite = process.env.SERVE_WEB_APP === 'true' ? createStaticSite(webRoot,{revision:process.env.RENDER_GIT_COMMIT,streamFiles:true}) : null;
if (serveSite) {
  const html = await readFile(new URL('../../dist/index.html',import.meta.url),'utf8');
  const entry = html.match(/src="(\/assets\/[A-Za-z0-9_-]+\.js)"/)?.[1];
  if (!entry) throw new Error('Built frontend entry is missing');
  console.log(`OOTIE frontend entry ${entry}`);
}
const provider = config.competitionMode
  ? { healthCheck: async () => ({ provider: 'youcam', configured: !!config.youcam.apiKey }) }
  : createGoogleAiProvider(config);
const supabase = new SupabaseGateway({ config });
const generationService = new GenerationService({ config, supabase, provider });
const productImportService = new ProductImportService();
const repository = new CommerceRepository(supabase);
const youcamClient = new YouCamClient(config.youcam);
const commerceService = new CommerceService({ repository, storage: supabase, provider: youcamClient,
  reviewerUserIds: config.youcam.reviewerUserIds, enabled: config.youcam.enabled && !!config.youcam.apiKey });
const weatherPlacesService = createWeatherPlacesService();
const contentTranslationService = createContentTranslationService({ supabase });
const app = createGatewayApp({ config, supabase, provider, generationService, productImportService, commerceService, weatherPlacesService, contentTranslationService });
const stopWorker = config.youcam.workerEnabled && config.youcam.enabled && config.youcam.apiKey
  ? startCommerceWorker(new CommerceJobWorker({ repository, storage: supabase, provider: youcamClient }), {
    onError: (error) => console.error('Commerce worker:', error?.code || 'UNAVAILABLE')
  }) : () => {};
process.on('SIGTERM', () => { stopWorker(); server.close(); });

const mediaWork=createWorkLimiter({concurrency:2,maxQueue:16});
const memoryLog=()=>{const m=process.memoryUsage();console.log(JSON.stringify({event:'runtime_memory',rssMiB:Math.round(m.rss/1048576),heapMiB:Math.round(m.heapUsed/1048576),externalMiB:Math.round(m.external/1048576),mediaActive:mediaWork.active,mediaQueued:mediaWork.queued}));};
const memoryTimer=setInterval(memoryLog,60000);memoryTimer.unref();
const server = http.createServer(async (request, response) => {
  let release;const cancelled=new AbortController();const onClose=()=>cancelled.abort();response.once('close',onClose);
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const staticResult = serveSite ? await serveSite(url.pathname, request.method) : null;
    if (staticResult) {
      response.writeHead(staticResult.status, staticResult.headers);
      if(staticResult.filePath)await pipeline(createReadStream(staticResult.filePath,{highWaterMark:64*1024}),response);
      else await endResponse(response,staticResult.rawBody);
      return;
    }
    const apiPath=serveSite && url.pathname.startsWith('/api/')?url.pathname.slice(4):url.pathname;
    const withBody=['POST','PUT','PATCH'].includes(request.method || '');
    if(withBody || /^\/v1\/(?:private-images\/|shared-clothing\/)/.test(apiPath))release=await mediaWork.acquire({signal:cancelled.signal});
    if(cancelled.signal.aborted)return;
    const body = withBody
      ? await readJsonBody(request)
      : null;
    const result = await app.dispatch({
      method: request.method || 'GET',
      path: apiPath,
      headers: request.headers,
      body
    });
    if(response.destroyed || cancelled.signal.aborted)return;
    response.writeHead(result.status, result.headers);
    await endResponse(response,result.rawBody || (result.body === null ? '' : JSON.stringify(result.body)));
  } catch (error) {
    if(response.destroyed || response.headersSent){response.destroy();return;}
    const result = toErrorResponse(error);
    response.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8','Cache-Control':'no-store',...(error?.code==='MEDIA_BUSY'?{'Retry-After':'3'}:{}) });
    await endResponse(response,JSON.stringify(result.body));
  } finally {release?.();response.off('close',onClose);}
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`OOTIE AI Gateway listening on port ${server.address().port}`);
  memoryLog();
});
