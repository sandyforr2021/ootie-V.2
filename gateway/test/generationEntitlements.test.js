import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('daily free images and unlimited point-funded generations use atomic billing',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql as $$select null::uuid$$;
   grant usage on schema public,auth to anon,authenticated,service_role;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table ootie_profiles(id uuid primary key,user_id uuid unique);
   create table ootie_point_transactions(id uuid primary key default gen_random_uuid(),profile_id uuid,amount integer,
    type text check(type in ('BIRTHDAY_BONUS','AI_USAGE','TRYON_USAGE','MANUAL_ADJUSTMENT','SUBSCRIPTION_GRANT','CREDIT_PURCHASE','PROMOTIONAL_REWARD')),
    source_key text,metadata jsonb,unique(profile_id,source_key));`);
  for(const name of ['20261022103816_youcam_commerce_jobs','20261023091242_youcam_safety_and_recovery','20261028055028_sequential_outfit_jobs',
   '20261028100841_platform_generation_points','20261028104917_member_daily_generation_limit','20261029104528_daily_free_images_and_point_access'])
   await db.exec(await readFile(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
  await db.exec("update ootie_youcam_budget set unit_limit=1000,reviewer_reserve_units=0,expires_at=now()+interval '1 day',per_user_daily_limit=2");
  async function member(points=0){
   const user=randomUUID(),profile=randomUUID(),ids=[randomUUID(),randomUUID(),randomUUID()];
   await db.query('insert into auth.users values($1)',[user]);await db.query('insert into ootie_profiles values($1,$2)',[profile,user]);
   for(const id of ids)await db.query("insert into ootie_shop_products(id,user_id,title,image_path,category)values($1,$2,'shirt','image','upper_body')",[id,user]);
   if(points)await db.query("insert into ootie_point_transactions(profile_id,amount,type,source_key)values($1,$2,'PROMOTIONAL_REWARD','grant')",[profile,points]);
   return{user,profile,ids,
    enqueue:(batch=randomUUID(),pieces=[ids[0]])=>db.query('select * from enqueue_ootie_outfit($1,$2,$3,$4,false)',[batch,user,`person/${user}/photo.jpg`,pieces]),
    cleanup:()=>db.query("select * from enqueue_ootie_youcam($1,$2,$3,'{}','garment_cleanup',false)",[randomUUID(),user,`shop/${user}/cleanup.jpg`]),
    balance:async()=>Number((await db.query('select ootie_platform_point_balance($1) n',[user])).rows[0].n),
    quota:async()=>(await db.query('select get_ootie_youcam_user_quota($1) q',[user])).rows[0].q};
  }
  const done=batch=>db.query("update ootie_youcam_jobs set status='succeeded',result_path='result' where batch_id=$1",[batch]);
  await t.test('Pacific midnight follows daylight saving rather than a fixed UTC offset',async()=>{
   const result=await db.query("select (timestamptz '2026-01-15 07:59:59+00' at time zone 'America/Los_Angeles')::date::text winter_before,(timestamptz '2026-01-15 08:00:00+00' at time zone 'America/Los_Angeles')::date::text winter_after,(timestamptz '2026-07-15 06:59:59+00' at time zone 'America/Los_Angeles')::date::text summer_before,(timestamptz '2026-07-15 07:00:00+00' at time zone 'America/Los_Angeles')::date::text summer_after");
   assert.deepEqual(result.rows[0],{winter_before:'2026-01-14',winter_after:'2026-01-15',summer_before:'2026-07-14',summer_after:'2026-07-15'});
  });
  await t.test('zero points: two free final images, whole outfit and replay',async()=>{
   const m=await member(),batch=randomUUID(),jobs=(await m.enqueue(batch,m.ids)).rows;
   assert.deepEqual(jobs.map(j=>j.platform_points),[0,0,0]);assert.deepEqual(jobs.map(j=>j.sequence_index),[1,2,3]);
   assert.equal(jobs[1].previous_job_id,jobs[0].id);assert.equal((await m.quota()).freeGenerationUsed,1);
   await m.enqueue(batch,m.ids);assert.equal((await m.quota()).freeGenerationUsed,1);await done(batch);
   await m.cleanup();assert.equal((await m.quota()).freeGenerationUsed,2);await assert.rejects(m.enqueue(),/DAILY_FREE_LIMIT/);
   assert.equal(await m.balance(),0);assert.equal((await db.query('select count(*) n from ootie_point_transactions where profile_id=$1',[m.profile])).rows[0].n,0);
  });
  await t.test('points: more than two results, then free fallback, then top-up',async()=>{
   const m=await member(12);
   for(let i=0;i<6;i++){const batch=randomUUID();assert.equal((await m.enqueue(batch)).rows[0].platform_points,2);await done(batch);}
   assert.equal(await m.balance(),0);assert.equal((await m.quota()).freeGenerationUsed,0);
   for(let i=0;i<2;i++){const batch=randomUUID();assert.equal((await m.enqueue(batch)).rows[0].platform_points,0);await done(batch);}
   await assert.rejects(m.enqueue(),/DAILY_FREE_LIMIT/);
   await db.query("insert into ootie_point_transactions(profile_id,amount,type,source_key)values($1,6,'CREDIT_PURCHASE','verified-test-payment')",[m.profile]);
   const batch=randomUUID();assert.deepEqual((await m.enqueue(batch,m.ids)).rows.map(j=>j.platform_points),[2,2,2]);
   assert.equal(await m.balance(),0);assert.equal((await m.quota()).freeGenerationUsed,2);await done(batch);
  });
  await t.test('insufficient outfit balance: no partial debit',async()=>{
   const m=await member(4),batch=randomUUID();assert.deepEqual((await m.enqueue(batch,m.ids)).rows.map(j=>j.platform_points),[0,0,0]);
   assert.equal(await m.balance(),4);await done(batch);
   assert.equal((await m.cleanup()).rows[0].platform_points,2);assert.equal(await m.balance(),2);
  });
  await t.test('pending/review holds a free slot, stopped failure/cancellation restores it',async()=>{
   const m=await member(),batch=randomUUID(),jobs=(await m.enqueue(batch,m.ids)).rows;
   await db.query("update ootie_youcam_jobs set status='needs_review' where id=$1",[jobs[0].id]);
   await db.query("update ootie_youcam_jobs set status='failed' where batch_id=$1 and id<>$2",[batch,jobs[0].id]);
   assert.equal((await m.quota()).freeGenerationUsed,1);
   await db.query("update ootie_youcam_jobs set status='failed' where id=$1",[jobs[0].id]);assert.equal((await m.quota()).freeGenerationUsed,0);
   const one=(await m.cleanup()).rows[0];await db.query('select cancel_ootie_youcam_job($1,$2)',[one.id,m.user]);assert.equal((await m.quota()).freeGenerationUsed,0);
  });
  await t.test('refund once; successful deletion does not restore quota; Pacific date reset',async()=>{
   const m=await member(6),batch=randomUUID(),jobs=(await m.enqueue(batch,m.ids)).rows;assert.equal(await m.balance(),0);
   await db.query("update ootie_youcam_jobs set status='succeeded' where id=$1",[jobs[0].id]);
   await db.query("update ootie_youcam_jobs set status='failed' where id=$1",[jobs[1].id]);
   await db.query("update ootie_youcam_jobs set status='cancelled' where batch_id=$1 and status='queued'",[batch]);assert.equal(await m.balance(),6);
   await db.query("update ootie_youcam_jobs set status='cancelled' where id=$1",[jobs[1].id]);assert.equal(await m.balance(),6);
   const free=await member(),id=randomUUID(),result=(await free.enqueue(id)).rows[0];await done(id);
   await db.query('select delete_ootie_youcam_result($1,$2)',[result.id,free.user]);assert.equal((await free.quota()).freeGenerationUsed,1);
   await db.query("update ootie_youcam_batches set billing_day=(now() at time zone 'America/Los_Angeles')::date-1 where id=$1",[id]);assert.equal((await free.quota()).freeGenerationUsed,0);
  });
  await t.test('account isolation, simultaneous requests, ownership and global guardrails',async()=>{
   const m=await member(),other=await member();await assert.rejects(m.enqueue(randomUUID(),[other.ids[0]]),/PRODUCT_NOT_OWNED/);
   const attempts=await Promise.allSettled([m.enqueue(),m.enqueue(),m.enqueue()]);assert.equal(attempts.filter(r=>r.status==='fulfilled').length,2);
   assert.match(attempts.find(r=>r.status==='rejected').reason.message,/DAILY_FREE_LIMIT/);assert.equal((await other.quota()).freeGenerationUsed,0);
   await db.exec('update ootie_youcam_budget set unit_limit=allocated_units');await assert.rejects(other.enqueue(),/FREE_BUDGET_EXHAUSTED/);
   await db.exec('set role authenticated');await assert.rejects(other.enqueue(),/permission denied/);
   await assert.rejects(db.query('select ootie_daily_free_image_count($1)',[other.user]),/permission denied/);await db.exec('reset role');
  });
 }finally{await db.close();}
});
