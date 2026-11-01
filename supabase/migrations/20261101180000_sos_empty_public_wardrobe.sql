BEGIN;

CREATE OR REPLACE FUNCTION public.ootie_validate_sos_shared_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id <> NEW.closet_owner_id
     OR NOT EXISTS (
       SELECT 1
       FROM public.ootie_profiles profile
       WHERE profile.id = NEW.user_id
         AND profile.public_closet IS TRUE
     )
     OR EXISTS (
       SELECT 1
       FROM unnest(NEW.closet_item_ids) AS shared(id)
       WHERE NOT EXISTS (
         SELECT 1
         FROM public.ootie_clothing_items item
         WHERE item.id = shared.id
           AND item.owner_id = NEW.user_id
           AND item.hidden IS FALSE
       )
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'SOS items must belong to the requesting public wardrobe';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
