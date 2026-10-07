# Personal RLS policy matrix

This matrix describes the personal baseline in `supabase/personal_baseline/011_rls_policies.sql`. It is a personal security fix, not a claim that the team database used these enabled policies. The identity bridge is always:

```text
auth.uid() -> ootie_profiles.user_id -> ootie_profiles.id
```

No policy compares `auth.uid()` directly with a profile-owned `owner_id` or `user_id`.

| Table | RLS | SELECT | INSERT | UPDATE | DELETE | Semantics |
| --- | --- | --- | --- | --- | --- | --- |
| `ootie_profiles` | enabled, not forced | Public read | Authenticated user where `user_id = auth.uid()` | Profile owner | Profile owner | Public profile discovery; owner manages own profile |
| `ootie_clothing_items` | enabled, not forced | Public read | Profile owner through `owner_id` bridge | Profile owner | Profile owner | Public closet content; writes require explicit profile ID |
| `ootie_ootd_posts` | enabled, not forced | Public read | Author/profile owner through `user_id` bridge | Author | Author | Public social posts |
| `ootie_sos_posts` | enabled, not forced | Public read | Requesting profile through `user_id` bridge | Requesting profile | Requesting profile | Public SOS content; `closet_owner_id` is an identity reference but not a second write owner |
| `ootie_outfit_suggestions` | enabled, not forced | Public read | Suggestion author through `user_id` bridge | Suggestion author | Suggestion author | Public replies; participant write semantics remain intentionally narrow |
| `ootie_notifications` | enabled, not forced | Recipient only | No client policy; system delivery path | Recipient | Recipient | Notifications are private; system delivery is not opened to clients |
| `ootie_post_likes` | enabled, not forced | Public read | Like actor through `user_id` bridge | No update policy | Like actor | Like rows are create/delete lifecycle objects |
| `ootie_saved_posts` | enabled, not forced | Public read | Save actor through `user_id` bridge | No update policy | Save actor | Saved rows are create/delete lifecycle objects |
| `ootie_bookmarks` | enabled, not forced | Bookmark owner | Bookmark owner | Bookmark owner | Bookmark owner | Private personal bookmarks |
| `storage.objects` (`ootie-bookmarks-images`) | enabled, not forced | Public bucket read | Authenticated profile folder owner | Same folder owner | Same folder owner | Path must be `bookmarks/<ootie_profiles.id>/...` |

## Policy naming

The executable policy names are intentionally unique and explicit:

- `ootie_profiles_public_select`, `ootie_profiles_self_insert`, `ootie_profiles_self_update`, `ootie_profiles_self_delete`
- `ootie_clothing_public_select`, `ootie_clothing_owner_insert`, `ootie_clothing_owner_update`, `ootie_clothing_owner_delete`
- `ootie_ootd_public_select`, `ootie_ootd_owner_insert`, `ootie_ootd_owner_update`, `ootie_ootd_owner_delete`
- `ootie_sos_public_select`, `ootie_sos_owner_insert`, `ootie_sos_owner_update`, `ootie_sos_owner_delete`
- `ootie_suggestions_public_select`, `ootie_suggestions_owner_insert`, `ootie_suggestions_owner_update`, `ootie_suggestions_owner_delete`
- `ootie_notifications_recipient_select`, `ootie_notifications_recipient_update`, `ootie_notifications_recipient_delete`
- `ootie_post_likes_public_select`, `ootie_post_likes_owner_insert`, `ootie_post_likes_owner_delete`
- `ootie_saved_posts_public_select`, `ootie_saved_posts_owner_insert`, `ootie_saved_posts_owner_delete`
- `ootie_bookmarks_owner_select`, `ootie_bookmarks_owner_insert`, `ootie_bookmarks_owner_update`, `ootie_bookmarks_owner_delete`
- `ootie_bookmark_images_public_select`, `ootie_bookmark_images_owner_insert`, `ootie_bookmark_images_owner_update`, `ootie_bookmark_images_owner_delete`

The old duplicate bookmark policies and the old `auth.uid() = owner_id` policies are not carried into the personal baseline.

## Known limits

- The team snapshot recorded eight OOTIE tables with RLS disabled and public SELECT policies. Enabling RLS and adding write ownership is therefore classified `PERSONAL_FIX`.
- Participant-specific permissions for SOS responders and suggestion readers are not inferred. Public SELECT remains the confirmed social behavior; writes stay with the row's profile owner.
- Table grants/default privileges are outside the exported evidence and are not invented here.
