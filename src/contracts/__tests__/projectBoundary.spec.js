import { it,expect } from 'vitest';
import { assertOotieProject } from '../projectBoundary';
it('accepts only the intended OOTIE project, blocking the independent drumstand project',()=>{
  expect(assertOotieProject('https://hoxkrmadzjnyjaqjbyxc.supabase.co')).toContain('hoxkrmadzjnyjaqjbyxc');
  expect(()=>assertOotieProject('https://iaswunanvtuwgmxpdbdd.supabase.co')).toThrow('OOTIE_PROJECT_MISMATCH');
  expect(()=>assertOotieProject('https://hoxkrmadzjnyjaqjbyxc.supabase.co.attacker.test')).toThrow();
});
