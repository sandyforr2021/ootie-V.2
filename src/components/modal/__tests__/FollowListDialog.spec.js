import {it,expect,vi} from 'vitest';
import {mount,flushPromises} from '@vue/test-utils';
const load=vi.hoisted(()=>vi.fn());
vi.mock('@/services/socialRepository',()=>({loadProfileConnections:load}));
import FollowListDialog from '../FollowListDialog.vue';
it('discards an old profile response after the displayed profile changes',async()=>{let finish;load.mockReturnValueOnce(new Promise(resolve=>finish=resolve)).mockResolvedValueOnce([{id:'new',username:'new-user',display_name:'New user'}]);const w=mount(FollowListDialog,{props:{open:true,profileId:'old',kind:'following'},global:{stubs:{RouterLink:{template:'<a><slot/></a>'}}}});await w.setProps({profileId:'new'});await flushPromises();finish([{id:'old',username:'old-user',display_name:'Old user'}]);await flushPromises();expect(w.text()).toContain('New user');expect(w.text()).not.toContain('Old user');w.unmount();});
