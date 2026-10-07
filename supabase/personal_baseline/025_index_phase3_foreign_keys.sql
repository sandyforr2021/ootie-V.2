-- Cover nullable foreign keys reported by the Development Performance Advisor.

BEGIN;

CREATE INDEX IF NOT EXISTS ootie_ai_generations_point_transaction_idx
  ON public.ootie_ai_generations(point_transaction_id)
  WHERE point_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ootie_notifications_actor_profile_idx
  ON public.ootie_notifications(actor_profile_id)
  WHERE actor_profile_id IS NOT NULL;

COMMIT;
