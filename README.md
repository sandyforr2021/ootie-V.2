# OOTIE Personal

GitHub 私人倉庫： [sandyforr2021-debug/ootie-personal](https://github.com/sandyforr2021-debug/ootie-personal)。原始碼、測試與小組開發文件保存在本倉庫；GitHub 存取權限由擁有者管理。

這是獨立於團隊原始倉庫的 OOTIE Personal 專案，保存目前 Vue 前端、Google Cloud AI Gateway、Supabase schema、測試與操作文件。倉庫由 sandyforr2021-debug 擁有，供受邀小組成員協作。

初始快照建立於 2026-10-07，來源為現有 OOTIE-main 工作資料夾，包含目前修改與新增的應用程式檔案。Git 歷史重新開始；legacy、舊 Git 歷史、本機帳密、資料備份與執行紀錄未帶入。保留既有團隊程式的貢獻與來源。

## 現行 Development 環境

| 服務 | 位置 |
| --- | --- |
| 網站 | https://ootie-web-dev-s5nwal7adq-as.a.run.app/ |
| AI Gateway | https://ootie-ai-gateway-dev-s5nwal7adq-as.a.run.app/ |
| Supabase | OOTIE-personal-dev（hoxkrmadzjnyjaqjbyxc） |
| 獨立私人原始碼倉庫 | https://github.com/sandyforr2021-debug/ootie-personal |

這次建立倉庫不包含部署更新、資料庫 migration、資料重置、Google Cloud／Supabase 成員邀請或付費 AI 請求。Production 仍未上線。

GitHub 協作者可讀寫程式碼；Cloud Run／Supabase 管理權限另外配置。網站網址可直接分享作為測試入口。

## 技術與目錄

| 範圍 | 技術 | 目錄 |
| --- | --- | --- |
| 前端 | Vue 3 Composition API、Pinia、Vue Router、Vite、Chart.js | src/ |
| UI／UX | CSS tokens、響應式導覽、共用元件、焦點管理、減少動態 | src/assets/、src/components/ |
| AI 後端 | Node.js HTTP／Fetch、Sharp、JWT／ownership／quota | gateway/src/ |
| AI 模型 | Vertex AI：Gemini、Virtual Try-On、Gemini 圖片預覽 | gateway/src/providers/ |
| 資料與身份 | Supabase Auth、PostgreSQL、RLS、Storage | supabase/personal_baseline/ |
| 其他整合 | Open-Meteo、PWA、獨立 Chrome Manifest V3 擴充功能 | src/services/、public/、extension/ |
| 建置與部署 | Docker、Nginx、Cloud Build、Cloud Run | deploy/ |
| 品質驗證 | Vitest、Vue Test Utils、Happy DOM、Playwright、Node Test、SQL 靜態檢核 | tests/、gateway/test/ |

架構圖：[OOTIE 技術架構](docs/architecture/OOTIE-technology-architecture.png)。圖中的團隊 GitHub 提示是本倉庫建立前的查核快照；目前獨立原始碼位置以本 README 為準。

## 本機開始

需求：Node.js 22 以上、npm、Git。

```powershell
 git clone https://github.com/sandyforr2021-debug/ootie-personal.git
 cd ootie-personal
 npm ci
 npm ci --prefix gateway
 Copy-Item .env.example .env.local
```

向專案擁有者取得前端可公開的 Supabase publishable 設定，填入本機 `.env.local`；Gateway URL 可使用上述 Development URL。本機網址須在既有 Auth redirect／CORS allowlist 中，否則由管理者另行配置。

```powershell
 npm run dev -- --host 127.0.0.1 --port 5174
```

後端非秘密範本在 `gateway/env.example`，詳細設定見 [GOOGLE_CLOUD_AI_SETUP.md](GOOGLE_CLOUD_AI_SETUP.md)。service-role、Google credential、測試帳密只在本機或受控雲端 Secret Manager 設定，不能提交，也不能放進 VITE_*。

## 小組開發

接受協作者邀請 → clone → 各自設定忽略環境檔 → 建立分支（例如 codex/closet-filter）→ 修改與測試 → Pull Request → 小組檢查與合併。

目前沒有 GitHub Actions 自動部署流程，合併程式碼不會自動更新 Cloud Run。詳細流程見 [CONTRIBUTING.md](CONTRIBUTING.md)。成員邀請由擁有者在 Settings → Collaborators → Add people 操作。

## 本機驗證

```powershell
 npm run check:syntax
 npm test
 npm run build
 npm run check:production-readiness
```

npm test 執行前端測試、隔離測試、mock Gateway 測試與 schema 靜態檢核，不呼叫付費模型。某些舊檢核輸出的 REMOTE_SQL_EXECUTED 是歷史文件狀態，並非測試當下執行遠端 SQL。

部分 test:e2e 與 remote smoke 會操作真實 Development 資料，執行前須閱讀測試檔、確認目標與操作授權。seed:demo、migration、重置與資料清理不能當作本機開發的預設步驟。

## 文件與環境邊界

- [AI_PROVIDER_ARCHITECTURE.md](AI_PROVIDER_ARCHITECTURE.md)：AI Gateway 與資料邊界。
- [AUTH_IDENTITY_MODEL.md](AUTH_IDENTITY_MODEL.md)：Auth UUID／profile UUID。
- [CLOTHING_OWNERSHIP_CONTRACT.md](CLOTHING_OWNERSHIP_CONTRACT.md)：衣物所有權。
- [SUPABASE_BASELINE_EXECUTION_MANIFEST.md](SUPABASE_BASELINE_EXECUTION_MANIFEST.md)：schema 檔案與 hash。
- [PRODUCTION_RELEASE_CHECKLIST.md](PRODUCTION_RELEASE_CHECKLIST.md)：尚未完成的 Production gate。

Development schema 001–027 含 demo 專用項目，不能直接套用到 Production。既有 audit／QA 文件保留過去工作路徑與歷史數字，供來源追溯；目前開發根目錄是你 clone 的倉庫根目錄。
