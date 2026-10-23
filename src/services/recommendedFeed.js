// Keep each author's relative order while varying voices in the recommended feed.
export function alternateAuthors(posts) {
  const buckets=new Map(), result=[];
  for(const post of posts){
    const author=post.user_id || post.username || post.id;
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
