# SUPABASE-PREFLIGHT-07C｜Target Collision Report

**OOTIE TABLE COLLISION = NONE。SAFE_TO_CREATE = YES（僅限本報告的 table 名稱）。**

本次唯一使用的個人 target inventory 為專案根目錄的 `PERSONAL_OOTIE_TARGET_INVENTORY.txt`。檔案原有重複的 `.txt` 副檔名；本階段僅在同一資料夾將其改為指定檔名，內容未改。SHA-256：`930F46E7CA6E94EEE54CA0C1D1A5456EF24E42C851C3997099A621A4AD94F1B8`。未讀取舊 inventory，也未連線任何 Supabase。

## 來源及查詢範圍

TXT 記載 `Project: OOTIE-sandy-dev`，並載明使用者已在 Dashboard 人工確認該 Project。查詢範圍為 `public` table：名稱符合 `ootie_%` 或等於 `profiles`／`items`。結果區塊明確寫為 `Result:` 接著 `0 rows`。這是使用者提供的唯讀匯出及人工 Project 確認；本階段沒有獨立連線驗證。

## 逐項碰撞判定

| Public table name | 指定 inventory 結果 | 07C 判定 |
| --- | --- | --- |
| `ootie_profiles` | 0 rows | `SAFE_TO_CREATE` |
| `ootie_clothing_items` | 0 rows | `SAFE_TO_CREATE` |
| `ootie_ootd_posts` | 0 rows | `SAFE_TO_CREATE` |
| `ootie_sos_posts` | 0 rows | `SAFE_TO_CREATE` |
| `ootie_outfit_suggestions` | 0 rows | `SAFE_TO_CREATE` |
| `ootie_bookmarks` | 0 rows | `SAFE_TO_CREATE` |
| `ootie_notifications` | 0 rows | `SAFE_TO_CREATE` |
| `ootie_post_likes` | 0 rows | `SAFE_TO_CREATE` |
| `ootie_saved_posts` | 0 rows | `SAFE_TO_CREATE` |
| `profiles` | 0 rows | `NO_COLLISION`（baseline 不建立此表） |
| `items` | 0 rows | `NO_COLLISION`（baseline 不建立此表） |

**範圍限制：**`SAFE_TO_CREATE = YES` 只表示指定查詢下，這九個 OOTIE table 名稱在個人 target 沒有同名碰撞；不授權建立 `profiles`／`items`，也不授權刪除、修改或重用 Project 中任何其他物件。此 table-only 查詢沒有盤點 functions、triggers、indexes、policies 或 Storage bucket；它們不能由 `0 rows` 推定不存在。整套 001–012 的執行判定另見 `SUPABASE_EXECUTION_GATE.md`。

## 07D｜Non-table collision 補充

新指定的 `PERSONAL_OOTIE_NON_TABLE_INVENTORY.csv` 在本機為正確檔名（原來多了 `.txt` 副檔名，已在同一資料夾更名且未改內容），SHA-256：`95A81952562753813350AF93FB5D4B4990680DBCF62D1EDADABF09BF13E85BD7`。CSV 只有 `object_type,object_name` 表頭，**0 筆資料列**。由於 CSV 本身沒有查詢篩選式，後續另產生逐一精確比對五個零參數 function signature、四個 `storage.objects` policy 名稱及 bucket ID／name 的**純 SELECT**；使用者在人工確認為 OOTIE-sandy-dev 的 SQL Editor 執行該查詢，回報 **0 rows** 並明確確認這些名稱均被涵蓋。這是使用者提供的唯讀結果及人工 Project 確認，本階段未獨立連線驗證。

| Baseline 類別 | 精確比對的名稱／數量 | 結果列 | 07D 狀態 |
| --- | --- | ---: | --- |
| Functions（009） | `public.get_closet_stats()`、`public.get_brand_stats()`、`public.get_disused_items()`、`public.set_updated_at()`、`public.update_ootie_bookmarks_updated_at()` | 0 | `SAFE_TO_CREATE` |
| Triggers（010） | bookmark 表的 2 個 trigger | 0 | `SAFE_TO_CREATE`：所屬 `ootie_bookmarks` 表目前不存在，不能已有該表上的 trigger |
| Public policies（011） | 九張新 OOTIE 表上的 16 個 policy | 0 | `SAFE_TO_CREATE`：所屬表目前不存在，不能已有其 policy |
| Storage policies（012） | `storage.objects` 上的 4 個 bookmark image policy | 0 | `SAFE_TO_CREATE` |
| Storage bucket（012） | `ootie-bookmarks-images` ID／名稱 | 0 | `SAFE_TO_CREATE` |

**FUNCTION COLLISION = NONE；STORAGE POLICY COLLISION = NONE；STORAGE BUCKET COLLISION = NONE；NON_TABLE_COLLISION = NONE。** 本次精確查詢沒有 `ALREADY_EXISTS` 或 `CONFLICT` 記錄。這是當次查詢時點的名稱碰撞證據，不證明 SQL 權限、執行語意或其他未列名物件；沒有刪除或修改任何現有物件。
