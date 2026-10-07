# SUPABASE-AUTH-IDENTITY-09｜Auth Profile Trigger Precheck

**狀態：HOLD，供未來 010 前後驗證；本次沒有執行 trigger migration 或建立 Auth user。**

## 010 BEFORE CHECK

在 002～009 均已依序 PASS、target 再次人工確認、010 hash 比對成功後，先執行唯讀 collision check：

```sql
SELECT p.oid::regprocedure::text AS existing_function
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'handle_new_ootie_user'
  AND pg_catalog.pg_get_function_identity_arguments(p.oid) = '';

SELECT t.tgname AS existing_trigger,
       t.tgrelid::regclass::text AS trigger_table
FROM pg_catalog.pg_trigger AS t
WHERE NOT t.tgisinternal
  AND t.tgrelid = 'auth.users'::regclass
  AND t.tgname = 'on_auth_user_created_ootie_profile';

SELECT count(*) AS profiles_before_010
FROM public.ootie_profiles;
```

前兩段必須為 0 rows。若有同名物件，停止並人工審查；不得 `CREATE OR REPLACE` 或 drop 現有物件。記錄 `profiles_before_010`，010 本身不得改變它。

## Static trigger contract

- Function：`public.handle_new_ootie_user()`，`RETURNS trigger`、`LANGUAGE plpgsql`。
- 權限：`SECURITY DEFINER`，固定 `SET search_path = ''`。
- DML：fully qualified `INSERT INTO public.ootie_profiles (user_id) VALUES (NEW.id)`。
- Idempotency：`ON CONFLICT (user_id) DO NOTHING`。
- Return：`RETURN NEW`。
- Trigger：`AFTER INSERT ON auth.users FOR EACH ROW`。
- 禁止 `INSERT ... SELECT ... FROM auth.users`、固定 UUID、`gen_random_uuid()` user ID、metadata required fields。

## 010 AFTER CHECK

010 commit 後先做純 catalog 驗證，不建立測試帳號：

```sql
SELECT p.oid::regprocedure::text AS function_name,
       p.prosecdef AS security_definer,
       p.proconfig AS function_config,
       pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'handle_new_ootie_user'
  AND pg_catalog.pg_get_function_identity_arguments(p.oid) = '';

SELECT t.tgname,
       t.tgrelid::regclass::text AS trigger_table,
       pg_catalog.pg_get_triggerdef(t.oid, true) AS definition
FROM pg_catalog.pg_trigger AS t
WHERE NOT t.tgisinternal
  AND t.tgrelid = 'auth.users'::regclass
  AND t.tgname = 'on_auth_user_created_ootie_profile';

SELECT count(*) AS profiles_after_010
FROM public.ootie_profiles;
```

必須只有一個 function 與一個 trigger；`prosecdef = true`；`function_config` 明確含空 search path；trigger 為 AFTER INSERT；`profiles_after_010 = profiles_before_010`，證明建立 trigger 沒有回填既有 users。

## Future designated test-user validation

這段需要另一次明確授權並使用未來指定的 OOTIE 測試帳號；本次禁止執行：

1. 透過正常 Supabase Auth signup 建立一個全新的指定測試帳號。
2. 以該帳號的 `auth.users.id` 做唯讀查詢：

   ```sql
   SELECT id, user_id
   FROM public.ootie_profiles
   WHERE user_id = '<designated-auth-user-uuid>'::uuid;
   ```

3. 結果必須 exactly 1 row，且 `user_id` 完全等於 Auth UUID；`id` 是獨立的 OOTIE profile UUID。
4. 對同一 `user_id` 重新走 provisioning 語意時，UNIQUE + `ON CONFLICT DO NOTHING` 必須維持 exactly 1 row。
5. 比對 010 前後既有 unrelated Auth users；不得因 trigger 建立而批次增加 profiles。
6. 若 Auth signup 或 profile lookup 失敗，必須能看到 error／`PROFILE_MISSING`；不得 fallback 到 mock identity。

## STOP CONDITIONS

同名 function／trigger 已存在、function 不是 SECURITY DEFINER、search path 未固定、body 非 fully qualified、缺少 conflict handling、profile count 在 010 建立時改變、任一測試出現 0 或多於 1 個 profile、或需要 service_role／secret 才能繼續時，立即停止。
