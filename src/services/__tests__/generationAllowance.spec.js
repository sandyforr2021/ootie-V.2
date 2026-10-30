import {describe,it,expect} from 'vitest';
import {generationQuote} from '../../../shared/generationAllowance.js';

describe('generation allowance quote',()=>{
 it('prefers points for the whole outfit and falls back without partial charge',()=>{
  expect(generationQuote({generationPolicyVersion:2,pointBalance:6,dailyFreeGenerationRemaining:2},3)).toEqual({allowed:true,mode:'points',points:6});
  expect(generationQuote({generationPolicyVersion:2,pointBalance:4,dailyFreeGenerationRemaining:2},3)).toEqual({allowed:true,mode:'daily_free',points:0});
 });
 it('never treats an unverified balance or free counter as free allowance',()=>{
  expect(generationQuote({generationPolicyVersion:2,pointBalance:null,dailyFreeGenerationRemaining:2}).allowed).toBe(false);
  expect(generationQuote({generationPolicyVersion:2,pointBalance:0}).allowed).toBe(false);
  expect(generationQuote({generationPolicyVersion:2,pointBalance:-1,dailyFreeGenerationRemaining:2}).allowed).toBe(false);
 });
 it('does not advertise free generation before the database policy is installed',()=>{
  expect(generationQuote({pointBalance:0,dailyFreeGenerationRemaining:2}).allowed).toBe(false);
  expect(generationQuote({pointBalance:10,dailyGenerationRemaining:0}).allowed).toBe(false);
 });
});
