-- OOTIE hoxkrmadzjnyjaqjbyxc only. Add currency without changing ownership or RLS.
BEGIN;
ALTER TABLE public.ootie_clothing_items
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TWD';
-- Preserve existing integer values exactly, while accepting cents for USD/EUR.
ALTER TABLE public.ootie_clothing_items ALTER COLUMN price TYPE numeric(14,2) USING price::numeric(14,2);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ootie_clothing_currency_check'
    AND conrelid = 'public.ootie_clothing_items'::regclass) THEN
    ALTER TABLE public.ootie_clothing_items ADD CONSTRAINT ootie_clothing_currency_check
      CHECK (currency IN ('TWD','USD','JPY','EUR','GBP','CAD','AUD','HKD','CNY','KRW'));
  END IF;
END $$;
COMMIT;
