# 小組協作

這是 sandyforr2021-debug 帳號下的 OOTIE Personal 私人倉庫。小組成員接受協作者邀請後，可 clone、建立分支並提交 Pull Request。

## 第一次使用

1. 確認邀請來自 `sandyforr2021-debug/OOTIE-Personal`。
2. 依 README 安裝前端與 Gateway 依賴。
3. 複製 `.env.example` 為自己的 `.env.local`，由擁有者另行提供前端 publishable 設定。
4. 在此倉庫的 clone 根目錄開發與測試。

## 每次修改

```powershell
git switch main
git pull --ff-only
git switch -c codex/your-change
```

提交前跑與修改相關的測試；介面修改檢查桌機與手機。Pull Request 說明問題、行為變更、驗證結果及限制，讓小組檢查後再合併。

本倉庫目前未設定 GitHub 自動部署，也未宣稱已啟用分支保護。合併與部署由專案擁有者依實際設定管理。

## 程式碼與雲端權限

- GitHub 協作者權限只授權此倉庫的程式碼存取。
- 使用 Development 網站依網站自己的 Auth／RLS 規則登入。
- 管理 Supabase 或 Google Cloud 必須另外由擁有者授權；不要分享擁有者密碼或 service-role key 代替邀請。
- 遠端資料操作、migration、seed reset、部署、付費 AI smoke 都應先確認目標、範圍與授權；本機測試不包含這些操作。

## 不提交的內容

`.env`、`.env.local`、測試帳密、`gateway/cloudrun.env.yaml`、私鑰、service-account JSON、資料備份、會員照片、執行紀錄、`node_modules` 與 `dist`。

公開展示素材與必要的 schema metadata 已包含在初始快照；真人會員私有 Storage 圖片及資料庫內容沒有匯出。

## 初始快照來源

2026-10-07 從既有 OOTIE-main 工作資料夾建立乾淨快照，保留目前應用程式原始碼及必要測試文件。歷史架構圖與 QA 文件仍保留當時狀態，不證明目前雲端版本與每次新 commit 完全一致。既有團隊程式的貢獻與來源應保留。
