import {describe,it,expect,vi,beforeEach} from 'vitest';
import {mount,flushPromises} from '@vue/test-utils';
const state=vi.hoisted(()=>({auth:{isMember:true,profileId:'me'},loadComments:vi.fn(async()=>true),remove:vi.fn(async()=>true)}));
vi.mock('@/stores/auth',()=>({useAuthStore:()=>state.auth}));
vi.mock('@/stores/app',()=>({useAppStore:()=>({})}));
vi.mock('@/stores/ootd',()=>({useOotdStore:()=>({loadComments:state.loadComments})}));
vi.mock('@/services/postComments',()=>({deletePostComment:state.remove}));
import PostComments from '../PostComments.vue';
import {setLocale} from '@/i18n';
const render=()=>mount(PostComments,{props:{post:{id:'post',comments:2,commentList:[{id:'mine',profile_id:'me',text:'My comment'},{id:'theirs',profile_id:'other',text:'Other comment'}]}},global:{stubs:{RouterLink:{template:'<a><slot/></a>'}}}});
beforeEach(()=>{setLocale('zh-TW');state.remove.mockReset().mockResolvedValue(true);state.loadComments.mockClear();});
describe('active post comment UI',()=>{
 it('offers deletion only for the signed-in author and reloads after confirmed deletion',async()=>{
  const w=render();await flushPromises();
  expect(w.findAll('.comment-delete')).toHaveLength(1);
  await w.find('.comment-delete').trigger('click');await flushPromises();
  expect(state.remove).toHaveBeenCalledWith({id:'mine',profileId:'me',postId:'post'});
  expect(state.loadComments).toHaveBeenCalledTimes(2);w.unmount();
 });
 it('shows an error after failed deletion rather than claiming success',async()=>{
  state.remove.mockRejectedValue(new Error('offline'));const w=render();await flushPromises();
  await w.find('.comment-delete').trigger('click');await flushPromises();
  expect(w.find('[role=alert]').text()).toContain('留言未刪除');
  expect(state.loadComments).toHaveBeenCalledTimes(1);w.unmount();
 });
});
