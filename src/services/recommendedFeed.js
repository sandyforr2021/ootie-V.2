// Keep each author's relative order while varying voices in the recommended feed.
export function alternateAuthors(posts) {
  const buckets=new Map(), result=[], seenImages=new Set();
  for(const post of posts){
    const author=post.user_id || post.username || post.id;
    const imageKey = post.image_storage_path || String(post.image || '').split('?')[0];
    const duplicateKey = `${author}:${imageKey}`;
    if (imageKey && seenImages.has(duplicateKey)) continue;
    if (imageKey) seenImages.add(duplicateKey);
    if(!buckets.has(author))buckets.set(author,[]);
    buckets.get(author).push(post);
  }
  while(buckets.size){
    for(const [author,queue] of buckets){
      result.push(queue.shift());
      if(!queue.length)buckets.delete(author);
    }
  }
  return result;
}
