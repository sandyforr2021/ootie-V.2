import http from 'node:http';
import { loadConfig } from './config.js';
import { createGatewayApp, readJsonBody } from './app.js';
import { createGoogleAiProvider } from './providers/index.js';
import { SupabaseGateway } from './services/supabaseGateway.js';
import { GenerationService } from './services/generationService.js';
import { toErrorResponse } from './errors.js';
import { ProductImportService } from './services/productImportService.js';

const config = loadConfig();
const provider = createGoogleAiProvider(config);
const supabase = new SupabaseGateway({ config });
const generationService = new GenerationService({ config, supabase, provider });
const productImportService = new ProductImportService();
const app = createGatewayApp({ config, supabase, provider, generationService, productImportService });

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const body = ['POST', 'PUT', 'PATCH'].includes(request.method || '')
      ? await readJsonBody(request)
      : null;
    const result = await app.dispatch({
      method: request.method || 'GET',
      path: url.pathname,
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
