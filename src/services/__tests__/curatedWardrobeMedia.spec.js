import {it,expect} from 'vitest';
import manifest from '@/data/curatedWardrobeMedia.json';
import {curatedWardrobePhoto} from '../curatedWardrobeMedia';
import {listThumbnail,fullImage} from '../publicThumbnails';

it('shows approved team derivatives but never hides a member replacement or another owner',()=>{
 const [id,e]=Object.entries(manifest)[0];
 const item={id,owner_id:e.ownerId,photo:e.sourcePhoto,photo_display_path:e.sourceDisplayPath};
 expect(curatedWardrobePhoto(item)).toBe(e.photo);
 expect(curatedWardrobePhoto({...item,photo:e.publishedPhoto})).toBe(e.photo);
 expect(curatedWardrobePhoto({...item,owner_id:'someone-else'})).toBe('');
 expect(curatedWardrobePhoto({...item,photo:'https://example.com/new-member-photo.webp'})).toBe('');
 expect(curatedWardrobePhoto({...item,photo_display_path:'new/operation/display.webp'})).toBe('');
 expect(listThumbnail(e.sourcePhoto)).toBe(e.thumbnail);
 expect(fullImage(e.sourcePhoto)).toBe(e.photo);
 expect(listThumbnail(e.photo)).toBe(e.thumbnail);
 expect(listThumbnail(e.publishedPhoto)).toBe(e.thumbnail);
});
