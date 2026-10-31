-- OOTIE Personal Baseline 022 - Remote Social State & V1 Metadata
-- Development migration. Production is intentionally out of scope.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

CREATE TABLE public.ootie_profile_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES public.ootie_profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.ootie_profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ootie_profile_follows_distinct_profiles CHECK (follower_id <> following_id),
  CONSTRAINT ootie_profile_follows_unique_pair UNIQUE (follower_id, following_id)
);

CREATE INDEX ootie_profile_follows_follower_idx
  ON public.ootie_profile_follows (follower_id, created_at DESC);
CREATE INDEX ootie_profile_follows_following_idx
  ON public.ootie_profile_follows (following_id, created_at DESC);

ALTER TABLE public.ootie_profile_follows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ootie_profile_follows FROM anon, authenticated;
GRANT SELECT ON TABLE public.ootie_profile_follows TO anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.ootie_profile_follows TO authenticated;

CREATE POLICY ootie_profile_follows_public_select
ON public.ootie_profile_follows
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY ootie_profile_follows_owner_insert
ON public.ootie_profile_follows
FOR INSERT TO authenticated
WITH CHECK (
  follower_id = (
    SELECT p.id FROM public.ootie_profiles AS p
    WHERE p.user_id = (SELECT auth.uid())
  )
  AND follower_id <> following_id
);

CREATE POLICY ootie_profile_follows_owner_delete
ON public.ootie_profile_follows
FOR DELETE TO authenticated
USING (
  follower_id = (
    SELECT p.id FROM public.ootie_profiles AS p
    WHERE p.user_id = (SELECT auth.uid())
  )
);

ALTER TABLE public.ootie_notifications
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN read SET DEFAULT false,
  ALTER COLUMN read SET NOT NULL,
  ADD COLUMN event_type text,
  ADD COLUMN actor_profile_id uuid REFERENCES public.ootie_profiles(id) ON DELETE SET NULL,
  ADD COLUMN entity_id uuid,
  ADD COLUMN target_path text;

CREATE INDEX ootie_notifications_recipient_created_idx
  ON public.ootie_notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX ootie_notifications_event_dedupe_idx
  ON public.ootie_notifications (user_id, event_type, actor_profile_id, entity_id)
  WHERE event_type IS NOT NULL AND actor_profile_id IS NOT NULL AND entity_id IS NOT NULL;

ALTER TABLE public.ootie_clothing_items
  ADD COLUMN source_url text,
  ADD COLUMN source_domain text;

ALTER TABLE public.ootie_profile_private
  ADD COLUMN weather_city text,
  ADD CONSTRAINT ootie_profile_private_weather_city_length
    CHECK (weather_city IS NULL OR char_length(btrim(weather_city)) BETWEEN 1 AND 80);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.create_ootie_social_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient_id uuid;
  actor_id uuid;
  actor_name text;
  sos_title text;
  notification_type text;
  notification_text text;
  notification_entity uuid;
  notification_path text;
BEGIN
  IF TG_TABLE_NAME = 'ootie_profile_follows' THEN
    recipient_id := NEW.following_id;
    actor_id := NEW.follower_id;
    notification_type := 'FOLLOW';
    notification_entity := NEW.id;
    notification_path := '/profile?user=' || coalesce((SELECT username FROM public.ootie_profiles WHERE id = NEW.follower_id), '');
  ELSIF TG_TABLE_NAME = 'ootie_post_likes' THEN
    SELECT p.user_id INTO recipient_id
    FROM public.ootie_ootd_posts AS p
    WHERE p.id = NEW.post_id;
    notification_type := 'OOTD_LIKE';
    actor_id := NEW.user_id;
    notification_entity := NEW.post_id;
    notification_path := '/ootd/' || NEW.post_id::text;
  ELSIF TG_TABLE_NAME = 'ootie_outfit_suggestions' THEN
    SELECT s.user_id, s.title INTO recipient_id, sos_title
    FROM public.ootie_sos_posts AS s
    WHERE s.id = NEW.sos_id;
    notification_type := 'SOS_SUGGESTION';
    actor_id := NEW.user_id;
    notification_entity := NEW.sos_id;
    notification_path := '/sos?sos=' || NEW.sos_id::text;
  END IF;

  IF recipient_id IS NULL OR recipient_id = actor_id THEN
    RETURN NEW;
  END IF;

  SELECT CASE
    WHEN username LIKE '@%' THEN username
    WHEN username IS NOT NULL AND username != '' THEN '@' || username
    ELSE coalesce(nullif(display_name, ''), '@衣友')
  END
  INTO actor_name
  FROM public.ootie_profiles
  WHERE id = actor_id;

  notification_text := CASE notification_type
    WHEN 'FOLLOW' THEN actor_name || ' 開始追蹤你。'
    WHEN 'OOTD_LIKE' THEN actor_name || ' 喜歡了你的 OOTD。'
    WHEN 'SOS_SUGGESTION' THEN actor_name || '在你的 SOS 求救貼文『' || coalesce(sos_title, '穿搭求救') || '』留言了。'
  END;

  INSERT INTO public.ootie_notifications (
    user_id, text, meta, read, event_type, actor_profile_id, entity_id, target_path
  ) VALUES (
    recipient_id,
    notification_text,
    jsonb_build_object('source', 'database_trigger')::text,
    false,
    notification_type,
    actor_id,
    notification_entity,
    notification_path
  )
  ON CONFLICT (user_id, event_type, actor_profile_id, entity_id)
    WHERE event_type IS NOT NULL AND actor_profile_id IS NOT NULL AND entity_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.create_ootie_social_notification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ootie_follow_notification
AFTER INSERT ON public.ootie_profile_follows
FOR EACH ROW EXECUTE FUNCTION private.create_ootie_social_notification();

CREATE TRIGGER trg_ootie_like_notification
AFTER INSERT ON public.ootie_post_likes
FOR EACH ROW EXECUTE FUNCTION private.create_ootie_social_notification();

CREATE TRIGGER trg_ootie_suggestion_notification
AFTER INSERT ON public.ootie_outfit_suggestions
FOR EACH ROW EXECUTE FUNCTION private.create_ootie_social_notification();

COMMIT;
