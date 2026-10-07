-- SUPABASE-BASELINE-BATCH-12 | PERSONAL RLS BASELINE
-- Target intent: OOTIE-sandy-dev. No SQL in this package has been executed.
-- PERSONAL_FIX: the team snapshot had RLS disabled on eight OOTIE tables and
-- duplicate bookmark policies, including auth.uid() = owner_id. This personal
-- baseline enables RLS and evaluates profile-owned IDs through user_id.
-- Social posts/SOS/suggestions retain public-read semantics where intended.
-- Clothing is private by default with explicit public-closet/SOS sharing; bookmarks,
-- saved posts and notifications remain owner-scoped.
-- Separate baseline: never combine with supabase/migrations/20260924_ootie_bookmarks.sql.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

ALTER TABLE public.ootie_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_bookmarks NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_clothing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_clothing_items NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_notifications NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_ootd_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_ootd_posts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_outfit_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_outfit_suggestions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_post_likes NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_saved_posts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_sos_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_sos_posts NO FORCE ROW LEVEL SECURITY;

-- Data API exposure is opt-in for this project. Grant only the operations
-- implemented below; RLS remains the row-level authorization boundary.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

REVOKE ALL ON TABLE
  public.ootie_profiles,
  public.ootie_clothing_items,
  public.ootie_ootd_posts,
  public.ootie_sos_posts,
  public.ootie_outfit_suggestions,
  public.ootie_notifications,
  public.ootie_post_likes,
  public.ootie_saved_posts,
  public.ootie_bookmarks
FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.ootie_profiles,
  public.ootie_ootd_posts,
  public.ootie_sos_posts,
  public.ootie_outfit_suggestions,
  public.ootie_post_likes
TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.ootie_profiles,
  public.ootie_clothing_items,
  public.ootie_ootd_posts,
  public.ootie_sos_posts,
  public.ootie_outfit_suggestions,
  public.ootie_bookmarks
TO authenticated;

GRANT SELECT, UPDATE, DELETE ON TABLE public.ootie_notifications TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE
  public.ootie_post_likes,
  public.ootie_saved_posts
TO authenticated;

-- Profile: public read; the authenticated profile owner may create, edit, or delete.
CREATE POLICY ootie_profiles_public_select
  ON public.ootie_profiles AS PERMISSIVE
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY ootie_profiles_self_insert
  ON public.ootie_profiles AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ootie_profiles_self_update
  ON public.ootie_profiles AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ootie_profiles_self_delete
  ON public.ootie_profiles AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Clothing: private by default. Authenticated users may read their own items,
-- items from profiles that explicitly enable public_closet, or items explicitly
-- shared by an OPEN SOS through closet_item_ids.
CREATE POLICY ootie_clothing_visible_select
  ON public.ootie_clothing_items AS PERMISSIVE
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.ootie_profiles owner_profile
      WHERE owner_profile.id = ootie_clothing_items.owner_id
        AND owner_profile.public_closet IS TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.ootie_sos_posts s
      WHERE s.status = 'OPEN'
        AND ootie_clothing_items.id = ANY (s.closet_item_ids)
    )
  );

CREATE POLICY ootie_clothing_owner_insert
  ON public.ootie_clothing_items AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_clothing_owner_update
  ON public.ootie_clothing_items AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())))
  WITH CHECK (owner_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_clothing_owner_delete
  ON public.ootie_clothing_items AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

-- OOTD posts: public read; author/profile owner writes.
CREATE POLICY ootie_ootd_public_select
  ON public.ootie_ootd_posts AS PERMISSIVE
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY ootie_ootd_owner_insert
  ON public.ootie_ootd_posts AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_ootd_owner_update
  ON public.ootie_ootd_posts AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_ootd_owner_delete
  ON public.ootie_ootd_posts AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

-- SOS: public read; the requesting profile (user_id) owns the post.
-- closet_owner_id is an explicit profile identity, but it is not treated as a
-- second write owner without a separately defined participant contract.
CREATE POLICY ootie_sos_public_select
  ON public.ootie_sos_posts AS PERMISSIVE
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY ootie_sos_owner_insert
  ON public.ootie_sos_posts AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_sos_owner_update
  ON public.ootie_sos_posts AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_sos_owner_delete
  ON public.ootie_sos_posts AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

-- Outfit suggestions: public read; suggestion author writes.
CREATE POLICY ootie_suggestions_public_select
  ON public.ootie_outfit_suggestions AS PERMISSIVE
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY ootie_suggestions_owner_insert
  ON public.ootie_outfit_suggestions AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_suggestions_owner_update
  ON public.ootie_outfit_suggestions AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_suggestions_owner_delete
  ON public.ootie_outfit_suggestions AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

-- Notifications: recipient-only read and lifecycle. System delivery is not a
-- client INSERT policy; it must use the server-side provisioning path.
CREATE POLICY ootie_notifications_recipient_select
  ON public.ootie_notifications AS PERMISSIVE
  FOR SELECT TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_notifications_recipient_update
  ON public.ootie_notifications AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_notifications_recipient_delete
  ON public.ootie_notifications AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

-- Likes: public read; actor may create or remove their own like. No UPDATE is
-- required because the row has no mutable actor/content contract.
CREATE POLICY ootie_post_likes_public_select
  ON public.ootie_post_likes AS PERMISSIVE
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY ootie_post_likes_owner_insert
  ON public.ootie_post_likes AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_post_likes_owner_delete
  ON public.ootie_post_likes AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

-- Saved posts are private to the actor.
CREATE POLICY ootie_saved_posts_owner_select
  ON public.ootie_saved_posts AS PERMISSIVE
  FOR SELECT TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_saved_posts_owner_insert
  ON public.ootie_saved_posts AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_saved_posts_owner_delete
  ON public.ootie_saved_posts AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (user_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

-- Bookmarks are private to the profile owner.
CREATE POLICY ootie_bookmarks_owner_select
  ON public.ootie_bookmarks AS PERMISSIVE
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_bookmarks_owner_insert
  ON public.ootie_bookmarks AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_bookmarks_owner_update
  ON public.ootie_bookmarks AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())))
  WITH CHECK (owner_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY ootie_bookmarks_owner_delete
  ON public.ootie_bookmarks AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));

COMMIT;
