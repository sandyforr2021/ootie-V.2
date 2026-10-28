import { supabase } from './supabase';

// Read the existing ledger. Never grant points or simulate a checkout here.
export async function loadPointAccount(profileId) {
  if (!profileId) throw new Error('SIGN_IN_REQUIRED');
  const [balance, transactions] = await Promise.all([
    supabase.rpc('ootie_my_point_balance'),
    supabase.from('ootie_point_transactions').select('id,amount,type,created_at').eq('profile_id',profileId).order('created_at',{ascending:false}).limit(50)
  ]);
  if (balance.error || transactions.error) throw new Error('POINTS_UNAVAILABLE');
  const value = Number(balance.data);
  if (balance.data == null || !Number.isFinite(value)) throw new Error('POINTS_UNAVAILABLE');
  return {balance:value,transactions:transactions.data || []};
}
