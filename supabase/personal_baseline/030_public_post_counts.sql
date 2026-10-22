-- Public aggregate counts only. Never expose who saved a post.
BEGIN;
CREATE INDEX IF NOT EXISTS ootie_saved_outfits_target_count_idx
  ON public.ootie_saved_outfits (target_type,target_id);
CREATE OR REPLACE FUNCTION public.ootie_public_post_counts(post_ids uuid[])
RETURNS TABLE(post_id uuid, like_count bigint, comment_count bigint, save_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id,
    (SELECT count(*) FROM public.ootie_post_likes l WHERE l.post_id=p.id),
    (SELECT count(*) FROM public.ootie_post_comments c WHERE c.post_id=p.id),
    (SELECT count(*) FROM public.ootie_saved_outfits s WHERE s.target_type='OOTD' AND s.target_id=p.id)
  FROM public.ootie_ootd_posts p
  WHERE p.id IN (SELECT unnest(post_ids[1:100]));
$$;
REVOKE ALL ON FUNCTION public.ootie_public_post_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ootie_public_post_counts(uuid[]) TO anon, authenticated;
COMMIT;
