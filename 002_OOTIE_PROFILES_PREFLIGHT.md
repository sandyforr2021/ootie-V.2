# SUPABASE-AUTH-IDENTITY-09｜002 OOTIE Profiles Preflight

**舊 `002_READY` 已作廢。狀態：HOLD，等待新的唯讀 BEFORE CHECK。不得執行 002。**

001 已由使用者回報執行 PASS；不得重跑 001。以下查詢只供未來在人工確認為 **OOTIE-sandy-dev** 的 SQL Editor 執行。不得在 Team Supabase 或其他 Project 執行。

## BEFORE CHECK

先人工確認 target 名稱，再只執行下列唯讀查詢：

```sql
SELECT current_database() AS database_name,
       to_regclass('auth.users') AS auth_users,
       to_regclass('public.ootie_profiles') AS ootie_profiles;

SELECT a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       i.indisprimary,
       i.indisunique
FROM pg_catalog.pg_attribute AS a
LEFT JOIN pg_catalog.pg_index AS i
  ON i.indrelid = a.attrelid
 AND a.attnum = ANY (i.indkey)
WHERE a.attrelid = 'auth.users'::regclass
  AND a.attname = 'id'
  AND NOT a.attisdropped;
```

BEFORE 必須同時成立：

- 介面清楚顯示 target = OOTIE-sandy-dev。
- `auth.users` 存在。
- `auth.users.id` 為 `uuid` 且有 PK／unique identity guarantee。
- `public.ootie_profiles` 為 `NULL`，沒有同名 table／view/materialized view。
- 本機 `002_ootie_profiles.sql` SHA-256 為 manifest 最新值。
- 可恢復備份與失敗處置已完成；001 PASS ledger 已保存。

## EXECUTION SQL

唯一允許來源是 [supabase/personal_baseline/002_ootie_profiles.sql](supabase/personal_baseline/002_ootie_profiles.sql) 的**完整原始內容**。不得從本文件拼接 SQL、不得改用舊 hash、不得重跑 001、不得與 003～012 合併提交。

002 必須保留自己的 `BEGIN`／`COMMIT`。執行前再次比對 [SUPABASE_BASELINE_EXECUTION_MANIFEST.md](SUPABASE_BASELINE_EXECUTION_MANIFEST.md) 的 SHA-256。

## AFTER CHECK

002 成功且 commit 明確後，只執行以下唯讀 catalog checks：

```sql
SELECT to_regclass('public.ootie_profiles') AS ootie_profiles;

SELECT ordinal_position,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ootie_profiles'
ORDER BY ordinal_position;

SELECT c.conname,
       c.contype,
       CASE c.confdeltype
         WHEN 'a' THEN 'NO ACTION'
         WHEN 'r' THEN 'RESTRICT'
         WHEN 'c' THEN 'CASCADE'
         WHEN 'n' THEN 'SET NULL'
         WHEN 'd' THEN 'SET DEFAULT'
         ELSE NULL
       END AS delete_action,
       pg_catalog.pg_get_constraintdef(c.oid, true) AS definition
FROM pg_catalog.pg_constraint AS c
WHERE c.conrelid = 'public.ootie_profiles'::regclass
ORDER BY c.conname;

SELECT count(*) AS seeded_rows
FROM public.ootie_profiles;
```

## SUCCESS CRITERIA

- Table 存在。
- 恰有原來 12 欄：`avatar_url`、`bio`、`created_at`、`hearts`、`helped`、`id`、`initials`、`likes`、`name`、`public_closet`、`user_id`、`username`；沒有其他欄。
- 除 `user_id` identity 修正外，其他 11 欄型別、nullable、default 未變。
- `user_id` 是 `uuid`、`NOT NULL`、`column_default IS NULL`。
- Constraints 恰為：`profiles_pkey`、`ootie_profiles_user_id_key`、`ootie_profiles_user_id_fkey`。
- UNIQUE 只涵蓋 `user_id`。
- FK 只涵蓋 `user_id`，target 為 `auth.users(id)`，delete action 為 `NO ACTION`。
- `seeded_rows = 0`；002 沒有替任何 Auth user 建 profile。
- 沒有未授權欄位、constraint、trigger、policy 或 seed。

## STOP CONDITIONS

任一情況立即停止，不執行 002 或後續 migration：target 不明、`ootie_profiles` 已存在、`auth.users.id` 契約不符、SHA-256 不符、備份未完成、SQL error／commit 不明、AFTER 欄位或 constraints 不完全符合、出現資料列、或看到任何意外物件。不得自動修復、重跑或繼續 003。
