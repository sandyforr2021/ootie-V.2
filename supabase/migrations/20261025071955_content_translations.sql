alter table public.ootie_ootd_posts add column if not exists caption_language text;
alter table public.ootie_post_comments add column if not exists body_language text;

create table if not exists public.ootie_content_translations (
  kind text not null check (kind in ('post','comment')),
  content_id uuid not null,
  source_hash text not null check (length(source_hash)=64),
  source_language text not null,
  target_language text not null check (target_language in ('zh-TW','en','ja','es')),
  translated_text text not null check (length(translated_text) between 1 and 20000),
  provider text not null,
  created_at timestamptz not null default now(),
  primary key (kind,content_id,source_hash,target_language)
);
alter table public.ootie_content_translations enable row level security;
revoke all on public.ootie_content_translations from public, anon, authenticated;
grant select,insert,update,delete on public.ootie_content_translations to service_role;

create table if not exists public.ootie_translation_usage (
  usage_day date primary key,
  characters integer not null default 0 check (characters between 0 and 4500)
);
alter table public.ootie_translation_usage enable row level security;
revoke all on public.ootie_translation_usage from public, anon, authenticated;
grant select,insert,update on public.ootie_translation_usage to service_role;

create or replace function public.ootie_reserve_translation_chars(p_chars integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if p_chars is null or p_chars < 1 or p_chars > 4000 then return false; end if;
  insert into public.ootie_translation_usage(usage_day,characters)
  values ((now() at time zone 'UTC')::date,p_chars)
  on conflict(usage_day) do update set characters=public.ootie_translation_usage.characters+excluded.characters
  where public.ootie_translation_usage.characters+excluded.characters <= 4500;
  get diagnostics changed = row_count;
  return changed=1;
end;
$$;
revoke all on function public.ootie_reserve_translation_chars(integer) from public,anon,authenticated;
grant execute on function public.ootie_reserve_translation_chars(integer) to service_role;
comment on table public.ootie_content_translations is 'Server-only cache. Gateway checks public source visibility and caption hash before returning a translation.';
