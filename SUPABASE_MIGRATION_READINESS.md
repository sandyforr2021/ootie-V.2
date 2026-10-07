# SUPABASE-SCHEMA-05｜個人版 Migration Readiness Gate

> **歷史文件／已被部分取代：**AUTH-IDENTITY-09 已於 2026-09-28 明確決定 Auth/Profile model，並建立本機 002／010 草案。R1 的「尚未決定」不再是現行產品規格；最新執行狀態以 `SUPABASE_EXECUTION_GATE.md` 為準。其他 RLS／RPC／權限 UNKNOWN 仍有效。

日期：2026-09-27。判定範圍是「以現有離線證據製作**完整、忠實且可安全審查**的 OOTIE-sandy-dev schema migration」。資料只來自本機 [原始快照](TEAM_SUPABASE_SCHEMA_SNAPSHOT.csv.csv)、[補充匯出](TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv)、[交叉比對](SUPABASE_SCHEMA_04_COMPARISON.md)、[個人版藍圖](SUPABASE_PERSONAL_MIGRATION_BLUEPRINT.md) 及正式程式。沒有連線 Supabase、執行 SQL、建立 `.sql` migration 或改動 Auth／Storage／RLS。

## 判定：NOT_READY

可在本機**起草**已有證據的 9 張 OOTIE 表、欄位、PK／FK／CHECK、索引及 5 個已匯出函式供人工審閱；目前**不能**宣稱已足夠製作完整、忠實且可安全採用的 migration。NOT_READY 是證據與設計關卡，不表示已對任何遠端專案做失敗測試。本階段沒有做資料庫測試。

## 已取得的結構證據

| 項目 | 現有結論 | 證據邊界 |
| --- | --- | --- |
| Auth trigger | 兩份 CSV 各列 9 個 trigger，名稱一致，均無 `auth.users` trigger；補充匯出無可辨識的 profile 建立 function | 未提供 trigger 匯出 SQL、權限與完整性聲明；**不能證明團隊端絕對沒有**，也不能回答它呼叫哪個 function |
| 身分 FK | `ootie_profiles.id` 是內容資料 FK 目標；`ootie_profiles.user_id uuid nullable default gen_random_uuid()`，已匯出的 constraint 無對 `auth.users.id` 的 FK／UNIQUE | 值是否真的對應 Auth user、建立流程與 profile ID 解析仍 UNKNOWN |
| Views | 兩份 CSV 的 `VIEW` row 都是 0 | 不能把零筆當成完整 view inventory；`profiles`／`items` 是否有未匯出的 relation 仍 UNKNOWN |
| Enums | 補充匯出 10 個：`auth.aal_level`、`auth.code_challenge_method`、`auth.factor_status`、`auth.factor_type`、`auth.oauth_authorization_status`、`auth.oauth_client_type`、`auth.oauth_registration_type`、`auth.oauth_response_type`、`auth.one_time_token_type`、`storage.buckettype`；未見 `public` enum，96 個 OOTIE 欄位未引用 enum | 可作已匯出 enum 清單；Auth／Storage 系統物件不手寫重建 |
| Extensions | 補充匯出 6 個：`pg_stat_statements 1.11`、`pgcrypto 1.3`、`plpgsql 1.0`、`supabase_vault 0.3.1`、`uuid-ossp 1.1`、`vector 0.8.2` | 安裝清單已知；所在 schema、建立方式、個人專案預設與 OOTIE 真正依賴範圍未全證實 |
| OOTIE function DDL | 補充匯出有完整可讀的 `public.get_closet_stats()`、`get_brand_stats()`、`get_disused_items()`、`set_updated_at()`、`update_ootie_bookmarks_updated_at()` 定義；完整 DDL 保存在交叉比對文件第 14.3 節 | 兩個前端 Stats RPC 仍未匯出；function owner／呼叫時有效 search_path 未提供 |
| Security 與 grants | 上述 5 個 function 均 `security_definer=f`，即 invoker；`config/search_path=NULL`，即無函式級設定；各有 `PUBLIC`、`anon`、`authenticated`、`service_role` EXECUTE grantable=NO 和 `postgres` EXECUTE grantable=YES 記錄 | `NULL` 不等於執行時沒有 search_path；函式 grant 不等於底層表一定可讀，表／schema grants 未提供 |
| 缺失 RPC | `get_top_worn_items`、`get_cost_per_wear_ranking` 在兩份 FUNCTION 清單及補充 grant 清單均為 0 筆；repo legacy 草案不代表團隊部署 | 需證明函式盤點涵蓋目標 schema，或由團隊確認「未部署」及個人版如何處理前端呼叫 |

## 阻擋完整重建的缺口與關閉條件

| Gate | 還缺的證據或決策 | 關閉條件 |
| --- | --- | --- |
| R1 Auth/profile | `auth.users` trigger 是否存在、若存在的 trigger/function 完整定義；`ootie_profiles.user_id` 的建立規則與 Auth 對應 | 提供可驗證範圍的離線 Auth trigger/function 匯出，或團隊明確確認無此 trigger 並描述 profile 建立流程；確認前端如何取得 `ootie_profiles.id` |
| R2 Relations/views | 完整 public table/view inventory；`profiles`、`items` 是真實表／view、legacy 名稱或本次匯出盲點 | 提供明確涵蓋 public schema 的 relation/view 清單或可驗證的零筆 view 結果，並決定前端舊表名的處置 |
| R3 RPC 契約 | 兩個未列出 Stats RPC 的實際部署狀態與應有回傳契約 | 取得完整 function inventory 或團隊確認未部署；若個人版需要它們，將新增視為**獨立設計**，不能冒稱忠實複製 |
| R4 SQL 權限／policy | 表與 schema grants、policy permissive/restrictive、function owner、有效 search_path；RLS 關閉的八張 OOTIE 表及 Storage 寬鬆 policy 是否照搬 | 提供缺失的離線結構／權限資訊，並完成忠實度與資料隔離的明確決策；不以名稱中的「own」推定 owner 保護 |
| R5 重播相容 | 已有 `20260924_ootie_bookmarks.sql` 與團隊 default、索引、trigger、policy 不一致；extensions schema／個人專案預設未知；幾個 UUID default/FK 組合有疑慮 | 決定個人版 baseline 與舊檔歷史如何處理；逐項核對可重播 DDL，而不是直接套用舊檔 |
| R6 前端驗收 | 正式程式仍呼叫 `profiles`、`items`，且 mock `user-01`／`profile-01` 不是 UUID；`get_closet_stats` 缺 `colorFamilyStats`，其他 Stats 函式有隔離／規則差異 | 另有前端身分映射與功能契約決策；不能以 schema 建成代表正式前端已可安全運作 |

R1 至 R4 與 R5 是「完整、忠實且安全可審查的 migration」的阻擋條件；R6 是後續實際運作驗收條件。已知表結構仍可形成**本機非執行草案**。不會在這份文件中把不確定的 Auth trigger、view、RPC、FK 或 policy 編造成確定物件。

## 建議的未來 migration 單元（僅檔名與依賴，未建立 SQL）

| 順序 | 候選檔名 | 主要依賴／gate |
| --- | --- | --- |
| 001 | `001_extensions.sql` | 確認 OOTIE 必要 extension、schema 與個人專案預設；R5 |
| 002 | `002_ootie_profiles.sql` | 001；Auth/profile 事實 R1 |
| 003 | `003_ootie_clothing_items.sql` | 002 |
| 004 | `004_ootie_ootd_posts.sql` | 002 |
| 005 | `005_ootie_sos_posts.sql` | 002，衣物 ID 契約參照 003 |
| 006 | `006_ootie_outfit_suggestions.sql` | 002、005 |
| 007 | `007_ootie_auxiliary.sql` | 002、004；notifications／post_likes／saved_posts |
| 008 | `008_ootie_bookmarks.sql` | 002；重整舊 bookmark migration 歷史 R5 |
| 009 | `009_functions.sql` | 003、008；已知 5 個函式，缺失 RPC 決策 R3，權限 R4 |
| 010 | `010_triggers.sql` | 002、008、009；兩個 bookmark trigger 已證，Auth trigger R1 |
| 011 | `011_rls_policies.sql` | 所有 OOTIE 表；權限與安全決策 R4 |
| 012 | `012_storage.sql` | 008、011；bucket／objects policy 與安全決策 R4 |

以上名稱是**邏輯候選**，不是已建立檔案；實際 Supabase CLI migration 命名與既有檔案歷史要在後續設計時協調。本階段未執行任何一項。

## 是否需要再次查看團隊 Supabase？

**需要更多團隊端結構證據或團隊確認，才能關閉 R1–R4；不需要由本工作階段連線。** 最少應是離線、唯讀、結構限定的 Auth trigger/function 盤點、完整 public table/view/function inventory、表／schema grants 與 policy permissive 設定，以及 `ootie_profiles.user_id` 建立流程說明。若團隊能以可信的既有文件或匯出查詢證明現有 CSV 的範圍完整，也可用來關閉相應 UNKNOWN。任何新證據到手後再重新判定 READY／NOT_READY；本階段到此停止。
