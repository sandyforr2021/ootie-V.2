import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {mount} from '@vue/test-utils';
import {createPinia,setActivePinia} from 'pinia';
import {useAuthStore} from '@/stores/auth';
import {useAppStore} from '@/stores/app';
import {setLocale} from '@/i18n';
import WardrobeBoard from '../WardrobeBoard.vue';
vi.mock('@/stores/closet',()=>({useClosetStore:()=>({remoteState:{status:'success'}})}));
let wrapper,auth,app;
const profile=id=>({status:'PROFILE_READY',profileId:id,profile:{id}});
const render=()=>wrapper=mount(WardrobeBoard,{global:{stubs:{RouterLink:{template:'<a><slot /></a>'}}}});
describe('personal wardrobe board',()=>{
 beforeEach(()=>{localStorage.clear();setLocale('zh-TW');setActivePinia(createPinia());auth=useAuthStore();app=useAppStore();auth.session={user:{id:'owner-auth'}};auth.user=auth.session.user;auth.profileIdentity=profile('owner');app.items=[{id:'shirt',owner_id:'owner',category:'Tops',name:'My shirt'},{id:'pants',owner_id:'owner',category:'Bottoms',name:'My pants'},{id:'private-other',owner_id:'other',category:'Tops',name:'Other private shirt'},{id:'hidden',owner_id:'owner',hidden:true,name:'Hidden shirt'}];});
 afterEach(()=>{wrapper?.unmount();vi.restoreAllMocks();});
 it('filters by actual owner and category and never displays stale cross-account selections',async()=>{localStorage.setItem('ootie-wardrobe-board-v1:owner',JSON.stringify(['shirt','private-other','hidden']));render();expect(wrapper.findAll('.board-canvas figure')).toHaveLength(1);expect(wrapper.text()).not.toContain('Other private shirt');expect(wrapper.text()).not.toContain('Hidden shirt');await wrapper.findAll('.board-filters button')[2].trigger('click');expect(wrapper.findAll('.board-items button').map(x=>x.text())).toEqual(['My pants']);auth.profileIdentity=profile('other');await wrapper.vm.$nextTick();expect(wrapper.findAll('.board-canvas figure')).toHaveLength(0);});
 it('restores a saved selection after remount and does not invoke generation',async()=>{render();await wrapper.find('.board-items button').trigger('click');await wrapper.find('.board-save button').trigger('click');expect(wrapper.find('[role=status]').text()).toContain('已儲存');wrapper.unmount();render();expect(wrapper.findAll('.board-canvas figure')).toHaveLength(1);expect(wrapper.text()).toContain('不會使用試穿額度');});
 it('retains the board and reports failure when browser storage rejects a save',async()=>{render();await wrapper.find('.board-items button').trigger('click');vi.spyOn(localStorage,'setItem').mockImplementation(()=>{throw Error('Quota');});await wrapper.find('.board-save button').trigger('click');expect(wrapper.find('[role=alert]').text()).toContain('無法儲存');expect(wrapper.findAll('.board-canvas figure')).toHaveLength(1);expect(wrapper.find('.board-save button').attributes('disabled')).toBeUndefined();});
});
