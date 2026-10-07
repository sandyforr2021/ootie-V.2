# OOTIE v1 Active Feature Map

> BATCH-00 baseline audit — 2026-09-28  
> 本文件描述目前 repository 的實際行為，不代表 OOTIE v2 已核准的實作規格。Supabase 遠端狀態未在本批次驗證。

## 狀態定義

| Status | 定義 |
|---|---|
| `WORKING` | 現有前端流程、資料來源與測試證據足以支持主要路徑 |
| `PARTIAL` | 有可操作流程，但缺少關鍵狀態、持久化、權限或資料一致性 |
| `BROKEN` | 入口存在，但主要承諾無法可靠完成或語意錯誤 |
| `MOCK_ONLY` | 只使用 fixture、localStorage 或模擬結果 |
| `UI_ONLY` | 有視覺入口，沒有完整資料／行為實作 |
| `MISSING` | 現有 application source 未找到該功能 |
| `UNKNOWN` | 需要遠端 Supabase 或真實裝置證據，本批次不能確認 |

## 1. Feature inventory

| Feature | Status | Frontend | Database | Tests | Notes |
|---|---|---|---|---|---|
| App shell / routing | `WORKING` | Vue Router、desktop sidebar、mobile bottom nav | N/A | Home/view smoke | 11 routes；無 route guard、404 route |
| Auth sign in | `PARTIAL` | Auth modal 可登入並顯示錯誤／loading | Supabase Auth | auth store 間接覆蓋 | 失敗時可能回到 local fake session |
| Auth sign up | `PARTIAL` | Auth modal 可註冊 | Supabase Auth | 無專屬 integration | 尚未解析 OOTIE profile identity |
| Auth sign out | `PARTIAL` | store action | Supabase Auth + local fallback | 無專屬測試 | 登出後 protected UI 沒有 routing contract |
| Session persistence | `PARTIAL` | `getSession`、auth state listener、localStorage | Supabase Auth | 無專屬測試 | 真實 session 與 `ootie-auth-state-v1` 混用 |
| Unauthorized / expired session | `MISSING` | 無 route guard 或統一 no-permission state | 未驗證 | 無 | 未落實 `PROFILE_MISSING` |
| Profile view/edit | `PARTIAL` | 個人頁、編輯 modal、avatar data URL | legacy `profiles` best-effort | Profile integration 5 cases | 預設 profile fixture；尚未使用 `ootie_profiles` identity contract |
| Closet list | `WORKING` | 搜尋、分類／顏色／季節／風格篩選 | local fixture/localStorage | view 4 + store 6 | 現有可用路徑為本機資料 |
| Closet add/edit/delete | `PARTIAL` | modal 與 local mutation | add/edit 無正式 remote；delete 呼叫 legacy `items` | store tests | UI 可成功但遠端可能失敗 |
| Closet favorite | `WORKING` | local toggle | 無明確 remote persistence | store tests | local-only |
| Closet archive | `PARTIAL` | 有 `hidden` 過濾語意 | 無完整 remote contract | 無專屬測試 | 缺 archive/restore 完整 UI |
| Closet item detail | `WORKING` | global detail modal | local data | 間接覆蓋 | 「加入穿搭」只有 toast |
| Closet sort | `PARTIAL` | 內部依建立時間排序 | N/A | 無 | 無使用者排序控制 |
| Closet image upload | `PARTIAL` | FileReader → data URL | 未使用 closet Storage | 間接覆蓋 | localStorage 容量與效能風險 |
| Background removal | `MISSING` | 未找到 | 無 | 無 | 未實作 |
| Outfit builder | `MISSING` | 無 route/store/canvas | 無 | 無 | 無 React Konva、Canvas API、drag/resize/layer/save/clone |
| Outfit placeholder action | `BROKEN` | item detail 只顯示 toast | 無 | 無 | 使用者無法建立穿搭 |
| OOTD feed | `PARTIAL` | feed、detail、like、save、comment | `ootie_ootd_posts` best-effort | 7 cases | local-first，remote 失敗不阻止 UI 成功 |
| OOTD create/edit/delete | `PARTIAL` | modal/store actions | `ootie_ootd_posts` | 7 cases | ownership 依 local profile/username，不是 canonical identity |
| OOTD privacy | `MISSING` | 無明確 privacy controls | 未找到 | 無 | 尚無可驗證 privacy contract |
| OOTD share | `BROKEN` | 產生 `/#/ootd/:id` | N/A | 無 | router 使用 history mode，URL 格式不一致 |
| SOS board/feed | `PARTIAL` | list、detail modal、發布 | `ootie_sos_posts` best-effort | 3 cases | local/remote hybrid |
| SOS minimum one clothing | `PARTIAL` | UI/store 檢查至少一件 | DB constraint unknown | store tests | 只驗證非空，未完整驗證 owner/subset |
| SOS per-post shared clothes | `BROKEN` | 以 `closet_item_ids` 映射 | `ootie_sos_posts` | 部分 | 他人貼文仍可能映射目前使用者 local closet |
| SOS self guard | `PARTIAL` | store 有 guard | RLS unknown | 部分 | 使用 local profile identity |
| SOS suggestion | `PARTIAL` | detail + form + responder | `ootie_outfit_suggestions` insert | 3 cases | 重複回覆 local overwrite、remote 仍 insert |
| SOS duplicate reply prevention | `BROKEN` | local 可覆寫舊 suggestion | DB unique unknown | 部分 | 無可靠 server-side exactly-one contract |
| SOS owner validation | `BROKEN` | close/adopt action 未完整驗證 owner | RLS unknown | 無 | 有越權語意風險 |
| SOS notification | `MOCK_ONLY` | local notification | 未使用 `ootie_notifications` | 間接 | recipient 語意可能指錯對象、無 realtime |
| Bookmark create/edit/remove | `PARTIAL` | local CRUD、batch、duplicate check | `ootie_bookmarks` best-effort | 6 cases | remote failure 可被 local success 遮蔽 |
| Bookmark image/storage | `PARTIAL` | FileReader + upload helper | bucket `ootie-bookmarks-images` | 部分 | storage/RLS 遠端狀態 unknown |
| Notifications | `MOCK_ONLY` | modal、read/unread、local deeplink | 無 active table query | 間接 | 無 recipient_id、realtime、remote persistence |
| Stats dashboard | `PARTIAL` | Chart.js + local aggregate | 5 RPC calls，失敗 fallback | 6 cases | 遠端 RPC 是否存在不在本批次驗證 |
| AI styling | `WORKING_LOCAL` | authenticated Gateway flow | Google Cloud via server adapter | unit/integration | paid Live Smoke remains gated |
| Virtual try-on | `WORKING_LOCAL` | explicit single-item mode + history | Google Cloud via server adapter | unit/integration | paid Live Smoke remains gated |
| Weather suggestion input | `PARTIAL` | geolocation/Open-Meteo + Taipei fallback | external public API | Home 2 cases | 網路／權限失敗有 fallback，但不是完整天氣錯誤 UX |

## 2. SOS detailed contract audit

| Requirement | Evidence | Status |
|---|---|---|
| `sender_id` | store/service payload 有欄位 | `PARTIAL`：值可能源自 mock profile |
| `closet_item_ids` | post payload 與 detail 映射存在 | `PARTIAL` |
| Per-SOS shared clothing | detail 依 IDs 顯示 | `BROKEN`：非本人貼文仍從目前 local closet 取物件 |
| 發布至少選 1 件 | UI/store guard | `WORKING`（前端層） |
| Owner validation | self guard 部分存在 | `BROKEN`：close/adopt 與 shared list 無完整 ownership 驗證 |
| Self-SOS guard | responder 與 sender 比較 | `PARTIAL`：identity 不可信 |
| Detail modal | 已存在 | `WORKING` |
| Suggestion form | 已存在 | `WORKING`（local path） |
| `responder_id` | payload 有欄位 | `PARTIAL`：可能使用 mock profile |
| Duplicate reply prevention | local 以 responder 覆寫 | `BROKEN`：remote 每次 insert，DB unique unknown |
| Shared closet validation | 僅非空／畫面層 | `BROKEN`：未驗證選取 ID 屬於該 SOS 分享集合 |
| Notification | local array | `MOCK_ONLY` |
| Received suggestion count | unique responder helper | `PARTIAL`：重送仍可能增加 helped counter |
| 每位 responder 一份 | local 接近此語意 | `BROKEN`：remote contract 未成立 |

## 3. Table reference map

| Frontend source | Table / resource | Operation | Module | Classification |
|---|---|---|---|---|
| `src/services/supabase.js` | `profiles` | select / upsert | Profile | `LEGACY` |
| `src/services/supabase.js` | `items` | select / insert / delete | Closet | `LEGACY` |
| — | `ootie_profiles` | no active runtime reference | Identity/Profile | `MISSING_RUNTIME_LINK` |
| `src/services/supabase.js` | `ootie_clothing_items` | update clearance notes only | Closet | `ACTIVE_PARTIAL` |
| `src/services/supabase.js`, OOTD view/store | `ootie_ootd_posts` | select / insert / update / delete | OOTD | `ACTIVE` |
| `src/services/supabase.js` | `ootie_sos_posts` | select / insert / update | SOS | `ACTIVE` |
| `src/services/supabase.js` | `ootie_outfit_suggestions` | select / insert | SOS | `ACTIVE` |
| `src/services/supabase.js` | `ootie_bookmarks` | select / insert / update / delete | Bookmark | `ACTIVE` |
| — | `ootie_notifications` | no active runtime reference | Notification | `UNUSED` |
| — | `ootie_post_likes` | no active runtime reference | OOTD | `UNUSED` |
| — | `ootie_saved_posts` | no active runtime reference | OOTD | `UNUSED` |
| `src/services/supabase.js` | `ootie-bookmarks-images` bucket | upload / public URL | Bookmark | `ACTIVE_UNKNOWN_REMOTE` |

No active content-table call was found that directly queries `auth.users`; frontend auth access is through Supabase Auth session APIs. The application nevertheless fails to translate that Auth UUID into `ootie_profiles.id`.

## 4. Stats / RPC map

| RPC | Runtime behavior | Repository baseline evidence | Status |
|---|---|---|---|
| `get_closet_stats` | call, then local aggregate on failure | function present in baseline SQL | `CALLED_BUT_DB_UNKNOWN` + `FALLBACK` |
| `get_brand_stats` | call, then local aggregate on failure | function present in baseline SQL | `CALLED_BUT_DB_UNKNOWN` + `FALLBACK` |
| `get_disused_items` | call, then local aggregate on failure | function present in baseline SQL | `CALLED_BUT_DB_UNKNOWN` + `FALLBACK` |
| `get_top_worn_items` | call, then local aggregate on failure | not found in inspected baseline | `CALLED_BUT_DB_UNKNOWN` + `FALLBACK` |
| `get_cost_per_wear_ranking` | call, then local aggregate on failure | not found in inspected baseline | `CALLED_BUT_DB_UNKNOWN` + `FALLBACK` |

`CALLED_BUT_DB_UNKNOWN` means no remote query or migration execution was performed. It does not assert that the RPC is absent remotely.

## 5. Runtime data source map

| Module | Runtime source | Classification | Failure behavior |
|---|---|---|---|
| Auth | Supabase Auth + local fake auth | `MIXED` | failed/no session can leave mock identity path available |
| Profile | fixture/app localStorage + legacy `profiles` | `REMOTE_WITH_FALLBACK` | remote error is commonly hidden by local data |
| Closet | fixture/app localStorage; sparse legacy/active writes | `LOCAL_ONLY` / `MIXED` | UI remains successful after remote failure |
| Outfit | none | `MISSING` | toast only |
| OOTD | fixture/local store + `ootie_ootd_posts` | `REMOTE_WITH_FALLBACK` | local mutation occurs first |
| SOS | fixture/local store + SOS tables | `REMOTE_WITH_FALLBACK` | local mutation occurs first; remote errors logged |
| Bookmark | fixture/localStorage + table/storage | `REMOTE_WITH_FALLBACK` | local success can mask table/storage failure |
| Notification | app store/localStorage | `MOCK_ONLY` | no remote path |
| Stats | local computed values + optional RPC | `REMOTE_WITH_FALLBACK` | all RPC errors become local results |
| AI styling | authenticated Gateway + server-side provider adapter | `LOCAL_VERIFIED_LIVE_PENDING` | no image generation occurs automatically |
| Try-on | authenticated Gateway + explicit server-side generation | `LOCAL_VERIFIED_LIVE_PENDING` | provider failure remains an explicit error |

Production runtime occurrences found include `localStorage`, `sessionStorage`-equivalent app state patterns, `mock`/sample/default data, and hardcoded `user-01` / `profile-01`. Test fixtures are not the only source of these identities.

## 6. Data access map

| Consumer | Access path | Assessment | Notes |
|---|---|---|---|
| Auth/Profile/Closet/OOTD/SOS/Bookmark/Stats stores | `src/services/supabase.js` | `MIXED` | Central helper exists, but catches often erase typed failure semantics |
| `src/views/OotdDetailView.vue` | direct Supabase query | `DIRECT_DB_ACCESS` | View bypasses feature service/repository boundary |
| AI Gateway client | `src/services/aiGateway.js` | `ACTIVE` | Browser has no provider credential or model ID |
| Local feature stores | Pinia + app store + localStorage | `MIXED` | Multiple sources of truth and manual synchronization |

## 7. State management map

| Module | State owner(s) | Main risk |
|---|---|---|
| Global shell/modals/profile/items/notifications | `app` Pinia store | store is oversized and persists heterogeneous data together |
| Auth | `auth` store + Supabase listener + localStorage | real and fake identity coexist |
| Closet | `closet` store over `app.items` | local mutation precedes or replaces remote truth |
| OOTD | `ootd` store over app/local fixtures | local/remote reconciliation missing |
| SOS | `sos` store plus watched app refs | duplicated state and manual sync |
| Bookmark | independent store/localStorage | separate profile fallback and remote reconciliation |
| Stats | derived local state + RPC results | remote provenance not visible to UI |

Mutation aftermath is inconsistent: most local arrays update immediately, remote failures are usually console-only, and no shared invalidation/refetch model guarantees that separate views converge on the same state.

## 8. Test coverage map

| Area | Existing evidence | Gap |
|---|---|---|
| App/Home | view/unit smoke | no browser interaction or auth integration |
| Closet | view + store tests | no remote persistence/storage/error path |
| OOTD | store tests | no real DB ownership/privacy/RLS test |
| SOS | store tests | no shared-closet privacy or concurrent duplicate-response test |
| Bookmark | store tests | no real storage/RLS integration |
| Stats | RPC fallback unit tests | placeholder network requests are not mocked cleanly |
| Profile | integration-style component test | no canonical Auth→Profile test |
| Isolation | Node native 6-case test | incompatible with broad Vitest discovery |
| Accessibility/mobile | none automated | only structural browser smoke evidence |
| Outfit/AI/Try-on/Notification | no meaningful coverage | core semantics unverified |

