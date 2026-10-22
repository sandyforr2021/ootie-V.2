// Read-only provider check: no uploads, task creation, purchases or top-ups.
// node --env-file=gateway/.env.local scripts/check-youcam-account.mjs
const key = process.env.YOUCAM_API_KEY;
if (!key) throw new Error('YOUCAM_API_KEY is missing from the server environment');
const origin = 'https://yce-api-01.makeupar.com';
async function get(path) {
  const response = await fetch(origin + path, {
    redirect: 'error', headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status !== 200) throw new Error(`YouCam HTTP ${response.status}`);
  return payload;
}
const report = { checkedAt: new Date().toISOString(), credit: null, costs: [] };
try {
  const balance = await get('/s2s/v1.0/client/credit');
  report.credit = balance.results?.map(({ type, amount_dec, expiry }) => ({ type, amount_dec, expiry }));
} catch (error) { report.creditError = error.message; }
let token;
for (let page = 0; page < 20; page++) {
  const data = await get('/s2s/v2.0/credit/feature-cost?page_size=20' + (token ? `&starting_token=${encodeURIComponent(token)}` : ''));
  const result = data.result;
  if (!Array.isArray(result?.skus)) throw new Error('Unrecognized feature-cost response');
  report.costs.push(...result.skus.filter(({ run_task_url }) => [origin + '/s2s/v2.0/task/cloth-v3', origin + '/s2s/v2.0/task/skin-tone-analysis'].includes(run_task_url)));
  token = result.next_token;
  if (!token) break;
  if (page === 19) throw new Error('Feature-cost pagination limit exceeded');
}
console.log(JSON.stringify(report, null, 2));
