import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../020_demo_subscription_points.sql', import.meta.url), 'utf8');
const seedGrantSql = await readFile(new URL('../021_demo_seed_saved_outfits_grant.sql', import.meta.url), 'utf8');
const required = [
  'CREATE TABLE public.ootie_demo_subscriptions',
  'ALTER TABLE public.ootie_demo_subscriptions ENABLE ROW LEVEL SECURITY',
  'CREATE POLICY ootie_demo_subscriptions_select_own',
  'CREATE FUNCTION public.ootie_demo_subscribe',
  'CREATE FUNCTION public.ootie_demo_purchase_credits',
  'CREATE FUNCTION public.grant_ootie_birthday_points',
  'CREATE FUNCTION public.claim_ootie_ai_generation_with_points',
  'CREATE FUNCTION public.debit_ootie_ai_points',
  "'birthday:' || p_award_year::text",
  "'ai-generation:' || p_generation_id::text",
  "GRANT EXECUTE ON FUNCTION public.debit_ootie_ai_points(uuid,uuid,integer) TO service_role"
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`020 missing required contract: ${token}`);
}
if (/stripe|ecpay|newebpay|card_number|credit_card/i.test(sql)) {
  throw new Error('020 must not contain a real payment integration');
}
for (const token of ['public.ootie_saved_outfits', 'TO service_role']) {
  if (!seedGrantSql.includes(token)) throw new Error(`021 missing required contract: ${token}`);
}
console.log(`020 demo subscription/points validation passed (${createHash('sha256').update(sql).digest('hex').toUpperCase()})`);
console.log(`021 demo seed grant validation passed (${createHash('sha256').update(seedGrantSql).digest('hex').toUpperCase()})`);
