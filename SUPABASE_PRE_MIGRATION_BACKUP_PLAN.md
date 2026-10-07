# SUPABASE-PREFLIGHT-07D｜Pre-Migration Backup & Recovery Plan

**PLAN ONLY：本階段沒有連線、備份、還原或執行 SQL。** 本計畫的唯一目標是個人 Project **OOTIE-sandy-dev**；不得讀取、備份或還原團隊 Supabase 或任何其他 Project。

## 需保留的現有個人內容

OOTIE-sandy-dev 並非保證全新。首次執行 baseline 前，應把**整個個人 Project 的既有狀態**視為需保留，而非只備份 OOTIE 表。至少涵蓋：既有非 OOTIE schema／tables 與資料、views、functions、triggers、constraints、indexes、RLS 設定及 policies、grants／角色設定、extension 清單、migration history、Auth 使用者與設定（若有）、Storage bucket metadata／policies／object metadata，以及實際檔案 bytes（若有）。哪些平台管理項目可匯出或還原，必須由所選備份方式的覆蓋清單確認；不能因資料庫 dump 存在就推定 Storage 檔案 bytes 已備份。

## 正式執行前的備份步驟

1. **鎖定來源身分。** 在備份介面／資料庫連線設定上人工核對 Project 名稱為 OOTIE-sandy-dev，並再核對它與前端個人 `.env` 的 Project 身分一致；不得顯示或把 URL、完整 Project Ref、密碼、key 寫進文件／log。若身分不明或指向團隊，立即停止。
2. **記錄當下狀態。** 以個人 Project 的唯讀 inventory 保存既有 schemas、表／資料量摘要、函式、policy、bucket／object 數量、migration history 與必要設定。紀錄只含結構與計數，不保存業務資料列在報告中。確認沒有與 001–012 相關的意外既有物件。
3. **取得可恢復的備份。** 優先選擇可確認範圍與還原方法的個人 Project 快照／備份；若該方式無法涵蓋全部需保留內容，補足經授權的 schema+data dump，並對 Storage 實際檔案 bytes、設定及任何未被 DB dump 涵蓋的項目做獨立備份。只使用經確認的個人 Project 管理連線；不使用團隊連線或 service_role／secret key。
4. **保護與驗證備份。** 備份存於專案工作樹和 Git 之外、受限且加密的位置。記錄備份時間、來源 Project 名稱、涵蓋範圍、檔案大小、SHA-256、保存位置及可用的還原步驟；不要在 log 中保留 credential。檢查備份完整性，並以隔離的個人測試環境做還原演練，或取得備份服務可恢復的明確驗證。使用者已回報 001 PASS；若無法證明目前備份可恢復，**不得開始下一個尚未執行的 002**。
5. **凍結變更窗口。** 在 001–012 期間避免其他程式或人員對個人 Project 寫入；否則整庫還原可能覆蓋這些新變更。記錄備份與執行開始之間的任何變更；若出現新變更，重新評估備份有效性。

## 逐檔失敗與 transaction 判定

每檔含自己的 `BEGIN`／`COMMIT`，**12 檔不是單一原子 transaction**。採 [唯一執行清單](SUPABASE_BASELINE_EXECUTION_MANIFEST.md) 的順序：每一檔成功、確認 commit、唯讀 postcheck 通過後才開始下一檔。

- 任一 SQL 錯誤、超時、連線中斷、postcheck 不符或 Project 身分疑義：**立即停止**；不自動繼續後續 migration，不直接重跑失敗檔，不執行推測性的 DROP／修補。
- 保存該檔完整錯誤與時間、檔名／雜湊、已成功檔案清單、最後可確認的 commit 與 postcheck；log 去除 URL、完整 ref、密碼、key 及業務資料列。
- **不可只憑錯誤訊息推定 rollback。** 對失敗檔以唯讀 catalog／migration ledger／目標設定檢查其預期物件是否存在，以及 transaction commit 是否有明確成功紀錄。若 COMMIT 結果不明，標記為「狀態不明」並暫停所有後續操作。
- 前面已 commit 的檔案不會因後面失敗而自動回滾。保留現場及備份；由人員比較備份、執行 log 與現況，再決定在**個人 Project** 做已審核的修復或從已驗證的備份還原。若還原會影響其他既有非 OOTIE 內容，先評估變更窗口內的差異並取得明確操作決策。

## Log／證據保存格式

每檔留一筆：執行序號、來源檔名、SHA-256、開始／結束時間、Project 名稱（僅名稱）、操作人、執行結果、commit 確認、唯讀 postcheck、錯誤摘要及 log／備份位置。將 log 與備份保存在受限個人位置，不加入 repository。結束後核對 001–012 的清單與順序；未經審核不得把舊 bookmark migration 補跑。

**執行前必須實際完成並驗證備份。** 此文件只使備份與失敗處置方式可審查，不表示備份已建立、還原已演練或 migration 已獲執行授權。
