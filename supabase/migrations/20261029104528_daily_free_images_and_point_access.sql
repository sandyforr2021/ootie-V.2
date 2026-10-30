begin;

-- Existing generations and ledger entries retain their original billing.
alter table public.ootie_youcam_batches
  add column billing_mode text not null default 'legacy'
    check (billing_mode in ('legacy','points','daily_free','none')),
  add column billing_day date;
create index ootie_daily_free_batches_idx on public.ootie_youcam_batches(user_id,billing_day)
  where billing_mode='daily_free';

create function public.ootie_daily_free_image_count(p_user_id uuid) returns integer
language sql security invoker set search_path='' as $$
  select coalesce(sum(image_count),0)::integer from (
    select case when b.execution_mode='sequential' then
      case when bool_or(j.status in ('queued','preparing','submitting','processing','needs_review'))
        or (bool_and(j.status='succeeded')) then 1 else 0 end
    else count(*) filter(where j.status in ('queued','preparing','submitting','processing','needs_review','succeeded')) end image_count
    from public.ootie_youcam_batches b join public.ootie_youcam_jobs j on j.batch_id=b.id and j.user_id=b.user_id
    where b.user_id=p_user_id and b.billing_mode='daily_free'
      and b.billing_day=(now() at time zone 'America/Los_Angeles')::date
    group by b.id,b.execution_mode
  ) counted;
$$;

create or replace function public.ootie_charge_generation_points() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_profile uuid; v_balance bigint; v_mode text;
begin
  select billing_mode into v_mode from public.ootie_youcam_batches where id=new.batch_id and user_id=new.user_id;
  new.platform_points:=case when new.kind in ('try_on','garment_cleanup') and v_mode<>'daily_free' then 2 else 0 end;
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

create or replace function public.ootie_enforce_daily_generations() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  -- V2 admission reserves the complete batch atomically before any job insert.
  if new.kind not in ('try_on','garment_cleanup') or exists(
    select 1 from public.ootie_youcam_batches where id=new.batch_id and user_id=new.user_id and billing_mode<>'legacy'
  ) then return new; end if;
  perform 1 from public.ootie_youcam_budget where id=true for update;
  if not exists(select 1 from public.ootie_youcam_jobs where batch_id=new.batch_id and user_id=new.user_id)
    and public.ootie_daily_generation_count(new.user_id)>=2 then raise exception 'DAILY_GENERATION_LIMIT'; end if;
  return new;
end $$;

create function public.enqueue_ootie_generation(
  p_batch_id uuid,p_user_id uuid,p_person_path text,p_product_ids uuid[],p_kind text,
  p_is_reviewer boolean,p_execution_mode text
) returns setof public.ootie_youcam_jobs language plpgsql security invoker set search_path='' as $$
declare
  v_budget public.ootie_youcam_budget; v_batch public.ootie_youcam_batches;
  v_hash text; v_count integer; v_cost integer; v_active integer; v_daily integer;
  v_profile uuid; v_balance bigint; v_mode text:='none'; v_images integer;
  v_id uuid; v_previous uuid; v_index integer:=0;
begin
  if p_kind is null or p_kind not in ('try_on','skin_tone','garment_cleanup') then raise exception 'INVALID_JOB_KIND'; end if;
  if p_execution_mode is null or p_execution_mode not in ('independent','sequential')
    or (p_execution_mode='sequential' and p_kind<>'try_on') then raise exception 'INVALID_BATCH'; end if;
  if p_person_path is null or p_person_path not like (case when p_kind='garment_cleanup' then 'shop/' else 'person/' end)||p_user_id::text||'/%'
    or p_person_path like '%..%' then raise exception 'PERSON_IMAGE_NOT_OWNED'; end if;
  v_count:=coalesce(cardinality(p_product_ids),0);
  if (p_kind='try_on' and (v_count<1 or v_count>3)) or (p_kind<>'try_on' and v_count<>0) then raise exception 'INVALID_BATCH'; end if;
  v_hash:=md5(jsonb_build_array(p_person_path,p_product_ids,p_kind)::text);
  select * into v_budget from public.ootie_youcam_budget where id=true for update;
  select * into v_batch from public.ootie_youcam_batches where id=p_batch_id;
  if found then
    if v_batch.user_id<>p_user_id or v_batch.request_hash<>v_hash or v_batch.execution_mode<>p_execution_mode then raise exception 'BATCH_CONFLICT'; end if;
    return query select * from public.ootie_youcam_jobs where batch_id=p_batch_id and user_id=p_user_id order by sequence_index,created_at;
    return;
  end if;
  if exists(select 1 from public.ootie_youcam_photo_deletions where user_id=p_user_id and person_path=p_person_path and lease_until>now()) then raise exception 'PERSON_IMAGE_DELETING'; end if;
  if p_kind='try_on' and (select count(*) from public.ootie_shop_products where id=any(p_product_ids) and user_id=p_user_id)<>v_count then raise exception 'PRODUCT_NOT_OWNED'; end if;
  v_cost:=case when p_kind='skin_tone' then 20 when p_kind='garment_cleanup' then 1 else 2*v_count end;
  select count(*)::integer into v_active from public.ootie_youcam_jobs
    where user_id=p_user_id and status in ('queued','preparing','submitting','processing','needs_review');
  if v_active+(case when p_kind='try_on' then v_count else 1 end)>v_budget.max_concurrent_jobs then raise exception 'USER_ACTIVE_LIMIT'; end if;
  if v_budget.unit_limit is null or v_budget.expires_at is null or v_budget.expires_at<=now()
    or v_budget.allocated_units+v_cost>v_budget.unit_limit then raise exception 'FREE_BUDGET_EXHAUSTED'; end if;
  if not coalesce(p_is_reviewer,false) and v_budget.unit_limit-v_budget.allocated_units-v_cost<v_budget.reviewer_reserve_units then raise exception 'REVIEWER_RESERVE_PROTECTED'; end if;

  if p_kind in ('try_on','garment_cleanup') then
    select id into v_profile from public.ootie_profiles where user_id=p_user_id;
    if v_profile is null then raise exception 'POINT_ACCOUNT_REQUIRED'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('points:'||v_profile::text,0));
    select coalesce(sum(amount),0) into v_balance from public.ootie_point_transactions where profile_id=v_profile;
    -- Choose billing once for the whole batch. No mixed or partial debit.
    if v_balance>=2*(case when p_kind='try_on' then v_count else 1 end) then v_mode:='points';
    else
      v_images:=case when p_execution_mode='sequential' or p_kind='garment_cleanup' then 1 else v_count end;
      if public.ootie_daily_free_image_count(p_user_id)+v_images>2 then raise exception 'DAILY_FREE_LIMIT'; end if;
      v_mode:='daily_free';
    end if;
  else
    -- Skin-tone analysis is not an image and does not consume the free images.
    select coalesce(sum(units),0)::integer into v_daily from public.ootie_youcam_jobs
      where user_id=p_user_id and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' and credit_state<>'released';
    if v_daily+v_cost>v_budget.per_user_daily_limit then raise exception 'USER_DAILY_LIMIT'; end if;
  end if;
  insert into public.ootie_youcam_batches(id,user_id,request_hash,execution_mode,billing_mode,billing_day)
    values(p_batch_id,p_user_id,v_hash,p_execution_mode,v_mode,(now() at time zone 'America/Los_Angeles')::date);
  update public.ootie_youcam_budget set allocated_units=allocated_units+v_cost where id=true;
  if p_kind<>'try_on' then
    insert into public.ootie_youcam_jobs(batch_id,user_id,kind,person_path,units,is_reviewer,reviewer_reserve_units)
      values(p_batch_id,p_user_id,p_kind,p_person_path,v_cost,coalesce(p_is_reviewer,false),v_budget.reviewer_reserve_units);
  else
    foreach v_id in array p_product_ids loop
      v_index:=v_index+1;
      insert into public.ootie_youcam_jobs(batch_id,user_id,product_id,kind,person_path,product_path,garment_category,units,is_reviewer,reviewer_reserve_units,
        sequence_index,sequence_total,previous_job_id)
      select p_batch_id,p_user_id,id,p_kind,p_person_path,image_path,category,2,coalesce(p_is_reviewer,false),v_budget.reviewer_reserve_units,
        case when p_execution_mode='sequential' then v_index else 1 end,
        case when p_execution_mode='sequential' then v_count else 1 end,v_previous
      from public.ootie_shop_products where id=v_id and user_id=p_user_id;
      if p_execution_mode='sequential' then
        select id into v_previous from public.ootie_youcam_jobs where batch_id=p_batch_id and product_id=v_id;
      end if;
    end loop;
  end if;
  return query select * from public.ootie_youcam_jobs where batch_id=p_batch_id and user_id=p_user_id order by sequence_index,created_at;
end $$;

create or replace function public.enqueue_ootie_youcam(
  p_batch_id uuid,p_user_id uuid,p_person_path text,p_product_ids uuid[],p_kind text,p_is_reviewer boolean default false
) returns setof public.ootie_youcam_jobs language sql security invoker set search_path='' as $$
  select * from public.enqueue_ootie_generation(p_batch_id,p_user_id,p_person_path,p_product_ids,p_kind,p_is_reviewer,'independent');
$$;
create or replace function public.enqueue_ootie_outfit(
  p_batch_id uuid,p_user_id uuid,p_person_path text,p_product_ids uuid[],p_is_reviewer boolean default false
) returns setof public.ootie_youcam_jobs language sql security invoker set search_path='' as $$
  select * from public.enqueue_ootie_generation(p_batch_id,p_user_id,p_person_path,p_product_ids,'try_on',p_is_reviewer,'sequential');
$$;

create or replace function public.get_ootie_youcam_user_quota(p_user_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object(
 'generationPolicyVersion',2,'freeGenerationLimit',2,'freeGenerationUsed',public.ootie_daily_free_image_count(p_user_id),
 'generationTimezone','America/Los_Angeles','dailyLimit',b.per_user_daily_limit,
 'dailyUsed',coalesce((select sum(j.units)::integer from public.ootie_youcam_jobs j where j.user_id=p_user_id and j.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' and j.credit_state<>'released'),0),
 'activeLimit',b.max_concurrent_jobs,
 'activeCount',coalesce((select count(*)::integer from public.ootie_youcam_jobs j where j.user_id=p_user_id and j.status in ('queued','preparing','submitting','processing','needs_review')),0),
 'reviewerReserveUnits',b.reviewer_reserve_units
 ) from public.ootie_youcam_budget b where b.id=true;
$$;
revoke all on function public.ootie_daily_free_image_count(uuid),public.enqueue_ootie_generation(uuid,uuid,text,uuid[],text,boolean,text) from public,anon,authenticated;
grant execute on function public.ootie_daily_free_image_count(uuid),public.enqueue_ootie_generation(uuid,uuid,text,uuid[],text,boolean,text) to service_role;
commit;
