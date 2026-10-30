import {it,expect} from 'vitest';
import {studioPollDelay} from '../studioPolling';
it('backs off when idle/hidden, but keeps active and uncertain work responsive',()=>{
 expect(studioPollDelay()).toBe(60000);expect(studioPollDelay({jobs:[{status:'succeeded'}]})).toBe(60000);
 expect(studioPollDelay({pending:true})).toBe(15000);expect(studioPollDelay({jobs:[{status:'processing'}]})).toBe(15000);
 expect(studioPollDelay({hidden:true,pending:true})).toBe(120000);
});
