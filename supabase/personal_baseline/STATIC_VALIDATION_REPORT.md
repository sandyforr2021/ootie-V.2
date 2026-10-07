# SUPABASE-MIGRATION-06｜Static Validation Report

> **AUTH-IDENTITY-09 更新（2026-09-28）：**最新 identity 驗證見文件末尾。舊 002_READY、002／010 hash、以及「不建 Auth trigger」結論已作廢；07B 以下段落保留為歷史證據。

> **07B 更新（2026-09-28）：**以下 06 原始檢查保留作歷史記錄；當中「policy mode 未知／中止」及「`get_disused_items` 尚未轉型」已被本文件末尾的 07B 增補取代。最新執行判定見根目錄 `SUPABASE_EXECUTION_GATE.md`。

日期：2026-09-28。**本機核對結果：PASS（證據、結構與限定語法掃描）；migration 執行狀態：HOLD。** 沒有連線 Supabase、執行 SQL、啟動前端或使用任何 credential。

## 已完成的靜態檢查

| 檢查 | 實際結果 |
| --- | --- |
| 檔案與外層語句 | 12 個預期 SQL 檔存在，依 001–012 排序；共掃描 104 個外層 SQL 語句。每檔有 BEGIN／COMMIT 與 migration 層級 search_path；沒有外層未終止語句 |
| 詞法／限定語法 | 本機 lexer 檢查單／雙引號、dollar quote、註解、括號與方括號配對，並檢查語句起始種類。另逐類人工核對 CREATE TABLE、constraint、index、function、trigger、policy format template、bucket INSERT 的形狀。這**不是完整 PostgreSQL grammar parse** |
| CSV parity | 9 張表、96 欄、21 constraints（9 PK、11 FK、1 CHECK）逐欄核對型別、nullable、非 NULL default 與名稱；PK 自帶 9 indexes，加上 3 個單獨 CREATE INDEX，對上來源 12 筆 OOTIE index；未重複建立 PK index |
| 依賴順序 | 11 個 FK 的父表均在引用表之前；3 個 Stats RPC 的衣物表在函式之前；兩個 bookmark trigger 的表與函式均先建立；16 個 public policy 的表已建立；Storage bucket 使用平台 `storage.buckets`／`storage.objects`，由 001 的未來前置檢查涵蓋 |
| Functions／grants／triggers | 5 段函式 body/signature 與 EXTRA 可讀 DDL 一致，僅把 CREATE OR REPLACE 改為空白 baseline 的 CREATE；25 筆 EXECUTE grant 的 role／grant option 對應 CSV；2 個 bookmark trigger 對應 SNAPSHOT |
| RLS／Storage | 9 張 OOTIE 表加 `storage.objects` 共 10 個 enable/disable、force/no force 狀態逐項核對；20 個 policy 的名稱、command、PUBLIC roles、USING、WITH CHECK 都對應 CSV；bucket name/public/NULL limits 與快照一致 |
| 不需的物件 | 只產生 OOTIE 九表；未產生 profiles／items、Auth trigger、兩個未匯出的 RPC、Storage 系統 trigger、seed／mock 固定 ID；未從 legacy SQL 複製 DDL |
| Frontend conflicts | 正式 src 直接 `.from('profiles')` 4 處、`.from('items')` 3 處；位置為 `src/services/supabase.js:21,44,64,97,118,162,184` |
| 舊 migration 衝突 | 既有 `20260924_ootie_bookmarks.sql` 的 currency default 為 TWD，個人 baseline 依快照沒有該 default；舊 policy／trigger／index／FK 也與團隊清單不同。檔案置於 `supabase/migrations/` 之外，沒有相互串接或重複執行器 |
| 來源與機密 | CSV SHA-256 對上 EVIDENCE_MAP；本 baseline SQL 未含 key 型態字串或 URL；本次沒有讀取 `.env` 或 legacy secret |

## 尚未通過的執行關卡

1. **20 個 policy modes = TODO / UNKNOWN。** CSV 無 PERMISSIVE／RESTRICTIVE。011 與 012 以空的 `policy_modes` map 加必填檢查保留所有已知 policy 定義；若現在嘗試執行，該檔會因 `POLICY_MODE_UNCONFIRMED` 報錯並回滾它自己的 transaction。這是**靜態設計判讀**，不是執行過的結果。不能把 policy 已可部署寫成 PASS。
2. **函式型別差異。** `get_disused_items` 宣告 `wear_count integer`，但來源表是 `bigint`。原始 DDL 已保留；沒有執行 PostgreSQL 驗證，不能保證 009 建立或呼叫成功。
3. **執行環境未驗證。** 個人專案的實際物件／ACL／角色權限、Auth 與 Storage 平台版本、extension namespace、bucket 欄位預設與現有 migration 歷史未讀取；使用者禁止本階段連線，因此這些留到下一階段受控檢查。
4. **完整語法解析未做。** 本機與工作區預裝 Python／Node 套件、可執行檔未找到 PostgreSQL parser；沒有下載或安裝，也沒有以資料庫「試跑」代替靜態檢查。詞法與結構掃描不能保證伺服器語意／權限、PL/pgSQL 動態 CREATE POLICY 或平台 DDL 一定可執行。
5. **獨立 reviewer 未完成。** 嘗試進行只讀同儕審查時，該 agent 因帳號使用額度限制中止；上表是本工作階段的實際本機檢查結果，不將同儕審查列為通過。

結論：**可以進入「OOTIE-sandy-dev 執行前安全檢查」；不可開始 migration 執行。** 下一階段需先確認個人目標與空白 schema、確立唯一 migration 歷史、補足 policy modes 或明確採用個人政策決策、處理函式型別差異，並進行受控的 PostgreSQL 語法／權限驗證。本階段到此只交付本機 SQL 與文件。

## 07B 增補：目前 001–012 的本機靜態結果

- **詞法／結構 PASS：**重掃 12 檔、122 個外層 SQL 語句；單雙引號、dollar quote、註解、括號、分號切分均無未閉合；每檔以 BEGIN／COMMIT 包住，含 SET LOCAL search_path。這是本機 scanner 的通過結果，**不是完整 PostgreSQL parser 或伺服器語意驗證**。
- **物件／順序 PASS：**9 個 CREATE TABLE、11 個 FK 的父表先建立、3 個明確 index、5 個函式、25 個 EXECUTE grants、2 個 trigger 均在預期檔案，未見重複定義。001 的必要平台物件只寫成未來的前置檢查，沒有執行。
- **Policy 20/20 PASS：**新增的 mode CSV 與團隊快照按 schema／table／policy name 一對一匹配；命令、角色、USING、WITH CHECK 一致，20 個均為 PERMISSIVE。011 的 16 個及 012 的 4 個明確 CREATE POLICY 再與 mode CSV 逐欄比對通過；原 `POLICY_MODE_UNCONFIRMED` 擋板已移除。
- **已知型別差異已在本機 SQL 修正：**009 的 `get_disused_items` 保留匯出回傳契約 `wear_count integer`，將 SELECT 的 bigint 欄位明確轉為 `integer`。這是有據可查的個人版相容修正，不是團隊 body 的逐字複製；超出 integer 範圍的資料在呼叫時仍可能失敗，未做 DB 測試。
- **Migration history 仍需隔離：**現有 `supabase/migrations/20260924_ootie_bookmarks.sql` 不能與 `supabase/personal_baseline/` 同套。12 檔各自提交，後一檔失敗不會回滾前面檔案；尚未有已核准的執行器、歷史記錄與跨檔失敗處置。
- **執行關卡仍 HOLD：**個人 inventory 的內容與所述匯出範圍衝突，未能排除目標同名物件；完整 PostgreSQL 語意與目標平台權限只能在後續受控階段確認。本階段沒有連線或執行任何 SQL。

## AUTH-IDENTITY-09 增補：身份模型靜態驗證

執行命令：

```text
node .\supabase\personal_baseline\tests\validate_auth_identity.mjs
```

結果：`AUTH_IDENTITY_STATIC_VALIDATION=PASS`，process exit code 0。

| 檢查 | 09 結果 |
| --- | --- |
| 002 columns | PASS：仍恰有 12 個原欄位，沒有未授權欄位 |
| `user_id` | PASS：`uuid NOT NULL`、無 default、具名 UNIQUE、具名 FK → `auth.users(id) ON DELETE NO ACTION` |
| 002 constraints | PASS：恰有 PK、user_id UNIQUE、user_id Auth FK 三個 constraints |
| Downstream profile FK | PASS：003～008 共 8 個 FK 繼續指向 `public.ootie_profiles(id)` |
| Direct Auth FK in content | PASS：003～008 為 0；只有 profile bridge 指向 `auth.users(id)` |
| Delete cascade | PASS：content schema 只有已證實的 `ootie_bookmarks.owner_id` 使用 CASCADE；新 Auth FK 明確 NO ACTION |
| Provisioning function | PASS：SECURITY DEFINER、固定空 search path、fully qualified insert、`NEW.id`、`ON CONFLICT (user_id) DO NOTHING`、`RETURN NEW` |
| Auth trigger | PASS：`AFTER INSERT ON auth.users FOR EACH ROW`；沒有批次 `INSERT ... SELECT FROM auth.users` |
| Mock／random identity in executable 010 | PASS：沒有 `user-01`、`profile-01` 或 `gen_random_uuid()` |
| Required docs | PASS：identity model、RLS follow-up、002 preflight、trigger precheck 均存在且非空 |
| Manifest hash lock | PASS：本機重新計算值與 manifest 一致 |

新 SHA-256：

- `002_ootie_profiles.sql`：`C849472DF5C3E924309540267385F215F4E52638FF7B20E7184B58A83696BB36`
- `010_triggers.sql`：`4C9291B851C6DAD93858372D032274E93ED31A83B92A133CDFD552C3AC2C43A7`

限定：本機未找到 `psql`、`pg_format` 或 `sqlfluff`，因此沒有宣稱完整 PostgreSQL grammar／server semantic validation。新 function／Auth trigger 的遠端名稱碰撞、執行權限、function owner、Auth trigger 建立權限與實際 signup 行為仍為 UNKNOWN，必須依 preflight 在已確認的個人 Project 做唯讀 catalog check，且另獲 migration 授權後才能執行。未連線 Supabase、未建立測試帳號、未執行任何 SQL。

結論：本機 identity artifact 為 **IDENTITY_READY**；遠端執行 gate 為 **IDENTITY_PREFLIGHT_HOLD**。001 使用者回報 PASS 且不得重跑；002～012 維持未執行。

## CLOTHING-OWNERSHIP-11 增補：003 ownership contract

執行命令：

```text
node .\supabase\personal_baseline\tests\validate_clothing_ownership.mjs
node .\supabase\personal_baseline\tests\validate_auth_identity.mjs
```

結果：兩個 process 均 exit code 0；`CLOTHING_OWNERSHIP_STATIC_VALIDATION=PASS`，既有 `AUTH_IDENTITY_STATIC_VALIDATION=PASS`。

| 檢查 | 11 結果 |
| --- | --- |
| 003 columns | PASS：仍恰有 21 個原欄位，名稱、順序、型別與除 owner 修正外的 nullable/default 完全未變 |
| 原始 team evidence | PASS：快照仍記錄 `owner_id uuid`、nullable、`DEFAULT gen_random_uuid()`；沒有改寫歷史證據 |
| `owner_id` personal fix | PASS：`uuid NOT NULL`、無 default |
| Owner FK | PASS：FK → `public.ootie_profiles(id) ON DELETE NO ACTION` |
| Direct Auth FK | PASS：003 為 0；content table 沒有直接引用 `auth.users` |
| Constraints／objects | PASS：只有 owner FK 與 PK；無額外 index、function、trigger 或 policy |
| Destructive statements | PASS：無 DROP／DELETE statement／TRUNCATE／UPDATE／INSERT／ALTER／REPLACE／CASCADE |
| Ownership contract | PASS：文件要求 session user → profile lookup → explicit owner；無 profile 回傳 `PROFILE_MISSING`；禁止 random/fixed mock/fallback owner |
| Manifest lock | PASS：現行 003 hash 與 manifest／preflight 一致；舊 hash 只存在失效紀錄，未列為 active hash |
| Existing identity regression | PASS：002 identity 與 003～008 profile FK 的既有測試仍通過 |

新 SHA-256：

- `003_ootie_clothing_items.sql`：`C9E8C0A7C435FABF15F23159304F9B6D23147A5ED8E0635CF0A03668D829C170`
- 已失效舊值：`39F294B4D2FB80691D6F18A4AFEAA3D2D03C0FDE0B9361430101DA38314CDB33`

限定：這是本機內容、證據與依賴驗證，不是 PostgreSQL server parse 或遠端執行結果。本階段沒有連線 Supabase 或執行 SQL。001／002 的 PASS 依使用者人工回報；003 仍未執行。新版 `003_OOTIE_PREFLIGHT.md` 的 BEFORE CHECK 必須在另行授權的執行階段先達到 8/8 true。

結論：下一檔本機 artifact 判定為 **003_READY_NEW**；004～012 未獲授權。
