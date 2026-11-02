BEGIN;

UPDATE public.ootie_clothing_items
SET hidden = FALSE
WHERE hidden IS NULL;

ALTER TABLE public.ootie_clothing_items
  ALTER COLUMN hidden SET DEFAULT FALSE,
  ALTER COLUMN hidden SET NOT NULL;

COMMIT;
