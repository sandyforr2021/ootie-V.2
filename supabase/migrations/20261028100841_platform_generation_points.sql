begin;
-- Existing production ledger does not yet allow a distinct refund entry.
alter table public.ootie_point_transactions drop constraint ootie_point_transactions_type_check;
alter table public.ootie_point_transactions add constraint ootie_point_transactions_type_check
check(type in ('BIRTHDAY_BONUS','AI_USAGE','TRYON_USAGE','MANUAL_ADJUSTMENT','SUBSCRIPTION_GRANT','CREDIT_PURCHASE','PROMOTIONAL_REWARD','REFUND'));
-- Retire legacy simulated purchases before points can fund real processing.
do $$ begin
 if to_regprocedure('public.ootie_demo_subscribe(text,uuid)') is not null then
  revoke execute on function public.ootie_demo_subscribe(text,uuid) from public,anon,authenticated;
 end if;
 if to_regprocedure('public.ootie_demo_purchase_credits(text,uuid)') is not null then
  revoke execute on function public.ootie_demo_purchase_credits(text,uuid) from public,anon,authenticated;
 end if;
end $$;
create function public.ootie_platform_point_balance(p_user_id uuid) returns bigint language sql security invoker set search_path='' as $$
 select coalesce(sum(t.amount),0) from public.ootie_point_transactions t join public.ootie_profiles p on p.id=t.profile_id where p.user_id=p_user_id;
$$;
revoke all on function public.ootie_platform_point_balance(uuid) from public,anon,authenticated;
grant execute on function public.ootie_platform_point_balance(uuid) to service_role;
alter table public.ootie_youcam_jobs drop constraint ootie_youcam_jobs_units_check;
alter table public.ootie_youcam_jobs drop constraint ootie_youcam_jobs_check;
alter table public.ootie_youcam_jobs add constraint ootie_job_provider_cost check(
 (kind='skin_tone' and units=20 and product_id is null) or
 (kind='try_on' and units=2 and product_id is not null) or
 (kind='garment_cleanup' and units=1 and product_id is null));
alter table public.ootie_youcam_jobs drop constraint ootie_youcam_jobs_kind_check;
alter table public.ootie_youcam_jobs add constraint ootie_youcam_jobs_kind_check check(kind in ('try_on','skin_tone','garment_cleanup'));
alter table public.ootie_youcam_jobs add column platform_points integer not null default 0 check(platform_points>=0);

-- Platform points are independent of the provider's units. No retroactive debit.
create function public.ootie_charge_generation_points() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_profile uuid; v_balance integer;
begin
  new.platform_points := case when new.kind in ('try_on','garment_cleanup') then 2 else 0 end;
  if new.platform_points=0 then return new; end if;
  select id into v_profile from public.ootie_profiles where user_id=new.user_id;
  if v_profile is null then raise exception 'POINT_ACCOUNT_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('points:'||v_profile::text,0));
  select coalesce(sum(amount),0) into v_balance from public.ootie_point_transactions where profile_id=v_profile;
  if v_balance<new.platform_points then raise exception 'INSUFFICIENT_POINTS'; end if;
  insert into public.ootie_point_transactions(profile_id,amount,type,source_key,metadata)
  values(v_profile,-new.platform_points,case when new.kind='try_on' then 'TRYON_USAGE' else 'AI_USAGE' end,
    'commerce-job:'||new.id::text,jsonb_build_object('jobId',new.id,'batchId',new.batch_id,'providerUnits',new.units));
  return new;
end $$;
create trigger ootie_charge_generation_points before insert on public.ootie_youcam_jobs
for each row execute function public.ootie_charge_generation_points();

create function public.ootie_refund_generation_points() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_profile uuid; v_sequential boolean;
begin
  if new.status not in ('succeeded','failed','cancelled') or old.status=new.status then return new; end if;
  select id into v_profile from public.ootie_profiles where user_id=new.user_id;
  if v_profile is null then return new; end if;
  select execution_mode='sequential' into v_sequential from public.ootie_youcam_batches where id=new.batch_id;
  if v_sequential then
    if not exists(select 1 from public.ootie_youcam_jobs where batch_id=new.batch_id and status in ('failed','cancelled'))
      or exists(select 1 from public.ootie_youcam_jobs where batch_id=new.batch_id and status='needs_review') then return new; end if;
  elsif new.status not in ('failed','cancelled') then return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('points:'||v_profile::text,0));
  -- A failed outfit has no usable final output: refund even completed intermediate steps.
  insert into public.ootie_point_transactions(profile_id,amount,type,source_key,metadata)
  select v_profile,-t.amount,'REFUND','refund:'||t.source_key,
    jsonb_build_object('debitTransactionId',t.id,'batchId',new.batch_id,'reason',new.status)
  from public.ootie_point_transactions t where t.profile_id=v_profile and t.amount<0
    and t.source_key like 'commerce-job:%'
    and (t.source_key='commerce-job:'||new.id::text or (v_sequential and t.metadata->>'batchId'=new.batch_id::text))
  on conflict(profile_id,source_key) do nothing;
  return new;
end $$;
create trigger ootie_refund_generation_points after update of status on public.ootie_youcam_jobs
for each row execute function public.ootie_refund_generation_points();
revoke all on function public.ootie_charge_generation_points(),public.ootie_refund_generation_points() from public,anon,authenticated;
grant execute on function public.ootie_charge_generation_points(),public.ootie_refund_generation_points() to service_role;
create or replace function public.enqueue_ootie_youcam(
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
  if p_kind not in ('try_on','skin_tone','garment_cleanup') or p_kind is null then raise exception 'INVALID_JOB_KIND'; end if;
  if p_person_path not like (case when p_kind='garment_cleanup' then 'shop/' else 'person/' end) || p_user_id::text || '/%' or p_person_path like '%..%' then raise exception 'PERSON_IMAGE_NOT_OWNED'; end if;
  v_count := coalesce(cardinality(p_product_ids),0);
  if (p_kind = 'try_on' and (v_count < 1 or v_count > 3)) or (p_kind <> 'try_on' and v_count <> 0) then raise exception 'INVALID_BATCH'; end if;
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
  v_cost := case when p_kind = 'skin_tone' then 20 when p_kind = 'garment_cleanup' then 1 else 2 * v_count end;
  select coalesce(sum(units),0)::integer into v_daily from public.ootie_youcam_jobs
    where user_id = p_user_id and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
      and credit_state <> 'released';
  select count(*)::integer into v_active from public.ootie_youcam_jobs
    where user_id = p_user_id and status in ('queued','preparing','submitting','processing','needs_review');
  if v_daily + v_cost > v_budget.per_user_daily_limit then raise exception 'USER_DAILY_LIMIT'; end if;
  if v_active + (case when p_kind <> 'try_on' then 1 else v_count end) > v_budget.max_concurrent_jobs then
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
  if p_kind <> 'try_on' then
    insert into public.ootie_youcam_jobs(batch_id,user_id,kind,person_path,units,is_reviewer,reviewer_reserve_units)
      values(p_batch_id,p_user_id,p_kind,p_person_path,v_cost,coalesce(p_is_reviewer,false),v_budget.reviewer_reserve_units);
  else
    insert into public.ootie_youcam_jobs(batch_id,user_id,product_id,kind,person_path,product_path,garment_category,units,is_reviewer,reviewer_reserve_units)
    select p_batch_id,p_user_id,id,p_kind,p_person_path,image_path,category,2,coalesce(p_is_reviewer,false),v_budget.reviewer_reserve_units
      from public.ootie_shop_products where id = any(p_product_ids) and user_id = p_user_id;
  end if;
  return query select * from public.ootie_youcam_jobs where batch_id = p_batch_id and user_id = p_user_id order by created_at;
end $$;


commit;
