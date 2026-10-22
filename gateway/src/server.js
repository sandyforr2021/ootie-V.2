import http from 'node:http';
import { fileURLToPath } from 'node:url';
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

const config = loadConfig();
const serveSite = process.env.SERVE_WEB_APP === 'true' ? createStaticSite(fileURLToPath(new URL('../../dist', import.meta.url))) : null;
const provider = config.competitionMode
  ? { healthCheck: async () => ({ provider: 'youcam', configured: !!config.youcam.apiKey }) }
  : createGoogleAiProvider(config);
const supabase = new SupabaseGateway({ config });
const generationService = new GenerationService({ config, supabase, provider });
const productImportService = new ProductImportService();
const repository = new CommerceRepository(supabase);
const commerceService = new CommerceService({ repository, storage: supabase, enabled: config.youcam.enabled && !!config.youcam.apiKey });
const app = createGatewayApp({ config, supabase, provider, generationService, productImportService, commerceService });
const stopWorker = config.youcam.workerEnabled && config.youcam.enabled && config.youcam.apiKey
  ? startCommerceWorker(new CommerceJobWorker({ repository, storage: supabase, provider: new YouCamClient(config.youcam) }), {
    onError: (error) => console.error('Commerce worker:', error?.code || 'UNAVAILABLE')
  }) : () => {};
process.on('SIGTERM', () => { stopWorker(); server.close(); });

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const staticResult = serveSite ? await serveSite(url.pathname, request.method) : null;
    if (staticResult) {
      response.writeHead(staticResult.status, staticResult.headers);
      response.end(staticResult.rawBody);
      return;
    }
    const body = ['POST', 'PUT', 'PATCH'].includes(request.method || '')
      ? await readJsonBody(request)
      : null;
    const result = await app.dispatch({
      method: request.method || 'GET',
      path: serveSite && url.pathname.startsWith('/api/') ? url.pathname.slice(4) : url.pathname,
      headers: request.headers,
      body
    });
    response.writeHead(result.status, result.headers);
    if (result.rawBody) response.end(result.rawBody);
    else response.end(result.body === null ? '' : JSON.stringify(result.body));
  } catch (error) {
    const result = toErrorResponse(error);
    response.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(result.body));
  }
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`OOTIE AI Gateway listening on port ${config.port}`);
});
