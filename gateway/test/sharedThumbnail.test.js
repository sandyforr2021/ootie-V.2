import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {SupabaseGateway} from '../src/services/supabaseGateway.js';
const owner='11111111-1111-4111-8111-111111111111',itemId='33333333-3333-4333-8333-333333333333';
const path=`closet/${owner}/${itemId}/operation/display.webp`;
const config={supabase:{url:'https://project.supabase.co',publishableKey:'publishable',serviceRoleKey:'server-test',aiBucket:'ootie-ai-private'}};
test('thumbnail reads remain viewer-authorized and fall back only on a missing derivative',async()=>{
 const bytes=await sharp({create:{width:256,height:256,channels:3,background:'white'}}).webp().toBuffer();
 for(const missing of [false,true]){
  const calls=[];
  const gateway=new SupabaseGateway({config,fetchImpl:async(url,options)=>{
   calls.push({url,options});
   if(url.includes('/ootie_clothing_items?'))return Response.json([{id:itemId,owner_id:'22222222-2222-4222-8222-222222222222',photo_display_path:path}]);
   if(url.includes('/ootie_profiles?'))return Response.json([{user_id:owner}]);
   if(missing&&url.endsWith('display.list-v1.webp'))return new Response(null,{status:404});
   return new Response(bytes,{headers:{'content-type':'image/webp'}});
  }});
  await gateway.sharedClothingImage({accessToken:'viewer-session'},itemId,{thumbnail:true});
  assert.equal(calls[0].options.headers.Authorization,'Bearer viewer-session');
  const reads=calls.filter(c=>c.url.includes('/storage/'));
  assert.ok(reads[0].url.endsWith('display.list-v1.webp'));
  assert.equal(reads.length,missing?2:1);
  if(missing)assert.ok(reads[1].url.endsWith('/display.webp'));
 }
});
