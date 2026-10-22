-- Additive competition schema. Does not alter or erase the original OOTIE tables.
begin;
create table public.ootie_shop_products (
  id uuid primary key, user_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 160),
  source_url text not null default '', image_path text not null,
  category text not null check (category in ('upper_body','lower_body','full_body','shoes','auto')),
  color text not null default '#c8bba9' check (color ~ '^#[0-9a-fA-F]{6}$'),
  state text not null default 'wishlist' check (state in ('wishlist','kept','dismissed','purchased')),
  created_at timestamptz not null default now()
);
create index on public.ootie_shop_products(user_id, created_at desc);

create table public.ootie_youcam_budget (
  id boolean primary key default true check (id),
  unit_limit integer not null default 0 check (unit_limit between 0 and 1000),
  allocated_units integer not null default 0 check (allocated_units >= 0),
  expires_at timestamptz,
  check (allocated_units <= unit_limit)
);
-- Fail closed until a verified free-credit budget and expiry are set by the owner.
insert into public.ootie_youcam_budget(id) values(true);

create table public.ootie_youcam_batches (
  id uuid primary key, user_id uuid not null references auth.users(id),
  request_hash text not null, created_at timestamptz not null default now()
);
create table public.ootie_youcam_jobs (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.ootie_youcam_batches(id),
  user_id uuid not null references auth.users(id), product_id uuid references public.ootie_shop_products(id),
  kind text not null check (kind in ('try_on','skin_tone')),
  garment_category text, person_path text not null, product_path text,
  status text not null default 'queued' check (status in ('queued','preparing','submitting','processing','succeeded','failed','needs_review','cancelled')),
  units integer not null check (units in (2,20)),
  provider_task_id text, result_path text, result_data jsonb, error_code text,
  lease_token uuid, lease_until timestamptz, next_poll_at timestamptz not null default now(),
  poll_errors integer not null default 0,
  created_at timestamptz not null default now(), completed_at timestamptz,
  check ((kind = 'skin_tone' and units = 20 and product_id is null) or (kind = 'try_on' and units = 2 and product_id is not null))
);
create index on public.ootie_youcam_jobs(user_id, created_at desc);
create index on public.ootie_youcam_jobs(next_poll_at, created_at) where status in ('queued','preparing','submitting','processing');
create unique index on public.ootie_youcam_jobs(provider_task_id) where provider_task_id is not null;

create table public.ootie_shop_posts (
  id uuid primary key, user_id uuid not null references auth.users(id),
  job_id uuid not null unique references public.ootie_youcam_jobs(id),
  title text not null, caption text not null check(char_length(caption) <= 800),
  image_url text not null, source_url text not null default '',
  created_at timestamptz not null default now()
);
create table public.ootie_commerce_events (
  id uuid primary key, user_id uuid not null references auth.users(id),
  product_id uuid references public.ootie_shop_products(id), post_id uuid references public.ootie_shop_posts(id),
  event_type text not null check(event_type in ('purchase_click','share_link')),
  created_at timestamptz not null default now(),
  check ((product_id is null) <> (post_id is null))
);

alter table public.ootie_shop_products enable row level security;
alter table public.ootie_youcam_batches enable row level security;
alter table public.ootie_youcam_jobs enable row level security;
alter table public.ootie_youcam_budget enable row level security;
alter table public.ootie_shop_posts enable row level security;
alter table public.ootie_commerce_events enable row level security;
create policy shop_products_owner_read on public.ootie_shop_products for select to authenticated using ((select auth.uid()) = user_id);
create policy shop_batches_owner_read on public.ootie_youcam_batches for select to authenticated using ((select auth.uid()) = user_id);
create policy shop_jobs_owner_read on public.ootie_youcam_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy shop_events_owner_read on public.ootie_commerce_events for select to authenticated using ((select auth.uid()) = user_id);
-- Public posts are projected by the gateway; user IDs and task metadata stay private.
create policy shop_posts_owner_read on public.ootie_shop_posts for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.ootie_shop_products, public.ootie_youcam_batches, public.ootie_youcam_jobs, public.ootie_youcam_budget, public.ootie_shop_posts, public.ootie_commerce_events from anon, authenticated;
grant select on public.ootie_shop_products, public.ootie_youcam_batches, public.ootie_youcam_jobs, public.ootie_shop_posts, public.ootie_commerce_events to authenticated;
grant all on public.ootie_shop_products, public.ootie_youcam_batches, public.ootie_youcam_jobs, public.ootie_youcam_budget, public.ootie_shop_posts, public.ootie_commerce_events to service_role;

create function public.enqueue_ootie_youcam(p_batch_id uuid, p_user_id uuid, p_person_path text, p_product_ids uuid[], p_kind text)
returns setof public.ootie_youcam_jobs language plpgsql security invoker set search_path = '' as $$
declare v_budget public.ootie_youcam_budget; v_batch public.ootie_youcam_batches; v_hash text; v_cost integer; v_count integer;
begin
  if p_kind not in ('try_on','skin_tone') or p_kind is null then raise exception 'INVALID_JOB_KIND'; end if;
  if p_person_path not like 'person/' || p_user_id::text || '/%' or p_person_path like '%..%' then raise exception 'PERSON_IMAGE_NOT_OWNED'; end if;
  v_count := coalesce(cardinality(p_product_ids),0);
  if (p_kind = 'try_on' and (v_count < 1 or v_count > 3)) or (p_kind = 'skin_tone' and v_count <> 0) then raise exception 'INVALID_BATCH'; end if;
  v_hash := md5(jsonb_build_array(p_person_path, p_product_ids, p_kind)::text);
  -- One global budget lock serializes concurrent batches and idempotency checks.
  select * into v_budget from public.ootie_youcam_budget where id = true for update;
  select * into v_batch from public.ootie_youcam_batches where id = p_batch_id;
  if found then
    if v_batch.user_id <> p_user_id or v_batch.request_hash <> v_hash then raise exception 'BATCH_CONFLICT'; end if;
    return query select * from public.ootie_youcam_jobs where batch_id = p_batch_id and user_id = p_user_id;
    return;
  end if;
  if p_kind = 'try_on' and (select count(*) from public.ootie_shop_products where id = any(p_product_ids) and user_id = p_user_id) <> v_count then raise exception 'PRODUCT_NOT_OWNED'; end if;
  v_cost := case when p_kind = 'skin_tone' then 20 else 2 * v_count end;
  if v_budget.unit_limit is null or v_budget.expires_at is null or v_budget.expires_at <= now()
    or v_budget.allocated_units + v_cost > v_budget.unit_limit then raise exception 'FREE_BUDGET_EXHAUSTED'; end if;
  insert into public.ootie_youcam_batches(id,user_id,request_hash) values(p_batch_id,p_user_id,v_hash);
  update public.ootie_youcam_budget set allocated_units = allocated_units + v_cost where id = true;
  if p_kind = 'skin_tone' then
    insert into public.ootie_youcam_jobs(batch_id,user_id,kind,person_path,units) values(p_batch_id,p_user_id,p_kind,p_person_path,20);
  else
    insert into public.ootie_youcam_jobs(batch_id,user_id,product_id,kind,person_path,product_path,garment_category,units)
    select p_batch_id,p_user_id,id,p_kind,p_person_path,image_path,category,2 from public.ootie_shop_products where id = any(p_product_ids) and user_id = p_user_id;
  end if;
  return query select * from public.ootie_youcam_jobs where batch_id = p_batch_id and user_id = p_user_id order by created_at;
end $$;

create function public.claim_ootie_youcam_job(p_lease uuid)
returns setof public.ootie_youcam_jobs language plpgsql security invoker set search_path = '' as $$
declare v_job public.ootie_youcam_jobs;
begin
  -- Unknown submission outcomes never repeat a billable POST.
  update public.ootie_youcam_jobs set status='needs_review', error_code='SUBMISSION_UNCERTAIN', lease_token=null, lease_until=null
    where status='submitting' and lease_until < now() and provider_task_id is null;
  select * into v_job from public.ootie_youcam_jobs
    where status in ('queued','preparing','processing') and next_poll_at <= now() and (lease_until is null or lease_until < now())
    order by next_poll_at, created_at for update skip locked limit 1;
  if not found then return; end if;
  return query update public.ootie_youcam_jobs set lease_token=p_lease, lease_until=now()+interval '180 seconds',
    status=case when status in ('queued','preparing') then 'preparing' else status end
    where id=v_job.id returning *;
end $$;

create function public.cancel_ootie_youcam_job(p_id uuid,p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_units integer;
begin
  perform 1 from public.ootie_youcam_budget where id=true for update;
  update public.ootie_youcam_jobs set status='cancelled',completed_at=now()
    where id=p_id and user_id=p_user_id and status='queued' returning units into v_units;
  if not found then return false; end if;
  update public.ootie_youcam_budget set allocated_units=allocated_units-v_units where id=true;
  return true;
end $$;
revoke all on function public.enqueue_ootie_youcam(uuid,uuid,text,uuid[],text), public.claim_ootie_youcam_job(uuid), public.cancel_ootie_youcam_job(uuid,uuid) from public, anon, authenticated;
grant execute on function public.enqueue_ootie_youcam(uuid,uuid,text,uuid[],text), public.claim_ootie_youcam_job(uuid), public.cancel_ootie_youcam_job(uuid,uuid) to service_role;

-- Only explicitly published derivative images go into this public bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ootie-shop-shares','ootie-shop-shares',true,7340032,array['image/jpeg','image/png']) on conflict(id) do nothing;
commit;
