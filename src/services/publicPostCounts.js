export async function mergePublicPostCounts(posts, client) {
  if (!posts?.length) return posts;
  const counts = new Map();
  for (let index=0;index<posts.length;index+=100) {
    const {data,error} = await client.rpc('ootie_public_post_counts',{post_ids:posts.slice(index,index+100).map(post=>post.id)});
    // Until the owner approves migration 030, preserve existing public counts.
    // Unavailable save totals remain unknown rather than looking like zero.
    if (error && !['PGRST202','42501'].includes(error.code)) throw error;
    for (const row of data || []) counts.set(row.post_id,row);
  }
  return posts.map(post=>{
    const count=counts.get(post.id);
    return {...post,saves:count?.save_count ?? null,
      ootie_post_likes:[{count:count?.like_count ?? post.ootie_post_likes?.[0]?.count ?? 0}],
      ootie_post_comments:[{count:count?.comment_count ?? post.ootie_post_comments?.[0]?.count ?? 0}]};
  });
}
