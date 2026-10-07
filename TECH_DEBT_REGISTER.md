# OOTIE v1 Technical Debt Register

> BATCH-00 audit snapshot — 2026-09-28  
> 本文件只登錄風險與未來處理方向；本批次沒有修正、重構或執行任何 migration。

## Priority model

| Priority | Meaning |
|---|---|
| `P0` | 可能造成身份混用、隱私／權限錯誤、秘密外洩或「看似成功但資料未保存」；進入真實使用前必須處理 |
| `P1` | 阻擋核心功能可靠完成，或會使後續 v2 實作建立在錯誤邊界上 |
| `P2` | 明顯降低品質、維護性、效能或測試信心，但不一定立即造成資料事故 |
| `P3` | 清潔度、一致性與長期維護問題，可在核心風險穩定後處理 |

## P0 — release blockers

| ID | Debt | Evidence | Impact | Recommended future action | Dependency |
|---|---|---|---|---|---|
| P0-01 | Auth 與 domain profile identity 混用 | `CURRENT_USER_ID='user-01'`；多處 `profile-01` fallback；auth store 有 fake local session | 使用者可能讀寫錯誤 owner 的內容，登入狀態無法證明資料 ownership | 前端實作單一 identity resolver：`session.user.id → ootie_profiles.user_id → ootie_profiles.id`；明確處理 `PROFILE_MISSING` | 必須等待 Supabase 專用視窗確認 schema/RLS |
| P0-02 | Active frontend 同時使用 legacy 與 v2 table names | Profile 呼叫 `profiles`，Closet 呼叫 `items`，其他模組呼叫 `ootie_*` | schema mismatch、404/permission failure、資料分裂 | Supabase contract 完成後，逐模組切到核准 table；在切換前禁止假設 remote persistence | Supabase contract |
| P0-03 | Remote failure 被 local mutation／mock fallback 隱藏 | OOTD、SOS、Bookmark、Profile、Closet 多為 local-first/best-effort remote；services 常回 `null/false` | UI 顯示成功但重新整理或換裝置資料消失；錯誤不可追蹤 | 定義 typed repository result 與 loading/error/success；只有 remote success 才宣告持久化成功 | Frontend architecture；部分需 RLS |
| P0-04 | SOS 分享衣櫃與 ownership 不可信 | 他人 `closet_item_ids` 仍可能映射目前 local items；無 subset/owner 重驗；close/adopt 未完整 guard | 可能展示未授權衣物或允許錯誤操作 | 建立 server-authoritative SOS shared-item query/validation；每個 mutation 驗證 profile ownership | Supabase/RLS follow-up |
| P0-05 | Browser AI secret boundary | Obsolete client credential path has been removed | Resolved locally: the browser now calls an authenticated Gateway without provider secrets | Verify deployed bundle and Cloud Run environment before Live Smoke | Google Cloud preflight |
| P0-06 | RLS 與前端 ownership contract 未閉合 | 無 canonical profile resolver、無 route guard；remote policy 未在本批次驗證 | 即使 UI guard 存在也不能當安全邊界 | 由 Supabase 視窗完成 `auth.uid()`→profile ownership policies；前端只消費已核准 contract | Supabase 專用視窗 |

## P1 — core reliability

| ID | Debt | Evidence | Impact | Recommended future action | Dependency |
|---|---|---|---|---|---|
| P1-01 | Outfit 核心功能不存在 | 無 route/store/canvas/model；「加入穿搭」只有 toast | 使用者無法完成產品主流程 | 規格確認後建立最小 create/save/reopen vertical slice | 可能需要 schema request |
| P1-02 | Notification 只有本機狀態 | 未引用 `ootie_notifications`、recipient_id 或 realtime | SOS/OOTD 互動無可靠跨使用者通知 | 先定義事件與 recipient contract，再接 repository/realtime | Supabase/RLS |
| P1-03 | OOTD detail 直接存取 Supabase | `OotdDetailView.vue` 直接 query table | error/identity/cache 邏輯分散 | 移入 OOTD repository/service；共用 typed result | 無，若只做前端邊界 |
| P1-04 | SOS duplicate reply 語意分裂 | local 同 responder 覆寫；remote 每次 insert；DB unique unknown | suggestion count、helped count 與實際資料可能不一致 | 定義「每 responder 每 SOS 一份」唯一鍵與 upsert contract | Supabase schema/RLS |
| P1-05 | 測試 runner 衝突 | `npm test` 把 Node `node:test` isolation file 當 Vitest，導致 20 pass/1 fail | 官方測試命令永遠紅燈，容易掩蓋真正 regression | 分離 `test:unit` 與 `test:isolation`，或排除 native Node test | package/test config only |
| P1-06 | Nested repository copy 被測試重複探索 | `OOTIE-main/OOTIE-main` 與外層 source 相同；Vitest 跑兩份，92=46×2 | 測試數量失真、維護與搜尋結果重複 | 先確認 canonical root，再在後續核准批次移除／排除 duplicate | 需要使用者核准刪除／整理 |
| P1-07 | 測試會發出 placeholder network request | Vitest 執行時出現 `ECONNREFUSED`/AbortError，靠 fallback 通過 | 測試慢、不乾淨，可能把 integration failure 當成功 | 對 Supabase client 做 deterministic mock；remote integration 另設 opt-in suite | Test architecture |
| P1-08 | Profile/Closet schema UUID 與 fixture IDs 混用 | `profile-01`、`item-01` 等非 UUID runtime 值 | FK/UUID schema 接軌時必然失敗 | production runtime 移除 fixture identity；fixtures 留在 test-only | Identity contract |
| P1-09 | OOTD share link 與 router mode 衝突 | `createWebHistory`，分享 URL 卻含 `/#/ootd/:id` | 分享連結可能導向錯誤頁面 | 以 router resolve 產生 canonical URL | 無 |
| P1-10 | AI／Try-on 成功語意誤導 | AI response 未被使用；Try-on fallback 原圖仍顯示完成 | 使用者誤認已執行真 AI 或產生新影像 | 未有真實結果時標記 demo/mock；外部 call 失敗顯示 error，不顯示成功 | Product decision；外部服務需另核准 |
| P1-11 | Modal 缺完整 accessibility contract | 無一致 `role=dialog`、`aria-modal`、focus trap、Escape、focus restore | 鍵盤與輔助科技使用者可能被困住或失去上下文 | 建立 shared accessible modal primitive | Frontend only |

## P2 — quality and maintainability

| ID | Debt | Evidence | Impact | Recommended future action |
|---|---|---|---|---|
| P2-01 | State ownership 重複 | app store、feature stores、watch sync、localStorage 各自持有資料 | stale state、mutation 後不同步 | 每個 domain 指定唯一 owner；derived state 不重複持久化 |
| P2-02 | 缺統一 async state model | 大多頁面沒有明確 remote loading/error/retry/no-permission | 使用者無法分辨空資料與載入／失敗 | 建立共用 async result 與 page state pattern |
| P2-03 | Data URL 大量存入 localStorage | Closet/Profile/OOTD/Bookmark image 使用 FileReader | quota、序列化成本、頁面啟動效能風險 | fixture 只放小圖；正式資料改走核准 Storage flow |
| P2-04 | Production bundle 過大 | build JS 676.98 kB，Vite >500 kB warning | 初載與低階手機效能下降 | route-level lazy loading、Chart/feature chunk splitting |
| P2-05 | Mobile navigation parity 不完整 | bottom nav 不直接提供 Stats/AI/Try-on；SOS/Bookmark 藏在 quick action | 功能發現性與 desktop 不一致 | 依 v2 information architecture 重排，限制主導航層級 |
| P2-06 | UI tokens 與元件不一致 | inline styles、emoji icons、不同 modal/card/button 呈現 | 視覺品質與維護成本下降 | 先建立 token與 primitive inventory，再漸進替換 |
| P2-07 | Automated browser/E2E 缺失 | package 無 E2E script | route、modal、responsive、persistence 無 regression gate | 為最小主流程加入本機 E2E；不連 production |
| P2-08 | Accessibility regression gate 缺失 | 無 axe/keyboard/focus 測試 | 修 UI 時容易反覆退化 | 加 component a11y checks 與少量 E2E keyboard scenarios |
| P2-09 | Stats provenance 不透明 | RPC 失敗自動顯示 local aggregate | 使用者不知道數字來源與新鮮度 | UI 顯示來源／最後更新／error；不要靜默降級 |
| P2-10 | Route protection / not-found UX 缺失 | 無 meta guards、無 catch-all | deep link 與未授權情境不明確 | identity 完成後加 loading/auth/profile-missing/404 boundary |
| P2-11 | 文件基線缺口 | 8 份指定文件不存在 | 決策與 implementation contract 難追溯 | 後續只依核准 v2 規格補文件，不回填臆測的舊規格 |

## P3 — cleanup and consistency

| ID | Debt | Evidence | Impact | Recommended future action |
|---|---|---|---|---|
| P3-01 | Legacy JavaScript 含 merge markers | `legacy/qingnian/app.js`、`legacy/ming/app.js` 與 nested copies syntax fail | repository-wide syntax check 失敗、搜尋雜訊 | 確認 legacy retention policy 後隔離或修復；本批次不動 |
| P3-02 | No lint/typecheck scripts | package scripts 僅 dev/build/test/preview | 靜態缺陷缺少 gate | 評估 Vue ESLint 與 type checking；不可把導入工具當本批次工作 |
| P3-03 | Icon 語彙混雜 | emoji、SVG、文字 icon 混用 | 平台感與可及名稱不一致 | 決定單一 icon system 並補 accessible name |
| P3-04 | Heading hierarchy 不一致 | browser smoke 中 AI、Try-on、OOTD detail 無 `h1` | 輔助導覽與頁面結構較弱 | 每個 route 建立唯一 page heading contract |
| P3-05 | Reduced motion 未處理 | CSS 未找到 `prefers-reduced-motion` | 動畫敏感使用者體驗較差 | 對 transition/animation 提供 reduced-motion override |
| P3-06 | Sample/default data 與 runtime code 混放 | constants/store defaults 直接進 production bundle | demo 與正式功能界線不清 | fixtures 移至 test/dev-only boundary |

## Cross-cutting conflict register

| Area | Current implementation | Confirmed v2 contract / expectation | Conflict |
|---|---|---|---|
| Identity | Auth UUID、`user-01`、`profile-01` 並存 | `session.user.id → ootie_profiles.user_id → ootie_profiles.id` | `P0` |
| Profile | legacy `profiles` | `ootie_profiles` | `P0` |
| Closet | legacy `items` + sparse `ootie_clothing_items` update | single approved content schema | `P0` |
| Failure handling | remote fail → local/mock result | failure must be explicit for formal runtime | `P0` |
| SOS ownership | client/local checks | profile-based RLS/ownership | `P0` |
| Notifications | local array | recipient-aware persistent events | `P1` |
| Outfit | toast placeholder | core creation workflow | `P1` |

## Performance observations

- The production build completes, but the main JavaScript chunk is 676.98 kB (219.79 kB gzip) and triggers Vite's chunk-size warning.
- Chart.js and most routes are in the same eager bundle; route-level lazy loading is not established.
- Base64/data URL images persisted in localStorage can increase parse, serialization, memory, and quota pressure.
- Duplicate project discovery doubles the apparent unit test workload.

## Test-gap summary

- No E2E or browser regression suite is declared in `package.json`.
- No lint or typecheck command exists.
- No real Auth→Profile resolution test exists.
- No verified remote Supabase/RLS integration test was run or authorized.
- No reliable tests cover SOS privacy, concurrent duplicate suggestions, notification recipient behavior, image Storage policy, outfit creation, AI truthfulness, modal focus, or responsive keyboard use.

## Boundary note

Items that require schema, RLS, Auth database, migration, Storage policy, or remote Supabase mutation are explicitly dependencies for the separate Supabase workstream. This register does not authorize implementing them from the product/frontend workspace.

