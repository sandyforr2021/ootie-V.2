-- Credit lifecycle, per-member limits, judge reserve and reversible media actions.
-- Apply only after reviewing this migration in the intended Supabase project.
begin;

alter table public.ootie_youcam_budget
  add column if not exists per_user_daily_limit integer not null default 22 check (per_user_daily_limit between 1 and 1000),
  add column if not exists max_concurrent_jobs integer not null default 3 check (max_concurrent_jobs between 1 and 20),
  add column if not exists reviewer_reserve_units integer not null default 22 check (reviewer_reserve_units between 0 and 1000);

alter table public.ootie_youcam_jobs
  add column if not exists credit_state text not null default 'reserved'
    check (credit_state in ('reserved','submitted','consumed','uncertain','released')),
  add column if not exists is_reviewer boolean not null default false,
  add column if not exists reviewer_reserve_units integer not null default 22 check (reviewer_reserve_units between 0 and 1000);

-- Preserve ambiguous historical failures; release only failures whose recorded cause proves
-- the billable task POST was never sent.
update public.ootie_youcam_jobs
set credit_state = case
  when status = 'cancelled' then 'released'
  when status = 'succeeded' then 'consumed'
  when provider_task_id is not null then 'submitted'
  when status = 'failed' and error_code in (
    'FREE_BUDGET_EXHAUSTED','YOUCAM_FREE_CREDITS_UNAVAILABLE','YOUCAM_COST_CHANGED',
    'IMAGE_PREPARATION_FAILED','PRIVATE_IMAGE_NOT_FOUND','YOUCAM_INVALID_UPLOAD','YOUCAM_UPLOAD_FAILED'
  ) then 'released'
  when status in ('needs_review','failed') then 'uncertain'
  else 'reserved'
end;

update public.ootie_youcam_budget b
set allocated_units = greatest(0, b.allocated_units - coalesce((
  select sum(j.units)::integer from public.ootie_youcam_jobs j
  where j.status = 'failed' and j.credit_state = 'released' and j.error_code in (
    'FREE_BUDGET_EXHAUSTED','YOUCAM_FREE_CREDITS_UNAVAILABLE','YOUCAM_COST_CHANGED',
    'IMAGE_PREPARATION_FAILED','PRIVATE_IMAGE_NOT_FOUND','YOUCAM_INVALID_UPLOAD','YOUCAM_UPLOAD_FAILED'
  )
), 0))
where b.id = true;

create index if not exists ootie_youcam_jobs_user_credit_day_idx
  on public.ootie_youcam_jobs(user_id, created_at, credit_state);

-- Serialize photo deletion with enqueue so a new job cannot start between the active-job
-- check and the Storage delete request. Expired leases recover cleanly after a process crash.
create table if not exists public.ootie_youcam_photo_deletions (
  user_id uuid not null references auth.users(id) on delete cascade,
  person_path text not null,
  lease_token uuid not null,
  lease_until timestamptz not null,
  primary key (user_id, person_path),
  check (person_path like 'person/' || user_id::text || '/%' and person_path not like '%..%')
);
alter table public.ootie_youcam_photo_deletions enable row level security;
revoke all on table public.ootie_youcam_photo_deletions from public, anon, authenticated;
grant select, insert, update, delete on table public.ootie_youcam_photo_deletions to service_role;

drop function if exists public.enqueue_ootie_youcam(uuid,uuid,text,uuid[],text);
create function public.enqueue_ootie_youcam(
  p_batch_id uuid, p_user_id uuid, p_person_path text, p_product_ids uuid[], p_kind text,
  p_is_reviewer boolean default false
)
returns setof public.ootie_youcam_jobs language plpgsql security invoker set search_path = '' as $$
declare
  v_budget public.ootie_youcam_budget;
  v_batch public.ootie_youcam_batches;
  v_hash text;
  v_cost integer;
  v_count integer;
  v_daily integer;
  v_active integer;
begin
  if p_kind not in ('try_on','skin_tone') or p_kind is null then raise exception 'INVALID_JOB_KIND'; end if;
  if p_person_path not like 'person/' || p_user_id::text || '/%' or p_person_path like '%..%' then raise exception 'PERSON_IMAGE_NOT_OWNED'; end if;
  v_count := coalesce(cardinality(p_product_ids),0);
  if (p_kind = 'try_on' and (v_count < 1 or v_count > 3)) or (p_kind = 'skin_tone' and v_count <> 0) then raise exception 'INVALID_BATCH'; end if;
  v_hash := md5(jsonb_build_array(p_person_path, p_product_ids, p_kind)::text);
  select * into v_budget from public.ootie_youcam_budget where id = true for update;
  select * into v_batch from public.ootie_youcam_batches where id = p_batch_id;
  if found then
    if v_batch.user_id <> p_user_id or v_batch.request_hash <> v_hash then raise exception 'BATCH_CONFLICT'; end if;
    return query select * from public.ootie_youcam_jobs where batch_id = p_batch_id and user_id = p_user_id;
    return;
  end if;
  if exists (select 1 from public.ootie_youcam_photo_deletions d
    where d.user_id=p_user_id and d.person_path=p_person_path and d.lease_until > now()) then
    raise exception 'PERSON_IMAGE_DELETING';
  end if;
  if p_kind = 'try_on' and (select count(*) from public.ootie_shop_products where id = any(p_product_ids) and user_id = p_user_id) <> v_count then raise exception 'PRODUCT_NOT_OWNED'; end if;
  v_cost := case when p_kind = 'skin_tone' then 20 else 2 * v_count end;
  select coalesce(sum(units),0)::integer into v_daily from public.ootie_youcam_jobs
    where user_id = p_user_id and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
      and credit_state <> 'released';
  select count(*)::integer into v_active from public.ootie_youcam_jobs
    where user_id = p_user_id and status in ('queued','preparing','submitting','processing','needs_review');
  if v_daily + v_cost > v_budget.per_user_daily_limit then raise exception 'USER_DAILY_LIMIT'; end if;
  if v_active + (case when p_kind = 'skin_tone' then 1 else v_count end) > v_budget.max_concurrent_jobs then
    raise exception 'USER_ACTIVE_LIMIT';
  end if;
  if v_budget.unit_limit is null or v_budget.expires_at is null or v_budget.expires_at <= now()
    or v_budget.allocated_units + v_cost > v_budget.unit_limit then raise exception 'FREE_BUDGET_EXHAUSTED'; end if;
  if not coalesce(p_is_reviewer,false)
    and v_budget.unit_limit - v_budget.allocated_units - v_cost < v_budget.reviewer_reserve_units then
    raise exception 'REVIEWER_RESERVE_PROTECTED';
  end if;
  insert into public.ootie_youcam_batches(id,user_id,request_hash) values(p_batch_id,p_user_id,v_hash);
  update public.ootie_youcam_budget set allocated_units = allocated_units + v_cost where id = true;
  if p_kind = 'skin_tone' then
    insert into public.ootie_youcam_jobs(batch_id,user_id,kind,person_path,units,is_reviewer,reviewer_reserve_units)
      values(p_batch_id,p_user_id,p_kind,p_person_path,20,coalesce(p_is_reviewer,false),v_budget.reviewer_reserve_units);
  else
    insert into public.ootie_youcam_jobs(batch_id,user_id,product_id,kind,person_path,product_path,garment_category,units,is_reviewer,reviewer_reserve_units)
    select p_batch_id,p_user_id,id,p_kind,p_person_path,image_path,category,2,coalesce(p_is_reviewer,false),v_budget.reviewer_reserve_units
      from public.ootie_shop_products where id = any(p_product_ids) and user_id = p_user_id;
  end if;
  return query select * from public.ootie_youcam_jobs where batch_id = p_batch_id and user_id = p_user_id order by created_at;
end $$;

create or replace function public.get_ootie_youcam_user_quota(p_user_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'dailyLimit', b.per_user_daily_limit,
    'dailyUsed', coalesce((select sum(j.units)::integer from public.ootie_youcam_jobs j
      where j.user_id = p_user_id and j.created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
        and j.credit_state <> 'released'),0),
    'activeLimit', b.max_concurrent_jobs,
    'activeCount', coalesce((select count(*)::integer from public.ootie_youcam_jobs j
      where j.user_id = p_user_id and j.status in ('queued','preparing','submitting','processing','needs_review')),0),
    'reviewerReserveUnits', b.reviewer_reserve_units
  ) from public.ootie_youcam_budget b where b.id = true;
$$;

create or replace function public.release_ootie_youcam_reservation(
  p_id uuid, p_lease uuid, p_error_code text
)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_units integer;
begin
  perform 1 from public.ootie_youcam_budget where id = true for update;
  update public.ootie_youcam_jobs set status='failed', credit_state='released', error_code=p_error_code,
    completed_at=now(), lease_token=null, lease_until=null
  where id=p_id and lease_token=p_lease and provider_task_id is null and credit_state='reserved'
    and status in ('preparing','submitting') returning units into v_units;
  if not found then return false; end if;
  update public.ootie_youcam_budget set allocated_units=greatest(0,allocated_units-v_units) where id=true;
  return true;
end $$;

create or replace function public.begin_ootie_youcam_photo_deletion(
  p_user_id uuid, p_person_path text, p_lease uuid
)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_person_path not like 'person/' || p_user_id::text || '/%' or p_person_path like '%..%' then
    raise exception 'PERSON_IMAGE_NOT_OWNED';
  end if;
  perform 1 from public.ootie_youcam_budget where id=true for update;
  if exists (select 1 from public.ootie_youcam_jobs j
    where j.user_id=p_user_id and j.person_path=p_person_path
      and j.status in ('queued','preparing','submitting','processing','needs_review')) then
    raise exception 'PERSON_IMAGE_IN_USE';
  end if;
  insert into public.ootie_youcam_photo_deletions(user_id,person_path,lease_token,lease_until)
    values(p_user_id,p_person_path,p_lease,now()+interval '2 minutes')
    on conflict (user_id,person_path) do update
      set lease_token=excluded.lease_token,lease_until=excluded.lease_until
      where public.ootie_youcam_photo_deletions.lease_until <= now();
  if not found then raise exception 'PERSON_IMAGE_DELETING'; end if;
  return true;
end $$;

create or replace function public.finish_ootie_youcam_photo_deletion(
  p_user_id uuid, p_person_path text, p_lease uuid
)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_deleted uuid;
begin
  delete from public.ootie_youcam_photo_deletions
    where user_id=p_user_id and person_path=p_person_path and lease_token=p_lease
  returning lease_token into v_deleted;
  return found;
end $$;

create or replace function public.claim_ootie_youcam_job(p_lease uuid)
returns setof public.ootie_youcam_jobs language plpgsql security invoker set search_path = '' as $$
declare v_job public.ootie_youcam_jobs;
begin
  perform 1 from public.ootie_youcam_budget where id=true for update;
  -- Recorded preparation and preflight failures are known not to have reached the billable task POST.
  with released as (
    update public.ootie_youcam_jobs set status='failed',credit_state='released',completed_at=coalesce(completed_at,now()),
      lease_token=null,lease_until=null
    where status in ('preparing','submitting') and lease_until < now() and provider_task_id is null
      and credit_state='reserved' and (
        (status='preparing' and error_code is not null)
        or (status='submitting' and error_code in (
          'FREE_BUDGET_EXHAUSTED','YOUCAM_FREE_CREDITS_UNAVAILABLE','YOUCAM_COST_CHANGED',
          'IMAGE_PREPARATION_FAILED','PRIVATE_IMAGE_NOT_FOUND','YOUCAM_INVALID_UPLOAD','YOUCAM_UPLOAD_FAILED'
        ))
      )
    returning units
  )
  update public.ootie_youcam_budget set allocated_units=greatest(0,allocated_units-coalesce((select sum(units)::integer from released),0)) where id=true;
  -- Other stale submissions may have reached YouCam. Keep their credits and require reconciliation.
  update public.ootie_youcam_jobs set status='needs_review',credit_state='uncertain',
    error_code='SUBMISSION_UNCERTAIN',lease_token=null,lease_until=null
    where status='submitting' and lease_until < now() and provider_task_id is null
      and (error_code is null or error_code not in (
        'FREE_BUDGET_EXHAUSTED','YOUCAM_FREE_CREDITS_UNAVAILABLE','YOUCAM_COST_CHANGED',
        'IMAGE_PREPARATION_FAILED','PRIVATE_IMAGE_NOT_FOUND','YOUCAM_INVALID_UPLOAD','YOUCAM_UPLOAD_FAILED'
      ));
  select * into v_job from public.ootie_youcam_jobs
    where status in ('queued','preparing','processing') and next_poll_at <= now()
      and (lease_until is null or lease_until < now())
    order by next_poll_at,created_at for update skip locked limit 1;
  if not found then return; end if;
  return query update public.ootie_youcam_jobs set lease_token=p_lease,lease_until=now()+interval '180 seconds',
    status=case when status in ('queued','preparing') then 'preparing' else status end
    where id=v_job.id returning *;
end $$;

create or replace function public.cancel_ootie_youcam_job(p_id uuid,p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_units integer;
begin
  perform 1 from public.ootie_youcam_budget where id=true for update;
  update public.ootie_youcam_jobs set status='cancelled',credit_state='released',completed_at=now()
    where id=p_id and user_id=p_user_id and status='queued' and credit_state='reserved' returning units into v_units;
  if not found then return false; end if;
  update public.ootie_youcam_budget set allocated_units=greatest(0,allocated_units-v_units) where id=true;
  return true;
end $$;

create or replace function public.delete_ootie_youcam_result(p_id uuid,p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.ootie_shop_posts where job_id=p_id and user_id=p_user_id;
  update public.ootie_youcam_jobs set result_path=null,result_data=null
    where id=p_id and user_id=p_user_id and status not in ('queued','preparing','submitting','processing');
  return found;
end $$;

create or replace function public.delete_ootie_youcam_post(p_id uuid,p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.ootie_shop_posts where id=p_id and user_id=p_user_id;
  return found;
end $$;

revoke all on function public.enqueue_ootie_youcam(uuid,uuid,text,uuid[],text,boolean),
  public.get_ootie_youcam_user_quota(uuid), public.release_ootie_youcam_reservation(uuid,uuid,text),
  public.begin_ootie_youcam_photo_deletion(uuid,text,uuid), public.finish_ootie_youcam_photo_deletion(uuid,text,uuid),
  public.claim_ootie_youcam_job(uuid), public.cancel_ootie_youcam_job(uuid,uuid),
  public.delete_ootie_youcam_result(uuid,uuid), public.delete_ootie_youcam_post(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_ootie_youcam(uuid,uuid,text,uuid[],text,boolean),
  public.get_ootie_youcam_user_quota(uuid), public.release_ootie_youcam_reservation(uuid,uuid,text),
  public.begin_ootie_youcam_photo_deletion(uuid,text,uuid), public.finish_ootie_youcam_photo_deletion(uuid,text,uuid),
  public.claim_ootie_youcam_job(uuid), public.cancel_ootie_youcam_job(uuid,uuid),
  public.delete_ootie_youcam_result(uuid,uuid), public.delete_ootie_youcam_post(uuid,uuid)
  to service_role;

commit;
