# Method: dual-agent（A：獨立人工設計審查；B：Impeccable detector + 瀏覽器量測）

# OOTIE Human Design Pass — Anti-AI UI Audit

日期：2026-10-02  
環境：Development Preview（Production 未檢查、未修改）  
狀態：**提案階段；本文件不授權實作。**

## 1. Executive judgment

OOTIE 已經有可辨識的品牌資產：Home Hero、真實衣櫥素材、Explore 全身穿搭與 OOTD Detail 的 canonical tagged items 都能建立信任。主要問題不是「不夠漂亮」，而是進入功能頁後，同一套「淡彩漸層 Hero、大圓角白卡、膠囊標籤、柔陰影」被反覆套用，讓成熟的時尚內容看起來像 pastel SaaS dashboard。

整體設計具體性：**2.5 / 4**。改善方向應以刪除容器、收斂色彩、放大真實影像與建立不同 layout family 為主，不應再增加裝飾。

## 2. Audit scope and evidence

實際檢查 Development Preview：

- Home（Guest / Member）
- Explore
- Closet
- OOTD Detail
- SOS
- AI Styling
- Try-on
- Bookmarks / Saved Outfits
- Statistics
- Notifications
- Profile
- Membership
- Settings
- Login / Signup source and rendered shell
- Mobile More menu
- Desktop account area

視窗證據：desktop 約 1265 × 710、mobile 390 × 844；另以 rendered DOM / computed style 檢查有效 375px 寬度。代表頁 Home、Explore、Closet、Try-on、Profile 在本次檢查中沒有水平溢位。Tablet 768px、完整鍵盤 traversal 與螢幕閱讀器仍需在實作後驗收。

程式面方向性量測：

- `card` 類別／引用：約 271
- `border-radius` 宣告：約 316
- 20–39px 或 `--radius-card` 大圓角：約 78
- pill radius：約 26
- gradient：約 46
- shadow：約 99
- Explore 完整手機頁：75 個 >=16px 圓角元素、41 個陰影元素、36 個 pill
- Closet 完整手機頁：55 個 >=16px 圓角元素、94 個陰影元素

這些數字包含共用與 legacy selector，應用來判斷趨勢，不應直接當成刪除清單。

## 3. Impeccable result

`impeccable detect --json src/views src/components` 執行一次，結果為 1 個 warning：

- `src/views/AiView.vue` 的 `border-left: 3px solid var(--sage)` 被判為 `side-tab`。

人工判定：這是天氣提示的細語意邊線，不是本產品主要的 AI-looking 問題，暫不列為改版目標。Detector 沒有涵蓋 `src/assets/main.css`，因此本報告以 live UI、computed style 與人工 CSS 審查補足。

## 4. Nielsen usability review

| 原則 | 分數 / 4 | 審查結果 |
|---|---:|---|
| 系統狀態可見性 | 2 | 有 loading、disabled、quota、unread；部分頁面 auth hydration 先出現 guest gate 再切會員內容。 |
| 符合真實世界 | 3 | 衣物、穿搭與人物影像自然；Gateway、ID 等工程語彙仍進入消費者 UI。 |
| 使用者控制與自由 | 1 | 人物照無刪除；生成失敗缺少素材層級復原；多件模式不易發現。 |
| 一致性與標準 | 2 | 表面高度一致但過度同構；Topbar avatar 與內容 avatar 裁切不一致。 |
| 錯誤預防 | 2 | 有 disabled、單件限制與 idempotency；未在送出前指出不相容衣物圖。 |
| 辨識勝於記憶 | 3 | 導覽清楚；多件生成仍要求使用者先理解模型與模式差異。 |
| 彈性與效率 | 2 | Closet 有分類；Try-on 直接展開 43 件衣物，缺搜尋／分類。 |
| 美學與極簡 | 1 | 內容被 Hero、card、pill、helper copy 多層包裹。 |
| 辨識與修復錯誤 | 1 | MIME 錯誤沒有指出是人物照或衣物圖，也沒有就地替換動作。 |
| 說明與幫助 | 3 | Capture guide 與狀態文案完整；部分說明過長或過度技術化。 |

## 5. P0 functional findings discovered during the audit

這些是實際缺陷，但依本輪 Stop Gate **尚未修改任何功能程式**。

### 5.1 人物照片無法刪除

- `TryonView.vue` 只有選擇與上傳人物照的 UI。
- Gateway 只有 `POST /v1/person-photos` 與清單讀取，沒有 owner-verified delete route。
- 建議下一批實作：縮圖 overflow menu（設為目前照片／刪除），刪除前確認；Gateway 只允許本人 `person/{user_id}/...` 路徑。若正被選用，刪除後改選下一張；Storage 失敗不得偽裝成功。

### 5.2 圖片生成失敗的根因已定位

- AI ledger 最近多筆 `single_try_on` 與 `outfit_preview` 皆記錄 `INVALID_IMAGE_MIME`。
- 失敗使用了不同 JPEG／PNG 人物照，但共通衣物資料的圖片來源為 `.webp`。
- Gateway `gateway/src/image.js` 只偵測並允許 `image/jpeg`、`image/png`；因此 WebP 衣物圖在 provider request 前即被拒絕。
- 目前 UI 訊息「請改用 JPEG 或 PNG」誤導使用者以為人物照有問題。
- 建議下一批實作：在 server-side 將受信任、通過 magic-byte 驗證的 WebP 衣物圖轉成 JPEG／PNG derivative，或讓 seed／media pipeline 為 AI 保存相容 derivative；不要關閉 MIME 驗證。錯誤應指出「所選衣物圖目前無法用於生成」，並標出問題衣物。
- 此錯誤發生在 Google provider request 前；本次診斷未發出付費 AI request。

### 5.3 多件選擇存在，但 discoverability 失敗

- `single` 模式會把選取覆蓋成 1 件。
- `outfit` 模式已可 toggle 1–5 件。
- 問題不是資料結構缺失，而是使用者沒有先理解要切換到「AI 穿搭預覽」，且衣物區沒有 persistent selected tray。
- 建議下一批實作：第一步改成白話決策「試一件衣服／預覽完整穿搭」；選擇第二項後顯示 `已選 n / 5` 固定 tray、可移除縮圖與明顯的 multi-select checkbox state。單件模式第二次點衣物時提示可切換完整穿搭，不要靜默取代。

## 6. Page / component issue register

| Page / component | Current problem | 為何像 AI template | Remove | Simplify | Keep | Proposed replacement | Priority |
|---|---|---|---|---|---|---|---|
| Try-on | Hero、quota、mode、setup、result 全是大圓角框；素材管理與錯誤復原不足 | 同構卡片把工作流程切成 dashboard blocks | 大型漸層 Hero、冗長工程說明 | mode 文案、quota 呈現 | 真實照片、private 說明、正式 provider 區分 | 單一工作台、模式先決策、selected tray、就地錯誤與素材操作 | P0 |
| Profile | 公開身份與五張 pastel metrics 競爭 | 指標逐卡、色彩輪替是典型生成式 dashboard | 五張 metric cards | points / plan 為 utility row | avatar、姓名、自介、OOTD | 開放式 profile header + 單行 metrics + media grid | P0 |
| Member Home | 43 件、245 點、SOS 拆成三張大卡，核心行動被推後 | 指標優先於日常任務 | 三張大型 metric cards | 天氣與統計壓成一列 | 問候、天氣、真實資料 | 最近衣物／今天穿什麼成首屏主角 | P0 |
| Closet | Hero、冷宮卡、搜尋卡、chip 後才看到衣物 | card-on-card 阻礙 image-first | 大 Hero card、冷宮巢狀卡 | filter toolbar | 真實衣物多樣性、CRUD | 開放頁首 + 一列 insight + 立即進入網格 | P0 |
| Auth | `GUEST-FIRST ACCESS`、粉色 segmented tab、大白 modal | 工程展示語氣與 UI kit 感 | 英文工程 eyebrow | 說明與 tabs | Google + email/password | 品牌標題、Google 主入口、divider、簡單文字 tabs | P0 |
| Desktop account | 圖片實際仍為方形 | avatar 規則不一致，削弱人感 | 方形裁切 | trigger chrome | 帳號 popover 功能 | 圓形 avatar + username + chevron | P0 |
| AI Styling | 選項、說明、結果皆多層 card / pill | 功能表單像 AI SaaS configurator | 大型裝飾 Hero | 場合/風格選項與 helper text | 衣櫥限定、structured result | 先問一句需要，進階條件折疊；結果以 outfit story 呈現 | P1 |
| SOS | Hero、搜尋、tabs、post cards、彩色頂邊層層堆疊 | `nth-child` 色彩輪替機械 | 輪替彩色頂邊 | tags 與狀態 badge | 真實作者、衣物縮圖、suggestions | flat social list + 一個明確發布 action | P1 |
| Statistics | 每個圖表各自 pastel card，長排行全部展開 | 彩色儀表板而非衣櫥洞察 | nth-child pastel rotation | 預設排行到 Top 5 | 真實 metrics / charts | 3–5 個敘事 insight + 平面 charts + 可展開排行 | P1 |
| Settings | 每個主題一張白卡 | consumer settings 看起來像管理後台 | card-per-section | 狀態 badge、helper copy | 真實設定 | sections + divider；危險操作才用強邊界 | P1 |
| Notifications | 每則事件是 mini card + badge | 容器比事件重要 | 單則 card、彩色事件 pill | mark-read feedback | actor、時間、unread、deep link | avatar + natural sentence + time + divider list | P1 |
| Membership | 方案與點數用多張大型方案卡 | 標準 SaaS pricing template | 多色等權重 plan cards | 重複 benefits | 真實方案、點數、操作 | 比較表／能力列；只突出目前建議方案 | P1 |
| Bookmarks | 大 Hero + import card + manager card | 工具被切成三個同型模組 | 大型 Hero surface | import 說明 | URL preview、真實 saved content | compact import row + image-first archive grid | P1 |
| Explore | 內容品質高，但 header、filter、每篇都完整卡化 | 社交 feed 被 card 框住 | feed 外框、過多陰影 | tags / caption hierarchy | full-body image、author、Like/Save | open feed、divider、低圓角媒體 | P1 |
| OOTD Detail | 主圖好，但外層大白卡與 story/card 疊層 | editorial 內容被 dashboard 容器化 | 外層大卡 | metadata / tags | canonical items、author、主圖 | 大圖 + 扁平 action row + editorial story + item rail | P2 |
| Guest Home | Hero 已有品牌辨識度；功能卡仍四張 pastel 輪替 | 首頁後半段回到 feature-card 模板 | 等權重四色功能卡 | CTA 數量 | frozen Hero、brand opening、real routes | 以敘事段落與影像節奏接續 Hero | P2 |
| Legal / utility | 單一大卡加彩色裝飾 | 所有頁面都像 landing card | decorative radial backgrounds | draft 標籤 | 清楚的法律草稿註記 | 紙張式平面文件與目錄 | P2 |

## 7. Cognitive load and emotional journey

### 認知超載

- Try-on 同頁競爭：人物照、43 件衣物、模式、quota、結果、history。
- AI Styling 以大量 pills 平鋪場合、風格、天氣、文字與件數，缺乏先後層級。
- Profile 將一眼可讀的社交數字拆成多張色卡。
- Statistics 長排行稀釋真正 insight。
- Mobile Home 先看到三張數字卡，而不是今天能做的事。

### 情緒旅程

1. Guest Home：影像與主標建立期待。
2. Explore → OOTD Detail：真實穿搭和 canonical items 提升信任。
3. Auth：工程語氣與 modal 模板使品牌感下降。
4. Member Home / Profile：轉成 dashboard。
5. Closet：內容真實，但 UI 容器延後衣物出現。
6. AI / Try-on：技術說明增加焦慮；錯誤不能定位、照片不能刪除破壞控制感。
7. Membership / Settings：功能完整，但與時尚生活品牌脫節。

## 8. Human-designed OOTIE principles

1. **Image first, controls second**：穿搭與衣物承擔敘事；chrome、helper copy、badge 主動退後。
2. **Identity is circular; fashion is editorial**：人物身份用圓形 avatar；服裝與 OOTD 保留影像比例與低圓角 framing。
3. **Flow over feature cards**：以「衣櫥 → 搭配 → 試穿 → 分享／收藏」組織體驗。
4. **Typography before containers**：先靠字級、留白、divider、圖片尺度建立層級。
5. **Asymmetry with purpose**：只在 editorial 區用不對稱；表單與工作流維持可預測。
6. **Private actions stay quiet**：Save、settings、notifications 不搶內容焦點。
7. **Color communicates hierarchy**：中性 85–90%、主 accent 8–12%、季節驚喜色 2–5%。
8. **Errors attach to their source**：問題應出現在出錯素材或輸入旁，不只出現在結果面板。

## 9. Proposed OOTIE design system

### Layout families

只保留四類：

1. **Editorial feature**：Home / Explore lead / Profile cover；開放式版面、大圖、少量文字。
2. **Media feed**：Explore / OOTD / Saved；影像 + identity + flat action row，以 whitespace / divider 分隔。
3. **Utility list**：Notifications / Settings / Membership details；扁平 row、分區標題、divider。
4. **Creative workspace**：AI / Try-on / capture；步驟與 selected tray，只有真正需要邊界的工作區使用 surface。

### Typography

| Role | Desktop | Mobile | Use |
|---|---|---|---|
| Display | 52–64 / 0.98 | 36–42 / 1.02 | Home / editorial only |
| H1 | 40–48 / 1.05 | 32–36 / 1.08 | Page title |
| H2 | 26–32 / 1.15 | 24–28 / 1.18 | Section |
| H3 | 18–22 / 1.25 | 18–20 / 1.3 | Content title |
| Body | 16 / 1.65 | 16 / 1.6 | Primary reading |
| Caption | 13–14 / 1.5 | 13 / 1.45 | Metadata |
| Label | 11–12 / 1.2 | 11–12 / 1.2 | Controls; not a substitute for heading |

Heading hierarchy should rely on size, weight and whitespace. Eyebrows are reserved for genuine editorial context, not every page.

### Spacing

- Page gutter：mobile 16px；tablet 24px；desktop 32–48px。
- Section rhythm：mobile 40–56px；desktop 64–88px。
- Content gaps：8 / 12 / 16 / 24 / 32px scale。
- Avoid equal 24px padding on every container; media rows may be edge-conscious.

### Radius

- Editorial / garment image：8–12px，或 full-bleed。
- Content card（確實可點擊／需要群組）：14–16px。
- Controls：10–12px。
- Modal / bottom sheet：20–24px。
- Pill：999px，只限 filter、status 或 compact toggle。
- Structural section：通常 0px。

### Color

- 85–90%：cream / off-white / white / warm gray / near-black。
- 8–12%：選定一個主要 accent（建議 lavender ink 或 pale blue）用於 selected、focus、primary context。
- 2–5%：pink / butter yellow / mint 作季節或 editorial surprise。
- 禁止以粉 → 黃 → 藍 → 紫循環為內容排序規則。

### Shadows, borders and dividers

- Shadow 僅用於 modal、floating menu、真正浮起的 interactive surface。
- 一般內容以 `1px` warm-gray divider 或留白分隔。
- Card hover 以輕微 `translateY` 或 border shift，不同時加大陰影、scale、gradient。

### Buttons

- Primary：near-black filled，48px 最小高度。
- Secondary：transparent / white + quiet border。
- Tertiary：text / icon action。
- Destructive：只在確認情境使用紅色，不以彩色卡包裝。
- 每個 viewport 的單一區塊原則上只允許一個主要 CTA。

### Avatar rules

- Desktop 40px；mobile 34px。
- `aspect-ratio: 1 / 1; border-radius: 50%; overflow: hidden; object-fit: cover`。
- 缺圖顯示圓形 initials / neutral fallback。
- Hover / focus 使用細圓環，不包大型圓角矩形。
- Desktop trigger：`[avatar] username ▾`；mobile 可只顯示 avatar。
- Explore、OOTD、SOS、Notifications、Profile 共用 identity avatar component。
- OOTD / garment image 永不套 avatar styling。

目前 Topbar 父層雖為 42 × 42、`border-radius: 50%`，但 `overflow: visible`、子圖 `border-radius: 0`，所以 live UI 顯示方形；實作時需一併修正尺寸與裁切。

### Image framing

- 人像 OOTD：保留全身構圖，允許 neutral mat，不強迫 cover。
- 衣物：依來源保留 flat lay / hanger / natural-light 差異；卡片展示可 contain，原圖不被改寫。
- Editorial：少量 full-bleed / asymmetrical crop；不得用相同框架處理所有圖片。

### Chips

- 只用於可操作 filter、selected state、必要 status。
- 純 metadata 改為文字、逗號、divider 或 caption。
- Mobile 可水平捲動，但不得重複另一組相同 filter。

### Motion

- 保留 Brand Opening、Hero reveal、按鈕 press、必要 modal entrance。
- 移除無狀態意義的 floating / repeating reveal。
- 180–260ms 為一般互動；尊重 `prefers-reduced-motion`。

## 10. REMOVE / REDUCE

### REMOVE

- 功能頁反覆出現的大型漸層 Hero card。
- Profile 五張 pastel metric cards。
- SOS / Statistics 依 `nth-child` 機械輪換 accent。
- Consumer UI 中的 Gateway、ID、structured data 等工程字詞。
- 每則 notification 的獨立厚卡框。
- 無互動意義的 badge、eyebrow、sticker。
- 同區多個同權重主要 CTA。

### REDUCE

- 22–28px radius 使用範圍。
- 每個 section 都有陰影。
- 粉／黃／藍／紫平均分配。
- icon → title → description → CTA 萬用卡模板。
- 一般 metadata 的 pill 化。
- 重複 helper copy 與模型／基礎設施說明。
- More Menu 快速新增卡片高度。
- Statistics 預設展開排行數量。
- 功能頁 sticker / handwriting；主要保留在 Guest Home。

## 11. Five-page before / after plan

### Try-on

**Current**：模式、quota、輸入、結果與歷史各自成卡；43 件衣物一次展開；無照片刪除；錯誤與來源分離。  
**Proposed**：模式先決策；流程內只顯示必要步驟；照片有管理 menu；衣物有搜尋／分類與固定 selected tray；錯誤貼近問題素材。

### Member Home

**Current**：三張大型指標卡讓手機首屏像 dashboard。  
**Proposed**：問候＋天氣；指標壓成一列；首屏主角改為最近衣物或「今天穿什麼」；內容區不用 pastel 背板逐段包覆。

### Closet

**Current**：Hero → 冷宮 section → 搜尋卡 → chips → 網格。  
**Proposed**：標題、件數、加入同列；chips 接頁首；冷宮成一列可展開 insight；衣物立即進首屏；卡片去主陰影。

### Profile

**Current**：identity、metrics、utility 都以大卡呈現。  
**Proposed**：開放式 identity header；一行 social metrics；OOTD grid 成主角；方案與點數降為 utility row。

### Explore / OOTD Detail

**Current**：內容品質高，但 header、filter、feed、detail 都被圓角 surface 包住。  
**Proposed**：Explore 使用開放 header、單列 filters、flat media feed；Detail 移除外層大白卡，保留主圖優勢，以 action row、story、canonical item rail 組成 fashion story。

## 12. Priority order

### P0

1. Try-on（含三個功能缺陷）
2. Profile
3. Member Home
4. Closet
5. Auth + Desktop account trigger

### P1

6. AI Styling
7. SOS
8. Statistics
9. Settings
10. Notifications
11. Membership
12. Bookmarks
13. Explore

### P2

14. OOTD Detail
15. Guest Home
16. Legal / utility / error pages

Home Hero V2、Brand Opening、canonical OOTD mapping 與現行 mobile IA 視為 frozen；除非發現回歸，不在 anti-AI pass 中重做。

## 13. Implementation impact estimate

- 預估受影響：12–16 個 views、8–12 個 shared components、全域 token / utility CSS。
- 資料邏輯：純視覺批次不需要改 DB、RLS、seed、OAuth、AI provider、payment。Try-on 三個 P0 功能缺陷需另列受控功能批次。
- Responsive：Home 之外多數功能頁會有結構調整，需 320 / 375 / 390 / 768 / 1024 / 1440 回歸。
- Accessibility：需統一 avatar label、`aria-pressed`、error-source linking、focus-visible 與 modal / menu focus。
- 風險：視覺改版中等；Try-on delete / media conversion 為中高，需 Storage ownership 與 provider preflight tests。
- 建議分批：
  1. P0 Try-on functional repair（不付費 smoke，先 mock / integration）。
  2. Shared tokens + avatar + Auth。
  3. Member Home / Closet / Profile。
  4. AI / SOS / Statistics / Settings / Notifications / Membership / Bookmarks。
  5. Explore / OOTD 減法一致性與全旅程 QA。

## 14. Strengths to preserve

- Home Hero 的專用品牌影像與主 CTA。
- Explore / OOTD Detail 的 full-body framing。
- OOTD 與 closet canonical items 的可信關係。
- 真實使用者衣物影像的多樣性。
- 已定案的 Bottom Nav / More IA。
- Loading、quota、private-result、reduced-motion 等安全與可及性基礎。

## 15. Run notes and limits

- Assessment A 在未接觸 detector findings 的情況下完成。
- Assessment B 另開 fresh browser tab，detector 僅執行一次。
- Subagent 環境無法顯示可見 overlay，因此改用實際頁面截圖、DOM 與 computed styles；沒有啟動 live server。
- Refero / Mobbin 在目前環境不可用；參考板改採官方產品頁、官方 help 與 newsroom。
- 沒有點擊 Like / Save / Generate 等遠端 mutation，沒有發出付費 AI request。
- 沒有修改 UI code、Gateway、DB、RLS、Storage policy、OAuth、payment 或 Production。
- 本次只新增兩份審查文件；等待明確批准後才進入實作。

