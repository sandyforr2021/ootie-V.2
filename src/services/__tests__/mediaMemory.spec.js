import {describe,it,expect,vi,afterEach} from 'vitest';
import {registerMedia,acquireMedia,releaseMedia,clearMediaMemory,fullMediaId} from '../mediaMemory';
afterEach(()=>{clearMediaMemory();vi.restoreAllMocks();});
describe('session media cache',()=>{
 it('coalesces concurrent requests for the same account and version',async()=>{
  const load=vi.fn(async()=>'blob:one'),id=registerMedia('a','path:v1',load);
  expect(registerMedia('a','path:v1',load)).toBe(id);
  expect(await Promise.all([acquireMedia(id),acquireMedia(id)])).toEqual(['blob:one','blob:one']);expect(load).toHaveBeenCalledTimes(1);
  expect(registerMedia('a','path:v2',load)).not.toBe(id);expect(registerMedia('b','path:v1',load)).toBe('');
 });
 it('revokes late results after logout and allows a new account',async()=>{
  const revoke=vi.spyOn(URL,'revokeObjectURL');let finish;
  const id=registerMedia('a','image',()=>new Promise(resolve=>{finish=resolve;}));
  const pending=acquireMedia(id);await Promise.resolve();clearMediaMemory();finish('blob:old');
  await expect(pending).rejects.toThrow('MEDIA_SESSION_EXPIRED');expect(revoke).toHaveBeenCalledWith('blob:old');
  expect(await acquireMedia(registerMedia('b','image',async()=>'blob:new'))).toBe('blob:new');
 });
 it('keeps thumbnail and full image separate and reloads evicted idle images',async()=>{
  const thumb=vi.fn(async()=>'blob:thumb'),full=vi.fn(async()=>'blob:full');const id=registerMedia('a','v1',thumb,full);
  expect(await acquireMedia(id)).toBe('blob:thumb');expect(full).not.toHaveBeenCalled();releaseMedia(id);
  expect(await acquireMedia(fullMediaId(id))).toBe('blob:full');
  for(let i=0;i<30;i++){const key=registerMedia('a',`extra:${i}`,async()=>`blob:${i}`);await acquireMedia(key);releaseMedia(key);}
  expect(await acquireMedia(id)).toBe('blob:thumb');expect(thumb).toHaveBeenCalledTimes(2);
 });
});
