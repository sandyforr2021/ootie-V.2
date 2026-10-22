import { describe,it,expect,vi } from 'vitest';
import { createCommerceClient, wardrobeMatches, categoryFamily, safeCommerceUrl, personalPalette } from '../commerce';
describe('commerce client and wardrobe pairing',()=>{
  it('does not automatically retry a possibly accepted POST',async()=>{
    const fetchImpl=vi.fn(async()=>{throw new Error('network');});
    await expect(createCommerceClient({baseUrl:'https://gateway.test',fetchImpl}).request('jobs','token',{batchId:'stable'})).rejects.toMatchObject({code:'NETWORK_UNCERTAIN'});
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('only pairs owned, visible, complementary items and reads saved hex colors',()=>{
    const item={category:'Bottoms',color_hex:'#eeeeee',primary_color:'白色'};
    const matches=wardrobeMatches({category:'upper_body',color:'#cc8800'},[
      {...item,id:'a',owner_id:'mine'}, {...item,id:'b',owner_id:'other'}, {...item,id:'c',owner_id:'mine',hidden:true}, {...item,id:'d',owner_id:'mine',category:'Tops'}
    ],'mine');
    expect(matches.map(m=>m.item.id)).toEqual(['a']);expect(matches[0].reason).toBe('neutral');expect(categoryFamily('連身裙')).toBe('full_body');
  });
  it('blocks executable purchase URLs and requires a valid skin color',()=>{
    expect(safeCommerceUrl('javascript:alert(1)')).toBe('');expect(safeCommerceUrl('https://user:pass@shop.test')).toBe('');
    expect(personalPalette({skin_color:'invalid'})).toEqual([]);expect(personalPalette({skin_color:'#ae8766'})).toHaveLength(3);
  });
});
