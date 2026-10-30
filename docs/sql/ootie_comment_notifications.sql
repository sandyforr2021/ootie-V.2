BEGIN;
CREATE OR REPLACE FUNCTION private.create_ootie_social_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient_id uuid;
  actor_id uuid;
  actor_name text;
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
    SELECT s.user_id INTO recipient_id
    FROM public.ootie_sos_posts AS s
    WHERE s.id = NEW.sos_id;
    notification_type := 'SOS_SUGGESTION';
    actor_id := NEW.user_id;
    notification_entity := NEW.sos_id;
    notification_path := '/sos?sos=' || NEW.sos_id::text;
  ELSIF TG_TABLE_NAME = 'ootie_post_comments' THEN
    SELECT p.user_id INTO recipient_id FROM public.ootie_ootd_posts p WHERE p.id=NEW.post_id;
    actor_id := NEW.profile_id;
    notification_type := 'OOTD_COMMENT';
    notification_entity := NEW.id;
    notification_path := '/ootd/' || NEW.post_id::text || '?comment=1';
  END IF;

  IF recipient_id IS NULL OR recipient_id = actor_id THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(username, ''), nullif(display_name, ''), '@衣友')
  INTO actor_name
  FROM public.ootie_profiles
  WHERE id = actor_id;

  notification_text := CASE notification_type
    WHEN 'FOLLOW' THEN actor_name || ' 開始追蹤你。'
    WHEN 'OOTD_LIKE' THEN actor_name || ' 喜歡了你的 OOTD。'
    WHEN 'OOTD_COMMENT' THEN actor_name || ' 留言了你的 OOTD。'
    WHEN 'SOS_SUGGESTION' THEN actor_name || ' 回覆了你的穿搭 SOS。'
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


CREATE OR REPLACE TRIGGER trg_ootie_comment_notification AFTER INSERT ON public.ootie_post_comments FOR EACH ROW EXECUTE FUNCTION private.create_ootie_social_notification();
COMMIT;
