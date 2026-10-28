import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { orderedOutfit } from '../../shared/outfitSelection.js';

test('outfit selection orders supported layers and rejects duplicate or unsupported multi-piece sets', () => {
  const top={id:'t',category:'Tops'},bottom={id:'b',category:'Bottoms'},outer={id:'o',category:'Outerwear'};
  assert.deepEqual(orderedOutfit([outer,bottom,top]).items.map(i=>i.id),['t','b','o']);
  assert.equal(orderedOutfit([top,{...top,id:'another'}]).valid,false);
  assert.equal(orderedOutfit([top,{category:'shoes'}]).valid,false);
  assert.equal(orderedOutfit([{category:'shoes'}]).valid,true);
  assert.equal(orderedOutfit([top,{category:'Trousers'},outer]).valid,true);
  assert.equal(orderedOutfit([top,{category:'Shorts'},outer]).valid,true);
});

test('sequential SQL admits atomically, gates each predecessor, preserves replay and releases stopped descendants', async () => {
  const db=new PGlite(), user=randomUUID(), other=randomUUID();
  const ids=[randomUUID(),randomUUID(),randomUUID()];
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    for(const name of ['20261022103816_youcam_commerce_jobs.sql','20261023091242_youcam_safety_and_recovery.sql','20261028055028_sequential_outfit_jobs.sql']) {
      await db.exec(await readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8'));
    }
    await db.query('insert into auth.users values($1),($2)',[user,other]);
    for(let i=0;i<3;i++) await db.query("insert into ootie_shop_products(id,user_id,title,image_path,category) values($1,$2,'garment',$3,$4)",[ids[i],user,`shop/${user}/${ids[i]}.jpg`,i===1?'lower_body':'upper_body']);
    await db.exec("update ootie_youcam_budget set unit_limit=100,reviewer_reserve_units=0,expires_at=now()+interval '1 day'");
    const enqueue=batch=>db.query('select * from enqueue_ootie_outfit($1,$2,$3,$4,false)',[batch,user,`person/${user}/photo.jpg`,ids]);
    const claim=()=>db.query('select * from claim_ootie_youcam_job($1,true)',[randomUUID()]);
    const batch=randomUUID(), initial=(await enqueue(batch)).rows;
    assert.deepEqual(initial.map(j=>j.sequence_index),[1,2,3]);
    assert.deepEqual((await enqueue(batch)).rows.map(j=>j.id),initial.map(j=>j.id));
    assert.equal((await db.query('select allocated_units from ootie_youcam_budget')).rows[0].allocated_units,6);
    assert.equal((await db.query('select * from claim_ootie_youcam_job($1)',[randomUUID()])).rows.length,0);
    assert.equal((await claim()).rows[0].id,initial[0].id);
    assert.equal((await claim()).rows.length,0);
    await assert.rejects(db.query('select delete_ootie_youcam_result($1,$2)',[initial[0].id,user]),/JOB_STILL_ACTIVE/);
    const previousPath=`ai-generated/${user}/${initial[0].id}.jpg`;
    await db.query("update ootie_youcam_jobs set status='succeeded',credit_state='consumed',result_path=$2,lease_token=null,lease_until=null where id=$1",[initial[0].id,previousPath]);
    const second=(await claim()).rows[0];
    assert.equal(second.id,initial[1].id); assert.equal(second.input_result_path,previousPath);
    assert.equal((await claim()).rows.length,0);
    // An uncertain provider submission never cascades into another billable step.
    await db.query("update ootie_youcam_jobs set status='submitting',lease_until=now()-interval '1 second' where id=$1",[second.id]);
    assert.equal((await claim()).rows.length,0);
    const remaining=(await db.query('select status,credit_state from ootie_youcam_jobs where id=$1',[initial[2].id])).rows[0];
    assert.deepEqual(remaining,{status:'failed',credit_state:'released'});
    assert.equal((await db.query('select allocated_units from ootie_youcam_budget')).rows[0].allocated_units,4);
    await claim();
    assert.equal((await db.query('select allocated_units from ootie_youcam_budget')).rows[0].allocated_units,4);
    // Free the explicit manual-review fixture for another scenario.
    await db.query("update ootie_youcam_jobs set status='failed' where id=$1",[second.id]);
    const cancelled=(await enqueue(randomUUID())).rows;
    assert.equal((await db.query('select cancel_ootie_youcam_job($1,$2) as ok',[cancelled[2].id,other])).rows[0].ok,false);
    assert.equal((await db.query('select cancel_ootie_youcam_job($1,$2) as ok',[cancelled[2].id,user])).rows[0].ok,true);
    assert.equal((await db.query('select allocated_units from ootie_youcam_budget')).rows[0].allocated_units,4);
    assert.equal((await claim()).rows.length,0);
    const final=(await enqueue(randomUUID())).rows;
    for(const row of final) {
      assert.equal((await claim()).rows[0].id,row.id);
      await db.query("update ootie_youcam_jobs set status='succeeded',credit_state='consumed',result_path=$2,lease_token=null,lease_until=null where id=$1",[row.id,`ai-generated/${user}/${row.id}.jpg`]);
    }
    assert.equal((await db.query('select delete_ootie_youcam_result($1,$2) as ok',[final[2].id,other])).rows[0].ok,false);
    assert.equal((await db.query('select delete_ootie_youcam_result($1,$2) as ok',[final[2].id,user])).rows[0].ok,true);
    assert.ok((await db.query('select result_deleted_at from ootie_youcam_jobs where id=$1',[final[2].id])).rows[0].result_deleted_at);
    await db.exec('set role authenticated');
    await assert.rejects(enqueue(randomUUID()),/permission denied/);
  } finally { await db.close(); }
});
