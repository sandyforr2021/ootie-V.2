// Free, on-device resizing; no AI API or third-party image service.
export async function createListImage(blob, edge=480) {
  if(typeof createImageBitmap!=='function')return null;
  let image;try{image=await createImageBitmap(blob);}catch{return null;}
  try {
    const scale=Math.min(1,edge/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(output=>output?resolve(output):reject(Error('THUMBNAIL_FAILED')),'image/webp',.76));
  }finally{image.close();}
}
export const listImagePath = path => path.replace(/\.[^/.]+$/,'.list-v1.webp');
