begin;
-- A sequential outfit is one submission but still charges two points per garment.
-- Successful or pending submissions reserve a daily slot. Fully stopped failures
-- release it; uncertain provider outcomes continue to reserve their slot.
create function public.ootie_daily_generation_count(p_user_id uuid) returns integer
language sql security invoker set search_path='' as $$
 select count(*)::integer from (
  select batch_id from public.ootie_youcam_jobs
  where user_id=p_user_id and kind in ('try_on','garment_cleanup')
   and created_at >= date_trunc('day',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei'
  group by batch_id
  having bool_or(status in ('queued','preparing','submitting','processing','needs_review'))
   or (bool_or(status='succeeded') and not bool_or(status in ('failed','cancelled')))
 ) counted;
$$;
create function public.ootie_enforce_daily_generations() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.kind not in ('try_on','garment_cleanup') then return new; end if;
 -- Same admission lock as enqueue; concurrent submissions cannot both take slot 2.
 perform 1 from public.ootie_youcam_budget where id=true for update;
 if not exists(select 1 from public.ootie_youcam_jobs where batch_id=new.batch_id and user_id=new.user_id and kind in ('try_on','garment_cleanup'))
  and public.ootie_daily_generation_count(new.user_id)>=2 then
  raise exception 'DAILY_GENERATION_LIMIT';
 end if;
 return new;
end $$;
create trigger ootie_enforce_daily_generations before insert on public.ootie_youcam_jobs
for each row execute function public.ootie_enforce_daily_generations();
create or replace function public.get_ootie_youcam_user_quota(p_user_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object(
 'generationLimit',2,'generationUsed',public.ootie_daily_generation_count(p_user_id),'generationTimezone','Asia/Taipei',
 'dailyLimit',b.per_user_daily_limit,
 'dailyUsed',coalesce((select sum(j.units)::integer from public.ootie_youcam_jobs j where j.user_id=p_user_id and j.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' and j.credit_state<>'released'),0),
 'activeLimit',b.max_concurrent_jobs,
 'activeCount',coalesce((select count(*)::integer from public.ootie_youcam_jobs j where j.user_id=p_user_id and j.status in ('queued','preparing','submitting','processing','needs_review')),0),
 'reviewerReserveUnits',b.reviewer_reserve_units
 ) from public.ootie_youcam_budget b where b.id=true;
$$;
revoke all on function public.ootie_daily_generation_count(uuid),public.ootie_enforce_daily_generations() from public,anon,authenticated;
grant execute on function public.ootie_daily_generation_count(uuid),public.ootie_enforce_daily_generations() to service_role;
commit;
