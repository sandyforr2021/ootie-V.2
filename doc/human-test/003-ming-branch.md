# OOTie 人工驗收指南：legacy/ming 功能整合 (Supabase 認證、Guest-First UX 與 AI 穿搭助手 / 虛擬試穿)

> **文件版本**：1.0.0  
> **建立日期**：2026-09-26  
> **測試對象**：`legacy/ming` 分支（Supabase 認證、Guest-First 體驗、AI Style Assistant、Virtual Try-On 虛擬試穿）重構至 Vue 3 + Pinia + Supabase 專案之功能驗收  
> **技術棧**：Vue 3 + Pinia + Vue Router + Vite + Supabase  

---

## 🛠️ 1. 準備工作 (Prerequisites)

在進行人工驗收之前，請確保本地環境已配置好 `.env` 並啟動開發伺服器。

```bash
# 1. 確認 .env 檔案只有公開的 Supabase client 設定與 Gateway URL；不得放入 AI Provider 機密
# VITE_SUPABASE_URL=https://tmegwwbmnwzgnbgadxwp.supabase.co
# VITE_SUPABASE_ANON_KEY=sb_publishable_TLCDkQkINOK9hBQE5h01-g_NuaQO7Fe
# VITE_OOTIE_AI_GATEWAY_URL=https://gateway.example.invalid

# 2. 安裝套件（若尚未安裝）
npm install

# 3. 啟動 Vite 本機開發伺服器
npm run dev
```

啟動完成後，開啟瀏覽器瀏覽 `http://localhost:5173/`。

---

## 📋 2. 人工驗收項目與操作步驟

### 驗收項目 1：Guest-First UX 與 Auth Modal 登入 / 註冊流程

- **測試目標**：驗證未登入訪客可瀏覽公開頁面，當執行私有操作時即時彈出 Auth Modal。
- **操作步驟**：
  1. 以未登入狀態（訪客身份）開啟網站，瀏覽「首頁」、「探索」與「穿搭求救」。
  2. 點擊頂部導覽列右側的 **「登入 / 註冊」** 按鈕，開啟 Auth Modal。
  3. 測試切換 **「登入」** 與 **「註冊」** 頁籤。
  4. 在「註冊」頁籤輸入全名、Email 與密碼送出；或在「登入」頁籤輸入 Email 與密碼送出。
  5. 登入成功後，觀察頂部導覽列顯示個人頭像與「登出」按鈕。
  6. 點擊「登出」，驗證系統還原為訪客狀態。
- **預期結果**：
  - 未登入時所有公開頁面皆可順暢瀏覽。
  - Auth Modal 切換流暢，錯誤訊息（如密碼過短或帳號錯誤）精準呈現。
  - 登入/註冊成功後即時更新 Session，頂部顯示使用者大頭貼與登出選項。

---

### 驗收項目 2：Supabase 資料表與個人資料/衣櫥單品同步 (`profiles` & `items`)

- **測試目標**：驗證 Supabase 服務模組與 `profiles`、`items` 資料表的 CRUD 操作與本機備援機制。
- **操作步驟**：
  1. 進入 `/profile` 頁面點擊「編輯個人資料」，修改暱稱與簡介後儲存。
  2. 進入 `/closet` 頁面點擊「＋ 新增單品」，新增件衣服並選擇類別、品牌與照片。
  3. 開啟瀏覽器開發者工具的 Network / Console，觀察 Supabase REST API 請求。
- **預期結果**：
  - 個人資料更新後，異步同步至 Supabase `profiles` 資料表。
  - 新增單品後，異步寫入 Supabase `items` 資料表。
  - 網路異常時具備 LocalStorage Fallback，不干擾使用者操作體驗。

---

### 驗收項目 3：AI Style Assistant (穿搭助手) 功能

- **測試目標**：驗證基於場合、天氣、風格與單品數量的智慧穿搭提案生成。
- **操作步驟**：
  1. 點擊側邊欄 **「✨ AI 助手」** 進入 `/ai` 頁面。
  2. 選擇場合（例如：`約會`）、天氣（`晴朗舒適`）與風格（`極簡俐落`）。
  3. 調整單品數量滑桿（2 ~ 5 件）。
  4. 點擊 **「產生 AI 穿搭提案」**。
  5. 觀察 AI 智慧契合度評分、建議卡片與選用單品列表。
  6. 檢視頁面下方的 **「歷史生成紀錄」**，驗證紀錄已儲存至 LocalStorage。
- **預期結果**：
  - 點擊生成後出現讀取動畫與智慧分析提示。
  - 產生出高契合度穿搭提案卡片，圖像與說明完整呈現。
  - 生成紀錄即時寫入歷史選單，且支援一鍵清空歷史。

---

### 驗收項目 4：Virtual Try-On (AI 虛擬試穿) 功能

- **測試目標**：驗證結合模特兒與衣櫥單品的虛擬試穿效果模擬。
- **操作步驟**：
  1. 點擊側邊欄 **「🪞 虛擬試穿」** 進入 `/tryon` 頁面。
  2. 選擇模特兒身型（如：`優雅俐落模特兒`）。
  3. 在衣物單品勾選區，挑選 1~2 件衣服單品。
  4. 選擇氛圍風格（`約會` 或 `輕鬆`）。
  5. 點擊 **「開始 AI 試穿預覽」**。
  6. 若為未登入狀態，系統會先觸發 Auth Modal；登入後即開始渲染試穿圖。
  7. 生成後點擊 **「💾 儲存試穿結果」** 或 **「📷 發布至 OOTD」**。
- **預期結果**：
  - 具備 Guest-First UX Guard，試穿需要登入驗證。
  - 試穿結果即時呈現視覺圖片、標籤與組合單品。
  - 「儲存試穿結果」會更新歷史畫廊；「發布至 OOTD」會自動帶入發文彈窗。

---

## 🤖 3. 自動化測試與編譯對照

本專案已完成全套自動化單元測試與 Vite Bundle 編譯：

```bash
# 執行單元測試
npm test

# 執行生產環境編譯
npm run build
```

### 驗收對照指標：
- **Unit Test 通過率**：`7 / 7` 測試檔案（100% PASS）、`31 / 31` 測試案例（100% PASS）
- **Vite Build 結果**：`✓ built in ~750ms`（0 Syntax/Lint Errors）

---

## 📝 4. 人工驗收檢核表 (Checklist)

| 驗收功能模組 | 人工測試結果 | 測試人員簽核 | 備註 |
|---|---|---|---|
| 訪客模式公開頁面瀏覽 (Guest-First Browsing) | [ ] PASS / [ ] FAIL | | |
| Auth Modal 登入/註冊頁籤切換與表單驗證 | [ ] PASS / [ ] FAIL | | |
| 登入後 Session 同步與頂部大頭貼/登出切換 | [ ] PASS / [ ] FAIL | | |
| Supabase `profiles` & `items` 資料表與 RLS 讀寫 | [ ] PASS / [ ] FAIL | | |
| AI 穿搭助手需求篩選 (場合/天氣/風格/數量) | [ ] PASS / [ ] FAIL | | |
| AI 穿搭提案生成與歷史紀錄 (LocalStorage) | [ ] PASS / [ ] FAIL | [ ] PASS / [ ] FAIL | |
| AI 虛擬試穿 (模特兒/單品選取/氛圍選擇) | [ ] PASS / [ ] FAIL | | |
| 虛擬試穿 Guest Guard & 儲存畫廊 / OOTD 轉發 | [ ] PASS / [ ] FAIL | | |
