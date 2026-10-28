import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

test('SOS migration keeps ownership boundaries and cascades only the requested post', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.ootie_profiles (id uuid primary key, user_id uuid not null, public_closet boolean not null);
      create table public.ootie_clothing_items (id uuid primary key, owner_id uuid not null references public.ootie_profiles(id));
      create table public.ootie_shop_products (state text constraint ootie_shop_products_state_check check (state in ('wishlist','kept','dismissed','purchased')));
      create table public.ootie_sos_posts (id uuid primary key, user_id uuid not null references public.ootie_profiles(id), closet_owner_id uuid not null references public.ootie_profiles(id), closet_item_ids uuid[] not null);
      create table public.ootie_outfit_suggestions (id uuid primary key, sos_id uuid not null constraint ootie_outfit_suggestions_sos_id_fkey references public.ootie_sos_posts(id), user_id uuid not null);
      alter table public.ootie_sos_posts enable row level security;
      create policy read_sos on public.ootie_sos_posts for select to authenticated using (true);
      create policy insert_sos on public.ootie_sos_posts for insert to authenticated with check (user_id = (select p.id from public.ootie_profiles p where p.user_id = auth.uid()));
      create policy delete_sos on public.ootie_sos_posts for delete to authenticated using (user_id = (select p.id from public.ootie_profiles p where p.user_id = auth.uid()));
      grant usage on schema public, auth to authenticated;
      grant select on public.ootie_profiles, public.ootie_clothing_items to authenticated;
      grant select, insert, delete on public.ootie_sos_posts to authenticated;
      insert into public.ootie_profiles values
        ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
        ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
      insert into public.ootie_clothing_items values
        ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111'),
        ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222');
    `);
    await db.exec(await readFile('supabase/migrations/20261028033412_studio_and_sos_updates.sql', 'utf8'));
    await db.exec(`set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'`);
    const ownerPost = `insert into public.ootie_sos_posts (id,user_id,closet_owner_id,closet_item_ids,cover_item_id,cover_url,cover_path) values ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',array['33333333-3333-4333-8333-333333333333'::uuid], '33333333-3333-4333-8333-333333333333', 'https://example.org/cover.jpg', 'ootd/owner/cover.jpg')`;
    await db.exec(ownerPost);
    await assert.rejects(db.exec(`insert into public.ootie_sos_posts (id,user_id,closet_owner_id,closet_item_ids) values ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',array['44444444-4444-4444-8444-444444444444'::uuid])`), /SOS items must belong/);
    await assert.rejects(db.exec(`insert into public.ootie_sos_posts (id,user_id,closet_owner_id,closet_item_ids,cover_item_id) values ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',array['33333333-3333-4333-8333-333333333333'::uuid], '44444444-4444-4444-8444-444444444444')`), /check constraint/);
    await assert.rejects(db.exec(`insert into public.ootie_sos_posts (id,user_id,closet_owner_id,closet_item_ids) values ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',array['33333333-3333-4333-8333-333333333333'::uuid])`), /SOS items must belong/);
    await db.exec(`reset role; insert into public.ootie_outfit_suggestions values ('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222'); set role authenticated; set request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'`);
    await assert.rejects(db.exec(`insert into public.ootie_sos_posts (id,user_id,closet_owner_id,closet_item_ids) values ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222',array['44444444-4444-4444-8444-444444444444'::uuid])`), /SOS items must belong/);
    assert.equal((await db.query(`delete from public.ootie_sos_posts where id='55555555-5555-4555-8555-555555555555' returning id`)).rows.length, 0);
    await db.exec(`set request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'`);
    assert.equal((await db.query(`delete from public.ootie_sos_posts where id='55555555-5555-4555-8555-555555555555' returning id`)).rows.length, 1);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int as count from public.ootie_outfit_suggestions')).rows[0].count, 0);
  } finally { await db.close(); }
});
