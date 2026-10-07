# SUPABASE-MIGRATION-06｜Personal Security Follow-up

此文件記錄個人 baseline 保留的團隊現況與後續建議。SQL 沒有套用這些建議，也沒有改動遠端 Auth／Storage／RLS；下列是本機 issue 候選，沒有建立外部 issue。來源：兩份 Team CSV、正式 src 與 baseline 的 EVIDENCE_MAP。

| 優先序／項目 | 已確認現況 | 後續建議與驗收方向（本次不執行） |
| --- | --- | --- |
| P0 SEC-001：內容資料隔離 | 9 張 OOTIE 表只有 bookmarks 開 RLS；其餘 8 張關閉。SELECT true policy 在關閉時不起作用；表 grants 未匯出 | 在真實個人資料進入之前審查表／schema grants 與隔離需求；另行授權後設計匿名／本人／另一位使用者讀寫矩陣。不能把成功建表等同安全隔離 |
| P0 SEC-002：Storage 寫入所有權 | bucket public；INSERT／UPDATE／DELETE 只檢查 bucket 與 authenticated，未驗證資料夾或物件 owner；前端 upload upsert=true | 後續決定是否限制 bookmarks/<本人 UUID>/ 路徑、owner 與覆寫／刪除權限，測試跨帳號物件存取；baseline 先保留來源條件 |
| P0 SEC-003：policy 組合語意 | 07B 補充匯出逐筆證實 20 個 policies 都是 PERMISSIVE；011／012 已按證據寫入 | 執行前仍需審查 permissive 政策的組合效果，尤其 bookmarks 雙套條件與 Storage 寬鬆寫入；本 baseline 忠實保留來源 |
| P1 SEC-004：Stats 資料範圍 | get_brand_stats／get_disused_items 無 owner filter，衣物表 RLS 關閉；5 個 OOTIE functions 都有 PUBLIC／anon EXECUTE 記錄 | 審查底層表 ACL 與匿名暴露，再另行決定 owner 篩選／授權；函式 EXECUTE 本身不證明底層一定可讀 |
| P1 SEC-005：Auth/profile 身分 | AUTH-IDENTITY-09 已在本機 002 定義 `user_id NOT NULL UNIQUE` 與 Auth FK，010 定義 prospective trigger；尚未執行，前端仍有 mock fallback | 依 `AUTH_IDENTITY_MODEL.md` 完成 runtime resolver、PROFILE_MISSING/error states 與 trigger precheck；Account Deletion Lifecycle 另案，不把 Auth ID 當 profile PK |
| P1 SEC-006：bookmark 雙套 policy | 一套用 profile.user_id 查 profile.id，另一套直接比 auth.uid()=owner_id；八個 policy 都是 PERMISSIVE。UNIQUE 已在新 002 解決 scalar 多列風險，但直接比較仍是錯誤 identity space | 依 `AUTH_RLS_FOLLOWUP.md` 另批重寫並測試；本次不改 011，也沒有採用舊 migration 的 OR 合併 |
| P1 SEC-007：UUID defaults | 多個 nullable FK 欄 default gen_random_uuid()，省略 owner/user 等欄可能產生無對應父列的 UUID；SOS picked_suggestion_id 是隨機 UUID 且無 FK | 後續逐一檢查 payload 與預設值，不以插入假父列或固定 mock ID 避開問題；任何 schema 修正另作 migration 決策 |
| P1 SEC-008：function／平台權限 | 五個 functions 為 invoker，函式 config NULL；owner、有效 caller search_path、表/schema grants、default ACL 未提供 | 執行前先確認個人平台角色和權限，再作授權最小化審查；baseline 不猜 OWNER／REVOKE、不建立角色或使用 key |
| P2 SEC-009：public 圖片與限制 | bucket public=true，file_size_limit=NULL，allowed_mime_types=NULL；平台全域限制 UNKNOWN | 後續決定公開圖片適用範圍、檔案格式／容量與清理策略；baseline 不虛構上傳限制或擅改 public 設定 |

get_disused_items 的 bigint／integer 回傳差異和缺失 RPC 屬功能契約問題，列於 FRONTEND_SCHEMA_CONFLICTS.md。以上建議不改變目前 baseline 的保真範圍；實際執行前必須明確知道哪些風險被保留，前端有 mock fallback 也不構成授權隔離。
