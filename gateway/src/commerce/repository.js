import { GatewayError } from '../errors.js';

export class CommerceRepository {
  constructor(storage) { this.storage = storage; }
  async request(table, query = '', { method = 'GET', body, prefer = 'return=representation' } = {}) {
    return this.storage.serviceRequest(`/rest/v1/${table}${query}`, {
      method, headers: { 'Content-Type': 'application/json', Prefer: prefer },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  }
  rpc(name, body) { return this.request(`rpc/${name}`, '', { method: 'POST', body }); }
  listProducts(userId) { return this.request('ootie_shop_products', `?user_id=eq.${userId}&state=neq.tryon_only&order=created_at.desc&limit=200`); }
  async product(id, userId) { return (await this.request('ootie_shop_products', `?id=eq.${id}&user_id=eq.${userId}&limit=1`))?.[0]; }
  async createProduct(row) { return (await this.request('ootie_shop_products', '', { method: 'POST', body: row }))[0]; }
  async updateProduct(id, userId, changes) { return (await this.request('ootie_shop_products', `?id=eq.${id}&user_id=eq.${userId}`, { method: 'PATCH', body: changes }))[0]; }
  listJobs(userId) { return this.request('ootie_youcam_jobs', `?user_id=eq.${userId}&select=id,batch_id,product_id,kind,status,units,result_path,result_data,error_code,created_at,completed_at,product:ootie_shop_products(title)&order=created_at.desc&limit=200`); }
  async job(id, userId) { return (await this.request('ootie_youcam_jobs', `?id=eq.${id}&user_id=eq.${userId}&limit=1`))?.[0]; }
  async savedOutfit(profileId, postId) { return (await this.request('ootie_saved_outfits', `?profile_id=eq.${profileId}&target_type=eq.OOTD&target_id=eq.${postId}&select=id&limit=1`))?.[0]; }
  async outfit(postId) { return (await this.request('ootie_ootd_posts', `?id=eq.${postId}&select=id,item_ids&limit=1`))?.[0]; }
  async clearJobResult(id, userId, resultPath) {
    const query = `?id=eq.${id}&user_id=eq.${userId}&status=eq.succeeded&result_path=eq.${encodeURIComponent(resultPath)}`;
    return (await this.request('ootie_youcam_jobs', query, { method: 'PATCH', body: { result_path: null } }))?.[0];
  }
  async budget() { return (await this.request('ootie_youcam_budget', '?id=eq.true&limit=1'))?.[0]; }
  async claim(lease) { return (await this.rpc('claim_ootie_youcam_job', { p_lease: lease }))?.[0]; }
  async updateJob(id, lease, changes) {
    const rows = await this.request('ootie_youcam_jobs', `?id=eq.${id}&lease_token=eq.${lease}`, { method: 'PATCH', body: changes });
    if (rows.length !== 1) throw new GatewayError('JOB_LEASE_LOST', 409, '任務已交由其他工作程序處理。');
    return rows[0];
  }
  posts() { return this.request('ootie_shop_posts', '?select=id,user_id,title,caption,image_url,source_url,created_at&order=created_at.desc&limit=60'); }
  async post(id) { return (await this.request('ootie_shop_posts', `?id=eq.${id}&select=id,user_id,title,caption,image_url,source_url,created_at&limit=1`))?.[0]; }
  publicAuthors(userIds) {
    if(!userIds.length)return [];
    return this.request('ootie_profiles',`?user_id=in.(${userIds.join(',')})&select=id,user_id,username,display_name,initials,avatar_url`);
  }
  async publish(row) { return (await this.request('ootie_shop_posts', '?on_conflict=id', { method: 'POST', body: row, prefer: 'resolution=ignore-duplicates,return=representation' }))?.[0] || this.post(row.id); }
  event(row) { return this.request('ootie_commerce_events', '?on_conflict=id', { method: 'POST', body: row, prefer: 'resolution=ignore-duplicates,return=minimal' }); }
  events(userId) { return this.request('ootie_commerce_events', `?user_id=eq.${userId}&select=event_type,product_id,post_id&order=created_at.desc&limit=1000`); }
}
