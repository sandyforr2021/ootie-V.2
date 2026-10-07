# SUPABASE-MIGRATION-06｜Frontend / Schema Conflicts

範圍：外層正式 `src/`；2026-09-27 本機掃描。下列是目前程式的實際引用，沒有執行請求或修改前端。個人 baseline 不建立 `profiles`／`items`，也不建立相容 view。2026-09-28 AUTH-IDENTITY-09 已定義正式 identity contract；本文件的前端衝突仍有效，最新規則見 `AUTH_IDENTITY_MODEL.md`。

## FE-001：profiles → ootie_profiles

| 正式呼叫位置 | Helper／操作 | 正式呼叫鏈與衝突 |
| --- | --- | --- |
| `src/services/supabase.js:21` | `fetchProfileAvatar`：select avatar_url、以 id 篩選 | `src/stores/app.js:12` 匯入、`:99` 的 loadRemoteAvatar 呼叫；預設 user-01 不是 UUID，table 名稱未被團隊快照證實 |
| `src/services/supabase.js:44` | `syncProfileAvatar`：upsert id／avatar_url | `src/stores/app.js:12` 匯入、`:107` 的 syncAvatar 呼叫；直接把 user ID 當 profile PK，沒有 Auth→ootie_profiles.id 解析 |
| `src/services/supabase.js:64` | `fetchProfileFromSupabase`：select *、以 user_id 篩選 | 正式 src 僅發現定義，沒有其他呼叫者；欄位 user_id 本身存在於 ootie_profiles，但關係建立流程未確認 |
| `src/services/supabase.js:97` | `upsertProfileToSupabase`：upsert、onConflict user_id | 正式 src 僅發現定義。payload 的 email、full_name、updated_at 不在 ootie_profiles 快照；團隊欄名為 name；user_id 沒有已匯出 UNIQUE，不能原封不動沿用 onConflict |

後續需依真實 `ootie_profiles` 欄位調整 helper／payload，明確解析 profile UUID 與 Auth UUID。AUTH-IDENTITY-09 已在本機 002／010 定義 `user_id` UNIQUE／Auth FK 與 prospective trigger，但尚未執行；`email`／`full_name`／`updated_at` 仍不是 002 欄位。單純替換 table 名稱仍不足以修正 payload 與 runtime fallback。

## FE-002：items → ootie_clothing_items

| 正式呼叫位置 | Helper／操作 | 正式呼叫鏈與衝突 |
| --- | --- | --- |
| `src/services/supabase.js:118` | `fetchItemsFromSupabase`：select *、user_id 篩選、created_at 排序 | 正式 src 僅發現定義，沒有其他呼叫者；團隊衣物 owner 欄是 owner_id，指向 ootie_profiles.id |
| `src/services/supabase.js:162` | `insertItemToSupabase`：insert | 正式 src 僅發現定義；payload 寫 user_id，真實表使用 owner_id；預設 user-01 不符合 UUID。新 item UUID 的生成不能代替 owner 對應 |
| `src/services/supabase.js:184` | `deleteItemFromSupabase`：delete，id＋user_id 篩選 | `src/stores/closet.js:11` 匯入、`:169` 的 deleteItem 呼叫；helper 對非 UUID item ID 直接回傳 true，只有 UUID 才進入遠端刪除路徑；table／owner 欄位仍有衝突 |

後續應使用 `ootie_clothing_items`、`owner_id = ootie_profiles.id`，保留真實欄位型別。不得為了舊 helper 建立假的 items table。正式 `markItemClearanceInSupabase` 已在 `src/services/supabase.js:562` 使用真實 `ootie_clothing_items`，但只按 item ID 更新，權限議題另見安全後續文件。

## FE-003／FE-004：FRONTEND_DEPENDENCY_MISSING

| RPC | 正式呼叫位置 | Store 呼叫位置 | 本 baseline 處理 |
| --- | --- | --- | --- |
| `get_top_worn_items` | `src/services/supabase.js:509` | `src/stores/stats.js:96`，匯入在 `:8` | 不建立；兩份 FUNCTION 匯出與 EXTRA grants 都未列出 |
| `get_cost_per_wear_ranking` | `src/services/supabase.js:526` | `src/stores/stats.js:113`，匯入在 `:9` | 不建立；不從 legacy 搬入 |

狀態均為 **FRONTEND_DEPENDENCY_MISSING**。這兩筆是後續 issue 候選，尚未送到 GitHub 或任何外部系統。Stats store 有本機資料 fallback；它不能證明遠端 RPC 已存在或可用。後續需決定保留本機功能、停止呼叫，或另行設計個人 RPC。

## FE-005：其他已知契約差異

- `src/services/supabase.js:9` 的 CURRENT_USER_ID 是 user-01；`src/constants/index.js:89` 的 profile ID 是 profile-01，均為 mock，不建成資料庫固定 ID。
- `src/services/supabase.js:585` 的 bookmarks OR filter 仍包含 profile-01；即使傳入真 UUID，這個 literal 仍與 UUID 欄位衝突。bookmarks store `:118/:189/:201/:243` 與 BookmarksView `:640/:724` 也有 profile-01 fallback。
- `src/services/supabase.js:474` 呼叫的 get_closet_stats 只回三組統計；`src/stores/stats.js` 的 getClosetStats 要求包含 colorFamilyStats 的四組，會回退本機。
- get_closet_stats 把 clothing.owner_id 和 auth.uid() 比較，但資料庫 FK 指向 profile ID；不能假設 profile ID 就是 Auth ID。
- get_disused_items 的回傳宣告 wear_count integer 與表欄 bigint 不同；其 30 天規則也不同於前端本機規則。baseline 保留證據，後續另作型別／規則決策。
- Storage path 在 `src/services/supabase.js:740` 為 bookmarks/<userId>/<timestamp>.<extension>，後續需統一 userId 的身分來源；baseline 保留 public bucket 與原始 policy 條件。

本次完整直接 `.from('profiles')`／`.from('items')` 盤點共 **7 處**，全在上述 service 檔；沒有因為前端舊名稱而新增 legacy table／view。
