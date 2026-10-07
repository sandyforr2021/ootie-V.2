# SUPABASE-BASELINE-BATCH-12 changelog

All changes in this file are local-only. No Supabase project was contacted and no SQL was executed.

## Approved personal fixes

| File | Change | Classification | Reason |
| --- | --- | --- | --- |
| `003_ootie_clothing_items.sql` | `owner_id` is `uuid NOT NULL` with no default; explicit profile FK `NO ACTION` | `PERSONAL_FIX` | Explicit clothing ownership contract |
| `004_ootie_ootd_posts.sql` | `user_id` is `uuid NOT NULL` with no default; explicit profile FK `NO ACTION` | `PERSONAL_FIX` | Post author identity must be supplied |
| `005_ootie_sos_posts.sql` | `user_id` and `closet_owner_id` are `uuid NOT NULL` with no random default; explicit profile FK for `closet_owner_id` | `PERSONAL_FIX` | Requester and closet owner are profile identities |
| `006_ootie_outfit_suggestions.sql` | `user_id` is `uuid NOT NULL` with no default; explicit profile FK `NO ACTION` | `PERSONAL_FIX` | Suggestion author identity must be supplied |
| `007_ootie_auxiliary.sql` | Notification/like/save `user_id` fields are `uuid NOT NULL` with no random default; explicit profile FKs `NO ACTION` | `PERSONAL_FIX` | Recipient/actor identity must be supplied |
| `009_functions.sql` | `get_closet_stats()` resolves `auth.uid()` through `ootie_profiles.user_id` before comparing `owner_id` | `PERSONAL_FIX` | Clothing owner stores profile ID |
| `011_rls_policies.sql` | Enable RLS on all OOTIE tables; replace duplicate/inconsistent policies with profile-bridge owner policies | `PERSONAL_FIX` | Prevent direct Auth/profile ID mismatch and enforce ownership |
| `012_storage.sql` | Bind upload/update/delete to `bookmarks/<profile-id>/...` path | `PERSONAL_FIX` | Authenticated role alone did not prove object ownership |

## Deliberately unchanged

- `price bigint`, `purchase_date text`, `last_worn text`, nullable timestamps, JSON fields, and other product fields remain evidence-derived.
- `picked_suggestion_id`, `sos_id`, `post_id`, and array relationships retain their exported nullable/default shape because this batch does not redesign non-identity product relations.
- The team-proven bookmark `ON DELETE CASCADE` remains unchanged.
- `get_top_worn_items()` and `get_cost_per_wear_ranking()` remain uncreated because no team DDL evidence exists.
- Auth provisioning remains new-user-only; there is no bulk profile backfill.

## Batch status

The revised 003–012 source set is intended for a future sequential manual/CLI execution after a separate target identity confirmation. This changelog is not an execution log.
