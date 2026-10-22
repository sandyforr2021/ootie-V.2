import { describe, expect, it, vi } from 'vitest';
import { mergePublicPostCounts } from '../publicPostCounts';
describe('public post aggregate counts',()=>{
  it('maps each count to its target post without sharing saver identities',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:[{post_id:'b',like_count:4,comment_count:3,save_count:2},{post_id:'a',like_count:0,comment_count:1,save_count:0}],error:null});
    const rows=await mergePublicPostCounts([{id:'a'},{id:'b'}],{rpc});
    expect(rows[0]).toMatchObject({id:'a',saves:0,ootie_post_likes:[{count:0}]});
    expect(rows[1]).toMatchObject({id:'b',saves:2,ootie_post_comments:[{count:3}]});
    expect(rpc).toHaveBeenCalledWith('ootie_public_post_counts',{post_ids:['a','b']});
  });
  it('keeps existing public interactions available while aggregate permission is pending',async()=>{
    const rows=await mergePublicPostCounts([{id:'a',ootie_post_likes:[{count:4}],ootie_post_comments:[{count:3}]}],{rpc:async()=>({error:{code:'PGRST202'}})});
    expect(rows[0]).toMatchObject({saves:null,ootie_post_likes:[{count:4}],ootie_post_comments:[{count:3}]});
  });
  it('reports unrelated network errors instead of presenting fabricated zero counts',async()=>{
    await expect(mergePublicPostCounts([{id:'a'}],{rpc:async()=>({error:{code:'NETWORK_ERROR'}})})).rejects.toMatchObject({code:'NETWORK_ERROR'});
  });
});
