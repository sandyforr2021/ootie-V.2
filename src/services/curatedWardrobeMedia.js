import manifest from '@/data/curatedWardrobeMedia.json';

// Exact published team assets only. A member's replacement must never be
// hidden by this presentation mapping, even when the clothing ID is unchanged.
export function curatedWardrobePhoto(item) {
 const entry=manifest[item?.id];
 if(!entry || item.owner_id!==entry.ownerId || (item.photo_display_path||null)!==entry.sourceDisplayPath)return '';
 if(![entry.sourcePhoto,entry.publishedPhoto,entry.photo,entry.thumbnail].filter(Boolean).includes(item.photo))return '';
 return entry.photo;
}
const publicImages=new Map();
for(const entry of Object.values(manifest)){
 for(const source of [entry.sourcePhoto,entry.publishedPhoto,entry.photo])if(source)publicImages.set(source,entry);
}
export function curatedPublicImage(source,full=false){const entry=publicImages.get(source);return entry?(full?entry.photo:entry.thumbnail):'';}
