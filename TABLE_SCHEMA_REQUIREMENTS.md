# OOTIE 個人版 Supabase Table Schema Requirements

狀態：**本機程式碼盤點，非可執行 DDL**（2026-09-27）。本文件只以外層正式前端 `src/` 與 `supabase/` 為證據；內層 `OOTIE-main/` 是另一份副本，不計為額外產品資源。未查詢任何遠端專案，也未讀取 `.env` 的值。

## 閱讀方式與範圍

- **觀察**：程式明確 `.from(...)`、`.select()`、`.insert()`、`.upsert()`、`.update()`、`.delete()`、`.rpc()` 或 Storage 呼叫，或現有 SQL 明確定義。
- **必填**分為「現有 SQL 的 `NOT NULL`」與「前端流程需要」；沒有 SQL 的表，其資料庫必填條件一律是 **UNKNOWN**。`select('*')` 不代表已知道所有欄位。
- **已接線**表示有非測試程式呼叫該 service；**未接線 helper** 仍記錄，避免日後誤以為 schema 已支援它。`src/constants/index.js` 的假資料與 localStorage 欄位不直接構成遠端 schema。
- 正式 `.from(...)` 表共有 **7 張**：`profiles`、`items`、`ootie_clothing_items`、`ootie_ootd_posts`、`ootie_sos_posts`、`ootie_outfit_suggestions`、`ootie_bookmarks`。`ootie_profiles` 僅被 bookmarks migration 引用，**不是目前前端查詢的表**。`auth.users` 由 Supabase Auth 管理，前端未直接 `.from('auth.users')`。

## 1. `public.profiles` — 已接線的 avatar；完整 profile helper 未接線

- **使用來源**：`src/services/supabase.js:18-109`；`src/stores/app.js:98-108`；`src/views/ProfileView.vue:123-125`；`src/components/modal/ProfileEditModal.vue:181-192`。
- **前端讀取欄位**：`avatar_url`（`select('avatar_url')`、依 `id` 查）；另有未接線 `select('*')`、依 `user_id` 查的 `fetchProfileFromSupabase`，不能由 `*` 推出其他確切欄位。
- **前端寫入欄位**：已接線 avatar upsert `{ id, avatar_url }`。未接線完整 upsert 寫 `user_id, email, full_name, username, initials, bio, avatar_url, updated_at`，以 `user_id` 衝突鍵 upsert 並 `.select()`。
- **必填欄位**：DB **UNKNOWN**。avatar 流程在 `avatarUrl` 為空時不寫；完整 helper 需要 `user_id`，但目前沒有真正的 Auth UUID 傳入。`full_name`、`email` 等可被前端寫成 `null`。
- **ID 格式需求**：程式未對 `id`/`user_id` 做 UUID 驗證；預設 `CURRENT_USER_ID = 'user-01'`。若採 UUID schema，現況需先改前端身分傳遞。
- **user/profile 關聯**：`id` 與 `user_id` 分別被用來找同一 profile，是否同值、是否一對一 **UNKNOWN**。
- **timestamp**：完整 helper 寫 `updated_at`；`created_at`/預設/trigger **UNKNOWN**。畫面中的本機 `defaultProfile.created_at` 不證明此表有該欄。
- **FK 推定**：建議 `user_id -> auth.users.id`，但現有 DB 定義 **UNKNOWN**；若採共享主鍵，`id` 與 Auth UUID 的關係要先決定。
- **RLS 需求**：avatar 及個資更新限本人；公開可讀欄位與匿名訪客權限待產品決定。不能以 `user-01` 做安全身分。
- **已有 migration**：**無**。
- **UNKNOWN**：真實表是否存在、型別、唯一鍵、`onConflict: 'user_id'` 是否可用、`id` 與 `user_id` 的規則、trigger、公開欄位。

## 2. `public.items` — 刪除已接線；查詢／新增 helper 未接線

- **使用來源**：`src/services/supabase.js:115-197`；`src/stores/closet.js:163-171`。衣櫥新增／編輯目前主要改 `appStore.items` 與 localStorage（`src/stores/closet.js:110-160`），未呼叫遠端新增 helper。
- **前端讀取欄位**：未接線 helper `select('*')`、依 `user_id` 查、依 `created_at` 排序；因此其遠端實際欄位集合 **UNKNOWN**。已接線刪除只用 `id`、`user_id` 條件。
- **前端寫入欄位**：未接線新增 helper 送 `id`（輸入為 UUID 時或瀏覽器產生 UUID 時）、`user_id, name, name_zh, brand, category, shape, primary_color, secondary_color, color_hex, style, season, photo, wear_count, favorite, hidden, notes, created_at`。已接線刪除依 `id` 與 `user_id`；沒有遠端 update helper。
- **必填欄位**：DB **UNKNOWN**。前端 payload 無條件包含 `user_id`、`name` 等鍵，但未保證值非空。`price, last_worn, purchase_date, owner_id` 存在於本機衣櫥模型，**未**包含在此新增 payload。
- **ID 格式需求**：刪除要求 `id` 是 UUID，否則直接視為本機資料；`user_id` 預設 `user-01`，沒有 UUID 檢查。
- **user/profile 關聯**：遠端欄名是 `user_id`，本機假資料用 `owner_id = 'profile-01'`；兩者未對齊。
- **timestamp**：查詢排序 `created_at`，新增可寫 `created_at`；其他時間欄 **UNKNOWN**。
- **FK 推定**：建議 `user_id -> auth.users.id`，但要先決定 `items` 與 `ootie_clothing_items` 是同一資料集、相容層還是兩張表。
- **RLS 需求**：每筆只允許本人讀寫／刪除；目前刪除帶 `user_id` 條件，但 RLS 仍必須獨立驗證 `auth.uid()`。
- **已有 migration**：**無**。
- **UNKNOWN**：真實欄位與型別、價格／穿著統計資料目前存在哪張表、是否已有同名表或 view、是否需要保留此 helper。

## 3. `public.ootie_clothing_items` — 出清備註更新已接線

- **使用來源**：`src/services/supabase.js:558-574`；`src/stores/closet.js:102-107`；衣櫥畫面觸發 `src/views/ClosetView.vue:45`、`src/components/modal/ItemDetailModal.vue:76`。
- **前端讀取欄位**：沒有直接 `.select()`；此程式碼只以 `id` 定位。5 個統計 RPC 的來源表無 SQL，**不可**直接認定就是此表。
- **前端寫入欄位**：`notes`（`.update({ notes }).eq('id', itemId)`）。
- **必填欄位**：DB **UNKNOWN**；此更新需要可定位的 `id`，`notes` 值由本機 item 產生。
- **ID 格式需求**：更新前要求 `itemId` 是 UUID；非 UUID 會直接返回成功而不寫遠端。
- **user/profile 關聯**：此呼叫沒有 owner/user 條件；表的 owner 欄名與 FK **UNKNOWN**。
- **timestamp**：前端未讀寫此表的時間欄；更新 trigger **UNKNOWN**。
- **FK 推定**：若此表是正式衣櫥，建議 owner UUID 對應 `auth.users.id`，但須先與 `items` 收斂。
- **RLS 需求**：**必須**限制本人更新，因為呼叫只依 `id` 過濾。
- **已有 migration**：**無**。
- **UNKNOWN**：表全貌、和 `items` 的關係、統計 RPC 來源、其他必要欄位。

## 4. `public.ootie_ootd_posts` — 已接線 CRUD 與分享頁讀取

- **使用來源**：`src/services/supabase.js:203-309`；`src/stores/ootd.js:30-164`；`src/views/OotdDetailView.vue:59-94`。
- **前端讀取欄位**：列表明確選 `id, user_id, image, caption, item_ids, wearing, hashtags, likes, comments, created_at`，依 `user_id` 過濾、`created_at` 排序。分享詳情 `select('*')`，實際消費 `id, image, caption, wearing, hashtags, created_at`。
- **前端寫入欄位**：新增可帶 `id`，並寫 `user_id, image, caption, item_ids, wearing, hashtags, likes, comments, created_at`；更新 `image, caption, item_ids, wearing, hashtags`；刪除依 `id` 與 `user_id`。
- **必填欄位**：DB **UNKNOWN**。建立流程提供 image/caption，但 DB 允空與長度未知；`item_ids` 等由前端預設空陣列。
- **ID 格式需求**：更新／刪除只接受 UUID。`src/stores/ootd.js:103-128` 先建立 `post-<timestamp>` 本機 ID；service 另產遠端 UUID，卻沒有把回傳 UUID 寫回本機，故後續更新／刪除可能跳過遠端。`item_ids` 的本機假資料也可能不是 UUID。
- **user/profile 關聯**：`user_id` 由 service 預設 `user-01`，不是目前 Auth session 的 user ID。
- **timestamp**：讀寫 `created_at`；`updated_at` **UNKNOWN**。
- **FK 推定**：建議 `user_id -> auth.users.id`；`item_ids` 若是陣列，普通 FK 無法逐項驗證，需另決定關聯表或其他完整性策略。
- **RLS 需求**：本人新增／修改／刪除；分享頁以貼文 ID 查詢，是否公開可讀須確認產品規則，不能直接假設所有貼文公開。
- **已有 migration**：**無**。
- **UNKNOWN**：真實欄位型別、貼文公開狀態、圖片儲存方式、`item_ids` 關聯與資料清除策略。

## 5. `public.ootie_sos_posts` — 已接線讀取／新增／兩種更新

- **使用來源**：`src/services/supabase.js:315-413`；`src/stores/sos.js:109-297`；`src/views/SosView.vue` 與 SOS modal。
- **前端讀取欄位**：`select('*')`、依 `created_at` 排序；store 明確取用 `id, user_id, sender_id, closet_owner_id, username, initials, title, occasion, weather, when_label, vibes, closet_item_ids, details, status, picked_suggestion_id, adopted_suggestion_id, liked_suggestion_ids, created_at`。其中 `sender_id`／`adopted_suggestion_id` 是備援讀法，不證明表一定有該欄。
- **前端寫入欄位**：新增可帶 `id`，並寫 `user_id, closet_owner_id, title, details, occasion, weather, when_label, vibes, closet_item_ids, status, created_at`；更新 `status` 或 `picked_suggestion_id`。
- **必填欄位**：DB **UNKNOWN**。本機建立流程要求至少一件 `closet_item_ids` 並整理標題；其餘 DB 約束未知。
- **ID 格式需求**：更新要求 SOS `id` 是 UUID。store 先建立 `sos-<timestamp>`，service 另產遠端 UUID且未回填，因此關閉／採納更新常不會觸及遠端。
- **user/profile 關聯**：本機 `sender_id`、`closet_owner_id` 取 `appStore.profile.id`（預設 `profile-01`），service 把 `sender_id` 寫進 `user_id`；這不是經驗證的 Auth UUID。
- **timestamp**：讀寫 `created_at`；更新時間欄 **UNKNOWN**。
- **FK 推定**：建議 `user_id`／`closet_owner_id` 統一為 Auth UUID；`picked_suggestion_id` 應在 suggestion 表建立後才加 FK；`closet_item_ids` 的逐項 FK 取決於陣列或關聯表設計。
- **RLS 需求**：跨使用者讀取公開 SOS 的規則待確認；只有發文者可改 `status`／採納建議。現有更新只依 `id` 過濾，必須靠 RLS 防越權。
- **已有 migration**：**無**。
- **UNKNOWN**：資料可見性、`username`/`initials` 是否表欄或需 join、`liked_suggestion_ids` 是否僅本機、關閉貼文是否仍公開。

## 6. `public.ootie_outfit_suggestions` — 已接線讀取／新增

- **使用來源**：`src/services/supabase.js:419-466`；`src/stores/sos.js:132-256` 與 SOS modal。
- **前端讀取欄位**：`select('*')`、依 `created_at` 排序；store 消費 `id, sos_id, user_id, responder_id, item_ids, message, hearts, created_at`。`responder_id` 是備援讀法。
- **前端寫入欄位**：可帶 `id`，並寫 `sos_id, user_id, item_ids, message, hearts, created_at`；沒有遠端 update/delete helper。
- **必填欄位**：DB **UNKNOWN**；流程需要找到 SOS、不能對自己的 SOS 建議，但這些目前只有本機檢查。
- **ID 格式需求**：`id` 可由 service 產 UUID；本機預設 `suggestion-<timestamp>`。`sos_id` 可能仍是本機 `sos-<timestamp>`，無法直接成為 UUID FK。
- **user/profile 關聯**：`user_id` 來自本機 `appStore.profile.id`（預設 `profile-01`），不是 Auth UUID。
- **timestamp**：讀寫 `created_at`；其他時間欄 **UNKNOWN**。
- **FK 推定**：`sos_id -> ootie_sos_posts.id`；建議 `user_id -> auth.users.id`；`item_ids` 逐項關聯方案未定。
- **RLS 需求**：依 SOS 可見性讀取；登入使用者只能以本人身分新增。防自我建議與「每人每則 SOS 一筆有效建議」若要資料庫保證，需與前端現行重複 insert 行為一併設計。
- **已有 migration**：**無**。
- **UNKNOWN**：真實欄位與唯一鍵、建議可見性、hearts 是否只在本機更新。

## 7. `public.ootie_bookmarks` — 唯一已有建表 migration

- **使用來源**：`src/services/supabase.js:580-730`；`src/stores/bookmarks.js:118-309`；`src/views/BookmarksView.vue:640,724`；`supabase/migrations/20260924_ootie_bookmarks.sql`。
- **前端讀取欄位**：`select('*')`，依 `owner_id = userId OR owner_id = 'profile-01'` 過濾、依 `created_at` 排序；store/view 明確使用 `id, owner_id, product_url, title, image_url, image_storage_path, brand, price, currency, variant_name, color, size, source_domain, notes, created_at, updated_at`。現有 SQL 另有 `description`，前端未用。
- **前端寫入欄位**：新增可帶 `id`，並寫 `owner_id, product_url, title, image_url, image_storage_path, brand, price, currency, variant_name, color, size, source_domain, notes, created_at, updated_at`；更新同組商品欄位與 `updated_at`；依 `id` 單筆或批次刪除。
- **必填欄位**：現有 migration 明定 `id`, `owner_id`, `product_url`, `title`, `created_at`, `updated_at` 非空；其餘可空。程式會把 `product_url` 預設為空字串，`NOT NULL` 不保證有效 URL。
- **ID 格式需求**：SQL 的 `id`、`owner_id` 都是 UUID。新增在 owner 不是 UUID 時直接當作本機資料；本機預設 `profile-01`，所以現況可能不會遠端新增。更新／刪除也只處理 UUID ID。
- **user/profile 關聯**：現有 policy 同時容許 `auth.uid() = owner_id` 或 `owner_id -> ootie_profiles.id -> user_id = auth.uid()`；條件式 FK 只有 `ootie_profiles` 已存在時才加。此混合語義不適合作為最終 ID 模型。
- **timestamp**：`created_at`, `updated_at` 為 `timestamptz default now()`；已有 `updated_at` trigger。
- **FK 推定**：現有 migration 擬指向 `ootie_profiles(id)`，但該表缺 migration；建議統一 `owner_id` 為 Auth UUID，或讓 `ootie_profiles.id` 與 Auth UUID 相同，並改成明確 FK。
- **RLS 需求**：私有收藏僅 owner 讀寫。現有 policy 在 `ootie_profiles` 尚未建立時直接引用它，**不能把這份 SQL 當作可在空白 DB 安全執行的 baseline**；`profile-01` OR 條件也不應留在正式查詢。
- **已有 migration**：`supabase/migrations/20260924_ootie_bookmarks.sql`，**不完整且需重整後才可執行**。
- **UNKNOWN**：團隊既有表是否與此 SQL 完全一致、`description` 用途、原 policy／FK 是否另有依賴、bucket 與物件路徑狀態。

## 8. 非 active table：`public.ootie_profiles` 與 `auth.users`

- **`ootie_profiles`**：正式前端沒有 `.from('ootie_profiles')`。只在 bookmark migration 的 policy 子查詢與條件式 FK 出現；可證實的需求只有 `id`、`user_id` 這兩個被引用名稱，型別、唯一性、其他欄位、是否與 `profiles` 同一模型皆 **UNKNOWN**。它沒有建表 migration。若列入個人版，應先確定唯一 profile 表名與共享 UUID 規則，再重寫 client 與 bookmarks migration。
- **`auth.users`**：登入、註冊、登出及 session 透過 `src/stores/auth.js:17-145` 的 `supabase.auth` API；沒有直接資料表查詢。個人版不應自行 `CREATE auth.users`，但自有表的身分 FK 應以實際 Auth UUID 為根。Auth trigger、email 驗證設定與登入資料皆未查驗。

## RPC / Function：正式前端實際呼叫 5 個

五者都在 `src/services/supabase.js:470-553` 以 `supabase.rpc('<name>')` **零參數**呼叫，`src/stores/stats.js:58-150` 消費，`src/views/StatsView.vue:518-538` 觸發。`supabase/` 沒有任一 RPC 的 SQL 定義；唯一 SQL function 是 bookmarks 的 `update_ootie_bookmarks_updated_at()` trigger function。所有 RPC 的資料來源、簽名、授權、依賴 helper function 都 **UNKNOWN**，不可假定依賴 `items` 或 `ootie_clothing_items`。

| RPC | 呼叫位置 | 傳入 | 前端期望回傳 | repo SQL 定義／依賴 |
| --- | --- | --- | --- | --- |
| `get_closet_stats` | service:474；stats store:59 | 無 | JSON object（或可解析的 JSON 字串），含 `colorStats`, `colorFamilyStats`, `styleStats`, `categoryStats` 四個陣列；元素分別需要 `color,count,color_hex`、`secondary_color,count`、`style,count`、`category,count` | 無；來源表、內部函數 UNKNOWN |
| `get_brand_stats` | service:492；stats store:68 | 無 | 陣列，元素 `brand,item_count,total_wear_count` | 無；來源表、內部函數 UNKNOWN |
| `get_top_worn_items` | service:509；stats store:96 | 無 | 陣列，元素 `id,name,name_zh,photo,wear_count` | 無；來源表、內部函數 UNKNOWN |
| `get_cost_per_wear_ranking` | service:526；stats store:113 | 無 | 陣列，元素 `id,name,name_zh,photo,price,wear_count,cost_per_wear` | 無；來源表、內部函數 UNKNOWN |
| `get_disused_items` | service:543；stats store:136 | 無 | 陣列，元素 `id,name,name_zh,photo,wear_count,last_worn`；`notes` 由本機 item 補上 | 無；來源表、內部函數 UNKNOWN |

統計頁在 RPC 失敗或無資料時回退到本機資料；本機「冷宮」門檻為 `> 90` 天或穿著次數 `< 2`（`src/constants/index.js:5-6`、`src/stores/closet.js:52-57`），**不證明**團隊 RPC 使用相同門檻。零參數 RPC 若要按使用者隔離，必須在資料庫內用 Auth context 驗證，不能信任前端傳入的 mock ID。

## Storage：唯一正式 bucket 呼叫

- **bucket**：`ootie-bookmarks-images`（`src/services/supabase.js:736-760`）。沒有其他正式前端 `supabase.storage` bucket 呼叫。
- **upload path**：`bookmarks/${userId}/${Date.now()}.${fileExt}`；`userId` 來自 bookmark owner 或預設 `user-01`／`profile-01`，目前不保證是 Auth UUID；副檔名直接取檔名，程式未證明有白名單／大小限制。上傳採 `upsert: true`。
- **URL 用法**：上傳後呼叫 `getPublicUrl(storagePath)`，把 `publicUrl` 存入 bookmark `image_url`，並把 path 存入 `image_storage_path`。若維持此程式與公開 URL，bucket 需要設定為 public；若要求私有圖片，須改前端為簽名 URL 流程。
- **現有 SQL**：`supabase/bookmarks-storage.sql` 只有 `storage.objects` policies，**未建立 bucket**。SELECT policy 讓此 bucket 物件人人可見；INSERT/UPDATE/DELETE 只檢查 `authenticated`，**未**限制 `bookmarks/<本人 UUID>/`，也未限制只能改自己的 object。
- **建議 policy 草案**：讀取權限依「公開商品圖片或私人圖片」產品決定；寫入限已登入且路徑的 user folder 等於 `auth.uid()`，更新／刪除再限物件 owner；對 `upsert` 特別驗證不能覆寫別人的 path。檔案型別、大小、刪 bookmark 時是否刪 object、孤兒檔清理皆待決。

## 需要先對齊的事實

1. `profiles` vs `ootie_profiles`、`items` vs `ootie_clothing_items` 是兩組不同表名；不能僅憑命名合併。
2. Auth store 能取得真實 `session.user.id`，但遠端資料函式仍預設 `user-01`，社交／收藏流程仍用 `profile-01`。`src/stores/auth.js:22-30` 還可用 localStorage mock 登入狀態建立假 user，即使沒有 Supabase session。
3. OOTD、SOS、suggestion、bookmark、衣物假資料有非 UUID ID；多處 service 對非 UUID 直接跳過遠端操作。只建立 UUID schema 無法修復這些流程。
4. Bookmark 既有 migration 的 policy 在缺少 `ootie_profiles` 時無法成為空白個人專案的完整 baseline；Storage SQL 的授權也不夠細。

下一步的依賴與暫定 schema 方案見 `SUPABASE_SCHEMA_MIGRATION_PLAN.md`。本文件不代表團隊資料庫實際結構。
