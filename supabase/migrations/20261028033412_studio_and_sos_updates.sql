begin;
-- Private job snapshots are not wishlist entries; the job keeps the existing budget ledger.
alter table public.ootie_shop_products drop constraint ootie_shop_products_state_check;
alter table public.ootie_shop_products add constraint ootie_shop_products_state_check
  check (state in ('wishlist','kept','dismissed','purchased','tryon_only'));
-- Optional SOS cover: either an uploaded public image or a shared wardrobe item.
alter table public.ootie_sos_posts add column cover_url text;
alter table public.ootie_sos_posts add column cover_path text;
alter table public.ootie_sos_posts add column cover_item_id uuid;
alter table public.ootie_sos_posts add constraint ootie_sos_cover_consistent check (
  (cover_url is null) = (cover_path is null)
  and (cover_item_id is null or cover_item_id = any (closet_item_ids))
);
-- Enforce the same ownership contract as the publish form. Without this check,
-- a forged post could list another user's private clothing and expose it through
-- the existing SOS shared-clothing policy. Existing posts are not rewritten.
create function public.ootie_validate_sos_shared_items()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp as $$
begin
  if new.user_id <> new.closet_owner_id or cardinality(new.closet_item_ids) = 0
     or not exists (select 1 from public.ootie_profiles p where p.id = new.user_id and p.public_closet is true)
     or exists (
       select 1 from unnest(new.closet_item_ids) as shared(id)
       where not exists (select 1 from public.ootie_clothing_items item
                         where item.id = shared.id and item.owner_id = new.user_id)
     ) then
    raise exception using errcode = '23514', message = 'SOS items must belong to the requesting public wardrobe';
  end if;
  return new;
end $$;
revoke all on function public.ootie_validate_sos_shared_items() from public;
create trigger ootie_sos_validate_shared_items
before insert or update of user_id, closet_owner_id, closet_item_ids, cover_item_id
on public.ootie_sos_posts for each row execute function public.ootie_validate_sos_shared_items();
-- Suggestions belong to their SOS and are removed when the owner deletes it.
alter table public.ootie_outfit_suggestions drop constraint ootie_outfit_suggestions_sos_id_fkey;
alter table public.ootie_outfit_suggestions add constraint ootie_outfit_suggestions_sos_id_fkey
  foreign key (sos_id) references public.ootie_sos_posts(id) on delete cascade;
commit;
