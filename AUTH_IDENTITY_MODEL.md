# SUPABASE-AUTH-IDENTITY-09｜Auth Identity Model

狀態：**本機 contract 已定義；migration 尚未執行；前端 runtime 尚未依本 contract 完成改造。**

## Canonical identity

```text
auth.users.id                         Authentication Identity
        │ 1 : 1
        ▼
public.ootie_profiles.user_id         Auth linkage key
public.ootie_profiles.id              OOTIE Application Profile Identity
        │ 1 : N
        ▼
OOTIE content owner/user/profile FK   Domain ownership
```

- `session.user.id` 永遠是 Auth UUID，不是 content owner ID。
- `ootie_profiles.id` 永遠是 OOTIE domain profile UUID；content tables 繼續 reference 此欄。
- `ootie_profiles.user_id` 是唯一的 bridge：`uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE NO ACTION`，且沒有 default。
- 一個 Auth user 最多一個 OOTIE profile；每個 OOTIE profile 必須有 Auth user。
- `user-01`、`profile-01` 只允許在 fixture／test data，不能成為正式 runtime identity。

## Frontend resolution contract

登入後必須依序執行：

1. 從有效 Supabase session 取得 `authUserId = session.user.id`。
2. 查詢 `public.ootie_profiles`，條件為 `user_id = authUserId`，只取一筆。
3. 查到一筆時，將 `profile.id` 保存為 `profileId`；content query／mutation 使用此 `profileId`。
4. 查到零筆時回報明確狀態 `PROFILE_MISSING`。
5. 查詢失敗時回報 `PROFILE_QUERY_ERROR`；不得把錯誤轉成 mock identity。
6. 查到多筆代表 invariant 被破壞，回報 `PROFILE_INVARIANT_VIOLATION`，不得任選一筆。

建議前端狀態：`SIGNED_OUT` → `SESSION_READY` → `PROFILE_LOADING` → `READY`，或明確進入 `PROFILE_MISSING`／`PROFILE_QUERY_ERROR`／`PROFILE_INVARIANT_VIOLATION`。

## Provisioning contract

`010_triggers.sql` 只對未來新增的 `auth.users` row 執行 `AFTER INSERT` provisioning：

```sql
INSERT INTO public.ootie_profiles (user_id)
VALUES (NEW.id)
ON CONFLICT (user_id) DO NOTHING;
```

不讀 metadata、不產生假 UUID、不批次掃描既有 `auth.users`。`name`、`username`、`avatar_url` 等資料由後續 onboarding 更新。

## Current frontend violations to remove before runtime activation

目前正式 `src/` 仍包含以下舊行為，因此本文件是強制 contract，不代表前端已符合：

- `src/stores/auth.js` 在 localStorage flag 存在時建立 `user-01` 假 session。
- `src/services/supabase.js` 匯出 `CURRENT_USER_ID = 'user-01'`，且多個 service 以它作預設值。
- bookmarks、closet、SOS 與 constants 仍有 `profile-01` fallback 或 fixture data。
- Supabase query 失敗時，部分 store 仍留在 local/mock 資料並讓 UI 繼續成功流程。

正式 runtime 上線前必須另批完成：移除上述 fallback、建立單一 identity resolver、讓所有 remote store 接收已解析的 `profileId`，並為 `PROFILE_MISSING`／query error 提供 UI。fixture 可以保留固定 ID，但必須由 test/fixture boundary 注入，不能由 production bundle 的登入流程選用。

## Failure contract

- Auth session 缺失：`SIGNED_OUT`，不得讀寫使用者內容。
- Auth 成功但 profile 不存在：`PROFILE_MISSING`，停止 content write，提示完成 provisioning／onboarding 修復。
- Profile lookup 失敗：`PROFILE_QUERY_ERROR`，保留錯誤供監控與 UI 顯示；不得自動切換 `user-01`／`profile-01`。
- Provisioning trigger 失敗：Auth 建立流程必須呈現失敗或後續 profile lookup 顯示 `PROFILE_MISSING`；不得掩蓋。

## Scope boundary

本次沒有修改前端 runtime、沒有建立既有 Auth user 的 profiles、沒有執行 SQL。RLS ownership 採用方式見 [AUTH_RLS_FOLLOWUP.md](AUTH_RLS_FOLLOWUP.md)。
