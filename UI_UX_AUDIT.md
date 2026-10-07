# OOTIE v1 UI / UX Audit

> BATCH-00 audit snapshot — 2026-09-28  
> 評估依據為現有 Vue/CSS、component behavior、unit tests，以及 360 / 390 / 430 px 的本機 route smoke。這不是完整真機、螢幕閱讀器或使用者研究報告。

## Classification

| Label | Meaning |
|---|---|
| `KEEP` | 現況可保留，後續只需一般驗證 |
| `IMPROVE` | 主體合理，可補足狀態或細節 |
| `REFACTOR` | 功能可沿用，但結構／元件邊界需重整 |
| `REPLACE` | 現有模式會誤導或阻礙主要流程，應以新模式取代 |
| `REMOVE` | 應從正式 runtime 移除 |
| `NEW` | 現有產品缺少，需在核准批次新增 |

## 1. Executive UX assessment

現有版本已具有可辨識的衣櫃產品外觀、桌機與手機導覽、卡片、modal、空狀態，以及 Home／Closet／OOTD／SOS／Profile 等可操作畫面。主要問題不是「沒有畫面」，而是畫面常把 local fixture 或 best-effort mutation 呈現成已完成的正式結果。v2 的第一優先應是讓身份、資料來源、成功／失敗語意與可達性可信，再做大規模視覺改版。

## 2. Global UI system

| Area | Assessment | Evidence / problem | Recommendation |
|---|---|---|---|
| Overall visual direction | `KEEP` | 衣著圖片、卡片與暖色系已形成生活風格產品感 | 保留品牌情緒，先建立可重用 tokens |
| Navigation | `REFACTOR` | desktop 9 個入口；mobile 僅 5 個主入口且資訊架構不同 | 依核心任務重排，明確定義 overflow/secondary navigation |
| Typography | `IMPROVE` | 基本層級可讀，但 route heading 不一致 | 建立 page title、section title、body、caption scale |
| Buttons | `REFACTOR` | primary/secondary/icon/emoji/inline variants 分散 | 建立 button primitive、size、disabled/loading contract |
| Inputs | `IMPROVE` | 多數有視覺 label，錯誤／help text 不一致 | 統一 label、required、error、description 關聯 |
| Cards | `REFACTOR` | Closet/OOTD/SOS/Profile 各自實作相近 interaction | 建立可組合 card pattern，不強迫所有內容同版型 |
| Modals | `REPLACE` | 視覺 modal 很多，但缺 dialog semantics 與 focus lifecycle | 建立 shared accessible modal/dialog primitive |
| Toast | `REPLACE` | 常把 local fallback 顯示為遠端成功；語意不可信 | toast 必須綁定真實 operation result；支援 retry/detail |
| Spacing/radius/color | `IMPROVE` | 已有一致傾向，但 scoped/inline styles 造成漂移 | 抽出 design tokens 並盤點例外 |
| Icons | `REFACTOR` | emoji、文字、SVG 混用，accessible name 不一致 | 採一致 icon source；裝飾 icon 隱藏、操作 icon 命名 |
| Responsive shell | `KEEP` / `IMPROVE` | 760 px breakpoint 能切換 sidebar/bottom nav | 保留結構，補 nav parity、safe area 與真機 touch QA |
| Motion | `NEW` | 未找到 reduced-motion handling | 加入 `prefers-reduced-motion` policy |

## 3. Page and feature audit

### Navigation

| Finding | Class | Detail |
|---|---|---|
| Desktop sidebar provides broad discoverability | `KEEP` | 主要 route 都可見 |
| Mobile bottom navigation differs from desktop IA | `REFACTOR` | Stats、AI、Try-on 不直接出現；SOS、Bookmarks 依 quick action |
| No active authorization-aware navigation | `NEW` | 未登入／profile missing 仍無一致入口狀態 |
| No 404 experience | `NEW` | invalid deep links 沒有產品化 recovery |

### Closet

| Finding | Class | Detail |
|---|---|---|
| Image-first grid and filters | `KEEP` | 符合衣櫃瀏覽任務；手機仍維持兩欄且無 document overflow |
| Search/category/color/season/style filters | `KEEP` / `IMPROVE` | 基本可用；需補結果數、清除條件與 no-result recovery |
| Add/edit/detail modal flow | `REFACTOR` | 可操作，但 modal semantics 與 remote status 不完整 |
| Delete confirmation | `IMPROVE` | 需清楚標示 local/remote consequence 與 failure recovery |
| Archive | `NEW` | 現有 hidden 語意沒有完整 archive/restore UI |
| Sorting | `NEW` | 無使用者可控制的排序選項 |
| Image handling | `REPLACE` | data URL/localStorage 不適合正式資料流；需等待 Storage contract |
| Add to outfit | `REPLACE` | 目前只有 toast，不應呈現為已加入 |

### Outfit

| Finding | Class | Detail |
|---|---|---|
| Builder | `NEW` | 無 route、canvas、drag、resize、layer、save、clone、detail |
| Entry from item detail | `REPLACE` | 目前是無結果 toast；應導向真正 selection/builder flow |
| Canvas technology | `NEW` | 未使用 React Konva、Canvas API 或等價實作；技術選型仍待產品範圍確認 |

### OOTD

| Finding | Class | Detail |
|---|---|---|
| Feed/card/detail interaction | `KEEP` / `IMPROVE` | local path 可操作且有 detail loading/error |
| Like/save/comment feedback | `REFACTOR` | local-first 立即成功，未區分 syncing/failed |
| Ownership controls | `REPLACE` | 現在依 username/local profile；應依 resolved profile ID |
| Privacy | `NEW` | 缺 private/public visibility contract |
| Share | `REPLACE` | hash URL 與 history router 不一致 |
| Detail heading structure | `IMPROVE` | browser DOM audit 未找到一致 `h1` |

### SOS / 衣友求救板

| Finding | Class | Detail |
|---|---|---|
| Board and detail modal | `KEEP` / `IMPROVE` | 核心求助→查看→建議流程可理解 |
| Minimum one shared item | `KEEP` | 前端有明確限制 |
| Per-SOS shared closet | `REPLACE` | 他人 SOS 可能展示目前使用者的 local items，違反使用者心智模型與隱私期望 |
| Suggestion form | `REFACTOR` | 需把可選衣物限制在 verified shared set，並顯示送出狀態 |
| Self-response prevention | `IMPROVE` | 有 guard，但必須建立在 canonical profile identity |
| Duplicate response | `REPLACE` | UI 應清楚是「編輯既有建議」而非再次新增 |
| Close/adopt controls | `REPLACE` | 只對 owner 顯示且 mutation 也需驗證 owner；adopt 後狀態轉移需明確 |
| Notification copy | `REPLACE` | 現有 local notification recipient/copy 語意可能錯置 |
| Counts | `IMPROVE` | suggestion/helped count 必須來自一致資料定義 |

### Bookmarks

| Finding | Class | Detail |
|---|---|---|
| CRUD and organization | `KEEP` / `IMPROVE` | local interaction較完整 |
| Save/upload success messaging | `REPLACE` | 不可在 remote fail 時仍顯示正式完成 |
| Ownership | `REPLACE` | 移除 `profile-01` compatibility query from formal runtime |

### Stats / Insights

| Finding | Class | Detail |
|---|---|---|
| Chart-based overview | `KEEP` | 能提供衣櫃摘要與可視性 |
| Data provenance | `NEW` | 應顯示 remote/local、最後更新與 degraded state |
| Empty/error | `IMPROVE` | RPC error 現在直接變 local chart，使用者無法判別 |
| Mobile chart accessibility | `IMPROVE` | canvas 需要文字摘要或資料表替代 |

### Profile

| Finding | Class | Detail |
|---|---|---|
| Identity and personal summary layout | `KEEP` / `IMPROVE` | 結構清楚，適合作為 v2 profile shell |
| Edit/avatar workflow | `REFACTOR` | local preview 可保留，但需真實 save/error/retry contract |
| Other-user profile | `REPLACE` | 目前從 post/display data 推導，沒有穩定 profile source |
| Public closet toggle | `REPLACE` | local-only toggle 不應暗示已更新 privacy setting |

### Auth

| Finding | Class | Detail |
|---|---|---|
| Sign-in/sign-up modal basics | `KEEP` / `IMPROVE` | loading/error 已有雛形 |
| Fake auth fallback | `REMOVE` | `user-01` formal runtime fallback 必須移除 |
| Auth route/state boundary | `NEW` | 需要 initializing、signed-out、authenticated、profile-missing、expired states |
| Post-login destination | `NEW` | 需定義 onboarding/profile provisioning 尚未完成時的 UX |

### AI styling and Try-on

| Finding | Class | Detail |
|---|---|---|
| Distinct dark visual language | `REFACTOR` | 與主要 light UI 不連續，可保留實驗感但需品牌 tokens |
| AI styling claim | `RESOLVED_LOCAL` | 現行畫面由 authenticated Gateway 結果驅動；付費 Live Smoke 仍待 Preflight 核准 |
| Try-on completion state | `REPLACE` | original-image fallback 不得顯示「AI 預覽完成」 |
| Heading hierarchy | `IMPROVE` | AI/Try-on route smoke 未找到一致 `h1` |

## 4. State design matrix

Legend: `✓` present enough for baseline; `△` partial/inconsistent; `—` missing.

| Module | Loading | Empty | Error | Success | Disabled | No permission | Confirm |
|---|---:|---:|---:|---:|---:|---:|---:|
| Auth | ✓ | N/A | ✓ | △ | △ | — | N/A |
| Profile | △ | △ | △ | △ | △ | — | — |
| Closet | △ | ✓ | △ | △ | △ | — | △ |
| Outfit | — | — | — | — | — | — | — |
| OOTD | ✓ detail | ✓ | ✓ detail / △ mutations | △ | △ | — | △ delete |
| SOS | △ | ✓ | △ | △ | △ | △ client-only | △ |
| Bookmark | △ | ✓ | △ | △ | △ | — | △ delete |
| Notification | N/A local | ✓ | — | △ | — | — | — |
| Stats | △ | ✓ | — silent fallback | N/A | — | — | N/A |
| AI | △ | ✓ history | △ | misleading | △ | N/A | — |
| Try-on | △ | ✓ history | △ | misleading fallback | △ | N/A | — |

Cross-cutting requirement for v2: an empty collection, an unauthenticated request, a permission denial, a network failure, and a successful-but-not-yet-synced mutation must never share the same visual state.

## 5. Responsive audit

### Evidence

- Inspected responsive CSS and the app shell breakpoint at `max-width: 760px`.
- Ran local browser structural smoke on 10 routes at 360 px, 390 px, and 430 px: 30 route/width checks.
- No document-level horizontal overflow was observed in those 30 checks.
- Home, Closet, and SOS were visually inspected at 360 px and remained renderable and navigable.

### Findings

| Area | Class | Finding |
|---|---|---|
| 360/390/430 layout containment | `KEEP` | no page-level horizontal overflow in the smoke set |
| Closet grid | `IMPROVE` | two-column layout holds, but needs long-label and real-image stress tests |
| Bottom navigation | `REFACTOR` | functional shell but lacks desktop feature parity and explicit safe-area review |
| Modal height/keyboard | `IMPROVE` | CSS suggests scrollable content; real mobile keyboard and focus behavior remain unknown |
| Touch targets | `IMPROVE` | no systematic 44×44 px verification |
| Real devices | `NEW` | iOS Safari/Android Chrome, orientation, camera/file picker not tested |

The 30 checks are a structural smoke baseline, not full mobile acceptance. No production deployment or external device testing was performed.

## 6. Accessibility audit

| Check | Current evidence | Class | Required direction |
|---|---|---|---|
| Button accessible name | close buttons often have `aria-label`; icon coverage inconsistent | `IMPROVE` | audit every icon-only action |
| Image alt | most content images provide alt | `KEEP` / `IMPROVE` | ensure alt describes garment/post, not filename |
| Form labels | most forms have visual labels | `IMPROVE` | bind `for`/`id`, error text and descriptions consistently |
| Keyboard access | some cards/avatar support Enter/Space | `REFACTOR` | native buttons/links preferred; cover all click-only cards |
| Modal focus | focus trap/restore/Escape not established | `REPLACE` | shared dialog primitive |
| Color-only status | not systematically prevented | `IMPROVE` | pair color with text/icon and announce status |
| ARIA dialog semantics | missing/inconsistent | `REPLACE` | `role=dialog`, `aria-modal`, labelled title |
| Heading hierarchy | route-level `h1` inconsistent | `IMPROVE` | exactly one logical page heading per route |
| Live announcements | toast/async status not reliably announced | `NEW` | polite/assertive live region policy |
| Chart alternatives | canvas labels exist but data alternative limited | `NEW` | textual summary/table |
| Reduced motion | no rule found | `NEW` | respect OS preference |

## 7. Component consistency

| Component family | Class | Observation |
|---|---|---|
| Page shell | `KEEP` / `REFACTOR` | global shell is reusable; auth-aware variants missing |
| Modal/dialog | `REPLACE` | many implementations repeat overlay/close behavior without a11y contract |
| Card | `REFACTOR` | repeated visual pattern, interaction semantics vary |
| Form field | `REFACTOR` | input/select/textarea feedback and validation differ per modal |
| Empty state | `KEEP` / `IMPROVE` | present on several views; actions and copy need standardization |
| Error state | `NEW` | no consistent recoverable error component |
| Skeleton/loading | `NEW` | loading treatment is sparse and per-view |
| Toast | `REPLACE` | success must reflect authoritative result |
| Avatar/image picker | `REFACTOR` | local preview should be separate from persisted/uploaded state |

## 8. Recommended UX sequence (proposal only)

1. Establish trustworthy app states: auth initializing, signed out, profile missing, loading, empty, denied, error, syncing, success.
2. Create accessible shared primitives for dialog, button, field, toast, and page state.
3. Reconcile desktop/mobile navigation around the approved core workflows.
4. Apply those primitives to one narrow vertical slice before redesigning every page.
5. Only after data semantics are reliable, refine editorial styling, motion, richer imagery, and AI/try-on presentation.

No item in this sequence was implemented in BATCH-00.

