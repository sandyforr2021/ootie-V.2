// One owner-approved withdrawal from the 2026-10-25 manual UX review.
// Uses Render's server credentials without exporting them to the frontend.
// The completion marker lets the owner deliberately republish later.
import { SupabaseGateway } from '../../gateway/src/services/supabaseGateway.js';
import { CommerceRepository } from '../../gateway/src/commerce/repository.js';
export const REVIEWED_SHARE = Object.freeze({
  id: '4d02eaaa-5ca5-45ce-9c3c-96ec9485039c',
  userId: '9910c555-1026-4d94-a345-1916b367848f',
  sourceUrl: 'https://www.net-fashion.net/product/759645',
  marker: 'owner_approved_withdrawal_20261025'
});
export async function retractReviewedShare({ repository, storage }) {
  const {id,userId,sourceUrl,marker}=REVIEWED_SHARE;
  const job=await repository.job(id,userId);
  if(!job)throw new Error('Reviewed share job was not found');
  if(job.result_data?.[marker]===true)return 'already-completed';
  if(job.status!=='succeeded' || !job.result_path)throw new Error('Private result must remain available');
  const post=await repository.post(id);
  if(post && (post.user_id!==userId || post.source_url!==sourceUrl))throw new Error('Reviewed share identity mismatch');
  // Delete through Storage API, never by deleting storage metadata in SQL.
  await storage.deleteObject('ootie-shop-shares',`${userId}/${id}.jpg`);
  if(post && await repository.removePost(id,userId)!==true)throw new Error('Withdrawal not confirmed');
  const resultData=job.result_data && typeof job.result_data==='object' && !Array.isArray(job.result_data)?job.result_data:{};
  const rows=await repository.request('ootie_youcam_jobs',`?id=eq.${id}&user_id=eq.${userId}`,{
    method:'PATCH',body:{result_data:{...resultData,[marker]:true}}
  });
  if(rows?.length!==1 || rows[0].result_path!==job.result_path)throw new Error('Private result preservation not confirmed');
  return 'withdrawn';
}
export async function runApprovedReleaseActions(env=process.env) {
  if(env.RENDER_SERVICE_ID!=='srv-dbd300psrm7s73bf4s0g')return;
  if(env.SUPABASE_URL!=='https://hoxkrmadzjnyjaqjbyxc.supabase.co')throw new Error('Wrong release project');
  const key=env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw new Error('Server credentials unavailable for approved withdrawal');
  const storage=new SupabaseGateway({config:{supabase:{url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,serviceRoleKey:key,aiBucket:'ootie-ai-private'}}});
  const state=await retractReviewedShare({repository:new CommerceRepository(storage),storage});
  console.log(`Approved reviewed share withdrawal: ${state}`);
}
