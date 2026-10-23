import looks from '@/data/editorialLooks.json';
export const editorialLook = post => looks.find(look => {
  if(look.id!==String(post?.id))return false;
  if(look.image===post?.image)return true;
  try {
    const url=new URL(post.image);
    return url.origin==='https://hoxkrmadzjnyjaqjbyxc.supabase.co'
      && url.pathname.startsWith('/storage/v1/object/public/ootie-ootd-images/ootd/')
      && url.pathname.endsWith('/'+look.id+'/'+look.image.split('/').at(-1));
  } catch { return false; }
});
