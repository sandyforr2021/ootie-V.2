# Evidence-Based Personal Baseline Implementation Plan

> **AUTH-IDENTITY-09 supersession（2026-09-28）：**本檔以下 MIGRATION-06／07B 內容保留為歷史計畫；其中「不建 Auth trigger」與 21 constraints 已由使用者最新 identity 指令取代。現行定義以 `AUTH_IDENTITY_MODEL.md`、002／010、execution manifest 與 gate 為準。

> 執行方式：依使用者 MIGRATION-06 指示在本 chat 完成本機 SQL、文件與靜態核對。沿用 writing-plans 的工作拆分與 executing-plans 的逐項記錄；ZIP 個人副本不建立 Git branch／worktree，不執行資料庫操作。

**Goal:** 只重建兩份 CSV 證實的 OOTIE 結構，保留 UNKNOWN 與已知前端缺口。

**Architecture:** `supabase/personal_baseline/` 與既有 CLI migration 隔離。12 個 SQL 檔依 FK／function／trigger／policy 依賴排序。07B 的補充 CSV 已證實 20 個 policy 均為 PERMISSIVE，011／012 已改成明確 SQL；個人 baseline 不重建未被證實的 Auth trigger、views 或 RPC。

**Tech Stack:** PostgreSQL SQL／PL/pgSQL 草案、Python 標準庫離線 CSV 比對、Markdown 文件。

**Spec:** 本 chat 的 SUPABASE-MIGRATION-06；Team CSV 為第一手證據，SCHEMA-04／05 文件為解讀輔助。

## Global Constraints

- 只產生本機 SQL 與文件；禁止 SQL／migration 執行、任何 Supabase 連線及前端啟動。
- 不讀取 `.env`／legacy secret、不使用 Secret 或 service_role credential。
- 內容 FK 保留 `ootie_profiles.id`；不建 mock 固定 ID，不自行建立 `profiles`／`items`。
- 歷史決策（已作廢）：`AUTH_PROFILE_CREATION = UNCONFIRMED`；AUTH-IDENTITY-09 現已明確授權 prospective Auth trigger。
- 缺失的兩個 RPC 標記 `FRONTEND_DEPENDENCY_MISSING`，不從 legacy 補入。
- 不重設計 RLS；未知欄位或 metadata 以 TODO / UNKNOWN 保留。

## Review Focus

- 欄位／default／FK 名稱是否逐項有 CSV 證據；陣列元素型別以 default cast 為證。
- 9 個 PK 自帶索引是否被重複建立；舊 bookmark SQL 是否混入本 baseline。
- 函式 DDL 是否改變原始邏輯，尤其 `get_disused_items` bigint／integer 差異。
- Policy 是否暗中假設未知 mode，或讓缺值時仍提交部分 policy／bucket 變更。
- 停止執行的限制與未知項是否在交付文件中清楚可見。

## Tasks

- [x] 1. 從 CSV 產生 001–008：prerequisites、9 張表、96 欄、21 constraints、3 個額外 indexes；檢查 FK 順序與 PK index 去重。
- [x] 2. 產生 009–012：5 functions、25 grants、2 triggers、RLS 狀態、20 policies 的已知定義與 mode gate、1 bucket；檢查依賴與來源一致性。
- [x] 3. 建立 README、EVIDENCE_MAP、前端衝突與安全後續文件；列出所有正式 `profiles`／`items` 呼叫及缺失 RPC。
- [x] 4. 本機靜態驗證：結構／語法檢查範圍、CSV parity、依賴、重複物件、舊檔衝突與來源未改動；輸出實際驗證結果。

## Decisions

- 採用 `supabase/personal_baseline/`，不放進既有 `migrations/`；使用者允許其他明確隔離目錄。
- 不建立缺乏 namespace 證據的 extension；001 記錄團隊清單，提供未來執行時的必要函式／語言／平台前置檢查。
- 06 階段 policy mode 未提供時保留中止區塊；07B 取得 20 筆精確證據後移除此區塊並寫入 `AS PERMISSIVE`。交易仍是每檔獨立，跨檔失敗沒有自動整體回滾。
- 可進入執行前安全檢查不代表可立即執行 migration；語法解析與伺服器語意驗證會分開報告。
