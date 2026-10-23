// Keep each author's relative order while varying voices in the recommended feed.
export function alternateAuthors(posts) {
  const remaining=[...posts], result=[];
  while(remaining.length) {
    const previous=result.at(-1)?.user_id;
    const next=remaining.findIndex(post=>post.user_id!==previous);
    result.push(remaining.splice(next<0?0:next,1)[0]);
  }
  return result;
}
