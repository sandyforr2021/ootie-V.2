# SUPABASE-AUTH-IDENTITY-09｜RLS Follow-up Contract

狀態：**設計 follow-up；本次不改寫 `011_rls_policies.sql`，不執行任何 policy。**

## Ownership root

唯一可信的登入身份是 `auth.uid()`；OOTIE content ownership 必須先解析成 domain profile：

```sql
EXISTS (
  SELECT 1
  FROM public.ootie_profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.id = <content_profile_fk>
)
```

`ootie_profiles` 自身的 owner 判斷使用 `user_id = auth.uid()`。不要用 `auth.uid() = owner_id` 比較 content row，因為 `owner_id`／`user_id` 在 OOTIE content tables 代表 `ootie_profiles.id`，不是 Auth UUID。

## Table mapping for future 011 revision

| Table | Profile relationship used for ownership | Notes |
| --- | --- | --- |
| `ootie_profiles` | `user_id = auth.uid()` | Self select/update contract；公開欄位另做最小化 read policy |
| `ootie_clothing_items` | `owner_id = ootie_profiles.id` | Private closet write；public closet read 必須另查 profile privacy |
| `ootie_ootd_posts` | `user_id = ootie_profiles.id` | Post owner write；社群 read 另定 |
| `ootie_sos_posts` | `user_id = ootie_profiles.id` | Request owner；`closet_owner_id` 目前沒有 FK，需另案確認 |
| `ootie_outfit_suggestions` | `user_id = ootie_profiles.id` | Responder owner；`sos_id` 指向 SOS |
| `ootie_notifications` | `user_id = ootie_profiles.id` | 只允許收件 profile 讀／更新 |
| `ootie_post_likes` | `user_id = ootie_profiles.id` | Like actor ownership；`post_id` 指向 OOTD |
| `ootie_saved_posts` | `user_id = ootie_profiles.id` | Saver ownership；`post_id` 指向 OOTD |
| `ootie_bookmarks` | `owner_id = ootie_profiles.id` | 所有 CRUD 都以 profile bridge 判斷 |

產品術語的 `profile_id`、`owner_id`、`sender_id`、`responder_id` 若落到 DB，均須明確映射到實際 profile FK 欄位；目前資料表常用 `user_id`，名稱不能被誤解為 `auth.users.id`。

## Known 011 conflicts

現有 011 是 Team snapshot 重建，不是安全完成版：

- bookmarks 同時存在正確方向的 profile bridge policies，以及 `auth.uid() = owner_id` 的錯誤 identity-space 比較。
- 除 bookmarks 外，八張 OOTIE 表目前都 `DISABLE ROW LEVEL SECURITY`。
- 多張表有 `USING (true)` public SELECT policy；未按個人資料、公開衣櫥或通知隱私重新分類。
- `ootie_profiles` 的 self ownership policy 尚未建立。

因此 011 不得被視為符合本 identity model。未來另批修改時，必須逐表定義 SELECT／INSERT／UPDATE／DELETE、anonymous/authenticated roles、public visibility 與 ownership test；不能只做字串替換。

## Account deletion lifecycle follow-up

002 使用 `auth.users → ootie_profiles` 的 `ON DELETE NO ACTION`。這會阻止未規劃的 Auth 刪除連鎖內容刪除，是目前安全預設。

下游 `ootie_profiles.id` FK 中，只有 `ootie_bookmarks.owner_id` 有 `ON DELETE CASCADE`；其餘 profile FK 皆為預設 `NO ACTION`。未來帳號刪除流程必須先決定資料保留、匿名化、匯出、soft delete 與刪除順序，再另案調整；本次不啟用 cascade。

## Acceptance criteria for the future RLS batch

- 每個 content write policy 都從 `auth.uid()` 經 `ootie_profiles.user_id` 對應到 `ootie_profiles.id`。
- 沒有 `auth.uid() = <profile id column>` 的跨 identity-space 比較。
- 未登入、profile missing、他人 profile、本人 profile 四種情境都有 positive/negative tests。
- notifications、private closet 與 bookmarks 不因 public SELECT policy 洩漏。
- RLS policy 改動有獨立 DB_CHANGE_REQUEST、preflight、rollback 與明確授權。
