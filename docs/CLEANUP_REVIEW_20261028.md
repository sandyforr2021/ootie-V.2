# 舊檔與資料庫清理清單（2026-10-28）

依使用者要求先列清單。本次沒有刪除帳號、衣物、貼文、點數紀錄或雲端圖片，也沒有刪除本機檔案。

## 已做的部署流程整理

`scripts/build-free-deploy.mjs` 已解除舊的 `runApprovedReleaseActions()` 呼叫。建置不再自動執行 10/25 的單筆公開試穿撤下作業。原腳本 `scripts/release/retract-reviewed-share.mjs` 及其測試仍保留供稽核，不在每次部署執行。

## 本機檔案

| 項目 | 數量／大小 | 判定與建議 |
|---|---:|---|
| `public/images/wardrobe-cutouts/` | 71 檔，約 98.50 MiB | 目前 src／gateway／public 文字檔沒有引用。屬暫停中的圖片整理候選，保留本機，不納入這次發布；不當成已完成素材。 |
| `public/catalog/` | 23 檔，約 9.85 MiB | 目前衣櫥、首頁、統計的去背呈現仍依賴這些檔案及來源紀錄，須發布，不能直接刪。原創替換完成後再連同下方 Maya 舊素材清理。 |
| `.audit-local.json`、`.test-unit-merge.json` | 2 份本機驗證輸出 | 不納入網站或這次 GitHub 提交；若不再需要可列入本機回收清單。 |
| `artifacts/qa/` | 本機驗收截圖 | 不部署、不納入這次 GitHub 提交；可自行留作比對。 |
| `.codex/` | 本機工作輔助資料 | 不部署、不納入提交，不自動刪除。 |
| `public/demo/garments/`、`public/demo/ootd/` | 43 件衣物、36 張穿搭 | 舊資料來源與測試仍有引用；不能只刪圖片。應與舊帳號、貼文、constants 和測試一起做下一次完整移除。 |
| `supabase/personal_baseline/` 及既有 migration | 資料庫基線與歷史 | 不是垃圾檔；驗證使用 SHA-256 與檔名登錄，不刪除或重編版本。 |

本機目前沒有 `/usr/bin/trash`。依目前 AGENTS.md，實際移除本機檔案前須先決定可用的回收方式；這不影響部署與清單盤點。

## 資料庫：內建帳號與社群資料保留

使用者確認總共 16 組設立的內建帳號與資料是正確內容。先前將下列 12 組稱為「舊社群帳號候選」的判斷已撤回。這 12 組及其 **144 件衣物、36 篇 OOTD、12 篇 SOS** 均保留，其他指定內建帳號也不列入清理。按讚、留言、收藏與追蹤關係一併保留。下表僅是數量盤點，不是刪除清單。

| 帳號 | 衣物 | OOTD | SOS |
|---|---:|---:|---:|
| @alex | 9 | 3 | 1 |
| @anya | 5 | 3 | 1 |
| @ella | 10 | 3 | 1 |
| @iris | 10 | 3 | 1 |
| @jules | 10 | 3 | 1 |
| @mika | 10 | 3 | 1 |
| @minji | 10 | 3 | 1 |
| @nora | 8 | 3 | 1 |
| @ootie_style（OOTIE Development Demo） | 43 | 3 | 1 |
| @rachel | 8 | 3 | 1 |
| @sofia | 11 | 3 | 1 |
| @theo | 10 | 3 | 1 |

名稱接近的不同帳號也不是重複資料的證據，例如 @iris／iris。不得根據前綴、名稱、建立日期或資料量擅自標成舊資料。AI L 等實際使用帳號也保留。

## 仍使用中的舊素材與紀錄

- Maya（jury_maya82）：目前 20 件衣物仍使用 merchant-v 路徑；去背圖已統一呈現，但原創素材替換尚未完成。依先前暫停圖片工作指示，未繼續替換或刪除。
- OOTIE Isolation Test：本次查詢 profile 符合 Isolation 的數量為 0，沒有再執行刪除。
- AI 工作：2 筆 failed／cancelled，0 筆活動或待核對工作，0 筆 result_deleted_at 標記。失敗工作仍可能參與扣點、退點與供應商成本稽核，不建議直接刪帳本／工作。
- Maya 的 +100 評審額度及既有點數流水保留；不是垃圾資料或已收款收入。

## 雲端圖片：僅完成數量盤點

| Bucket | 物件數 |
|---|---:|
| ootie-ai-private | 57 |
| ootie-bookmarks-images | 0 |
| ootie-closet-media | 158 |
| ootie-ootd-images | 406 |
| ootie-profile-avatars | 23 |
| ootie-shop-shares | 1 |

這些數量不是孤兒檔數量。必須對照衣物、人物照、AI 工作、公開分享、大頭貼及 JSON 內嵌路徑後，才能列出可刪的具體物件。尚未做雲端刪除。
