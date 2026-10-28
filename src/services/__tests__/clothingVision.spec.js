import {describe,it,expect,vi,afterEach} from 'vitest';
import {identifyClothing} from '../clothingVision';
import {garmentSuggestion} from '../clothingVisionLabels';
describe('local garment identification',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('releases worker resources when the user changes or closes the image',async()=>{
  const terminate=vi.fn(),postMessage=vi.fn();
  vi.stubGlobal('Worker',class{constructor(){this.terminate=terminate;this.postMessage=postMessage;}});
  const controller=new AbortController();
  const promise=identifyClothing(new Blob(['pixels']),{signal:controller.signal});
  controller.abort();
  await expect(promise).rejects.toMatchObject({name:'AbortError'});
  expect(terminate).toHaveBeenCalledTimes(1);
 });
 it('declines ambiguous or non-garment pictures instead of assigning a confident class',()=>{
  expect(garmentSuggestion([{label:'a pair of trousers',score:.28},{label:'a t-shirt',score:.26}])).toBeNull();
  expect(garmentSuggestion([{label:'something other than clothing',score:.8}])).toBeNull();
  expect(garmentSuggestion([{label:'a pair of trousers',score:.6},{label:'a t-shirt',score:.1}])).toEqual({category:'Bottoms',nameKey:'長褲'});
 });
});
