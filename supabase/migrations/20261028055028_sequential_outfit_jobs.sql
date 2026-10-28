begin;
alter table public.ootie_shop_products add column if not exists outfit_layer text
  check (outfit_layer in ('top','bottom','outer','single'));
alter table public.ootie_youcam_batches add column if not exists execution_mode text not null default 'independent'
  check (execution_mode in ('independent','sequential'));
alter table public.ootie_youcam_jobs
  add column if not exists sequence_index integer not null default 1,
  add column if not exists sequence_total integer not null default 1,
  add column if not exists previous_job_id uuid references public.ootie_youcam_jobs(id),
  add column if not exists input_result_path text,
  add column if not exists result_deleted_at timestamptz,
  add constraint ootie_outfit_sequence_valid check (sequence_index between 1 and sequence_total and sequence_total between 1 and 3);
create index ootie_outfit_predecessor_idx on public.ootie_youcam_jobs(previous_job_id) where previous_job_id is not null;

create function public.enqueue_ootie_outfit(p_batch_id uuid,p_user_id uuid,p_person_path text,p_product_ids uuid[],p_is_reviewer boolean default false)
returns setof public.ootie_youcam_jobs language plpgsql security invoker set search_path='' as $$
declare v_mode text; v_id uuid; v_previous uuid; v_index integer:=0; v_total integer:=cardinality(p_product_ids);
begin
  -- Use the same lock and original admission function as all other jobs. Its
  -- quotas, expiry, ownership checks and idempotent request hash remain intact.
  perform 1 from public.ootie_youcam_budget where id=true for update;
  select execution_mode into v_mode from public.ootie_youcam_batches where id=p_batch_id;
  if found and v_mode<>'sequential' then raise exception 'BATCH_CONFLICT'; end if;
  perform * from public.enqueue_ootie_youcam(p_batch_id,p_user_id,p_person_path,p_product_ids,'try_on',p_is_reviewer);
  if v_mode is null then
    update public.ootie_youcam_batches set execution_mode='sequential' where id=p_batch_id and user_id=p_user_id;
    foreach v_id in array p_product_ids loop
      v_index:=v_index+1;
      update public.ootie_youcam_jobs set sequence_index=v_index,sequence_total=v_total,previous_job_id=v_previous
        where batch_id=p_batch_id and user_id=p_user_id and product_id=v_id returning id into v_previous;
      if not found then raise exception 'PRODUCT_NOT_OWNED'; end if;
    end loop;
  end if;
  return query select * from public.ootie_youcam_jobs where batch_id=p_batch_id and user_id=p_user_id order by sequence_index;
end $$;
revoke all on function public.enqueue_ootie_outfit(uuid,uuid,text,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.enqueue_ootie_outfit(uuid,uuid,text,uuid[],boolean) to service_role;

drop function public.claim_ootie_youcam_job(uuid);
create function public.claim_ootie_youcam_job(p_lease uuid,p_support_outfits boolean default false)
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
  -- Release untouched descendants when an earlier layer cannot safely continue.
  with stopped as (
    update public.ootie_youcam_jobs j set status='failed',credit_state='released',
      error_code='OUTFIT_PREVIOUS_STEP_STOPPED',completed_at=now(),lease_token=null,lease_until=null
    where j.status='queued' and j.credit_state='reserved' and j.sequence_total>1
      and exists (select 1 from public.ootie_youcam_jobs parent where parent.batch_id=j.batch_id
        and parent.user_id=j.user_id and parent.sequence_index<j.sequence_index
        and (parent.status in ('failed','cancelled','needs_review') or parent.result_deleted_at is not null))
    returning j.units
  ) update public.ootie_youcam_budget set allocated_units=greatest(0,allocated_units-coalesce((select sum(units)::integer from stopped),0)) where id=true;
  select * into v_job from public.ootie_youcam_jobs j
    where status in ('queued','preparing','processing') and next_poll_at <= now()
      and (sequence_total=1 or p_support_outfits)
      and (lease_until is null or lease_until < now())
      and (previous_job_id is null or exists (select 1 from public.ootie_youcam_jobs parent
        where parent.id=j.previous_job_id and parent.user_id=j.user_id and parent.batch_id=j.batch_id
          and parent.status='succeeded' and parent.result_path is not null and parent.result_deleted_at is null))
    order by next_poll_at,created_at for update skip locked limit 1;
  if not found then return; end if;
  return query update public.ootie_youcam_jobs set lease_token=p_lease,lease_until=now()+interval '180 seconds',
    status=case when status in ('queued','preparing') then 'preparing' else status end,
    input_result_path=case when previous_job_id is null then null else
      (select parent.result_path from public.ootie_youcam_jobs parent where parent.id=v_job.previous_job_id) end
    where id=v_job.id returning *;
end $$;


create or replace function public.cancel_ootie_youcam_job(p_id uuid,p_user_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_job public.ootie_youcam_jobs; v_units integer;
begin
  perform 1 from public.ootie_youcam_budget where id=true for update;
  select * into v_job from public.ootie_youcam_jobs where id=p_id and user_id=p_user_id;
  if not found or v_job.status<>'queued' then return false; end if;
  -- An outfit can be cancelled before it starts. Never cancel a provider task
  -- whose outcome or billing is uncertain.
  if v_job.sequence_total>1 and exists(select 1 from public.ootie_youcam_jobs
    where batch_id=v_job.batch_id and status<>'queued') then return false; end if;
  with removed as (
    update public.ootie_youcam_jobs set status='cancelled',credit_state='released',completed_at=now()
    where user_id=p_user_id and status='queued' and credit_state='reserved'
      and (id=p_id or (v_job.sequence_total>1 and batch_id=v_job.batch_id)) returning units
  ) select sum(units)::integer into v_units from removed;
  if v_units is null then return false; end if;
  update public.ootie_youcam_budget set allocated_units=greatest(0,allocated_units-v_units) where id=true;
  return true;
end $$;

create or replace function public.delete_ootie_youcam_result(p_id uuid,p_user_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.ootie_youcam_budget where id=true for update;
  if exists(select 1 from public.ootie_youcam_jobs j join public.ootie_youcam_jobs target on target.id=p_id
    where target.user_id=p_user_id and j.batch_id=target.batch_id
      and j.status in ('queued','preparing','submitting','processing','needs_review')) then raise exception 'JOB_STILL_ACTIVE'; end if;
  delete from public.ootie_shop_posts where job_id=p_id and user_id=p_user_id;
  -- Keep the private storage path for retryable physical cleanup. Readers and
  -- publishers must reject the tombstone before serving or publishing an image.
  update public.ootie_youcam_jobs set result_deleted_at=coalesce(result_deleted_at,now()),result_data=null
    where id=p_id and user_id=p_user_id and status not in ('queued','preparing','submitting','processing','needs_review');
  return found;
end $$;
revoke all on function public.claim_ootie_youcam_job(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_ootie_youcam_job(uuid,boolean) to service_role;
commit;
