-- OOTIE only. Additive migration; existing posts and interactions are retained.
BEGIN;
CREATE TABLE public.ootie_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.ootie_ootd_posts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.ootie_profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ootie_post_comments_post_created ON public.ootie_post_comments(post_id, created_at);
CREATE INDEX ootie_post_comments_profile ON public.ootie_post_comments(profile_id);
ALTER TABLE public.ootie_post_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ootie_post_comments FROM anon, authenticated;
GRANT SELECT ON public.ootie_post_comments TO anon, authenticated;
GRANT INSERT, DELETE ON public.ootie_post_comments TO authenticated;
GRANT ALL ON public.ootie_post_comments TO service_role;
CREATE POLICY comments_public_read ON public.ootie_post_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY comments_author_insert ON public.ootie_post_comments FOR INSERT TO authenticated
  WITH CHECK (profile_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));
CREATE POLICY comments_author_delete ON public.ootie_post_comments FOR DELETE TO authenticated
  USING (profile_id = (SELECT p.id FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())));
COMMIT;
