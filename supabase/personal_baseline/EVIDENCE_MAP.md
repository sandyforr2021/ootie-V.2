# Baseline Evidence Map

Source references use 1-based CSV data-record numbers, not physical line numbers (multiline DDL spans lines).

| Source | SHA-256 | Records |
| --- | --- | --- |
| TEAM_SUPABASE_SCHEMA_SNAPSHOT.csv.csv | f79c7b2b60af4e53575f4aa7273218440049171cbb2ebdbe1ddc81122ee77daa | 376 |
| TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv | fafb3a0ab7f1ac241d9ed4b76e6436a90b9b2d62cf9912236c7d86688b94b6b5 | 812 |

## Source precedence and transformations

SNAPSHOT is authoritative for tables/constraints/indexes/RLS/policies/bucket/triggers; EXTRA supplies readable function DDL plus security/config/grants and the extension inventory.
Only schema qualification, identifier quoting, deterministic exported column order, final semicolons, transactions and CREATE-only collision behavior are added. No function body is redesigned.
ARRAY becomes uuid[] only where the same COLUMN record explicitly casts its default to uuid[]. default=NULL is emitted as no non-NULL default.
PK-backed indexes are produced by their named PK constraints, not created twice. SQL GRANT rows use logical signatures rather than database-specific routine OIDs.
Policy mode is absent in the evidence and remains mandatory unresolved metadata; no default mode is inferred.
Column physical order, owner, ACL defaults, extension namespace and undisclosed objects are outside the evidenced reconstruction.

## AUTH-IDENTITY-09 authorized delta

Team SNAPSHOT record 102 證明舊 `ootie_profiles.user_id` 是 nullable 且有 `gen_random_uuid()` default；Team constraints 沒有 Auth FK／UNIQUE，trigger export 也沒有 profile provisioning。AUTH-IDENTITY-09 是較新的個人版產品／安全規格，明確授權只覆寫這些 identity parts：

- `user_id uuid NOT NULL`，無 default。
- `ootie_profiles_user_id_key UNIQUE (user_id)`。
- `ootie_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE NO ACTION`。
- `public.handle_new_ootie_user()` 與 `auth.users AFTER INSERT` trigger，只處理未來新 user。

這些不是 Team export 事實；文件與驗證必須標示為 authorized personal baseline delta。其他 002 欄位與 003～008 content FK 保留 Team evidence。

## 001_extensions.sql

| Source | Data record | Object |
| --- | --- | --- |
| EXTRA | 11 | pg_stat_statements |
| EXTRA | 12 | pgcrypto |
| EXTRA | 13 | plpgsql |
| EXTRA | 14 | supabase_vault |
| EXTRA | 15 | uuid-ossp |
| EXTRA | 16 | vector |

## 002_ootie_profiles.sql

| Source | Data record | Object |
| --- | --- | --- |
| SNAPSHOT | 92 | public.ootie_profiles.avatar_url |
| SNAPSHOT | 93 | public.ootie_profiles.bio |
| SNAPSHOT | 94 | public.ootie_profiles.created_at |
| SNAPSHOT | 95 | public.ootie_profiles.hearts |
| SNAPSHOT | 96 | public.ootie_profiles.helped |
| SNAPSHOT | 97 | public.ootie_profiles.id |
| SNAPSHOT | 98 | public.ootie_profiles.initials |
| SNAPSHOT | 99 | public.ootie_profiles.likes |
| SNAPSHOT | 100 | public.ootie_profiles.name |
| SNAPSHOT | 101 | public.ootie_profiles.public_closet |
| SNAPSHOT | 102 | public.ootie_profiles.user_id |
| SNAPSHOT | 103 | public.ootie_profiles.username |
| SNAPSHOT | 167 | public.ootie_profiles.profiles_pkey |
| SNAPSHOT | 319 | public.profiles_pkey |

## 003_ootie_clothing_items.sql

| Source | Data record | Object |
| --- | --- | --- |
| SNAPSHOT | 44 | public.ootie_clothing_items.brand |
| SNAPSHOT | 45 | public.ootie_clothing_items.category |
| SNAPSHOT | 46 | public.ootie_clothing_items.color_hex |
| SNAPSHOT | 47 | public.ootie_clothing_items.created_at |
| SNAPSHOT | 48 | public.ootie_clothing_items.favorite |
| SNAPSHOT | 49 | public.ootie_clothing_items.hidden |
| SNAPSHOT | 50 | public.ootie_clothing_items.id |
| SNAPSHOT | 51 | public.ootie_clothing_items.last_worn |
| SNAPSHOT | 52 | public.ootie_clothing_items.name |
| SNAPSHOT | 53 | public.ootie_clothing_items.name_zh |
| SNAPSHOT | 54 | public.ootie_clothing_items.notes |
| SNAPSHOT | 55 | public.ootie_clothing_items.owner_id |
| SNAPSHOT | 56 | public.ootie_clothing_items.photo |
| SNAPSHOT | 57 | public.ootie_clothing_items.price |
| SNAPSHOT | 58 | public.ootie_clothing_items.primary_color |
| SNAPSHOT | 59 | public.ootie_clothing_items.purchase_date |
| SNAPSHOT | 60 | public.ootie_clothing_items.season |
| SNAPSHOT | 61 | public.ootie_clothing_items.secondary_color |
| SNAPSHOT | 62 | public.ootie_clothing_items.shape |
| SNAPSHOT | 63 | public.ootie_clothing_items.style |
| SNAPSHOT | 64 | public.ootie_clothing_items.wear_count |
| SNAPSHOT | 155 | public.ootie_clothing_items.ootie_clothing_items_owner_id_fkey |
| SNAPSHOT | 156 | public.ootie_clothing_items.ootie_clothing_items_pkey |
| SNAPSHOT | 312 | public.ootie_clothing_items_pkey |

## 004_ootie_ootd_posts.sql

| Source | Data record | Object |
| --- | --- | --- |
| SNAPSHOT | 71 | public.ootie_ootd_posts.caption |
| SNAPSHOT | 72 | public.ootie_ootd_posts.comments |
| SNAPSHOT | 73 | public.ootie_ootd_posts.created_at |
| SNAPSHOT | 74 | public.ootie_ootd_posts.hashtags |
| SNAPSHOT | 75 | public.ootie_ootd_posts.id |
| SNAPSHOT | 76 | public.ootie_ootd_posts.image |
| SNAPSHOT | 77 | public.ootie_ootd_posts.item_ids |
| SNAPSHOT | 78 | public.ootie_ootd_posts.likes |
| SNAPSHOT | 79 | public.ootie_ootd_posts.user_id |
| SNAPSHOT | 80 | public.ootie_ootd_posts.wearing |
| SNAPSHOT | 159 | public.ootie_ootd_posts.ootie_ootd_posts_pkey |
| SNAPSHOT | 160 | public.ootie_ootd_posts.ootie_ootd_posts_user_id_fkey |
| SNAPSHOT | 314 | public.ootie_ootd_posts_pkey |

## 005_ootie_sos_posts.sql

| Source | Data record | Object |
| --- | --- | --- |
| SNAPSHOT | 108 | public.ootie_sos_posts.closet_item_ids |
| SNAPSHOT | 109 | public.ootie_sos_posts.closet_owner_id |
| SNAPSHOT | 110 | public.ootie_sos_posts.created_at |
| SNAPSHOT | 111 | public.ootie_sos_posts.details |
| SNAPSHOT | 112 | public.ootie_sos_posts.id |
| SNAPSHOT | 113 | public.ootie_sos_posts.liked_suggestion_ids |
| SNAPSHOT | 114 | public.ootie_sos_posts.notes |
| SNAPSHOT | 115 | public.ootie_sos_posts.occasion |
| SNAPSHOT | 116 | public.ootie_sos_posts.picked_suggestion_id |
| SNAPSHOT | 117 | public.ootie_sos_posts.status |
| SNAPSHOT | 118 | public.ootie_sos_posts.title |
| SNAPSHOT | 119 | public.ootie_sos_posts.user_id |
| SNAPSHOT | 120 | public.ootie_sos_posts.vibes |
| SNAPSHOT | 121 | public.ootie_sos_posts.weather |
| SNAPSHOT | 122 | public.ootie_sos_posts.when_label |
| SNAPSHOT | 171 | public.ootie_sos_posts.ootie_sos_posts_pkey |
| SNAPSHOT | 172 | public.ootie_sos_posts.ootie_sos_posts_status_check |
| SNAPSHOT | 173 | public.ootie_sos_posts.ootie_sos_posts_user_id_fkey |
| SNAPSHOT | 318 | public.ootie_sos_posts_pkey |

## 006_ootie_outfit_suggestions.sql

| Source | Data record | Object |
| --- | --- | --- |
| SNAPSHOT | 81 | public.ootie_outfit_suggestions.created_at |
| SNAPSHOT | 82 | public.ootie_outfit_suggestions.hearts |
| SNAPSHOT | 83 | public.ootie_outfit_suggestions.id |
| SNAPSHOT | 84 | public.ootie_outfit_suggestions.item_ids |
| SNAPSHOT | 85 | public.ootie_outfit_suggestions.message |
| SNAPSHOT | 86 | public.ootie_outfit_suggestions.sos_id |
| SNAPSHOT | 87 | public.ootie_outfit_suggestions.user_id |
| SNAPSHOT | 161 | public.ootie_outfit_suggestions.ootie_outfit_suggestions_pkey |
| SNAPSHOT | 162 | public.ootie_outfit_suggestions.ootie_outfit_suggestions_sos_id_fkey |
| SNAPSHOT | 163 | public.ootie_outfit_suggestions.ootie_outfit_suggestions_user_id_fkey |
| SNAPSHOT | 315 | public.ootie_outfit_suggestions_pkey |

## 007_ootie_auxiliary.sql

| Source | Data record | Object |
| --- | --- | --- |
| SNAPSHOT | 65 | public.ootie_notifications.created_at |
| SNAPSHOT | 66 | public.ootie_notifications.id |
| SNAPSHOT | 67 | public.ootie_notifications.meta |
| SNAPSHOT | 68 | public.ootie_notifications.read |
| SNAPSHOT | 69 | public.ootie_notifications.text |
| SNAPSHOT | 70 | public.ootie_notifications.user_id |
| SNAPSHOT | 157 | public.ootie_notifications.ootie_notifications_pkey |
| SNAPSHOT | 158 | public.ootie_notifications.ootie_notifications_user_id_fkey |
| SNAPSHOT | 313 | public.ootie_notifications_pkey |
| SNAPSHOT | 88 | public.ootie_post_likes.created_at |
| SNAPSHOT | 89 | public.ootie_post_likes.id |
| SNAPSHOT | 90 | public.ootie_post_likes.post_id |
| SNAPSHOT | 91 | public.ootie_post_likes.user_id |
| SNAPSHOT | 164 | public.ootie_post_likes.ootie_post_likes_pkey |
| SNAPSHOT | 165 | public.ootie_post_likes.ootie_post_likes_post_id_fkey |
| SNAPSHOT | 166 | public.ootie_post_likes.ootie_post_likes_user_id_fkey |
| SNAPSHOT | 316 | public.ootie_post_likes_pkey |
| SNAPSHOT | 104 | public.ootie_saved_posts.created_at |
| SNAPSHOT | 105 | public.ootie_saved_posts.id |
| SNAPSHOT | 106 | public.ootie_saved_posts.post_id |
| SNAPSHOT | 107 | public.ootie_saved_posts.user_id |
| SNAPSHOT | 168 | public.ootie_saved_posts.ootie_saved_posts_pkey |
| SNAPSHOT | 169 | public.ootie_saved_posts.ootie_saved_posts_post_id_fkey |
| SNAPSHOT | 170 | public.ootie_saved_posts.ootie_saved_posts_user_id_fkey |
| SNAPSHOT | 317 | public.ootie_saved_posts_pkey |

## 008_ootie_bookmarks.sql

| Source | Data record | Object |
| --- | --- | --- |
| SNAPSHOT | 27 | public.ootie_bookmarks.brand |
| SNAPSHOT | 28 | public.ootie_bookmarks.color |
| SNAPSHOT | 29 | public.ootie_bookmarks.created_at |
| SNAPSHOT | 30 | public.ootie_bookmarks.currency |
| SNAPSHOT | 31 | public.ootie_bookmarks.description |
| SNAPSHOT | 32 | public.ootie_bookmarks.id |
| SNAPSHOT | 33 | public.ootie_bookmarks.image_storage_path |
| SNAPSHOT | 34 | public.ootie_bookmarks.image_url |
| SNAPSHOT | 35 | public.ootie_bookmarks.notes |
| SNAPSHOT | 36 | public.ootie_bookmarks.owner_id |
| SNAPSHOT | 37 | public.ootie_bookmarks.price |
| SNAPSHOT | 38 | public.ootie_bookmarks.product_url |
| SNAPSHOT | 39 | public.ootie_bookmarks.size |
| SNAPSHOT | 40 | public.ootie_bookmarks.source_domain |
| SNAPSHOT | 41 | public.ootie_bookmarks.title |
| SNAPSHOT | 42 | public.ootie_bookmarks.updated_at |
| SNAPSHOT | 43 | public.ootie_bookmarks.variant_name |
| SNAPSHOT | 153 | public.ootie_bookmarks.ootie_bookmarks_owner_id_fk |
| SNAPSHOT | 154 | public.ootie_bookmarks.ootie_bookmarks_pkey |
| SNAPSHOT | 307 | public.idx_ootie_bookmarks_owner_created_at |
| SNAPSHOT | 308 | public.idx_ootie_bookmarks_owner_updated_at |
| SNAPSHOT | 309 | public.idx_ootie_bookmarks_source_domain |
| SNAPSHOT | 311 | public.ootie_bookmarks_pkey |

## 009_functions.sql

07B 個人 baseline 相容性修正：EXTRA record 40 的函式回傳欄位 `wear_count integer`，SNAPSHOT 的 `ootie_clothing_items.wear_count` 為 `bigint`。009 在輸出欄位加入 `::integer`，保留已匯出的函式 signature；此處**不是團隊原 DDL 的逐字重建**。超過 integer 範圍的來源值在呼叫時可能失敗，尚未經 PostgreSQL 執行驗證。

| Source | Data record | Object |
| --- | --- | --- |
| EXTRA | 39 | public.get_closet_stats() |
| EXTRA | 265 | public.get_closet_stats.get_closet_stats_26062 grantee=PUBLIC; privilege=EXECUTE; grantable=NO |
| EXTRA | 266 | public.get_closet_stats.get_closet_stats_26062 grantee=service_role; privilege=EXECUTE; grantable=NO |
| EXTRA | 267 | public.get_closet_stats.get_closet_stats_26062 grantee=authenticated; privilege=EXECUTE; grantable=NO |
| EXTRA | 268 | public.get_closet_stats.get_closet_stats_26062 grantee=anon; privilege=EXECUTE; grantable=NO |
| EXTRA | 269 | public.get_closet_stats.get_closet_stats_26062 grantee=postgres; privilege=EXECUTE; grantable=YES |
| EXTRA | 38 | public.get_brand_stats() |
| EXTRA | 260 | public.get_brand_stats.get_brand_stats_26184 grantee=anon; privilege=EXECUTE; grantable=NO |
| EXTRA | 261 | public.get_brand_stats.get_brand_stats_26184 grantee=PUBLIC; privilege=EXECUTE; grantable=NO |
| EXTRA | 262 | public.get_brand_stats.get_brand_stats_26184 grantee=service_role; privilege=EXECUTE; grantable=NO |
| EXTRA | 263 | public.get_brand_stats.get_brand_stats_26184 grantee=authenticated; privilege=EXECUTE; grantable=NO |
| EXTRA | 264 | public.get_brand_stats.get_brand_stats_26184 grantee=postgres; privilege=EXECUTE; grantable=YES |
| EXTRA | 40 | public.get_disused_items() |
| EXTRA | 270 | public.get_disused_items.get_disused_items_26139 grantee=PUBLIC; privilege=EXECUTE; grantable=NO |
| EXTRA | 271 | public.get_disused_items.get_disused_items_26139 grantee=postgres; privilege=EXECUTE; grantable=YES |
| EXTRA | 272 | public.get_disused_items.get_disused_items_26139 grantee=anon; privilege=EXECUTE; grantable=NO |
| EXTRA | 273 | public.get_disused_items.get_disused_items_26139 grantee=authenticated; privilege=EXECUTE; grantable=NO |
| EXTRA | 274 | public.get_disused_items.get_disused_items_26139 grantee=service_role; privilege=EXECUTE; grantable=NO |
| EXTRA | 91 | public.set_updated_at() |
| EXTRA | 525 | public.set_updated_at.set_updated_at_26128 grantee=PUBLIC; privilege=EXECUTE; grantable=NO |
| EXTRA | 526 | public.set_updated_at.set_updated_at_26128 grantee=service_role; privilege=EXECUTE; grantable=NO |
| EXTRA | 527 | public.set_updated_at.set_updated_at_26128 grantee=authenticated; privilege=EXECUTE; grantable=NO |
| EXTRA | 528 | public.set_updated_at.set_updated_at_26128 grantee=anon; privilege=EXECUTE; grantable=NO |
| EXTRA | 529 | public.set_updated_at.set_updated_at_26128 grantee=postgres; privilege=EXECUTE; grantable=YES |
| EXTRA | 111 | public.update_ootie_bookmarks_updated_at() |
| EXTRA | 635 | public.update_ootie_bookmarks_updated_at.update_ootie_bookmarks_updated_at_26163 grantee=PUBLIC; privilege=EXECUTE; grantable=NO |
| EXTRA | 636 | public.update_ootie_bookmarks_updated_at.update_ootie_bookmarks_updated_at_26163 grantee=postgres; privilege=EXECUTE; grantable=YES |
| EXTRA | 637 | public.update_ootie_bookmarks_updated_at.update_ootie_bookmarks_updated_at_26163 grantee=service_role; privilege=EXECUTE; grantable=NO |
| EXTRA | 638 | public.update_ootie_bookmarks_updated_at.update_ootie_bookmarks_updated_at_26163 grantee=anon; privilege=EXECUTE; grantable=NO |
| EXTRA | 639 | public.update_ootie_bookmarks_updated_at.update_ootie_bookmarks_updated_at_26163 grantee=authenticated; privilege=EXECUTE; grantable=NO |

## 010_triggers.sql

| Source | Data record | Object |
| --- | --- | --- |
| SNAPSHOT | 368 | public.ootie_bookmarks.ootie_bookmarks_set_updated_at |
| SNAPSHOT | 369 | public.ootie_bookmarks.set_ootie_bookmarks_updated_at |

AUTH-IDENTITY-09 額外授權 `public.handle_new_ootie_user()` 與 `auth.users.on_auth_user_created_ootie_profile`；兩者沒有 Team export record，必須通過獨立 collision／catalog precheck。

## 011_rls_policies.sql

| Source | Data record | Object |
| --- | --- | --- |
| SNAPSHOT | 347 | public.ootie_bookmarks |
| SNAPSHOT | 348 | public.ootie_clothing_items |
| SNAPSHOT | 349 | public.ootie_notifications |
| SNAPSHOT | 350 | public.ootie_ootd_posts |
| SNAPSHOT | 351 | public.ootie_outfit_suggestions |
| SNAPSHOT | 352 | public.ootie_post_likes |
| SNAPSHOT | 353 | public.ootie_profiles |
| SNAPSHOT | 354 | public.ootie_saved_posts |
| SNAPSHOT | 355 | public.ootie_sos_posts |
| SNAPSHOT | 324 | public.ootie_bookmarks."Users can delete own bookmarks" |
| SNAPSHOT | 325 | public.ootie_bookmarks."Users can delete their own bookmarks" |
| SNAPSHOT | 326 | public.ootie_bookmarks."Users can insert own bookmarks" |
| SNAPSHOT | 327 | public.ootie_bookmarks."Users can insert their own bookmarks" |
| SNAPSHOT | 328 | public.ootie_bookmarks."Users can update own bookmarks" |
| SNAPSHOT | 329 | public.ootie_bookmarks."Users can update their own bookmarks" |
| SNAPSHOT | 330 | public.ootie_bookmarks."Users can view own bookmarks" |
| SNAPSHOT | 331 | public.ootie_bookmarks."Users can view their own bookmarks" |
| SNAPSHOT | 332 | public.ootie_clothing_items."Enable read access for all users" |
| SNAPSHOT | 333 | public.ootie_notifications."Enable read access for all users" |
| SNAPSHOT | 334 | public.ootie_ootd_posts."Enable read access for all users" |
| SNAPSHOT | 335 | public.ootie_outfit_suggestions."Enable read access for all users" |
| SNAPSHOT | 336 | public.ootie_post_likes."Enable read access for all users" |
| SNAPSHOT | 337 | public.ootie_profiles."Enable read access for all users" |
| SNAPSHOT | 338 | public.ootie_saved_posts."Enable read access for all users" |
| SNAPSHOT | 339 | public.ootie_sos_posts."Enable read access for all users" |

## 012_storage.sql

| Source | Data record | Object |
| --- | --- | --- |
| SNAPSHOT | 367 | storage.buckets.ootie-bookmarks-images |
| SNAPSHOT | 363 | storage.objects |
| SNAPSHOT | 340 | storage.objects."Bookmark images are viewable by everyone" |
| SNAPSHOT | 341 | storage.objects."Users can delete their own bookmark images" |
| SNAPSHOT | 342 | storage.objects."Users can update their own bookmark images" |
| SNAPSHOT | 343 | storage.objects."Users can upload their own bookmark images" |

## TEAM_SUPABASE_POLICY_MODES.csv.csv

SHA-256: a08019d52d3a7465420e64dc386b2157ebc04ee89f6dadcd76473356b2c0bd3d; 20 data records. Each record was joined by exact schema/table/policy name, then checked against SNAPSHOT command, roles, USING and WITH CHECK. All 20 modes are PERMISSIVE; no row was guessed.

| Data record | Policy | Mode |
| --- | --- | --- |
| 1 | public.ootie_bookmarks.Users can delete own bookmarks | PERMISSIVE |
| 2 | public.ootie_bookmarks.Users can delete their own bookmarks | PERMISSIVE |
| 3 | public.ootie_bookmarks.Users can insert own bookmarks | PERMISSIVE |
| 4 | public.ootie_bookmarks.Users can insert their own bookmarks | PERMISSIVE |
| 5 | public.ootie_bookmarks.Users can update own bookmarks | PERMISSIVE |
| 6 | public.ootie_bookmarks.Users can update their own bookmarks | PERMISSIVE |
| 7 | public.ootie_bookmarks.Users can view own bookmarks | PERMISSIVE |
| 8 | public.ootie_bookmarks.Users can view their own bookmarks | PERMISSIVE |
| 9 | public.ootie_clothing_items.Enable read access for all users | PERMISSIVE |
| 10 | public.ootie_notifications.Enable read access for all users | PERMISSIVE |
| 11 | public.ootie_ootd_posts.Enable read access for all users | PERMISSIVE |
| 12 | public.ootie_outfit_suggestions.Enable read access for all users | PERMISSIVE |
| 13 | public.ootie_post_likes.Enable read access for all users | PERMISSIVE |
| 14 | public.ootie_profiles.Enable read access for all users | PERMISSIVE |
| 15 | public.ootie_saved_posts.Enable read access for all users | PERMISSIVE |
| 16 | public.ootie_sos_posts.Enable read access for all users | PERMISSIVE |
| 17 | storage.objects.Bookmark images are viewable by everyone | PERMISSIVE |
| 18 | storage.objects.Users can delete their own bookmark images | PERMISSIVE |
| 19 | storage.objects.Users can update their own bookmark images | PERMISSIVE |
| 20 | storage.objects.Users can upload their own bookmark images | PERMISSIVE |
