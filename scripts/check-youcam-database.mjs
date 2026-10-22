// Read-only health check. Never prints credentials, identities or stored images.
// Run: node --env-file=gateway/.env.local scripts/check-youcam-database.mjs
import { loadConfig } from '../gateway/src/config.js';
import { SupabaseGateway } from '../gateway/src/services/supabaseGateway.js';

const config = loadConfig();
const storage = new SupabaseGateway({ config });
const tables = ['ootie_shop_products', 'ootie_youcam_budget', 'ootie_youcam_batches', 'ootie_youcam_jobs', 'ootie_shop_posts', 'ootie_commerce_events'];
const results = [];
for (const table of tables) {
  const response = await fetch(`${config.supabase.url}/rest/v1/${table}?select=id`, {
    method: 'HEAD', headers: storage.serviceHeaders({ Prefer: 'count=exact' }), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
  const anonymous = await fetch(`${config.supabase.url}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: config.supabase.publishableKey }, signal: AbortSignal.timeout(15000)
  });
  const anonymousRows = anonymous.ok ? await anonymous.json() : null;
  // Public posts are projected through the gateway. No direct anon table grants.
  if (anonymous.ok && (!Array.isArray(anonymousRows) || anonymousRows.length)) throw new Error(`${table}: unexpected anonymous access`);
  if (!anonymous.ok && ![401, 403].includes(anonymous.status)) throw new Error(`${table}: anonymous probe HTTP ${anonymous.status}`);
  results.push({ table, rows: Number(response.headers.get('content-range')?.split('/')[1]), anonymousRead: anonymous.ok ? 'no rows visible' : 'denied' });
}
const [budget] = await storage.serviceRequest('/rest/v1/ootie_youcam_budget?select=unit_limit,allocated_units,expires_at&id=eq.true');
console.log(JSON.stringify({ project: new URL(config.supabase.url).hostname, tables: results, budget,
  generationEnabled: config.youcam.enabled, workerEnabled: config.youcam.workerEnabled,
  note: 'Read-only checks. No YouCam call, data modification or paid request.' }, null, 2));
