# SUPABASE-CLOTHING-OWNERSHIP-11｜Execution Gate

**目前判定：`003_READY_NEW`（2026-09-28，本機審查通過；003 尚未執行）。** 001 與 002 的 PASS 來自使用者人工回報。舊 `003_READY` 已作廢。這不是 004–012 的執行授權。

本階段沒有連線任何 Supabase、執行 SQL、重跑 001／002、修改遠端 Auth／Storage／Database，或啟動前端寫入測試。

## Current gate

| Gate | Result | Evidence / boundary |
| --- | --- | --- |
| Target identity | **PASS for reported 001/002; RECHECK REQUIRED before 003** | 每次真正執行前仍須在介面人工確認 `OOTIE-sandy-dev`；禁止 Team Supabase 與其他 Project |
| 001 extensions | **PASS（使用者回報）** | 不得重跑 |
| 002 profiles | **PASS（使用者回報）** | 12 欄；`user_id uuid NOT NULL`、無 default、UNIQUE、FK → `auth.users(id) NO ACTION`、零 seed |
| 003 table collision | **PASS from prior inventory / BEFORE RECHECK REQUIRED** | 先前 OOTIE table inventory 為 0 rows；執行前仍要跑新版 preflight 的精確唯讀名稱檢查 |
| 003 ownership definition | **LOCAL STATIC PASS** | `owner_id uuid NOT NULL`、無 default、FK → `public.ootie_profiles(id) ON DELETE NO ACTION`；無直接 Auth FK |
| 003 evidence handling | **PASS** | 團隊原始 nullable + random default 保留為 evidence；新版只將 ownership 決策標為 `PERSONAL_FIX` |
| 003 destructive review | **PASS** | 可執行 SQL 無 DROP／DELETE／TRUNCATE／UPDATE／INSERT／ALTER／CASCADE／REPLACE；只建立一張 OOTIE table |
| 003 hash lock | **PASS** | manifest 與 preflight 使用新 hash；舊 hash明確失效 |
| Backup gate | **PASS（前階段結果）** | database logical backup 已驗證；Storage file bytes 另屬不同範圍 |
| Migration source | **PASS** | `supabase/personal_baseline/001–012` 是唯一來源；`supabase/migrations/` 排除 |
| 004–012 | **NOT AUTHORIZED** | 本次只處理 003；後續仍需各自 preflight |

## 003 source lock

- Allowed source: `supabase/personal_baseline/003_ootie_clothing_items.sql`
- Current SHA-256: `C9E8C0A7C435FABF15F23159304F9B6D23147A5ED8E0635CF0A03668D829C170`
- Invalidated SHA-256: `39F294B4D2FB80691D6F18A4AFEAA3D2D03C0FDE0B9361430101DA38314CDB33`

The invalidated version must never be executed because it permitted missing ownership and generated an unrelated random profile identifier.

## Required execution sequence for 003

1. Manually confirm the visible target is `OOTIE-sandy-dev`.
2. Do not rerun 001 or 002.
3. Run only section A of `003_OOTIE_PREFLIGHT.md`; require exactly `8/8 true`.
4. Recompute the source SHA-256 and require an exact match with the current hash above.
5. If separately authorized, execute only the complete 003 source file as one transaction.
6. Run every section C AFTER CHECK and require all success criteria.
7. If any error, mismatch, unexpected object, or uncertain commit occurs, stop. Preserve the log and do not run 004.

## Identity and frontend contract gate

The canonical chain is:

`auth.users.id -> ootie_profiles.user_id -> ootie_profiles.id -> ootie_clothing_items.owner_id`

Any future clothing create path must resolve `session.user.id` to `ootie_profiles.id`, pass that value explicitly as `owner_id`, and return `PROFILE_MISSING` without an insert when no profile exists. Random, fixed mock, and fallback owners are prohibited. See `CLOTHING_OWNERSHIP_CONTRACT.md`.

## Remaining scope after this gate

- The current frontend has not been modified or write-tested against this contract.
- Follow-up field and RPC questions are recorded in `CLOTHING_SCHEMA_FOLLOWUP.md`; they do not block creation of 003.
- 010's function/Auth-trigger collision check remains a future gate before 010 and does not block 003.
- Full baseline completion remains pending because 003–012 are not yet reported PASS.

Final next-file decision: **`003_READY_NEW`**. Actual execution remains prohibited until the user starts a separate authorized execution step.
