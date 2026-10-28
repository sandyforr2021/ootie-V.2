export function webUrl(value) {
  try {const url=new URL(value); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';}
  catch {return '';}
}
export function buildHandoff(endpoint, product, language='en') {
  const base=webUrl(endpoint);
  if (!base) throw new Error('endpoint');
  const title=String(product.title || '').trim().slice(0,160);
  if (!title) throw new Error('title');
  const url=new URL('/closet',base);
  url.searchParams.set('tab','wishlist');
  url.searchParams.set('quick','add-product');
  url.searchParams.set('title',title);
  for(const key of ['url','image']) {const value=webUrl(product[key]);if(value) url.searchParams.set(key,value);}
  url.searchParams.set('lang',['en','zh-TW','ja','es'].includes(language)?language:'en');
  return url.href;
}
