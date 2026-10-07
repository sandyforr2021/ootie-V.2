# OOTIE 個人版 Supabase Schema Migration Plan

> **交付狀態：本機遷移藍圖／測試草案，尚無可執行 SQL。** 本階段不得執行 migration、SQL Editor、`db push`、`db reset`，不得連線或修改團隊／個人 Supabase。以下檔名是未來候選順序，**目前均未建立**。

**Goal:** 讓獨立的 OOTIE-sandy-dev 專案能在可核對的身分、表、RPC、RLS 與 Storage 契約下重建正式前端所需 schema。

**Architecture:** 以 `auth.users.id` 的 UUID 作唯一資料擁有者身分；選一張 canonical profile 表與一張 canonical clothing 表，消除現有雙表名。先確定表與 ID 契約，再定義跨表關聯、RPC、RLS 及 bucket。每張表建立時即啟用 RLS／預設拒絕，最後才逐項開放所需權限。

**Tech Stack:** Vite/Vue 前端、Supabase Auth、Postgres、PostgREST RPC、Supabase Storage。事實清單見 [TABLE_SCHEMA_REQUIREMENTS.md](TABLE_SCHEMA_REQUIREMENTS.md)。

## Global Constraints

- 僅以本機 `src/`、`supabase/` 為證據；團隊 Supabase 的真實 DDL、資料與 policies 尚未取得。
- 本階段只寫文件與草案；**不**執行任何 SQL、migration 或遠端操作，也**不**修改 Auth、Storage 或前端程式。
- 任何未知欄位、型別、預設值、FK、RPC 實作及安全規則都標為 **UNKNOWN**；未經確認不得變成可執行 migration。
- 不使用或輸出 `legacy/` 的 secret／service role 檔，也不把它們複製進個人專案。

## 先決定的身分模型（建議，非現況）

1. **唯一 owner ID = `auth.users.id`（UUID）**。登入後所有遠端 CRUD、Storage path 都應使用當前 session 的這個 ID；資料庫政策只信任 `auth.uid()`，不信任前端傳來的任意 owner 值。
2. **建議保留 `public.profiles` 作 canonical profile 表**，因為正式前端實際 `.from('profiles')`。可採共享主鍵 `profiles.id = auth.users.id`，一個 Auth user 對一個 profile。現有未接線 helper 的 `profiles.user_id` 查詢／upsert 需在後續前端對齊；若為相容而保留 `user_id`，它應是 `auth.users.id` 的唯一 FK，並保證與 `id` 相同。不要建立兩套互不相干的 profile 身分。
3. **`ootie_profiles.user_id` 若保留，應對應 `auth.users.id`**；但 `ootie_profiles` 目前只出現在 bookmark migration。建議個人版不再新建第二張 profile 表，將該 migration 改為直接使用 Auth UUID／`profiles`。若離線團隊 DDL 顯示 `ootie_profiles` 必須是 canonical，則反向調整前端 `profiles` 呼叫與本計畫後再寫 SQL。
4. **其他資料表的 owner FK 建議直指 `auth.users(id)`**：`user_id`、`owner_id`、`closet_owner_id` 都存同一種 Auth UUID；若需要 profile 顯示資料，透過共享 UUID join `profiles`。`sos_id`、`picked_suggestion_id`、衣物參照則指向各自內容表，不指向 Auth。
5. `user-01` 是 service 預設值與 Auth localStorage fallback 的 mock；`profile-01` 是 `defaultProfile`、SOS、bookmarks 等本機假資料的 mock。`post-...`、`sos-...`、`suggestion-...`、`bookmark-...` 與數字字串衣物 ID 也不是遠端 UUID。這些 ID 不能種入 UUID 欄，也不能當成 Auth 身分。

**現況判斷：** Supabase Auth 負責登入／session，但遠端資料函式沒有取得 `authStore.user.id`。因此「主要使用 auth user id 還是 profile id」的答案是 **雙軌且未對齊**：Auth 流程用真實 Auth user；資料寫入預設 `user-01`，社交／收藏多用 `profile-01`。目前不能因為登入成功就推論資料列或 RLS 可正常運作。`src/stores/auth.js:22-30` 的 localStorage 假登入還可能在無 Auth session 時把 UI 視為已登入。

## Review Focus：未來實作前必驗證的 5 個失敗情境

1. **新註冊但無 session／email 尚未驗證**：前端不得用 mock ID 寫入；profile 建立策略要在真正登入後成立。
2. **跨使用者 ID**：惡意改 `owner_id`、SOS ID、bookmark ID、Storage path 時，RLS 與 Storage policy 都拒絕越權。
3. **本機 ID 與遠端 UUID 不一致**：新建 OOTD/SOS 後，後續更新／刪除／採納及 suggestion FK 必須使用回傳的遠端 ID。
4. **統計 RPC 無參數**：每個 RPC 只回目前 Auth 使用者可見的資料，匿名呼叫不能取得私人衣櫥。
5. **bucket 上傳／upsert**：使用者不能覆寫或刪除其他使用者的物件；公開讀取是否允許須與產品隱私規則一致。

## 決策關卡：寫可執行 SQL 之前

| 關卡 | 程式證據與衝突 | 決定／所需材料 |
| --- | --- | --- |
| A. Profile canonical 名稱 | 正式 client 查 `profiles`；bookmark SQL 查 `ootie_profiles` | 建議 `profiles`；若要忠實複製團隊版，需團隊兩表的 schema-only DDL／關係與 trigger 說明 |
| B. Clothing canonical 名稱 | `items` 有查／新增 helper 和已接線刪除；`ootie_clothing_items` 有已接線 `notes` 更新 | 建議選 **一張**（暫以 `ootie_clothing_items` 作候選）；需團隊兩表 DDL、統計 RPC 來源與資料遷移規則。選定前不得同時建立兩份會分歧的衣櫥資料 |
| C. ID／陣列關聯 | OOTD `item_ids`、SOS `closet_item_ids`、suggestion `item_ids` 目前可含假 ID；新增遠端 ID 未回填 | 決定保留 UUID array（無普通逐項 FK）或改關聯表；先制定本機 mock 到 UUID 的處理與前端回填方案 |
| D. 公開範圍 | SOS/suggestion `select('*')`、分享 OOTD 以 ID 查；`public_closet` 目前僅本機狀態 | 確認匿名／登入／作者對公開貼文、關閉 SOS、衣櫥與 profile 欄位的可見矩陣；避免把敏感欄位直接暴露給 `select('*')` |
| E. Storage 可見性 | 前端用 `getPublicUrl`；現有 policy 只看 authenticated，不限 folder | 決定公開 bucket 或私有 bucket＋前端簽名 URL；確定物件 owner、檔案限制與刪除清理規則 |
| F. RPC 契約 | 5 個零參數 RPC 被 Stats 頁呼叫；repo 無 SQL 定義 | 取得團隊 function DDL、來源表、回傳型別、授權、threshold；若不沿用團隊設計，依前端回傳契約重新設計並驗證 |

## 候選 migration 依賴順序（未建立 SQL）

> 下列 `001_...` 是**邏輯檔名草案**。個人副本目前另有 `supabase/migrations/20260924_ootie_bookmarks.sql`；在空白 DB 直接依現有歷史執行會遇到它引用未建立的 `ootie_profiles`。未來須先把 migration 歷史整理成一條可重播 baseline（重寫／取代舊 bookmarks migration），不能只附加較晚的修補檔。正式 CLI 檔名格式待建立 SQL 時依工具要求確認。

| 順序／候選檔 | 依賴 | 本機草案內容與暫定驗收 |
| --- | --- | --- |
| `001_extensions.sql` | Supabase 空白 project | 僅確認 `gen_random_uuid()` 所需能力；現有 bookmarks SQL 用 `pgcrypto`。不建立 `auth.users`。驗收：UUID 預設可用，無多餘權限。 |
| `002_profiles.sql` | Auth 已存在；關卡 A | 建唯一 canonical profile 表（建議 `profiles`），共享 Auth UUID；只納入前端已觀察的 profile 欄位與確認後的必要欄。決定 signup 建 profile 的 trigger 或經驗證 session 後的 client 寫入。建表時啟用 RLS、先不開放。驗收：一位 Auth user 最多一筆 profile，假 ID 無法入表。 |
| `003_clothing_items.sql` | `002`、關卡 B/C | 建唯一 canonical 衣物表；至少滿足已接線 `notes` 更新與決定後的衣櫥讀寫、統計來源。`items`／`ootie_clothing_items` 的舊名稱相容方式需同時定案，不能讓一個 service 寫 A、另一個寫 B。驗收：本人 CRUD／欄位契約一致。 |
| `004_ootd_posts.sql` | `002`,`003`、關卡 C/D | 建 OOTD，Auth UUID owner、UUID post ID，保留前端實際讀寫欄位；`item_ids` 表示法待定。建表即啟用 RLS。驗收：新增取得 UUID 後可更新／刪除，分享頁按預定公開規則讀取。 |
| `005_sos_posts.sql` | `002`,`003`、關卡 C/D | 建 SOS 與 `user_id`／`closet_owner_id` 關係；先保留可空 `picked_suggestion_id`，**暫不**加指向尚未存在 suggestion 表的 FK。建表即啟用 RLS。驗收：只有作者能更新 status／採納欄。 |
| `006_outfit_suggestions.sql` | `005`、關卡 C/D | 建 suggestion，`sos_id` 指向 SOS、responder 為 Auth UUID；決定一人一則 SOS 是否唯一與重送時 update/upsert 語義。建表即啟用 RLS。驗收：不存在 SOS／非 UUID ID 被拒絕，跨人資料符合可見性規則。 |
| `007_sos_adoption_fk.sql` | `005`,`006` | 在兩張表都存在後加入 `picked_suggestion_id` FK；還須保證被採納 suggestion 屬於**同一則** SOS（單純 FK 到 suggestion ID 不足）。驗收：不能採納別則 SOS 的 suggestion。 |
| `008_bookmarks.sql` | `002`、關卡 A/E | 以現有 `20260924_ootie_bookmarks.sql` 為**參考**重整；保持已確認的欄位／timestamp trigger，`owner_id` 統一 Auth UUID，明確 FK。移除不存在的 `ootie_profiles` 子查詢與條件式 FK，不保留 `profile-01` 查詢後門。建表即啟用 RLS。驗收：本人可 CRUD、他人不可；空白 DB 可重播。 |
| `009_rpc_functions.sql` | `003`、關卡 B/F | 定義 5 個前端實際呼叫的零參數 RPC，回傳欄位／型別見需求文件；使用 Auth context 篩選，避免由 client 提供 owner ID。若需內部 helper function，列為同檔前置定義並審核執行權限。驗收：回傳形狀符合 Stats 頁，跨使用者不漏資料。 |
| `010_rls_policies.sql` | `002`–`009`、關卡 D | 為已啟用 RLS 的每張表加最小必要 SELECT/INSERT/UPDATE/DELETE policy；核對零參數 RPC 的執行權限與是否會繞過 RLS。公開 SOS／OOTD 與 profile 欄位必須依決策矩陣，不用猜測。驗收：角色矩陣所有允許／拒絕案例通過。 |
| `011_storage_bucket_policies.sql` | `002`,`008`、關卡 E | 先建立 `ootie-bookmarks-images` bucket，再定義讀取與 `bookmarks/<auth UUID>/...` owner 寫入政策；取代 `supabase/bookmarks-storage.sql` 的寬鬆更新／刪除 policy。若 bucket 私有，須先改前端 URL 流程。驗收：本人可上傳／upsert，跨人修改／刪除被拒。 |

**實際建表最小欄位與 UNKNOWN**：每張表的前端讀寫欄位已逐項列在 `TABLE_SCHEMA_REQUIREMENTS.md`。除既有 bookmarks SQL 外，型別、`NOT NULL`、預設值、索引、cascade、trigger 均待團隊 DDL 或明確產品決策；本計畫不把推定欄位寫成已知資料庫事實。

## 前端對齊工作（後續階段；本次不改碼）

- 將 service 的 `CURRENT_USER_ID = 'user-01'` 與 Auth localStorage 假登入撤出遠端路徑；每個遠端操作取已驗證 session 的 Auth UUID，未登入時不執行私人資料寫入。
- 將 `appStore.profile.id`、bookmarks `owner_id`、SOS `sender_id`／`closet_owner_id` 對齊同一 UUID；移除正式查詢中的 `owner_id.eq.profile-01`。`public_closet` 若要控制 DB 可見性，需有已驗證的持久化欄位與規則。
- 在 OOTD/SOS/suggestion 新增成功後把遠端 UUID 回填本機物件，再進行更新、刪除、採納與 FK 寫入；失敗時不要把本機成功誤報為遠端成功。
- 收斂 `items`／`ootie_clothing_items`、`profiles`／`ootie_profiles` 的表名；對齊統計 RPC 使用的衣物欄位，例如 `price, wear_count, last_worn`，但只有團隊 DDL／新設計確認後才加入遠端 schema。
- Storage folder 改用 Auth UUID；依 bucket 公開決策保留 `getPublicUrl` 或改簽名 URL；限制檔案型別、大小與路徑碰撞。

## 測試草案（本階段未執行）

1. **空白本機 DB 重播**：從第一支到最後一支 migration 全部成功；重建後可列出預期表、FK、RLS、function、bucket，沒有對缺失 `ootie_profiles` 的引用。這是將來的本機驗收，**本階段不執行**。
2. **型別／ID**：假 `user-01`、`profile-01`、`sos-<timestamp>` 不能當 UUID；真正 Auth UUID 建立 profile／內容列成功；新增後更新／刪除使用同一遠端 UUID。
3. **Auth 與 RLS 雙使用者**：A 建 profile、衣物、OOTD、SOS、suggestion、bookmark；B 對 A 私有資料的 SELECT/UPDATE/DELETE 與 Storage upsert 被拒；公開資料依決策矩陣可讀。匿名角色只能讀明確公開資源。
4. **跨表關聯**：不存在或不屬於該 SOS 的 suggestion 不可採納；不存在的 `sos_id` 不可新增 suggestion；衣物 ID 表示法依關卡 C 驗證。
5. **RPC 契約**：5 個零參數 function 的回傳形狀符合 Stats 頁，空集合仍有穩定型別；A 的結果不含 B 私有衣物。`get_disused_items` 門檻與本機的 90 天／2 次是否一致須明確決定。
6. **Storage**：公開 bucket 的 URL 可讀（若選公開）；A 可上傳自己的 folder，A 不能用 `upsert` 覆寫 B 的檔，匿名／B 不能刪 A 的檔；刪 bookmark 後物件清理按決策規則驗證。

## 目前可否安全開始建立個人 schema？

**可開始撰寫、審查本機 SQL 草案；尚不可安全執行到個人 Supabase。** 目前至少要先關閉 A–F 的 schema／權限決策，修正 mock ID 與遠端 ID 回填，並取得團隊 schema-only 資料或明確接受一套與團隊不同的乾淨新 schema。現有 bookmark migration 不能當作完整 baseline 直接套用。

若目標是「忠實複製團隊 Supabase」，仍需由團隊提供**不含資料、密鑰與個資的離線結構匯出**：所有表的 DDL、型別、defaults、indexes、FK、triggers、RLS policies、5 個 RPC 與其依賴 functions／grants、bucket public 設定與 Storage policies、Auth/profile 建立方式。收到後先離線比對本文件，再完成可執行 SQL；本階段不要求也不進行任何遠端連線。
