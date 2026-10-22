import looks from '@/data/editorialLooks.json';
export const editorialLook = post => looks.find(look => look.id === String(post?.id) && look.image === post?.image);
