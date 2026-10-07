# SUPABASE-MIGRATION-06｜Evidence-Based Personal Development Baseline

目前目標：獨立 Development Project `OOTIE-personal-dev`（ref `hoxkrmadzjnyjaqjbyxc`）。狀態：**001–026 已依數字順序套用並完成 Development postcheck；027 撤銷 trigger-only SECURITY DEFINER 函式的直接 RPC 執行權。** `OOTIE-sandy-dev` 因含非 OOTIE workflow tables 而未被修改。完整 hash 與執行紀錄見根目錄 [SUPABASE_BASELINE_EXECUTION_MANIFEST.md](../../SUPABASE_BASELINE_EXECUTION_MANIFEST.md)。

以下 AUTH-IDENTITY 與 evidence 段落保留為 migration 設計來源與歷史審查背景；凡是提到「本機草案／未執行／舊 target」的文字，不再代表目前 remote status。

2026-09-28 AUTH-IDENTITY-09：舊 002_READY 作廢。002 新增 Auth FK／UNIQUE，010 新增 prospective profile trigger；舊 non-table collision 結果未涵蓋新 function／trigger，需重新唯讀 preflight。最新判定見根目錄 [SUPABASE_EXECUTION_GATE.md](../../SUPABASE_EXECUTION_GATE.md)、[002 preflight](../../002_OOTIE_PROFILES_PREFLIGHT.md)、[trigger precheck](../../AUTH_PROFILE_TRIGGER_PRECHECK.md) 與 [SUPABASE_BASELINE_EXECUTION_MANIFEST.md](../../SUPABASE_BASELINE_EXECUTION_MANIFEST.md)。

這套 baseline 以 Team evidence 為結構起點；`ootie_profiles.user_id` 的 Auth FK／UNIQUE 與 profile provisioning 是 AUTH-IDENTITY-09 明確核准的個人版 identity 修正，不聲稱來自 Team export。Views 與額外 RPC 仍不猜測補齊。

## 來源與隔離

來源優先順序：根目錄 `TEAM_SUPABASE_SCHEMA_SNAPSHOT.csv.csv` → `TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv` → `SUPABASE_SCHEMA_04_COMPARISON.md` → 外層正式 `src/` → 現有 `supabase/`。實際 CSV 檔名有兩個 `.csv`。來源雜湊、CSV 資料筆次及每個物件的對應見 [EVIDENCE_MAP.md](EVIDENCE_MAP.md)。legacy 沒有用作產生 DDL 的來源。

此目錄在 `supabase/migrations/` **之外**，沒有加入既有 migration 清單、建立執行器或改動 CLI 設定。這是預備給空白個人應用 schema 的單次 baseline；使用 `CREATE TABLE/FUNCTION` 讓同名物件衝突浮現，不用 `IF NOT EXISTS` 或 `CREATE OR REPLACE` 掩蓋差異。不含資料移轉／seed。

## SQL 清單與依賴

| 檔案 | 範圍 | 前置依賴 |
| --- | --- | --- |
| [001_extensions.sql](001_extensions.sql) | 團隊 6 個 extension 的來源註解；未來執行時檢查必要函式／語言／平台物件 | 已初始化的 Supabase Auth／Storage；不手工重建平台 schema |
| [002_ootie_profiles.sql](002_ootie_profiles.sql) | `ootie_profiles` 12 欄、PK、`user_id` UNIQUE／Auth FK | 001；`auth.users(id)` |
| [003_ootie_clothing_items.sql](003_ootie_clothing_items.sql) | 衣物 21 欄、owner FK | 002 |
| [004_ootie_ootd_posts.sql](004_ootie_ootd_posts.sql) | OOTD 10 欄、user FK | 002 |
| [005_ootie_sos_posts.sql](005_ootie_sos_posts.sql) | SOS 15 欄、user FK、status CHECK | 002；衣物 ID 是應用契約，未加不存在的 FK |
| [006_ootie_outfit_suggestions.sql](006_ootie_outfit_suggestions.sql) | suggestions 7 欄、profile／SOS FK | 002、005 |
| [007_ootie_auxiliary.sql](007_ootie_auxiliary.sql) | notifications 6 欄、post_likes／saved_posts 各 4 欄 | 002、004 |
| [008_ootie_bookmarks.sql](008_ootie_bookmarks.sql) | bookmarks 17 欄、owner FK、3 個非 PK indexes | 002 |
| [009_functions.sql](009_functions.sql) | 3 個 Stats RPC、2 個 trigger function、25 筆 EXECUTE grants | 003、Auth `uid()`、plpgsql；實際 ACL 需執行前審查 |
| [010_triggers.sql](010_triggers.sql) | 1 個 profile provisioning function、1 個 Auth AFTER INSERT trigger、2 個 bookmark BEFORE UPDATE trigger | 002、008、009、`auth.users` |
| [011_rls_policies.sql](011_rls_policies.sql) | 9 張 OOTIE 表的 RLS 狀態、16 個已知 policy 定義 | 002–008、Auth `uid()`、已確認 policy modes |
| [012_storage.sql](012_storage.sql) | 1 個 public bucket、objects RLS 狀態、4 個已知 policy 定義 | 平台 Storage、Auth `role()`、已確認 policy modes |
| [013_profile_account_foundation.sql](013_profile_account_foundation.sql) | 個人帳號／公開 profile 分界與頭像基礎 | 002、Auth、Storage |
| [014_saved_outfits_metrics.sql](014_saved_outfits_metrics.sql) | 私人收藏組合與 metrics 基礎 | 002、004、005、007 |
| [015_ootd_publish_foundation.sql](015_ootd_publish_foundation.sql) | OOTD 圖片／tagged item ownership 基礎 | 003、004、007、Storage |
| [016_ootie_ai_gateway.sql](016_ootie_ai_gateway.sql) | 私人 AI Storage、usage ledger、quota/idempotency claim | 002、003、Auth、Storage；只允許 server service role claim |
| [017_ootie_ai_gateway_runtime_grants.sql](017_ootie_ai_gateway_runtime_grants.sql) | Gateway 最小 Data API 權限 | 002、003、016；service role 僅可讀 profile／衣物並更新 AI ledger |
| [018_remove_public_bucket_listing_policies.sql](018_remove_public_bucket_listing_policies.sql) | 移除舊 public bucket Data API listing policies | 012、013、015；bucket 仍為 public，只移除列舉物件權限 |
| [019_public_bucket_owner_select.sql](019_public_bucket_owner_select.sql) | 恢復 Storage update/delete 所需的 owner-only SELECT | 018、002；只允許 authenticated owner 路徑，不允許 anon 或 cross-user listing |
| [020_demo_subscription_points.sql](020_demo_subscription_points.sql) | Development Demo 方案、點數、生日獎勵與 AI 點數扣抵 | 013、016；只有 Demo provider，不含真實付款 |
| [021_demo_seed_saved_outfits_grant.sql](021_demo_seed_saved_outfits_grant.sql) | Demo seed runner 寫入 canonical saved outfits 的 server-only 權限 | 014、020；Development seed 用途，不照搬 Production |
| [022_social_remote_product_import_weather.sql](022_social_remote_product_import_weather.sql) | follow、通知、外部商品來源與私有天氣城市 | 002、007、008、013 |
| [023_social_service_role_grant.sql](023_social_service_role_grant.sql) | Development social smoke／seed 最小 server grant | 022 |
| [024_restrict_rls_auto_enable.sql](024_restrict_rls_auto_enable.sql) | 收緊 RLS helper 執行權限 | 011 |
| [025_index_phase3_foreign_keys.sql](025_index_phase3_foreign_keys.sql) | Phase 3 nullable FK index | 016、022 |
| [026_clothing_media_lifecycle.sql](026_clothing_media_lifecycle.sql) | 私有衣物原圖／顯示衍生圖 metadata、bucket、owner RLS、引用中刪除防護 | 002–006、Storage |
| [027_production_readiness_acl_hardening.sql](027_production_readiness_acl_hardening.sql) | 撤銷兩個 trigger-only SECURITY DEFINER 函式對 client roles 的直接 EXECUTE | 014、015 |

共有 9 表、96 欄、23 constraints（9 PK、12 FK、1 CHECK、1 UNIQUE）、3 個顯式索引。9 個 PK 與 1 個 UNIQUE 各自產生索引；加上 3 個顯式索引，預期共 13 個 OOTIE indexes。新增的 Auth FK／UNIQUE 是 AUTH-IDENTITY-09 授權修正，不是 Team export parity。

## 保留的事實與必要 TODO

- **Identity：**內容 FK保留 `ootie_profiles.id`。`ootie_profiles.user_id` 為 `uuid NOT NULL UNIQUE`、無 default、FK → `auth.users(id) ON DELETE NO ACTION`。010 只為未來新 Auth user 建 profile，不批次回填既有 Auth users，不插入 `user-01`／`profile-01`。完整 contract 見 [AUTH_IDENTITY_MODEL.md](../../AUTH_IDENTITY_MODEL.md)。
- **Functions：**只建立 `get_closet_stats`、`get_brand_stats`、`get_disused_items` 與 `set_updated_at`、`update_ootie_bookmarks_updated_at`。signature 取可讀 EXTRA DDL；`get_disused_items` body 有一處明確的個人版型別相容修正，見下節。security 為 invoker，函式 config 為 NULL。migration 的 `SET LOCAL search_path` 只服務這次 DDL 名稱解析，不會新增 function 的 `SET search_path`。
- **缺失 RPC：**`get_top_worn_items`、`get_cost_per_wear_ranking` = `FRONTEND_DEPENDENCY_MISSING`；不從 legacy 補入。後續 issue 候選見 [FRONTEND_SCHEMA_CONFLICTS.md](../../FRONTEND_SCHEMA_CONFLICTS.md)。
- **Policy modes：**`TEAM_SUPABASE_POLICY_MODES.csv.csv` 的 20 筆以 schema／table／policy name 一對一匹配原快照，command、roles、USING、WITH CHECK 也一致；20 筆均明確記為 `PERMISSIVE`。011／012 現在各有 16／4 個 `CREATE POLICY ... AS PERMISSIVE`，原本因 mode 未知而中止的區塊已移除。這只解決 mode 證據，不代表已驗證目標物件、SQL 語意或執行權限。
- **RLS：**bookmarks 開啟，其餘 8 張 OOTIE 表關閉；全部 NO FORCE。Storage objects 開啟、NO FORCE。這是來源現況，未加 owner policy 或重新設計；風險記於 [PERSONAL_SECURITY_FOLLOWUP.md](../../PERSONAL_SECURITY_FOLLOWUP.md)。
- **Storage：**bucket id/name `ootie-bookmarks-images`、public=true、file_size_limit=NULL、allowed_mime_types=NULL。ID 有前端 storage.from 與 policy bucket_id 的交叉證據；NULL 是匯出值，沒有自行增加限制。全域限制與平台管理欄位仍 UNKNOWN；不複製 Storage 系統 trigger。
- **Extensions：**安裝位置未匯出，001 沒有自行選 schema 安裝 extension，也沒有把團隊其他專案的 vector／Vault 依賴帶入。使用者回報 001 PASS；本次不重跑。
- **欄位與 defaults：**`ARRAY` 只在同列 default 明確為 `'{}'::uuid[]` 時產生 `uuid[]`。`default=NULL` 產生無非 NULL default 的欄位；無法區分來源是省略 default 或 explicit DEFAULT NULL。原始 ordinal_position 未匯出，按 CSV 順序列欄；保留欄名與型別契約。
- **權限：**只寫入 5 函式已匯出的 25 個 EXECUTE grant。`service_role` 在 SQL 中僅是角色名稱，不是 key。function owner、表／schema grants、default ACL、呼叫時 search_path 未提供；沒有建立角色、猜測 OWNER／REVOKE 或新增表權限。

## 已知語意衝突

`get_disused_items()` 宣告回傳 `wear_count integer`，但來源表欄位為 `bigint`。07B 在 009 的最後輸出欄位加上 `wear_count::integer`，保留原回傳介面；這是已標記的個人版相容修正，與團隊函式 body 不逐字相同。來源值超過 integer 範圍時仍可能在呼叫時失敗；本階段沒有執行 PostgreSQL 驗證。`get_closet_stats` 少前端要求的 `colorFamilyStats`，且 owner_id 與 auth.uid() 的比較仍有身分疑慮；不在 baseline 中改寫。

## 舊 bookmark migration 衝突

不要把這套 baseline 和 `supabase/migrations/20260924_ootie_bookmarks.sql` 或 `supabase/bookmarks-storage.sql` 串在同一套執行流程。舊檔的 bookmark currency default='TWD'、條件式 FK 名稱／策略、索引數、四個 OR policy 與單組 trigger 和團隊來源不同；Storage SELECT policy 名稱也不同。兩者混用會產生重複 table／index／policy／trigger、function overwrite 或錯誤 default。舊檔本階段保留，未執行、未刪除、未改名。

## 執行前安全檢查的進入條件

**09 判定 IDENTITY_PREFLIGHT_HOLD。** 本機 identity 定義與靜態檢查可完成，但舊 002_READY 已作廢；新 002 BEFORE CHECK、新 function／Auth trigger collision check 與遠端 catalog postcheck 尚未執行。001 不重跑。真正開始 002 前仍須人工核對 target、新 hash、當下碰撞狀態與可恢復備份，並取得另一次 migration 執行授權。

每檔包在獨立 BEGIN／COMMIT 中，**整個 12 檔並非一個原子交易**。不得用「先跑到出錯再說」處理已知 gate；較前檔案可能已提交。未來的執行與回復方式必須在開始任何 SQL 前確認。本次靜態驗證範圍與未驗證事項見 [STATIC_VALIDATION_REPORT.md](STATIC_VALIDATION_REPORT.md)。

## AI migration 016 status

016 已隨 001–015 套用到獨立 Development project；017 補上 Cloud Run Gateway 實際需要的最小 Data API grants。Browser 不能寫入 AI ledger 或 private bucket；Gateway 以 verified Auth user 建立固定路徑並使用 server-only service role。`npm run test:schema:ai` 驗證 canonical SQL 結構；remote RLS、Storage、Advisor 與 member/logout E2E 仍需分別記錄，不能由靜態測試取代。

## Phase 3 migrations

- `022_social_remote_product_import_weather.sql`: follows, notification metadata/triggers, external product attribution and private weather city.
- `023_social_service_role_grant.sql`: remote smoke/seed service-role access to follow rows.
- `024_restrict_rls_auto_enable.sql`: removes the project RLS helper from anon/authenticated execution.
- `025_index_phase3_foreign_keys.sql`: covers nullable AI point-transaction and notification actor foreign keys.
