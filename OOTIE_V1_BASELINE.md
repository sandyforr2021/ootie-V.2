# BATCH-00｜OOTIE v1 Baseline

日期：2026-09-28（Asia/Taipei）  
有效專案根目錄：`C:\Users\w\Desktop\Smart_Wardrobe\OOTIE-main`  
範圍：READ／AUDIT／COMPARE／TEST／REPORT。沒有修改 application source、沒有執行 Supabase migration、沒有 deploy／commit／push。

## 1. Executive Summary

目前 OOTIE 是 Vue 3 單頁應用，具有完整的導覽外殼、衣櫥、OOTD、SOS、書籤、統計、Profile、Auth modal、AI 穿搭與試穿畫面。主要產品體驗可在 local fixture／localStorage 上操作，但不是一致的遠端產品：Auth、profile、closet、OOTD、SOS、bookmarks、stats 各自採不同程度的 Supabase、local state 與 fallback。

最重要結論：

- UI 覆蓋面廣，但正式 identity 仍混用 `user-01`、`profile-01`、Auth user UUID 與 profile UUID。
- Closet 沒有完整 remote CRUD；`profiles`／`items` 是 legacy table reference。
- Outfit builder 並不存在；「加入穿搭」只有 toast。
- SOS 有完整畫面與 local interaction，但 shared closet、ownership、duplicate reply 與 notification 語意不足以作為真實多使用者功能。
- `npm test` baseline 為 FAIL，但 92 個 Vitest assertions 本身全數通過；失敗來自 runner discovery 衝突。
- Production build 通過，但主 JS 676.98 kB，超過 Vite 500 kB warning threshold。

## 2. Documents Reviewed

| 文件 | 狀態 | 使用方式 |
| --- | --- | --- |
| `README.md` | FOUND | 現有啟動方式與產品說明 |
| `AGENTS.md` | NOT_FOUND | 無 repository-specific agent instruction |
| `ARCHITECTURE.md` | NOT_FOUND | 以程式碼反推架構 |
| `ACCEPTANCE_CRITERIA.md` | NOT_FOUND | 不自行創造舊驗收規格 |
| `API_SPEC.md` | NOT_FOUND | 以 service 呼叫反推 |
| `DATABASE_SCHEMA.md` | NOT_FOUND | 僅比較現有 local baseline 文件；遠端狀態 UNKNOWN |
| `UIUX_SPEC.md` | NOT_FOUND | 以目前 UI 與 v2 spec 對照 |
| `BACKLOG.md` | NOT_FOUND | 不推定舊 backlog |
| `HANDOFF.md` | NOT_FOUND | 不推定舊 handoff |
| `OOTIE_V2_OPTIMIZATION_SPEC.md` | FOUND | v2 目標；不視為 v1 已存在功能 |
| `OOTIE_V2_CODEX_SLICES.md` | FOUND | 後續切片建議；本批不執行 |
| `AUTH_IDENTITY_MODEL.md` | FOUND | 最新 frontend identity contract；runtime 尚未符合 |
| `AUTH_RLS_FOLLOWUP.md` | FOUND | RLS follow-up；本批不修改 schema／policy |

## 3. Current Architecture

### 3.1 Runtime

| 項目 | 現況 |
| --- | --- |
| Framework | Vue 3.4；Composition API／`<script setup>` |
| Frontend entry | `src/main.js` → Pinia → Vue Router → `App.vue` |
| Package manager | npm；`package-lock.json` |
| Build system | Vite 5.4 |
| Routing | Vue Router 4，`createWebHistory()` |
| State management | Pinia；部分 store 包裝 `appStore`，部分另有獨立 state |
| Persistence | 多組 localStorage keys；無 sessionStorage 使用 |
| Styling | 全域 `src/assets/main.css` 加 view/component scoped CSS；CSS variables |
| Supabase | `@supabase/supabase-js`；單一 `src/services/supabase.js` client |
| Images | Remote Unsplash URLs、FileReader data URLs、Supabase Storage（bookmark only） |
| Charts | Chart.js 4.5 |
| AI／Try-on | 舊版曾由 Browser 直呼第三方 API；現已由 server-side Gateway 取代 |
| Unit/integration tests | Vitest 3、Vue Test Utils、happy-dom／jsdom |
| E2E | MISSING；沒有 Playwright／Cypress |
| Lint/typecheck | package.json 沒有 script；專案是 JavaScript，沒有 TypeScript config |

### 3.2 Application shell

`App.vue` 全域掛載 sidebar、topbar、bottom navigation、toast 與所有 modal，再顯示 `<router-view>`。Desktop sidebar 有 9 個目的地；mobile bottom nav 只有首頁、探索、快速選單、衣櫥、我的。Bookmarks／SOS 可從快速選單進入；Stats／AI／Try-on 沒有 mobile 主導覽入口。

### 3.3 Folder Map

```text
OOTIE-main/
├── src/                       # 有效 Vue app，50 files
│   ├── assets/
│   ├── components/
│   │   ├── layout/
│   │   ├── modal/
│   │   └── ui/
│   ├── constants/
│   ├── router/
│   ├── services/
│   ├── stores/
│   └── views/
├── public/                    # static assets
├── tests/                     # Node native Supabase isolation test
├── supabase/
│   ├── migrations/            # 舊 bookmark migration；本批未執行
│   └── personal_baseline/     # 另一工作流維護；本批唯讀
├── extension/                 # browser extension prototype/source
├── legacy/                    # 多位組員舊版本；非 active runtime
├── doc/                       # 舊測試／prompt 文件
├── OOTIE_V2_Optimization_Pack/
├── OOTIE-main/                # 巢狀重複專案副本
├── pre_migration_backup/
├── index.html
├── package.json
└── vite.config.js
```

外層 `src/`／`public/` 與巢狀 `OOTIE-main/src`／`public` 共比較 51 個檔案，內容 51/51 相同。外層才有目前 `.env`、v2 文件、identity 文件與額外 isolation test，因此本報告以外層為有效 root。專案根目錄不是 Git repository，無法用 `git diff/status` 作變更證據。

## 4. Route and Page Inventory

| Path | Page | Status | Current behavior |
| --- | --- | --- | --- |
| `/` | Home | PARTIAL | local closet recommendation、weather、recent items、SOS/OOTD previews；核心資料多為 fixture |
| `/home` | Redirect | WORKING | redirect 至 `/` |
| `/closet` | Closet | PARTIAL | local list/filter/search/CRUD/favorite/disused；remote CRUD 不完整 |
| `/bookmarks` | Bookmarks | PARTIAL | localStorage CRUD、batch delete、remote best-effort sync、Storage image upload |
| `/stats` | Stats | PARTIAL | Chart.js + 5 RPC attempts；失敗時靜默使用 local aggregates |
| `/explore` | OOTD feed | PARTIAL | local feed/search/like/save/comment；remote posts 可載入但 mutation 不是 transaction-safe |
| `/sos` | SOS board | PARTIAL | local/remote hybrid；多使用者 ownership 與 shared closet 不可靠 |
| `/ai` | AI stylist | SUPERSEDED | 舊版 local generator/history 已由 authenticated Gateway flow 取代 |
| `/tryon` | Virtual try-on | SUPERSEDED | 舊版模擬 fallback 已由明確 single-item VTO flow 取代 |
| `/profile` | Profile | PARTIAL | local profile edit/public toggle/OOTD；非本人 profile 由 post 資料臨時推導 |
| `/ootd/:id` | OOTD detail | PARTIAL | local-first detail，缺少時直接從 Supabase query；有 loading/error |

沒有獨立 Settings、Login、Register、Item、Outfit routes。Login/Register、Item Detail/Add/Edit、SOS detail/forms、Notification 與 OOTD form 都是 global modal。

Router 沒有 auth guard、permission metadata、not-found route 或 expired-session redirect。

## 5. Current Modules and Data Sources

| Module | Primary runtime source | Remote behavior | Classification |
| --- | --- | --- | --- |
| Auth | Supabase Auth + localStorage fake session | Sign in/up/out/getSession | MIXED |
| Profile | default fixture + `weary-app-state-v1` | legacy `profiles` helpers；avatar best-effort | MIXED |
| Closet | default fixture + appStore localStorage | delete/clearance only；legacy `items` helpers unused/partial | LOCAL_FIRST / PARTIAL |
| OOTD | default fixture + appStore localStorage | best-effort `ootie_ootd_posts` | REMOTE_WITH_FALLBACK |
| SOS | fixture/appStore local state | best-effort `ootie_sos_posts`／suggestions | REMOTE_WITH_FALLBACK |
| Bookmarks | defaults + dedicated localStorage | `ootie_bookmarks` + Storage best-effort | REMOTE_WITH_FALLBACK |
| Notifications | default/local appStore | no active DB integration | LOCAL_ONLY |
| Stats | derived local closet | 5 RPC attempts, then local fallback | REMOTE_WITH_FALLBACK |
| AI stylist | legacy local closet + generator/history | 舊第三方 request result 未使用 | SUPERSEDED |
| Try-on | legacy default models/local closet/history | 舊第三方 simulated fallback | SUPERSEDED |
| Weather | component state | Open-Meteo/geolocation with Taipei fallback | REMOTE_WITH_FALLBACK |

## 6. Feature Baseline

### Working locally

- App shell, desktop/mobile navigation, route rendering and global toast.
- Closet local search, category/color/season/style filters, add/edit/delete/favorite and disused calculation.
- Local OOTD feed, detail, like, save, comments, create/edit/delete and share UI.
- Local bookmarks CRUD, duplicate check, manager mode and batch delete.
- Local profile edit, public-closet toggle and follow state.
- Stats local calculations and Chart.js presentation.
- SOS local publish, tabs, search, detail modal and suggestion UI.

### Partial

- Supabase Auth works in principle but fake session fallback remains and no profile resolver exists.
- Profile and Closet use legacy table names or local state.
- OOTD/SOS/Bookmarks mutate local state before remote success and usually keep success UI after remote failure.
- Bookmark Storage is implemented only for bookmark images and depends on unverified remote policy/runtime state.
- Notifications are local and do not model a real recipient.
- Responsive shell works at 360/390/430 px without observed document-level horizontal overflow, but hierarchy and navigation parity remain inconsistent.

### Broken or misleading

- Outfit builder: no store, route, data model, canvas, drag, resize, layer, save, clone or detail. Item action only shows `已加入你的穿搭` toast.
- AI stylist stores `apiResult` but never reads it; displayed recommendations always come from local deterministic mapping.
- Try-on fallback uses the original chosen model image but displays `AI 試穿預覽完成`.
- Try-on “發布至 OOTD” opens the form but does not pass the generated image/result into it.
- OOTD share URL uses `/#/ootd/:id` although router uses history mode.
- Legacy `qingnian/app.js` and `ming/app.js` contain unresolved `<<<<<<<< HEAD` markers and fail syntax check.

### Missing

- Real Outfit builder and persistence.
- Closet background removal and general Storage image pipeline.
- Complete remote Closet CRUD.
- Notification realtime/recipient model.
- Route-level authorization and explicit no-permission UI.
- E2E tests, lint and typecheck scripts.

## 7. Service and State Architecture

- Most database operations are centralized in `src/services/supabase.js`, but `OotdDetailView.vue` directly queries `ootie_ootd_posts`, so layering is MIXED.
- `auth.js` directly uses exported Supabase client; acceptable as store/service coupling but no identity resolver/repository boundary exists.
- `appStore` owns profile, items, OOTD, notifications, SOS and suggestions, and persists one large `weary-app-state-v1` object.
- Closet and OOTD mostly mutate `appStore` directly. SOS copies arrays into local refs and watches back to appStore. Bookmarks owns separate state and separate localStorage. This creates inconsistent ownership and refresh behavior.
- Remote errors are usually caught in the service and converted to `null`/`false`; stores then continue with local data. The UI cannot reliably distinguish offline, rejected, unauthorized or saved-remote states.

## 8. Test and Build Baseline

Commands used local-only placeholder Supabase values (`127.0.0.1:1`) to prevent calls to a real project.

| Check | Result | Counts / evidence |
| --- | --- | --- |
| Active app syntax | PASS | active `src`/config JS has no syntax failures |
| Repository-wide JS/MJS syntax | FAIL | 90/94 pass；4 failures are duplicated legacy merge-marker files |
| Node Supabase isolation test | PASS | 6/6 |
| `npm test` | FAIL | 20 suites pass, 1 suite fails discovery；92/92 assertions pass |
| Logical unique Vitest coverage | PASS with warnings | 10 source test files / 46 logical cases；nested duplicate makes runner execute 20/92 |
| Build | PASS | 117 modules；JS 676.98 kB / gzip 219.79 kB；chunk-size warning |
| Lint | SKIP | no script/config |
| Typecheck | SKIP | no script/TS config |
| E2E | SKIP | no framework/tests |

`npm test` failure is caused by Vitest discovering `tests/supabase-isolation.test.mjs`, which uses Node `node:test`, and reporting “No test suite found”. Tests also make real fetch attempts to the placeholder endpoint instead of mocking the data layer; `ECONNREFUSED` and teardown `AbortError` messages are present even when assertions pass.

## 9. Baseline Decision

OOTIE v1 is a visually broad local prototype with partial remote adapters, not a coherent end-to-end multi-user application. The first v2 implementation batch should establish frontend foundation and state/error semantics without requiring schema changes. No v2 implementation was started in BATCH-00.
