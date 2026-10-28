import { describe, expect, it } from 'vitest';
import { outfitDate, outfitColorScore, recommendDailyOutfit } from '../dailyOutfit';
const garment = (id, category, extra = {}) => ({id, owner_id:'me', photo:'photo.jpg', category, primary_color:'White', ...extra});
const input = {profileId:'me',weather:{temperature:24,apparent:24,timezone:'Asia/Taipei'},date:'2026-10-28'};
const ids = pieces => pieces.map(item=>item.id);
describe('daily wardrobe suggestions', () => {
  it('stays stable in one day and rotates core outfits on the next day', () => {
    const items=[garment('a','Tops'),garment('b','Tops'),garment('c','Tops'),garment('p','Trousers')];
    const today=recommendDailyOutfit({...input,items});
    expect(ids(recommendDailyOutfit({...input,items:[...items].reverse()}))).toEqual(ids(today));
    expect(ids(recommendDailyOutfit({...input,items,date:'2026-10-29'}))).not.toEqual(ids(today));
  });
  it('only uses this account, visible owned items and real tagged OOTD history', () => {
    const items=[garment('old','Tops'),garment('fresh','Tops'),garment('p','Trousers'),garment('other','Tops',{owner_id:'them'}),garment('hidden','Tops',{hidden:'true'})];
    const posts=[{user_id:'me',created_at:'2026-10-27T12:00:00Z',item_ids:['old','old']},{user_id:'them',created_at:'2026-10-27T12:00:00Z',item_ids:['fresh']}];
    expect(ids(recommendDailyOutfit({...input,items,posts}))).toEqual(['fresh','p']);
    expect(recommendDailyOutfit({...input,items,profileId:null})).toEqual([]);
  });
  it('prefers covered legs and an outer layer in cold weather', () => {
    const items=[garment('top','Tops'),garment('shorts','Shorts'),garment('pants','Trousers'),garment('jacket','Jackets')];
    expect(ids(recommendDailyOutfit({...input,items,weather:{temperature:9}}))).toEqual(['top','pants','jacket']);
  });
  it('takes occasion and color compatibility into account', () => {
    const items=[garment('shirt','Tops',{name:'Oxford shirt',style:'Smart Casual'}),garment('tee','Tops',{name:'Tee',style:'Casual'}),garment('p','Trousers')];
    const posts=[{user_id:'me',created_at:'2026-10-01T00:00:00Z',item_ids:['shirt']}];
    expect(ids(recommendDailyOutfit({...input,items,posts,occasion:'work'}))).toContain('shirt');
    expect(outfitColorScore({color_hex:'#cc3355'},{color_hex:'#eeeeee'})).toBeGreaterThan(outfitColorScore({color_hex:'#cc3355'},{color_hex:'#aa33cc'}));
  });
  it('uses the selected city date across midnight and ignores invalid history dates', () => {
    expect(outfitDate(Date.parse('2026-10-28T17:00:00Z'),'Asia/Taipei')).toBe('2026-10-29');
    expect(outfitDate(Date.parse('2026-10-28T17:00:00Z'),'America/New_York')).toBe('2026-10-28');
    expect(()=>recommendDailyOutfit({...input,items:[garment('a','Tops')],posts:[{user_id:'me',created_at:'bad'}]})).not.toThrow();
  });
  it('can suggest a dress without overlapping separates and handles an empty wardrobe', () => {
    const result=recommendDailyOutfit({...input,items:[garment('dress','Dress'),garment('shoes','Shoes')]});
    expect(result[0].slot).toBe('dress');
    expect(ids(result)).toEqual(['dress','shoes']);
    expect(recommendDailyOutfit({...input,items:[]})).toEqual([]);
  });
});
