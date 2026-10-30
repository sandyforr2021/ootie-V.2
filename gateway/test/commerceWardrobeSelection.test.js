import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {CommerceService} from '../src/commerce/service.js';
const userId=randomUUID(), profileId=randomUUID(), itemId=randomUUID(), postId=randomUUID(), batchId=randomUUID();
const image=await sharp({create:{width:300,height:300,channels:3,background:'#dedede'}}).jpeg().toBuffer();
function setup(){
 const products=new Map(), calls=[];
 const storage={findProfileForUser:async()=>({id:profileId}),findOwnedItems:async(profile,ids)=>{assert.equal(profile,profileId);return ids.map(id=>({id,name:'Trousers',category:'Bottoms'}));},
   downloadPrivate:async()=>({buffer:image,mimeType:'image/jpeg'}),clothingImage:async()=>({buffer:image,mimeType:'image/jpeg'}),
   accessibleSharedClothing:async()=>({id:itemId,name:'Trousers',category:'Bottoms'}),sharedClothingImage:async()=>({buffer:image,mimeType:'image/jpeg'}),uploadPrivate:async(path)=>calls.push(path)};
 const repository={product:async(id,user)=>products.get(`${user}:${id}`),createProduct:async(row)=>{products.set(`${row.user_id}:${row.id}`,row);return row;},
   savedOutfit:async()=>({id:'saved'}),outfit:async()=>({id:postId,item_ids:[itemId]}),rpc:async(name,args)=>{calls.push(args);return [args];}};
 return {service:new CommerceService({storage,repository,enabled:true}),storage,repository,products,calls};
}
const body=()=>({kind:'try_on',personPath:`person/${userId}/photo.jpg`,productIds:[],clothingItemIds:[itemId],savedItems:[],consent:true,batchId});
test('owned wardrobe selection creates a private job snapshot, never a wishlist item, and reuses it on replay',async()=>{
 const f=setup(); await f.service.enqueue({id:userId},body()); await f.service.enqueue({id:userId},body());
 assert.equal(f.products.size,1); assert.equal([...f.products.values()][0].state,'tryon_only');
 assert.equal([...f.products.values()][0].category,'lower_body'); assert.equal(f.calls.filter(x=>typeof x==='string').length,1);
 const requests=f.calls.filter(x=>typeof x==='object'); assert.deepEqual(requests[0].p_product_ids,requests[1].p_product_ids);
});
test('unowned and unbookmarked garments never create a snapshot or submit a job',async()=>{
 const f=setup();f.storage.findOwnedItems=async()=>{throw Object.assign(new Error('not owned'),{code:'ITEM_NOT_OWNED'});};
 await assert.rejects(f.service.enqueue({id:userId},body()),{code:'ITEM_NOT_OWNED'});assert.equal(f.products.size,0);
 f.repository.savedOutfit=async()=>null;
 await assert.rejects(f.service.enqueue({id:userId},{...body(),clothingItemIds:[],savedItems:[{postId,itemId}]}),{code:'ITEM_NOT_SAVED'});
 assert.equal(f.products.size,0);assert.equal(f.calls.filter(x=>typeof x==='object').length,0);
});
test('saved item also requires current viewer permission before taking a snapshot',async()=>{
 const f=setup();f.storage.accessibleSharedClothing=async()=>{throw Object.assign(new Error('private'),{code:'ITEM_NOT_FOUND'});};
 await assert.rejects(f.service.enqueue({id:userId},{...body(),clothingItemIds:[],savedItems:[{postId,itemId}]}),{code:'ITEM_NOT_FOUND'});
 assert.equal(f.products.size,0);
});
test('a mixed wardrobe and saved selection rejects accessories before any image copy or reservation',async()=>{
 for (const category of ['Bags','Accessories','包款','配件','unknown','']) {
  const f=setup(), otherId=randomUUID(); let reads=0;
  f.storage.clothingImage=async()=>{reads++;return {buffer:image,mimeType:'image/jpeg'};};
  f.storage.sharedClothingImage=async()=>{reads++;return {buffer:image,mimeType:'image/jpeg'};};
  f.storage.accessibleSharedClothing=async()=>({id:otherId,name:'Accessory',category});
  f.repository.outfit=async()=>({id:postId,item_ids:[otherId]});
  await assert.rejects(f.service.enqueue({id:userId},{...body(),savedItems:[{postId,itemId:otherId}]}),{code:'UNSUPPORTED_GARMENT_CATEGORY'});
  assert.equal(reads,0); assert.equal(f.products.size,0); assert.deepEqual(f.calls,[]);
 }
});
test('a mixed selection checks wishlist ownership before copying an otherwise valid wardrobe item',async()=>{
 const f=setup(); let reads=0;
 f.storage.clothingImage=async()=>{reads++;return {buffer:image,mimeType:'image/jpeg'};};
 await assert.rejects(f.service.enqueue({id:userId},{...body(),productIds:[randomUUID()]}),{code:'INVALID_PRODUCT'});
 assert.equal(reads,0);assert.equal(f.products.size,0);assert.deepEqual(f.calls,[]);
});
test('existing real garment categories map to supported provider categories',async()=>{
 for (const [category, expected] of [
  ['Tops','upper_body'],['Knitwear','upper_body'],['Jackets','upper_body'],['Outerwear','upper_body'],['上身','upper_body'],['外套','upper_body'],
  ['Bottoms','lower_body'],['Trousers','lower_body'],['Shorts','lower_body'],['下身','lower_body'],
  ['Dress','full_body'],['Dresses','full_body'],['洋裝','full_body']
 ]) {
  const f=setup(); f.storage.findOwnedItems=async()=>[{id:itemId,name:'Garment',category}];
  await f.service.enqueue({id:userId},body());
  assert.equal([...f.products.values()][0].category,expected,category);
 }
});
test('unsupported footwear is rejected before copying wardrobe images',async()=>{
 for(const category of ['Shoes','Sneakers','鞋子']){
  const f=setup();f.storage.findOwnedItems=async()=>[{id:itemId,name:'Shoes',category}];
  await assert.rejects(f.service.enqueue({id:userId},body()),{code:'UNSUPPORTED_GARMENT_CATEGORY'});
  assert.equal(f.products.size,0);assert.deepEqual(f.calls,[]);
 }
});
