# SUPABASE-SCHEMA-04／05 團隊快照與補充匯出比對

日期：2026-09-27。證據僅來自本機 `TEAM_SUPABASE_SCHEMA_SNAPSHOT.csv.csv`（376 筆）與 `TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv`（812 筆；兩者實際檔名都有兩個 `.csv`）、`TABLE_SCHEMA_REQUIREMENTS.md`、`SUPABASE_SCHEMA_MIGRATION_PLAN.md`、外層正式 `src/`、`supabase/`，以及只用於辨識來源名稱的 `legacy/` SQL。沒有連線任何 Supabase、執行 SQL 或使用 secret。原快照提供 `COLUMN / CONSTRAINT / FUNCTION / INDEX / POLICY / RLS_STATUS / STORAGE_BUCKET / TRIGGER`；補充匯出提供 `ENUM / EXTENSION / FUNCTION / FUNCTION_GRANT / TRIGGER`。兩份檔案均無 `VIEW` 記錄、無 `auth.users` trigger 記錄；未取得匯出查詢與完整性證明，**不能**把未列出等同於團隊資料庫不存在。第 14 節記錄 SCHEMA-05 的補充證據與仍未解決的問題。

## 1. 團隊 public tables 與正式前端

`COLUMN` 與 `RLS_STATUS` 一致指向下列 **15 張 public table**。其中 9 張屬 OOTIE 名稱；前端直接 `.from(...)` 的團隊表有 5 張，另直接呼叫兩個快照未列出的 `profiles`、`items` 表名。

| Snapshot 中存在的 public table | 正式 `src/` 直接 `.from` | 判斷 |
| --- | --- | --- |
| `ootie_profiles` | 否 | 團隊真實存在；其他 OOTIE 表的多數 FK 目的地，bookmarks policy 也查它 |
| `ootie_clothing_items` | 是 | 正式程式更新 `notes`；三個已存在 RPC 都查它 |
| `ootie_ootd_posts` | 是 | 正式程式 CRUD／詳情讀取 |
| `ootie_sos_posts` | 是 | 正式程式讀取、新增、狀態與採納更新 |
| `ootie_outfit_suggestions` | 是 | 正式程式讀取、新增 |
| `ootie_bookmarks` | 是 | 正式程式 CRUD；repo 唯一建表 migration |
| `ootie_notifications` | 否 | 團隊真實存在，正式通知仍在 localStorage；完整團隊 OOTIE parity 應包含 |
| `ootie_post_likes` | 否 | 團隊真實存在，正式 likes 目前只改本機 store；完整 parity 應包含 |
| `ootie_saved_posts` | 否 | 團隊真實存在，正式 saved 狀態目前只改本機 store；完整 parity 應包含 |
| `careu`, `documents`, `functions`, `rag_query_logs`, `recommendations`, `test_table` | 否 | 團隊共用專案中的其他資料；沒有正式 OOTIE 引用，不納入個人 OOTIE migration |

**快照未列出** `public.profiles`、`public.items`。正式 `src/services/supabase.js:18-197` 仍對它們 `.from(...)`：`profiles` 的 avatar 讀／upsert 已接線，完整 profile helper 未接線；`items` 的刪除已接線，查詢／新增 helper 未接線。`legacy/sinsin/supabase-schema.sql` 有 `profiles`、`posts`；`legacy/ming/supabase/schema.sql` 有 `profiles`、`items`。因此 `profiles`／`items` 是**正式程式仍帶有的 legacy schema 名稱**，不是 CSV 證實的團隊表；`posts` 僅 legacy，正式前端不使用。快照沒有 `TABLE` 清單來源 SQL，若要把「未列出」提升成「團隊絕對不存在」，仍需完整 catalog 清單。

## 2. Column schema：團隊 OOTIE 實際結構

下表逐列轉錄 CSV 的 `COLUMN`，保留 PostgreSQL 型別、nullable、default，並交叉標出 CSV `CONSTRAINT` 中的 PK／FK／CHECK。`—` 代表快照沒有該項；**不表示資料庫其他未匯出的規則不存在**。所有 OOTIE 表都沒有被快照記錄的非 PK `UNIQUE` constraint；PK 本身當然唯一。`timestamp with time zone` 即此快照記錄的時間欄型別；`last_worn`／`purchase_date` 在衣物表是 `text`，不可改寫成 date 當成團隊現況。

### `public.ootie_profiles` (12 欄)

| Column | PostgreSQL type | Nullable | Default | PK | Non-PK UNIQUE | FK | CHECK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `avatar_url` | `text` | YES | `NULL` | — | — | — | — |
| `bio` | `text` | YES | `NULL` | — | — | — | — |
| `created_at` | `timestamp with time zone` | YES | `NULL` | — | — | — | — |
| `hearts` | `bigint` | YES | `NULL` | — | — | — | — |
| `helped` | `bigint` | YES | `NULL` | — | — | — | — |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | — | — | — |
| `initials` | `text` | YES | `NULL` | — | — | — | — |
| `likes` | `bigint` | YES | `NULL` | — | — | — | — |
| `name` | `text` | YES | `NULL` | — | — | — | — |
| `public_closet` | `boolean` | YES | `NULL` | — | — | — | — |
| `user_id` | `uuid` | YES | `gen_random_uuid()` | — | — | — | — |
| `username` | `text` | YES | `NULL` | — | — | — | — |

**Timestamp 欄**：`created_at`。

### `public.ootie_clothing_items` (21 欄)

| Column | PostgreSQL type | Nullable | Default | PK | Non-PK UNIQUE | FK | CHECK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `brand` | `text` | YES | `NULL` | — | — | — | — |
| `category` | `text` | YES | `NULL` | — | — | — | — |
| `color_hex` | `text` | YES | `NULL` | — | — | — | — |
| `created_at` | `timestamp with time zone` | YES | `NULL` | — | — | — | — |
| `favorite` | `boolean` | YES | `NULL` | — | — | — | — |
| `hidden` | `boolean` | YES | `NULL` | — | — | — | — |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | — | — | — |
| `last_worn` | `text` | YES | `NULL` | — | — | — | — |
| `name` | `text` | YES | `NULL` | — | — | — | — |
| `name_zh` | `text` | YES | `NULL` | — | — | — | — |
| `notes` | `text` | YES | `NULL` | — | — | — | — |
| `owner_id` | `uuid` | YES | `gen_random_uuid()` | — | — | `ootie_profiles(id)` | — |
| `photo` | `text` | YES | `NULL` | — | — | — | — |
| `price` | `bigint` | YES | `NULL` | — | — | — | — |
| `primary_color` | `text` | YES | `NULL` | — | — | — | — |
| `purchase_date` | `text` | YES | `NULL` | — | — | — | — |
| `season` | `text` | YES | `NULL` | — | — | — | — |
| `secondary_color` | `text` | YES | `NULL` | — | — | — | — |
| `shape` | `text` | YES | `NULL` | — | — | — | — |
| `style` | `text` | YES | `NULL` | — | — | — | — |
| `wear_count` | `bigint` | YES | `NULL` | — | — | — | — |

**Timestamp 欄**：`created_at`。

### `public.ootie_ootd_posts` (10 欄)

| Column | PostgreSQL type | Nullable | Default | PK | Non-PK UNIQUE | FK | CHECK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `caption` | `text` | YES | `NULL` | — | — | — | — |
| `comments` | `bigint` | YES | `NULL` | — | — | — | — |
| `created_at` | `timestamp with time zone` | YES | `NULL` | — | — | — | — |
| `hashtags` | `jsonb` | YES | `NULL` | — | — | — | — |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | — | — | — |
| `image` | `text` | YES | `NULL` | — | — | — | — |
| `item_ids` | `jsonb` | YES | `NULL` | — | — | — | — |
| `likes` | `bigint` | YES | `NULL` | — | — | — | — |
| `user_id` | `uuid` | YES | `gen_random_uuid()` | — | — | `ootie_profiles(id)` | — |
| `wearing` | `jsonb` | YES | `NULL` | — | — | — | — |

**Timestamp 欄**：`created_at`。

### `public.ootie_sos_posts` (15 欄)

| Column | PostgreSQL type | Nullable | Default | PK | Non-PK UNIQUE | FK | CHECK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `closet_item_ids` | `ARRAY` | NO | `'{}'::uuid[]` | — | — | — | — |
| `closet_owner_id` | `uuid` | YES | `gen_random_uuid()` | — | — | — | — |
| `created_at` | `timestamp with time zone` | YES | `NULL` | — | — | — | — |
| `details` | `text` | YES | `NULL` | — | — | — | — |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | — | — | — |
| `liked_suggestion_ids` | `ARRAY` | NO | `'{}'::uuid[]` | — | — | — | — |
| `notes` | `text` | YES | `NULL` | — | — | — | — |
| `occasion` | `text` | YES | `NULL` | — | — | — | — |
| `picked_suggestion_id` | `uuid` | YES | `gen_random_uuid()` | — | — | — | — |
| `status` | `text` | NO | `'OPEN'::text` | — | — | — | `CHECK (status = ANY (ARRAY['OPEN'::text, 'CLOSED'::text]))` |
| `title` | `text` | YES | `NULL` | — | — | — | — |
| `user_id` | `uuid` | YES | `gen_random_uuid()` | — | — | `ootie_profiles(id)` | — |
| `vibes` | `jsonb` | YES | `NULL` | — | — | — | — |
| `weather` | `text` | YES | `NULL` | — | — | — | — |
| `when_label` | `text` | YES | `NULL` | — | — | — | — |

**Timestamp 欄**：`created_at`。

### `public.ootie_outfit_suggestions` (7 欄)

| Column | PostgreSQL type | Nullable | Default | PK | Non-PK UNIQUE | FK | CHECK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `created_at` | `timestamp with time zone` | YES | `NULL` | — | — | — | — |
| `hearts` | `bigint` | YES | `NULL` | — | — | — | — |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | — | — | — |
| `item_ids` | `jsonb` | YES | `NULL` | — | — | — | — |
| `message` | `text` | YES | `NULL` | — | — | — | — |
| `sos_id` | `uuid` | YES | `gen_random_uuid()` | — | — | `ootie_sos_posts(id)` | — |
| `user_id` | `uuid` | YES | `gen_random_uuid()` | — | — | `ootie_profiles(id)` | — |

**Timestamp 欄**：`created_at`。

### `public.ootie_bookmarks` (17 欄)

| Column | PostgreSQL type | Nullable | Default | PK | Non-PK UNIQUE | FK | CHECK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `brand` | `text` | YES | `NULL` | — | — | — | — |
| `color` | `text` | YES | `NULL` | — | — | — | — |
| `created_at` | `timestamp with time zone` | NO | `now()` | — | — | — | — |
| `currency` | `text` | YES | `NULL` | — | — | — | — |
| `description` | `text` | YES | `NULL` | — | — | — | — |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | — | — | — |
| `image_storage_path` | `text` | YES | `NULL` | — | — | — | — |
| `image_url` | `text` | YES | `NULL` | — | — | — | — |
| `notes` | `text` | YES | `NULL` | — | — | — | — |
| `owner_id` | `uuid` | NO | `NULL` | — | — | `ootie_profiles(id) ON DELETE CASCADE` | — |
| `price` | `text` | YES | `NULL` | — | — | — | — |
| `product_url` | `text` | NO | `NULL` | — | — | — | — |
| `size` | `text` | YES | `NULL` | — | — | — | — |
| `source_domain` | `text` | YES | `NULL` | — | — | — | — |
| `title` | `text` | NO | `NULL` | — | — | — | — |
| `updated_at` | `timestamp with time zone` | NO | `now()` | — | — | — | — |
| `variant_name` | `text` | YES | `NULL` | — | — | — | — |

**Timestamp 欄**：`created_at`, `updated_at`。

### `public.ootie_notifications` (6 欄)

| Column | PostgreSQL type | Nullable | Default | PK | Non-PK UNIQUE | FK | CHECK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `created_at` | `timestamp with time zone` | YES | `NULL` | — | — | — | — |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | — | — | — |
| `meta` | `text` | YES | `NULL` | — | — | — | — |
| `read` | `boolean` | YES | `NULL` | — | — | — | — |
| `text` | `text` | YES | `NULL` | — | — | — | — |
| `user_id` | `uuid` | YES | `gen_random_uuid()` | — | — | `ootie_profiles(id)` | — |

**Timestamp 欄**：`created_at`。

### `public.ootie_post_likes` (4 欄)

| Column | PostgreSQL type | Nullable | Default | PK | Non-PK UNIQUE | FK | CHECK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `created_at` | `timestamp with time zone` | YES | `NULL` | — | — | — | — |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | — | — | — |
| `post_id` | `uuid` | YES | `gen_random_uuid()` | — | — | `ootie_ootd_posts(id)` | — |
| `user_id` | `uuid` | YES | `gen_random_uuid()` | — | — | `ootie_profiles(id)` | — |

**Timestamp 欄**：`created_at`。

### `public.ootie_saved_posts` (4 欄)

| Column | PostgreSQL type | Nullable | Default | PK | Non-PK UNIQUE | FK | CHECK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `created_at` | `timestamp with time zone` | YES | `NULL` | — | — | — | — |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | — | — | — |
| `post_id` | `uuid` | YES | `gen_random_uuid()` | — | — | `ootie_ootd_posts(id)` | — |
| `user_id` | `uuid` | YES | `gen_random_uuid()` | — | — | `ootie_profiles(id)` | — |

**Timestamp 欄**：`created_at`。


`profiles`、`items` 在快照沒有任何 `COLUMN`／`RLS_STATUS`／`CONSTRAINT` 記錄，因此不能為它們填造型別或約束。三張未被正式前端查詢的 OOTIE 輔助表也一併列出，供決定是否複製完整團隊 OOTIE 結構；不應因存在就推定目前前端使用。

## 3. Constraints 與 indexes

以下是 CSV 中 **全部 OOTIE 名稱表**的 constraint 和 index；沒有自創 FK。`ootie_profiles.user_id` **沒有**指向 `auth.users.id` 的 FK 記錄，也沒有唯一約束；`ootie_sos_posts.closet_owner_id`、`picked_suggestion_id` 與 UUID arrays 均無 FK 記錄。這與「應該有關聯」是兩回事。

### Constraints（snapshot 全部 OOTIE 表）

| Object name | Definition |
| --- | --- |
| `public.ootie_bookmarks.ootie_bookmarks_owner_id_fk` | `FOREIGN KEY (owner_id) REFERENCES ootie_profiles(id) ON DELETE CASCADE` |
| `public.ootie_bookmarks.ootie_bookmarks_pkey` | `PRIMARY KEY (id)` |
| `public.ootie_clothing_items.ootie_clothing_items_owner_id_fkey` | `FOREIGN KEY (owner_id) REFERENCES ootie_profiles(id)` |
| `public.ootie_clothing_items.ootie_clothing_items_pkey` | `PRIMARY KEY (id)` |
| `public.ootie_notifications.ootie_notifications_pkey` | `PRIMARY KEY (id)` |
| `public.ootie_notifications.ootie_notifications_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES ootie_profiles(id)` |
| `public.ootie_ootd_posts.ootie_ootd_posts_pkey` | `PRIMARY KEY (id)` |
| `public.ootie_ootd_posts.ootie_ootd_posts_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES ootie_profiles(id)` |
| `public.ootie_outfit_suggestions.ootie_outfit_suggestions_pkey` | `PRIMARY KEY (id)` |
| `public.ootie_outfit_suggestions.ootie_outfit_suggestions_sos_id_fkey` | `FOREIGN KEY (sos_id) REFERENCES ootie_sos_posts(id)` |
| `public.ootie_outfit_suggestions.ootie_outfit_suggestions_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES ootie_profiles(id)` |
| `public.ootie_post_likes.ootie_post_likes_pkey` | `PRIMARY KEY (id)` |
| `public.ootie_post_likes.ootie_post_likes_post_id_fkey` | `FOREIGN KEY (post_id) REFERENCES ootie_ootd_posts(id)` |
| `public.ootie_post_likes.ootie_post_likes_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES ootie_profiles(id)` |
| `public.ootie_profiles.profiles_pkey` | `PRIMARY KEY (id)` |
| `public.ootie_saved_posts.ootie_saved_posts_pkey` | `PRIMARY KEY (id)` |
| `public.ootie_saved_posts.ootie_saved_posts_post_id_fkey` | `FOREIGN KEY (post_id) REFERENCES ootie_ootd_posts(id)` |
| `public.ootie_saved_posts.ootie_saved_posts_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES ootie_profiles(id)` |
| `public.ootie_sos_posts.ootie_sos_posts_pkey` | `PRIMARY KEY (id)` |
| `public.ootie_sos_posts.ootie_sos_posts_status_check` | `CHECK (status = ANY (ARRAY['OPEN'::text, 'CLOSED'::text]))` |
| `public.ootie_sos_posts.ootie_sos_posts_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES ootie_profiles(id)` |

### Indexes（snapshot 全部 OOTIE 表）

| Object name | Definition |
| --- | --- |
| `public.idx_ootie_bookmarks_owner_created_at` | `CREATE INDEX idx_ootie_bookmarks_owner_created_at ON public.ootie_bookmarks USING btree (owner_id, created_at DESC)` |
| `public.idx_ootie_bookmarks_owner_updated_at` | `CREATE INDEX idx_ootie_bookmarks_owner_updated_at ON public.ootie_bookmarks USING btree (owner_id, updated_at DESC)` |
| `public.idx_ootie_bookmarks_source_domain` | `CREATE INDEX idx_ootie_bookmarks_source_domain ON public.ootie_bookmarks USING btree (source_domain)` |
| `public.ootie_bookmarks_pkey` | `CREATE UNIQUE INDEX ootie_bookmarks_pkey ON public.ootie_bookmarks USING btree (id)` |
| `public.ootie_clothing_items_pkey` | `CREATE UNIQUE INDEX ootie_clothing_items_pkey ON public.ootie_clothing_items USING btree (id)` |
| `public.ootie_notifications_pkey` | `CREATE UNIQUE INDEX ootie_notifications_pkey ON public.ootie_notifications USING btree (id)` |
| `public.ootie_ootd_posts_pkey` | `CREATE UNIQUE INDEX ootie_ootd_posts_pkey ON public.ootie_ootd_posts USING btree (id)` |
| `public.ootie_outfit_suggestions_pkey` | `CREATE UNIQUE INDEX ootie_outfit_suggestions_pkey ON public.ootie_outfit_suggestions USING btree (id)` |
| `public.ootie_post_likes_pkey` | `CREATE UNIQUE INDEX ootie_post_likes_pkey ON public.ootie_post_likes USING btree (id)` |
| `public.ootie_saved_posts_pkey` | `CREATE UNIQUE INDEX ootie_saved_posts_pkey ON public.ootie_saved_posts USING btree (id)` |
| `public.ootie_sos_posts_pkey` | `CREATE UNIQUE INDEX ootie_sos_posts_pkey ON public.ootie_sos_posts USING btree (id)` |
| `public.profiles_pkey` | `CREATE UNIQUE INDEX profiles_pkey ON public.ootie_profiles USING btree (id)` |

團隊 OOTIE 的唯一額外 CHECK 是 `ootie_sos_posts.status IN ('OPEN','CLOSED')`；所有 OOTIE 非 PK index 只出現在 `ootie_bookmarks`。repo migration 只包含其中的 `(owner_id, created_at DESC)` index。

## 4. Auth／Identity 現況

| 問題 | 快照能證實的現況 | 限制 |
| --- | --- | --- |
| `profiles` 是否 FK 到 `auth.users` | 快照未列出 `public.profiles`；正式程式讀寫它 | 不能確認此表在團隊端存在 |
| `ootie_profiles` 是否存在 | **存在**；`id uuid PK default gen_random_uuid()`，`user_id uuid nullable default gen_random_uuid()` | 原快照無 `user_id -> auth.users.id` FK／UNIQUE；補充匯出沒有新增 constraint 證據，也未列出 Auth trigger；實際資料對應／建立流程 **UNKNOWN** |
| 內容 FK 指向誰 | `ootie_clothing_items.owner_id`、`ootie_ootd_posts.user_id`、`ootie_sos_posts.user_id`、`ootie_outfit_suggestions.user_id`、`ootie_bookmarks.owner_id` 以及三張輔助表的 `user_id` 均 FK 到 `ootie_profiles.id`；suggestion `sos_id -> ootie_sos_posts.id` | 沒有證據支持把這些 FK 改說成直接指向 `auth.users` |
| `profile_id` | 正式程式以 `appStore.profile.id` 當 profile 身分，資料庫欄名通常是 `owner_id`／`user_id`；快照未見名為 `profile_id` 的 OOTIE 欄位 | 不能用前端變數名推論 SQL 欄名 |
| `user-01`／`profile-01` | `src/services/supabase.js:9`、`src/constants/index.js:88-100` 與 stores 明確硬編碼的 mock | 都不是 UUID，不能符合團隊表的 UUID 欄／FK；也不等於已登入的 Auth user |

正式 Auth store 會呼叫 `getSession`、`signInWithPassword`、`signUp`、`signOut`，但資料 service 不把真實 session user ID 解析成團隊 `ootie_profiles.id`。`src/stores/auth.js:22-30` 還能用 localStorage 模擬登入。現有團隊 schema 的身分主軸是 **內容列 → `ootie_profiles.id`**；`ootie_profiles.user_id → auth.users.id` 是否成立於資料或 trigger，CSV 無法確認。上一階段 `SUPABASE_SCHEMA_MIGRATION_PLAN.md:18-25` 建議的「直接 FK Auth UUID、以 `profiles` 為 canonical」是**設計建議，與團隊快照不符**；忠實複製版應以快照為準，暫不改成另一套模型。

`ootie_profiles` 的 PK／index 名為 `profiles_pkey`，只是**現存物件名稱**，不能把它當作 `public.profiles` 表存在的證據。

特別注意：多個指向 `ootie_profiles` 的 FK 欄位雖可空，卻預設 `gen_random_uuid()`；未提供值時很可能產生不對應任何 profile 的 UUID。`ootie_sos_posts.picked_suggestion_id` 也預設隨機 UUID，但快照沒有其 FK。這些是團隊真實 default，是否應在個人版原樣保留，需與既有資料／應用流程核對；不能悄悄「修正」後仍聲稱忠實還原。

## 5. RLS status 與全部相關 policies

| 關係 | 快照 RLS | 說明 |
| --- | --- | --- |
| `public.ootie_bookmarks` | enabled=t, forced=f | 唯一啟用 RLS 的 OOTIE 表；8 個 policy |
| `public.ootie_profiles`, `ootie_clothing_items`, `ootie_ootd_posts`, `ootie_sos_posts`, `ootie_outfit_suggestions`, `ootie_notifications`, `ootie_post_likes`, `ootie_saved_posts` | enabled=f, forced=f | 各有一個 `SELECT USING true` policy，**RLS 關閉時 policy 不生效**；快照未列出這些表的寫入 policy |
| `storage.objects` | enabled=t, forced=f | bucket 對應 4 個 policy |

CSV 的 `roles={public}` 是 policy 的適用角色集合；它不代表 row 自動公開，仍需看 RLS 開關與 `USING`／`WITH CHECK`。下面逐項保留 policy 名稱、command、roles、USING、WITH CHECK：

| Relation | Policy name | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- | --- |
| `public.ootie_bookmarks` | `Users can delete own bookmarks` | `DELETE` | `{public}` | `(owner_id = ( SELECT ootie_profiles.id FROM ootie_profiles WHERE (ootie_profiles.user_id = auth.uid())))` | `NULL` |
| `public.ootie_bookmarks` | `Users can delete their own bookmarks` | `DELETE` | `{public}` | `(auth.uid() = owner_id)` | `NULL` |
| `public.ootie_bookmarks` | `Users can insert own bookmarks` | `INSERT` | `{public}` | `NULL` | `(owner_id = ( SELECT ootie_profiles.id FROM ootie_profiles WHERE (ootie_profiles.user_id = auth.uid())))` |
| `public.ootie_bookmarks` | `Users can insert their own bookmarks` | `INSERT` | `{public}` | `NULL` | `(auth.uid() = owner_id)` |
| `public.ootie_bookmarks` | `Users can update own bookmarks` | `UPDATE` | `{public}` | `(owner_id = ( SELECT ootie_profiles.id FROM ootie_profiles WHERE (ootie_profiles.user_id = auth.uid())))` | `(owner_id = ( SELECT ootie_profiles.id FROM ootie_profiles WHERE (ootie_profiles.user_id = auth.uid())))` |
| `public.ootie_bookmarks` | `Users can update their own bookmarks` | `UPDATE` | `{public}` | `(auth.uid() = owner_id)` | `(auth.uid() = owner_id)` |
| `public.ootie_bookmarks` | `Users can view own bookmarks` | `SELECT` | `{public}` | `(owner_id = ( SELECT ootie_profiles.id FROM ootie_profiles WHERE (ootie_profiles.user_id = auth.uid())))` | `NULL` |
| `public.ootie_bookmarks` | `Users can view their own bookmarks` | `SELECT` | `{public}` | `(auth.uid() = owner_id)` | `NULL` |
| `public.ootie_clothing_items` | `Enable read access for all users` | `SELECT` | `{public}` | `true` | `NULL` |
| `public.ootie_notifications` | `Enable read access for all users` | `SELECT` | `{public}` | `true` | `NULL` |
| `public.ootie_ootd_posts` | `Enable read access for all users` | `SELECT` | `{public}` | `true` | `NULL` |
| `public.ootie_outfit_suggestions` | `Enable read access for all users` | `SELECT` | `{public}` | `true` | `NULL` |
| `public.ootie_post_likes` | `Enable read access for all users` | `SELECT` | `{public}` | `true` | `NULL` |
| `public.ootie_profiles` | `Enable read access for all users` | `SELECT` | `{public}` | `true` | `NULL` |
| `public.ootie_saved_posts` | `Enable read access for all users` | `SELECT` | `{public}` | `true` | `NULL` |
| `public.ootie_sos_posts` | `Enable read access for all users` | `SELECT` | `{public}` | `true` | `NULL` |
| `storage.objects` | `Bookmark images are viewable by everyone` | `SELECT` | `{public}` | `(bucket_id = 'ootie-bookmarks-images'::text)` | `NULL` |
| `storage.objects` | `Users can delete their own bookmark images` | `DELETE` | `{public}` | `((bucket_id = 'ootie-bookmarks-images'::text) AND (auth.role() = 'authenticated'::text))` | `NULL` |
| `storage.objects` | `Users can update their own bookmark images` | `UPDATE` | `{public}` | `((bucket_id = 'ootie-bookmarks-images'::text) AND (auth.role() = 'authenticated'::text))` | `((bucket_id = 'ootie-bookmarks-images'::text) AND (auth.role() = 'authenticated'::text))` |
| `storage.objects` | `Users can upload their own bookmark images` | `INSERT` | `{public}` | `NULL` | `((bucket_id = 'ootie-bookmarks-images'::text) AND (auth.role() = 'authenticated'::text))` |

Bookmark 有**兩組並存** policy：`... own bookmarks` 透過 `ootie_profiles.user_id = auth.uid()` 找 profile ID，`... their own bookmarks` 直接比 `auth.uid() = owner_id`。現有 repo migration 只有後者四個名稱，但每個條件把兩種路徑寫成 OR；兩者可達到類似意圖，**不是相同的 policy 清單**。因 `ootie_profiles.user_id` 無 UNIQUE，前者的 scalar subquery 遇到重複 user_id 時行為也可能出錯。Storage 寫入 policy 只檢查 bucket 與 authenticated，沒有 folder owner 限制；policy 名稱中的「own」不等於已實作所有權檢查。

## 6. RPC／Function 真實狀態

正式 `src/services/supabase.js:474-543` 呼叫五個**零參數** RPC。原快照有 120 筆 `FUNCTION`，補充匯出有 143 筆；兩份都只找到以下三個目標名稱。另兩個只有 `legacy/aizhen/get_*.sql` 草案檔，**不是團隊端存在的證據**。補充匯出另有兩個 bookmark trigger function；五個 OOTIE 相關 function 的完整定義與 grants 見第 14 節。

| 前端 RPC | Snapshot signature／return | SQL 定義與依賴 | security／search_path | 比對 |
| --- | --- | --- | --- | --- |
| `get_closet_stats` | `public.get_closet_stats()` → `jsonb` | `LANGUAGE sql STABLE`；查 `public.ootie_clothing_items` 且 `owner_id = auth.uid()`；只輸出 `colorStats`, `styleStats`, `categoryStats` | 補充匯出 `security_definer=f`、函式 config/search_path `NULL`；invoker，實際有效 search_path 由呼叫環境決定 | **CONFLICT**：前端要求第四個 `colorFamilyStats`，store 因缺 key 回退本機；`owner_id` FK 是 profile ID，與 `auth.uid()` 是否相同未證 |
| `get_brand_stats` | `public.get_brand_stats()` → `TABLE(brand text, item_count bigint, total_wear_count bigint)` | `LANGUAGE sql STABLE`；查 `public.ootie_clothing_items`，`hidden = false`，按品牌聚合前 10；**無 owner filter** | `security_definer=f`、函式 config/search_path `NULL` | **CONFLICT**：前端形狀匹配，但團隊表 RLS 關閉，可能跨使用者聚合 |
| `get_top_worn_items` | **未列出** | `legacy/aizhen/get_top_worn_items.sql` 有草案；團隊 function 定義／依賴 **UNKNOWN** | UNKNOWN | **MISSING**（在此 FUNCTION 快照） |
| `get_cost_per_wear_ranking` | **未列出** | `legacy/aizhen/get_cost_per_wear_ranking.sql` 有草案；團隊 function 定義／依賴 **UNKNOWN** | UNKNOWN | **MISSING**（在此 FUNCTION 快照） |
| `get_disused_items` | `public.get_disused_items()` → `TABLE(id uuid, name text, name_zh text, photo text, last_worn text, wear_count integer)` | `LANGUAGE sql STABLE`；查 `public.ootie_clothing_items`，`hidden = false`；`last_worn::date < current_date - 30` 或 `wear_count < 2` 等；**無 owner filter** | `security_definer=f`、函式 config/search_path `NULL` | **CONFLICT**：本機規則為 90 天／2 次；表欄 `wear_count bigint`、回傳宣告 `integer` 可能有型別問題，未執行故結果 UNKNOWN |

現有三個目標 RPC 的 definition 沒有呼叫額外自訂 helper function；`get_closet_stats` 依賴 `auth.uid()`，三者都依賴 `ootie_clothing_items`。補充匯出的五個 OOTIE 相關 function 定義有可讀中文字，且列出 `security_definer=f`、`config/search_path=NULL`、各五筆 EXECUTE grant；這補足**函式層級**資訊，但未提供呼叫時的有效 search_path、owner 或表權限。原快照的非 ASCII 亂碼不能作為重播來源；補充 DDL 只保存在文件供人工審核，本階段沒有建立 `.sql` migration。

## 7. Triggers

兩份 CSV 各有相同的 **9 個** `TRIGGER` 記錄。名稱、時機與事件依 definition；前兩個是 OOTIE，其他為 Supabase Storage 系統物件，不應複製成個人版手寫 SQL。

| Trigger | Table | Function | Timing | Event |
| --- | --- | --- | --- | --- |
| `ootie_bookmarks_set_updated_at` | `public.ootie_bookmarks` | `public.set_updated_at()` | BEFORE | UPDATE |
| `set_ootie_bookmarks_updated_at` | `public.ootie_bookmarks` | `public.update_ootie_bookmarks_updated_at()` | BEFORE | UPDATE |
| `enforce_bucket_name_length_trigger` | `storage.buckets` | `storage.enforce_bucket_name_length()` | BEFORE | INSERT / UPDATE OF name |
| `protect_bucket_control_insert` | `storage.buckets` | `storage.protect_bucket_control_columns('service_role')` | BEFORE | INSERT |
| `protect_bucket_control_update` | `storage.buckets` | `storage.protect_bucket_control_columns()` | BEFORE | UPDATE OF lifecycle columns |
| `protect_bucket_control_update_role` | `storage.buckets` | `storage.enforce_bucket_lifecycle_service_role()` | AFTER | UPDATE OF lifecycle columns |
| `protect_buckets_delete` | `storage.buckets` | `storage.protect_delete()` | BEFORE | DELETE |
| `protect_objects_delete` | `storage.objects` | `storage.protect_delete()` | BEFORE | DELETE |
| `update_objects_updated_at` | `storage.objects` | `storage.update_updated_at_column()` | BEFORE | UPDATE |

**`auth.users → profiles/ootie_profiles` 自動建立 profile trigger：UNKNOWN。** 補充 CSV 雖有四個 `auth.*` function 記錄（`auth.email/jwt/role/uid`），但 `TRIGGER` 仍無 `auth.users` 記錄，也沒有 profile 建立函式。匯出查詢範圍與權限未提供，不能由零筆證明團隊端沒有 Auth trigger。兩個 bookmark BEFORE UPDATE trigger 都改 `updated_at`，repo 只定義後者；個人版若追求忠實清單需辨識兩者並存，若追求最小必要結構則需團隊確認是否可省略其中之一。

## 8. Views、Enums、Storage

- **Views**：兩份 CSV 均無 `VIEW` 記錄；未取得完整 view 盤點查詢，**不能證實團隊不存在 view**。正式 `src/` 未直接呼叫可辨識的 view 名稱。
- **Enums**：補充 CSV 列出 10 個：九個 `auth.*` 與一個 `storage.buckettype`，沒有 `public` enum，也沒有 OOTIE 欄位引用這些 enum。完整清單見第 14 節；這些平台型別不應手寫重建。
- **Extensions**：補充 CSV 列出六個已安裝 extension 與版本；完整清單見第 14 節。`vector` 服務其他專案資料結構，沒有證據顯示 OOTIE 表依賴它。
- **Storage bucket**：唯一 `STORAGE_BUCKET` 是 `storage.buckets.ootie-bookmarks-images`，`public=t`、`file_size_limit=NULL`、`allowed_mime_types=NULL`。`NULL` 是快照記錄的設定，代表未列出特定限制；實際上傳服務的全域限制 **UNKNOWN**。
- **前端使用**：`src/services/supabase.js:736-760` 上傳至 `bookmarks/${userId}/${Date.now()}.${fileExt}`，呼叫 `getPublicUrl`，把 URL／path 寫入 bookmark。團隊 public bucket 與此用法相符；`userId` 當前可能是 `profile-01`，並非 Auth UUID。
- **Storage RLS**：`storage.objects` RLS enabled；四個 policy 已完整列於第 5 節。SELECT 對 bucket 公開；INSERT/UPDATE/DELETE 只限制 authenticated 與 bucket，**不**檢查 `bookmarks/<本人>/` 或物件 owner。若要安全複製，必須明確決定是忠實保留目前寬鬆 policy，還是經授權修訂；本階段不改動。

## 9. Repository migration 對團隊快照

只比較正式 `supabase/migrations/20260924_ootie_bookmarks.sql` 與 `supabase/bookmarks-storage.sql`，不把 legacy SQL 視為已套用。`MATCH` 表示快照與檔案一致；`MISSING` 是 repo 缺團隊物件；`OUTDATED` 是 repo 內容落後或結構不同；`CONFLICT` 是直接重播有依賴／語義問題。

| 物件／條件 | Status | 具體差異 |
| --- | --- | --- |
| `ootie_bookmarks` 17 欄、主鍵 `id`、主要型別與多數 nullability | MATCH | CSV 與 repo 都有 17 欄；`id`, `owner_id`, `product_url`, `title`, `created_at`, `updated_at` 非空 |
| `currency` default | OUTDATED | repo `DEFAULT 'TWD'`；團隊 CSV `default=NULL` |
| `owner_id` FK | OUTDATED | 團隊是**確定存在**的 `ootie_bookmarks_owner_id_fk -> ootie_profiles(id) ON DELETE CASCADE`；repo 只在 profile 表存在時條件式加 FK，名稱也不同 |
| Bookmark RLS enabled | MATCH | 團隊與 repo 都啟用；團隊 `forced=f` |
| Bookmark policies | OUTDATED | repo 四個 `... their own bookmarks` 以 OR 合併雙路徑；團隊八個 policy，分為 `... own bookmarks` 與 `... their own bookmarks` 兩組 |
| `idx_ootie_bookmarks_owner_created_at` | MATCH | 團隊與 repo 都有 |
| `idx_ootie_bookmarks_owner_updated_at`、`idx_ootie_bookmarks_source_domain` | MISSING | 團隊有，正式 repo 沒有 |
| `set_ootie_bookmarks_updated_at`＋`update_ootie_bookmarks_updated_at()` | MATCH | 團隊與 repo 都有此 trigger／function |
| `ootie_bookmarks_set_updated_at`＋`set_updated_at()` | MISSING | 團隊另有第二組 BEFORE UPDATE trigger／function，repo 沒有 |
| `ootie_profiles` 前置表 | CONFLICT | 團隊有；正式 repo 沒建表 SQL，而 bookmark policy 直接引用它；空白個人 DB 不能只跑現有 bookmark migration |
| 其餘 8 張團隊 OOTIE 表、3 個團隊現有 RPC | MISSING | 正式 `supabase/` 沒有建表／RPC SQL；兩個前端要用的 RPC 連團隊快照都未列出 |
| bucket `ootie-bookmarks-images` 建立 | MISSING | 團隊有 public bucket；repo 只有物件 policy SQL，沒有 bucket 建立記錄 |
| Storage policies | OUTDATED | repo 的 SELECT 名稱是 `Bookmarks images...`，團隊是 `Bookmark images...`；其餘三個名稱／條件對得上，四者都未限制 folder owner |
| `pgcrypto` extension | MATCH（存在）／UNKNOWN（建立方式） | repo 有 `CREATE EXTENSION IF NOT EXISTS`；補充 CSV 證實團隊安裝 `pgcrypto 1.3`，但未提供 schema、建立方式或個人專案預設狀態 |

## 10. 正式前端需求 vs 團隊現況矩陣

| Frontend Requirement | Team Supabase Reality | Status | Migration Action（只規劃） |
| --- | --- | --- | --- |
| avatar 對 `profiles` 讀／upsert | `profiles` 未列出；`ootie_profiles.avatar_url` 存在 | LEGACY | 忠實複製 `ootie_profiles`；日後決定是否改前端表名與 Auth→profile ID 解析，不憑空建另一張 `profiles` |
| 對 `items` 查／新增／刪 | `items` 未列出；`ootie_clothing_items` 有所需多數衣物欄 | LEGACY | 忠實複製 `ootie_clothing_items`；日後收斂前端呼叫，不把 legacy `items` 當團隊表 |
| `ootie_clothing_items.notes` 更新 | 表與 `notes text` 存在；`id uuid PK` | MATCH | 保留表；但前端只按 ID update，RLS 目前關閉，需單獨安全決策 |
| OOTD 表欄位與 UUID | 10 欄與前端 list select／insert payload 對得上，`user_id` FK 到 profile | MATCH | 複製真實欄／FK；另解決前端 `user-01` 與本機 `post-*` ID，不把 mock 當 UUID |
| SOS 表／status | 表與 `status OPEN/CLOSED` CHECK 存在 | MATCH | 保留欄位、CHECK、FK；前端 SOS ID 回填另處理 |
| SOS 採納 suggestion FK | `picked_suggestion_id uuid` 存在，但預設隨機 UUID，無 FK | CONFLICT | 記錄原樣；複製前確認是否要保留 default／新增關聯保護，不能自行假設 |
| suggestion `sos_id`、`user_id` | 表有兩個 FK，分別指 SOS／profile | MATCH | 依團隊依賴順序建立；前端需傳遠端 SOS UUID、profile UUID |
| bookmarks 表與 owner FK | 表存在且 owner FK 指 `ootie_profiles`；repo policy／default／index 落後 | CONFLICT | 用團隊快照重建 bookmarks 草案，不能直接執行 repo 舊 migration |
| `get_closet_stats` 的四組 stats | 團隊只回三組，少 `colorFamilyStats` | CONFLICT | 忠實記錄團隊 function；若要滿足現行 Stats 頁，另提功能變更決策 |
| `get_brand_stats` 使用者隔離 | Function 存在但不按 owner 篩選；衣物表 RLS 關閉 | CONFLICT | 複製前作權限決策，不能把「團隊現況」稱為已隔離 |
| `get_top_worn_items`、`get_cost_per_wear_ranking` | FUNCTION 快照未列出；legacy 有 SQL 草案 | MISSING | 不自動搬 legacy；先確認團隊是否實際建立／簽名與回傳 |
| `get_disused_items` | 存在，30 天／2 次，無 owner 篩選；前端本機是 90 天／2 次 | CONFLICT | 保留證據，另決定規則與授權；留意 bigint→integer 宣告差異 |
| bookmark Storage URL | public bucket 存在，前端用 `getPublicUrl` | MATCH | 規劃 bucket 設定與 path；政策另行審查 |
| Storage folder ownership | 寫入 policy 只檢查 bucket＋authenticated | CONFLICT | 不能聲稱已有 owner 保護；安全複製須經明確政策決策 |
| Auth 自動建立 profile | 兩份匯出均無 `auth.users` trigger；補充匯出只有 `auth.email/jwt/role/uid` function，無 profile 建立 function | UNKNOWN | 需可證明涵蓋 `auth.users` 的 trigger 盤點與 profile 建立機制證據 |
| Views 依賴 | 兩份匯出均無 `VIEW` row；未提供完整盤點範圍 | UNKNOWN | 取得明確的 public view 清單或可驗證的零筆結果 |
| Enums／extension 依賴 | 補充匯出有 10 enum（九個 Auth、一個 Storage）與六個 extension；無 OOTIE enum 欄位 | MATCH（清單）／UNKNOWN（完整依賴） | 平台物件交由 Supabase 管理；只規劃 OOTIE 實際依賴的 extension |

## 11. Legacy 與搬遷範圍判斷

- **A. 團隊真實存在**：上列 15 張 public table；與 OOTIE 直接相關的 9 張、三個目標 RPC、兩個 bookmark trigger、public bookmark bucket 均有 CSV 證據。
- **B. 正式前端正在使用**：直接 `.from` 的 `profiles`、`items`、`ootie_clothing_items`、`ootie_ootd_posts`、`ootie_sos_posts`、`ootie_outfit_suggestions`、`ootie_bookmarks`；其中前兩者未被團隊快照證實。它還呼叫 5 個 RPC，但團隊快照只證實 3 個；Storage 只使用 bookmark bucket。
- **C. Repository legacy 才存在**：`legacy/sinsin/supabase-schema.sql` 的 `posts`／`profiles`、`legacy/ming/supabase/schema.sql` 的 `items`／`profiles`；另有 `legacy/aizhen` 的五個統計 RPC SQL 草案，其中兩個在團隊 FUNCTION 快照不存在。沒有讀取或使用 legacy 的 key／env 檔。
- **D. 個人版不應自動搬**：legacy-only `posts`、`profiles`、`items`；團隊其他專案的 `careu`, `documents`, `functions`, `rag_query_logs`, `recommendations`, `test_table`；legacy RPC 草案也不能因檔案存在就當作團隊已部署。新 blueprint 以**完整團隊 OOTIE parity** 為目標，納入三張團隊確實存在的 OOTIE 輔助表，同時註明正式前端目前沒有直接使用它們。

## 12. 尚需補充的團隊證據

1. **Auth scope**：`auth.users` 相關 trigger 的完整盤點、`ootie_profiles.user_id` 的真實建立流程／資料對應；兩份匯出都沒有 Auth trigger，但缺少可證明範圍完整的查詢資訊。
2. **缺少的 object types**：補充匯出已列出 enum／extension；仍需完整 public table/view 盤點，確認 `profiles`／`items` 真正不存在或只是匯出範圍不足。
3. **Functions**：兩個未列出 RPC 是否其實部署於其他 schema；現有五個 OOTIE function 的乾淨 DDL、`security_definer`、函式層級 config 與 EXECUTE grant 已補足，但 owner、呼叫時有效 search_path、表權限及兩個缺失 RPC 仍待釐清。
4. **Policy metadata**：現有 `POLICY` row 有 command/roles/USING/WITH CHECK，但沒有 policy 的 permissive/restrictive 設定、grants 等完整可重播資訊；RLS 關閉表若要安全複製，需要正式權限決策。
5. **Storage**：CSV 已證實 bucket public、size/mime 欄為 NULL 與物件 policies；全域上傳限制、object owner 實際行為及清理流程仍 UNKNOWN。
6. **忠實度 vs 安全**：多數 OOTIE 表 RLS 關閉、兩個 RPC 缺 owner 篩選、Storage 寫入政策過寬。若目標是「安全的個人環境」，不能不加審查地照搬這些設定；若目標是「團隊狀態逐字複製」，須明確接受其現況風險。新 blueprint 保留此決策關卡，不在本階段改寫。

## 13. SCHEMA-03 文件與新證據的對照

| 舊文件敘述 | 新快照結果 | 本階段處置 |
| --- | --- | --- |
| `TABLE_SCHEMA_REQUIREMENTS.md` 的 7 張 active `.from` 表 | **MATCH**，仍是正式程式的呼叫清單；但其中 `profiles`／`items` 快照未列出 | 保留「前端需求」身份，不能當成團隊實際表清單 |
| `TABLE_SCHEMA_REQUIREMENTS.md` 將 `ootie_profiles` 註為前端非 active、migration-only 依賴 | 前端非 active 仍正確；團隊 CSV **確認表實際存在**，且是多數內容 FK 目的地 | 在個人完整 OOTIE parity 中列為第一張核心表 |
| `TABLE_SCHEMA_REQUIREMENTS.md` 記錄 5 個 RPC 而正式 repo 無 RPC SQL | 兩點都正確；團隊 CSV 只有 3 個 function，另 2 個只見 legacy 草案 | 分開呈現「前端呼叫 5」與「團隊證實 3」 |
| `SUPABASE_SCHEMA_MIGRATION_PLAN.md` 建議 `profiles` canonical、內容直接 FK 到 `auth.users` | 與團隊 CSV 的 `ootie_profiles` 及內容 FK 不一致 | 本次忠實還原藍圖以團隊 FK 鏈為準；舊建議不作為 migration 根據 |
| SCHEMA-03 Storage bucket public／政策設定 UNKNOWN | CSV 已確認 bucket public、size/mime 欄 NULL、四個 storage.objects policy | 更新為已知團隊現況；全域限制與 owner 安全仍待確認 |
| SCHEMA-03 以舊 bookmark SQL 作唯一 migration 來源 | 團隊多兩個 index、第二組 trigger／function、四個額外 bookmark policies，`currency` default 不同 | 舊 SQL 標為 OUTDATED，未來須重整 baseline，不能直接套用 |

個人版的依賴順序與每步所需證據見 [SUPABASE_PERSONAL_MIGRATION_BLUEPRINT.md](SUPABASE_PERSONAL_MIGRATION_BLUEPRINT.md)。

## 14. SCHEMA-05：補充 CSV 核對結果

以下只比對本機 `TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv` 與原快照；兩份 CSV 均為資料來源，沒有把任何 DDL 送到資料庫。補充檔共 812 筆：`ENUM=10`、`EXTENSION=6`、`FUNCTION=143`、`FUNCTION_GRANT=644`、`TRIGGER=9`。原快照的 9 個 trigger 與補充檔列出的 9 個名稱一致。

### 14.1 Auth trigger 與 profile 關係

- 補充檔的 `TRIGGER` 沒有 `auth.users` 記錄，也沒有 `handle_new_user` 或其他可辨識的 profile 建立 function；只有 `auth.email()`、`auth.jwt()`、`auth.role()`、`auth.uid()` 四個 Auth function。**結論是「兩份匯出未證實有自動建 profile trigger」，不是「已證實沒有」。** CSV 未附匯出查詢、權限與完整性證明，Auth schema 的 trigger 可見範圍仍 UNKNOWN。
- 原快照對 `ootie_profiles.user_id` 記錄 `uuid`、可空、`gen_random_uuid()` default；在已匯出的 constraint 中**沒有**指向 `auth.users.id` 的 FK 或 UNIQUE。補充檔沒有 `CONSTRAINT` 類別，因此沒有新約束證據。內容表的 FK 實際指向 `ootie_profiles.id`。`user_id` 的既有值是否對應 Auth UUID、由何流程寫入，需團隊結構／流程證據，不能從欄名推定。
- `public.profiles`、`public.items` 在原快照的 public table 欄位清單中未列出；補充檔也沒有 table/view 類別，仍不能判定前端呼叫的名稱是否為團隊真實 relation 或匯出盲點。

### 14.2 Views、Enums、Extensions

兩份 CSV 的 `VIEW` row 均為 **0**；這只表示匯出沒有 view 記錄。完整 public／相關 schema view inventory 和匯出範圍仍 UNKNOWN。正式前端未辨識出對特定 view 的直接引用。

| 類別 | 補充匯出所列實際物件 | OOTIE 搬遷判讀 |
| --- | --- | --- |
| Enum（10） | `auth.aal_level`、`auth.code_challenge_method`、`auth.factor_status`、`auth.factor_type`、`auth.oauth_authorization_status`、`auth.oauth_client_type`、`auth.oauth_registration_type`、`auth.oauth_response_type`、`auth.one_time_token_type`、`storage.buckettype` | 9 個 Auth、1 個 Storage；原快照 96 個 OOTIE 欄位沒有 enum 型別，無證據需要在個人版手寫這些平台 enum。各值見下表。 |
| Extension（6） | `pg_stat_statements 1.11`、`pgcrypto 1.3`、`plpgsql 1.0`、`supabase_vault 0.3.1`、`uuid-ossp 1.1`、`vector 0.8.2` | 這是團隊已安裝清單，不代表六個都屬 OOTIE 依賴。`plpgsql` 用於兩個 bookmark trigger function；repo bookmark migration 曾宣告 `pgcrypto`。extension 所在 schema、建立方式與個人專案預設狀態未匯出；其他四個沒有已證實的 OOTIE 需求。 |

| Enum | 匯出值 |
| --- | --- |
| `auth.aal_level` | `aal1`, `aal2`, `aal3` |
| `auth.code_challenge_method` | `s256`, `plain` |
| `auth.factor_status` | `unverified`, `verified` |
| `auth.factor_type` | `totp`, `webauthn`, `phone`, `recovery_code` |
| `auth.oauth_authorization_status` | `pending`, `approved`, `denied`, `expired` |
| `auth.oauth_client_type` | `public`, `confidential` |
| `auth.oauth_registration_type` | `dynamic`, `manual` |
| `auth.oauth_response_type` | `code` |
| `auth.one_time_token_type` | `confirmation_token`, `reauthentication_token`, `recovery_token`, `email_change_token_new`, `email_change_token_current`, `phone_change_token` |
| `storage.buckettype` | `STANDARD`, `ANALYTICS`, `VECTOR` |

### 14.3 OOTIE Function／RPC、security、config、grants

兩份 CSV 均有以下 **5 個** OOTIE 相關 function：三個正式前端 Stats RPC、兩個 bookmark trigger function。補充檔提供可讀、完整的 `CREATE OR REPLACE FUNCTION` 定義；原快照非 ASCII 註解／字串部分亂碼，應以補充檔為文件參照。**`get_top_worn_items` 與 `get_cost_per_wear_ranking` 在兩份 FUNCTION 清單與補充 grant 清單均為零筆**；只有 repo legacy 草案，不能宣稱團隊已部署。是否為完整盤點仍取決於匯出範圍證據。

| Function | 回傳／用途 | `security_definer` | 函式層級 `config/search_path` | 補充 CSV 的 EXECUTE grant |
| --- | --- | --- | --- | --- |
| `public.get_closet_stats()` | `jsonb`；衣櫃統計 | `f`（invoker） | `NULL`（無函式級 SET） | `PUBLIC`、`anon`、`authenticated`、`service_role`：grantable=NO；`postgres`：grantable=YES |
| `public.get_brand_stats()` | `TABLE(brand text, item_count bigint, total_wear_count bigint)`；品牌統計 | `f`（invoker） | `NULL` | 同上 |
| `public.get_disused_items()` | `TABLE(id uuid, name text, name_zh text, photo text, last_worn text, wear_count integer)`；閒置衣物 | `f`（invoker） | `NULL` | 同上 |
| `public.set_updated_at()` | `trigger`；更新 `updated_at` | `f`（invoker） | `NULL` | 同上 |
| `public.update_ootie_bookmarks_updated_at()` | `trigger`；更新 `updated_at` | `f`（invoker） | `NULL` | 同上 |

`NULL` 僅表示沒有 function 專屬 `SET search_path`／config，**不**代表執行時 search_path 為空；有效值取決於 role／session／平台設定。grant row 顯示這五個函式都有 `PUBLIC` 與 `anon` 的 EXECUTE 權限；其中 `get_brand_stats`、`get_disused_items` 無 owner filter，衣物表 RLS 又關閉，重建前必須決定權限與資料隔離方式。匯出沒有 function owner 或底層表的完整 GRANT 清單；不能只根據函式 grant 推定實際端到端可讀性。下面保留補充 CSV 的完整函式定義作**唯讀比對附件**，不是 migration 檔，也未執行。

#### 補充 CSV 完整 DDL（未執行）

**`public.get_closet_stats()`**

```sql
CREATE OR REPLACE FUNCTION public.get_closet_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  with visible_items as (
    select primary_color, style, category, color_hex
    from public.ootie_clothing_items
    where owner_id = auth.uid()
      and hidden = false
  ),
  -- 1. 顏色統計 (先 Group BY 再轉 JSON)
  grouped_colors as (
    select 
      primary_color as color,
      coalesce(min(color_hex), '#D8D2C8') as color_hex,
      count(*) as item_count
    from visible_items
    where nullif(primary_color, '') is not null
    group by primary_color
  ),
  color_stats as (
    select jsonb_agg(jsonb_build_object(
      'color', color,
      'color_hex', color_hex,
      'count', item_count
    ) order by item_count desc) as value
    from grouped_colors
  ),
  -- 2. 風格統計 (先 Group BY 再轉 JSON)
  grouped_styles as (
    select 
      style,
      count(*) as item_count
    from visible_items
    where nullif(style, '') is not null
    group by style
  ),
  style_stats as (
    select jsonb_agg(jsonb_build_object(
      'style', style,
      'count', item_count
    ) order by item_count desc) as value
    from grouped_styles
  ),
  -- 3. 分類統計 (先 Group BY 再轉 JSON)
  grouped_categories as (
    select 
      category,
      count(*) as item_count
    from visible_items
    where nullif(category, '') is not null
    group by category
  ),
  category_stats as (
    select jsonb_agg(jsonb_build_object(
      'category', category,
      'count', item_count
    ) order by item_count desc) as value
    from grouped_categories
  )
  select jsonb_build_object(
    'colorStats', coalesce((select value from color_stats), '[]'::jsonb),
    'styleStats', coalesce((select value from style_stats), '[]'::jsonb),
    'categoryStats', coalesce((select value from category_stats), '[]'::jsonb)
  );
$function$
```

**`public.get_brand_stats()`**

```sql
CREATE OR REPLACE FUNCTION public.get_brand_stats()
 RETURNS TABLE(brand text, item_count bigint, total_wear_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with normalized_brands as (
    select
      lower(nullif(trim(brand), '')) as brand_key,
      nullif(trim(brand), '') as display_brand,
      coalesce(wear_count, 0)::bigint as wear_count
    from public.ootie_clothing_items
    where hidden = false
  )
  select
    coalesce(min(display_brand), '未分類') as brand,
    count(*)::bigint as item_count,
    sum(wear_count)::bigint as total_wear_count
  from normalized_brands
  group by brand_key
  order by item_count desc, total_wear_count desc
  limit 10;
$function$
```

**`public.get_disused_items()`**

```sql
CREATE OR REPLACE FUNCTION public.get_disused_items()
 RETURNS TABLE(id uuid, name text, name_zh text, photo text, last_worn text, wear_count integer)
 LANGUAGE sql
 STABLE
AS $function$
  select id, name, name_zh, photo, last_worn, wear_count
  from public.ootie_clothing_items
  where hidden = false
    and (
      (nullif(last_worn, '') is not null and last_worn::date < current_date - 30)
      or wear_count < 2
      or (nullif(last_worn, '') is null and coalesce(wear_count, 0) = 0)
    )
  order by last_worn is not null, last_worn asc nulls first, wear_count asc;
$function$
```

**`public.set_updated_at()`**

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
```

**`public.update_ootie_bookmarks_updated_at()`**

```sql
CREATE OR REPLACE FUNCTION public.update_ootie_bookmarks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
```

### 14.4 對完整重建仍有影響的 UNKNOWN

1. `auth.users` trigger 是否實際存在、若存在呼叫何 function；需有可證明覆蓋 Auth schema 的 trigger／function 盤點或團隊流程說明。兩份現有 CSV 的零筆不足以證明絕對不存在。
2. `ootie_profiles.user_id` 與 `auth.users.id` 的實際資料／建立流程；已匯出的 constraint **沒有 FK／UNIQUE**，但這不能證明資料值的語意。身份解析是前端與 RLS 使用 profile ID 的前提。
3. View 的完整清單與 `profiles`／`items` 是否為未匯出的 relation；需要完整、可驗證範圍的 table/view inventory。已知的 10 enum／6 extension 清單不消除此缺口。
4. 兩個前端呼叫而未匯出的 Stats RPC 是確實未部署、存在於其他 schema，或匯出遺漏；若不存在，個人版應省略還是另行新增，需明確決策。已存在五個 OOTIE function 的 DDL／函式級 security/config/grants 已取得。
5. 表與 schema 權限、policy 的 permissive/restrictive 設定、function owner、有效 search_path，以及 Storage 全域限制沒有完整可重播證據。忠實複製既有 RLS 關閉與寬鬆 Storage policy 也需安全決策。

Migration gate 判定見 [SUPABASE_MIGRATION_READINESS.md](SUPABASE_MIGRATION_READINESS.md)：**NOT_READY** 用於「安全且完整重建可執行 migration」；仍可只在本機起草已證實的表、約束、索引與五個函式草案供審閱。
