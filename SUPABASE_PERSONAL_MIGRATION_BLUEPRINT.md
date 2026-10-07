# OOTIE-sandy-dev 個人 Supabase 重建藍圖

狀態：**規劃稿；SCHEMA-05 readiness = NOT_READY；沒有可執行 SQL，也沒有執行 migration**（2026-09-27）。依據 [SUPABASE_SCHEMA_04_COMPARISON.md](SUPABASE_SCHEMA_04_COMPARISON.md) 對兩份團隊 CSV 的比對，優先忠實還原團隊 OOTIE 結構；與先前 `SUPABASE_SCHEMA_MIGRATION_PLAN.md` 的「直接 FK Auth UUID／改用 `profiles`」**不同**。不能把舊建議當成團隊現況。此文件不觸碰任何遠端專案；gate 的逐項判定見 [SUPABASE_MIGRATION_READINESS.md](SUPABASE_MIGRATION_READINESS.md)。

## 目標與範圍

| 範圍 | 物件 | 處理 |
| --- | --- | --- |
| 團隊 OOTIE 核心，個人版候選必需 | `ootie_profiles`, `ootie_clothing_items`, `ootie_ootd_posts`, `ootie_sos_posts`, `ootie_outfit_suggestions`, `ootie_bookmarks` | CSV 證實存在；依下表 FK 順序起草本機 migration |
| 團隊 OOTIE 輔助，完整 parity 範圍 | `ootie_notifications`, `ootie_post_likes`, `ootie_saved_posts` | CSV 證實存在，正式 `src/` 目前沒有直接 `.from`；本藍圖以完整團隊 OOTIE 結構為目標，因此納入 |
| 目前正式前端仍呼叫，但團隊快照未證實 | `profiles`, `items` | 不因 legacy SQL 而建立；另規劃前端表名／身分參照對齊。若要求前端**原封不動**運行，這是阻擋條件 |
| 前端呼叫但兩份 FUNCTION 匯出均未證實 | `get_top_worn_items`, `get_cost_per_wear_ranking` | 不從 `legacy/aizhen` 直接搬入；取得完整 function inventory 或確認團隊未部署，再決定是否另行新增功能 |
| 團隊其他專案或 legacy only | `careu`, `documents`, `functions`, `rag_query_logs`, `recommendations`, `test_table`；legacy `posts` | 不納入個人 OOTIE migration；也不複製其資料、函數或 vector 相關依賴 |

**資料移轉**不在本藍圖：沒有業務資料列、Auth user、密碼或 key，也不建立假使用者。若未來需要 demo 資料，須另做獨立決策；目前只規劃 schema。`auth.users` 由個人 Supabase Auth 管理，不寫手工建表 SQL。

## 原樣保留的團隊結構關係

團隊快照的內容 FK 鏈是 `ootie_profiles.id` → clothing／OOTD／SOS／suggestion／bookmark／三張輔助表。`ootie_outfit_suggestions.sos_id` 指向 SOS；post likes/saves 的 `post_id` 指向 OOTD。`ootie_profiles.user_id` 是 UUID 欄、可空、預設隨機 UUID，**沒有**已記錄的 `auth.users` FK 或 UNIQUE；補充匯出也未列出 Auth 自動建 profile trigger。是否有未匯出的 trigger、資料值是否對應 Auth user 仍需補證據。

忠實重建時先保留快照的**欄名、型別、nullable、default、PK、FK、CHECK、index** 作比較基準，不把 `owner_id`／`user_id` 直接改成 Auth FK，也不憑空創造 `profiles`／`items`。但現有隨機 UUID defaults（包含內容 FK 欄、SOS `picked_suggestion_id`）可能造成無效關聯；每個有疑慮的 default 必須在審查表中標明，未確認前不能把它悄悄改掉或安全地直接套用。

## 必須先關閉的決策關卡

| Gate | 需要確認 | 影響 |
| --- | --- | --- |
| G1 Auth/profile 對應 | 兩份匯出均無 `auth.users` trigger，但需可證明涵蓋 Auth schema 的盤點；`ootie_profiles.user_id` 的真實資料／規則；profile ID 如何由 session 解析 | 無法可靠授權或從前端把 Auth user 映射成團隊 profile ID |
| G2 Snapshot 完整性 | 10 個 enum／6 個 extension 已列出；仍需完整 public table/view inventory，確認 `profiles`／`items` 真不存在或只是匯出未涵蓋 | 決定是否需要舊表相容層；本藍圖暫不建立 |
| G3 Function 完整性 | 三個 RPC 與兩個 trigger function 的完整 DDL、security、函式級 config、EXECUTE grant 已有；仍需兩個未列出 RPC 的團隊狀態與 function owner／有效 search_path | 決定 `009_functions` 的最終清單及 Stats 頁回傳契約 |
| G4 安全設定 | 多數 OOTIE 表 RLS 關閉、`get_brand_stats`／`get_disused_items` 無 owner filter、Storage 寫入 policy 不驗 folder owner | 決定忠實複製現況還是經授權做安全修訂；**不**在此階段自行改寫 |
| G5 前端相容 | `profiles`／`items` 仍被呼叫；`user-01`／`profile-01`／本機非 UUID 貼文 ID 未對齊真實 profile UUID | 只做 schema migration 也無法保證正式前端可正常 CRUD；需要後續獨立前端修正計畫 |
| G6 SQL 重播細節 | 補充 CSV 有 extension 清單與乾淨 function DDL／grants；仍無 policy permissive、表／schema grants、完整 Auth 物件、function owner 與 extension schema；既有 bookmark SQL 與團隊不同 | 無法從 CSV 直接轉成精確、完整、可重播的 migration |

## Migration 依賴順序（邏輯候選檔名，尚未建立）

> 以下不是 SQL 檔，也不構成執行授權。未來實際檔名須與 Supabase CLI 規則及既有 `20260924_ootie_bookmarks.sql` 的歷史順序協調。**不可**原封不動先執行舊 bookmark migration：它在個人空白 DB 直接引用尚未建立的 `ootie_profiles`，且與團隊快照的 default、index、trigger、policy 數量不同。應先把整條個人版 migration 歷史重整成可重播 baseline。

| 順序 | 候選單元 | 前置依賴 | 忠實還原內容／待決事項 |
| --- | --- | --- | --- |
| `001_extensions` | prerequisite 檢查 | 空白個人專案、G2/G6 | 補充 CSV 列出 `pg_stat_statements 1.11`、`pgcrypto 1.3`、`plpgsql 1.0`、`supabase_vault 0.3.1`、`uuid-ossp 1.1`、`vector 0.8.2`；只針對 OOTIE 實際依賴的 `gen_random_uuid()` 與 bookmark trigger `plpgsql` 規劃，先確認 extension schema／個人專案預設，不因團隊其他專案的 vector functions 搬入無關 extension。 |
| `002_ootie_profiles` | profile 基底 | `001`、G1 | 按 CSV 的 12 欄、`profiles_pkey`（實際表是 `ootie_profiles`）建立。`user_id` 不得擅自加 Auth FK／UNIQUE；若新 Auth 匯出證實 trigger 或約束，再補進正式草案。 |
| `003_ootie_clothing_items` | 衣物 | `002` | 按 21 欄、`owner_id -> ootie_profiles(id)`、PK；保留 `last_worn`／`purchase_date` 為 `text` 的事實，標記 `owner_id default gen_random_uuid()` 的疑慮。 |
| `004_ootie_ootd_posts` | OOTD | `002`、可選 `003` 的 item ID 契約 | 按 10 欄、`user_id -> ootie_profiles(id)`、PK；`item_ids jsonb` 不是已確認的逐項 FK。 |
| `005_ootie_sos_posts` | SOS | `002`,`003` | 按 15 欄、`user_id -> ootie_profiles(id)`、PK、`status` CHECK。保留 `closet_item_ids uuid[]`、`liked_suggestion_ids uuid[]`、`picked_suggestion_id uuid` 的快照事實；後兩個 ID 欄沒有已記錄 FK，不新增臆測 FK。 |
| `006_ootie_outfit_suggestions` | 建議 | `002`,`005` | 按 7 欄、`sos_id -> ootie_sos_posts(id)`、`user_id -> ootie_profiles(id)`、PK；`item_ids jsonb` 的參照完整性尚無 FK。 |
| `007_ootie_auxiliary` | 團隊 OOTIE 輔助表 | `002`,`004` | 納入 CSV 證實的 `ootie_notifications`、`ootie_post_likes`、`ootie_saved_posts` 及其 FK／PK；當前正式前端最小範圍雖不依賴它們，完整團隊 parity 仍需包含。不得加入 legacy-only `posts`。 |
| `008_ootie_bookmarks` | 收藏表 | `002` | 按 CSV 17 欄、`owner_id -> ootie_profiles(id) ON DELETE CASCADE`、PK、三個非 PK index 重寫 baseline。`currency default=NULL` 是團隊現況，不是舊 repo 的 `'TWD'`。先不放 trigger／policy，交由後續依賴單元。 |
| `009_functions` | 三個已證實 RPC＋兩個 bookmark trigger functions | `003`,`008`、G3/G4/G6 | 補充 CSV 有五個完整、可讀的函式 DDL，均 `security_definer=f`、函式級 config/search_path `NULL`，且各有 `PUBLIC`、`anon`、`authenticated`、`service_role`、`postgres` EXECUTE 記錄。只把它們用作本機 SQL 草案依據；兩個前端呼叫而未匯出的 RPC 不自動建立。缺 owner／有效 search_path／底層表權限，跨使用者讀取需審查。 |
| `010_triggers` | Bookmark triggers；Auth trigger 待證 | `002`,`008`,`009`、G1 | 兩份 CSV 都有兩個 bookmark BEFORE UPDATE triggers，分別呼叫上述兩個函數；是否兩者都需重播應確認。兩份 CSV 均未列出 Auth trigger，但未證明涵蓋 `auth.users`，不能編造或斷言不存在。 |
| `011_rls_policies` | RLS 與 policies | 所有表、G4/G6 | 記錄團隊狀態：bookmark RLS 開啟、有八個 policy；其餘八張 OOTIE 表 RLS 關閉，雖有 `SELECT USING true` policy。個人版要「原樣還原」或「安全修訂」須明確決定；未決前不要產出會暴露資料的可執行版本。 |
| `012_storage` | Bucket 與物件 policies | `008`,`011`、G4/G6 | 團隊 public bucket `ootie-bookmarks-images`，size/mime 欄為 NULL，storage.objects 四個 policy；寫入只看 bucket＋authenticated，沒有 folder owner 檢查。Storage 系統 triggers 不手工複製。 |

### 每個單元在未來的本機驗收草案（本次未執行）

- 在**隔離、可丟棄的本機資料庫**由空白狀態重播全部 migration，逐項對照 CSV 的 9 張 OOTIE 表、96 欄、21 個 OOTIE constraints、12 個 OOTIE indexes、20 個 policies（含 Storage）、9 個 triggers 中**需自行建立的 OOTIE 部分**；系統內建 Storage triggers 不由個人 SQL 寫入。
- 核對 `profiles`／`items` 沒有被 legacy SQL 意外建出；若另行決定相容層，必須有獨立變更記錄及對應前端驗證。
- 對 Auth/profile、bookmark owner、跨人讀寫、三個已證實 RPC、Storage 上傳／覆寫建立**雙使用者與匿名**的測試草案；但必須先完成 G1/G4，不能把目前團隊 RLS 關閉誤判為安全。
- 比對 RPC 回傳契約：`get_closet_stats` 缺 `colorFamilyStats`、`get_disused_items` 的 30 天規則與本機 90 天不同、兩個 RPC 缺定義。這些是前端功能差異，不能用「migration 成功」掩蓋。
- 驗證 CSV 未完整證明的 Auth trigger、public table/view inventory、表／schema grants、policy permissive 與 extension schema；enum／extension 清單及五個 OOTIE function 的 EXECUTE grant 已補足。否則只宣稱「依快照重建了可見的 OOTIE 部分」。

## 是否已足夠開始製作個人版 migration SQL？

**NOT_READY：可起草本機表／欄位／FK／index 及五個已證實 function 的非執行版 SQL，但不足以完成安全且忠實的整套可執行 migration。** Auth/profile 建立機制、兩個缺失 RPC 的確切狀態、完整 public table/view 清單、表與 policy 權限細節及 RLS／Storage 安全決策仍是關卡。若下一次要補證據，只接受另外取得的**離線、唯讀、結構限定**資料或團隊確認；本階段不再次連線團隊或個人 Supabase。逐項缺口見 [SUPABASE_MIGRATION_READINESS.md](SUPABASE_MIGRATION_READINESS.md)。
