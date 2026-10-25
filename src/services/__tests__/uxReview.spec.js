import { describe, it, expect, vi } from 'vitest';
import { deletePostComment } from '../postComments';
import { searchProfiles } from '../profileSearch';
import { tryOnCategory, filenameGarmentCategory, suggestedGarmentName } from '../garmentImport';
import { analyzePixelData } from '../colorDetection';

describe('manual UX report regressions',()=>{
 it('requires confirmed deletion of a comment scoped to the current author',async()=>{
  const query={delete:vi.fn(()=>query),eq:vi.fn(()=>query),select:vi.fn(async()=>({data:[{id:'comment'}]}))};
  const client={from:vi.fn(()=>query)};
  await expect(deletePostComment({id:'comment',profileId:'owner'},client)).resolves.toBe(true);
  expect(query.eq.mock.calls).toEqual([['id','comment'],['profile_id','owner']]);
  query.select.mockResolvedValue({data:[]});
  await expect(deletePostComment({id:'foreign',profileId:'owner'},client)).rejects.toThrow('COMMENT_DELETE_NOT_CONFIRMED');
 });
 it('searches handles and display names and removes duplicates',async()=>{
  const query={select:vi.fn(()=>query),ilike:vi.fn(()=>query),limit:vi.fn(async()=>({data:[{id:'p',username:'clara'}]}))};
  const client={from:vi.fn(()=>query)};
  expect(await searchProfiles('@clara',client)).toEqual([{id:'p',username:'clara',user_id:'p'}]);
  expect(query.ilike.mock.calls).toEqual([['username','%clara%'],['display_name','%clara%']]);
  query.limit.mockResolvedValue({error:{message:'offline'}});
  await expect(searchProfiles('clara',client)).rejects.toThrow('PROFILE_SEARCH_FAILED');
 });
 it('maps supported closet categories without treating accessories as supported try-ons',()=>{
  expect(tryOnCategory('Outerwear')).toBe('upper_body');
  expect(tryOnCategory('Bags')).toBeNull();
  expect(filenameGarmentCategory('bottom_01_indigo_denim_pants.png')).toBe('Bottoms');
  expect(filenameGarmentCategory('IMG_0012.jpg')).toBeNull();
  expect(suggestedGarmentName('Bottoms','丹寧藍')).toBe('丹寧藍下身');
 });
 it('keeps dark blue and purple garment samples in chromatic families',()=>{
  const pixels=(rgb)=>Array.from({length:16},()=>[...rgb,255]).flat();
  expect(analyzePixelData(pixels([35,50,85]),4,4).colorFamily).toBe('藍綠冷色系');
  expect(analyzePixelData(pixels([66,35,73]),4,4).colorFamily).toBe('紫紅神秘系');
 });
 it('weights a central colored garment over a dark neutral background',()=>{
  const pixels=Array.from({length:100},()=>[29,29,35,255]).flat();
  for(let y=2;y<8;y++)for(let x=3;x<7;x++)pixels.splice((y*10+x)*4,4,59,89,152,255);
  expect(analyzePixelData(pixels,10,10).colorFamily).toBe('藍綠冷色系');
 });
});
