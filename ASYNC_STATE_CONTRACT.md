# OOTIE Frontend Async State Contract

## Purpose

OOTIE UI must describe what actually happened. A local mutation is not proof that a remote write succeeded, and a fallback result is not a synced result.

The executable contract lives in `src/contracts/asyncState.js`. Service failures use `src/services/serviceError.js`.

## Request states

| State | Meaning | UI behavior |
|---|---|---|
| `idle` | No request has started | Default controls; no success or error claim |
| `loading` | Initial remote read is pending | Loading indicator; prevent duplicate request where appropriate |
| `success` | Operation produced usable data | Success language is allowed only when `syncStatus=SYNCED` for remote writes |
| `empty` | Authoritative read succeeded with no records | Purpose-built empty state; never use an error message |
| `error` | Request failed | Error state with safe message and retry when allowed |
| `denied` | Auth/RLS/permission rejected the operation | No-permission message; do not retry invisibly |
| `syncing` | Local change exists and a remote write is pending | Show pending/syncing state; do not say saved or synced |

## Persistence states

| State | Meaning | Allowed toast |
|---|---|---|
| `SYNCED` | Authoritative remote write succeeded | `success` |
| `LOCAL_ONLY` | Intentionally stored only on this device | `info` or `warning`, with explicit local-only copy |
| `UNSYNCED` | Local change exists; remote outcome is still pending | `info` or `warning`; never `success` |
| `REMOTE_FAILED` | Local change exists but the remote write failed | `warning` or `error`, with explicit unsynced copy |

`canUseSuccessToast(state)` returns true only for `success`/`empty` plus `SYNCED`.

## Copy rules

When remote persistence failed, forbidden wording includes:

- Saved / 已儲存
- Success / 成功
- Synced / 已同步
- Uploaded / 已上傳
- Published / 已發布

unless the message explicitly limits the claim to this device, for example:

- 「已保存在此裝置，但遠端同步失敗」
- 「已從此裝置移除，遠端資料可能仍存在」

## Error codes

UI consumes stable service codes, not raw Supabase messages:

- `AUTH_REQUIRED`
- `PROFILE_MISSING`
- `NOT_FOUND`
- `PERMISSION_DENIED`
- `VALIDATION_ERROR`
- `DUPLICATE`
- `NETWORK_ERROR`
- `REMOTE_WRITE_FAILED`
- `UNKNOWN`

`normalizeServiceError()` maps a raw provider error to `ServiceError`; `getServiceErrorMessage()` returns approved user-facing copy. Raw policy names, SQL details, tokens, URLs, stack traces, and provider payloads must not be rendered to the UI.

## Identity states

The frontend-only resolver in `src/services/identityResolver.js` defines:

- `UNAUTHENTICATED`
- `PROFILE_LOADING`
- `PROFILE_READY`
- `PROFILE_MISSING`
- `PROFILE_QUERY_ERROR`

Its lookup is injected. The module has no Supabase table name or remote query dependency. After the separate Supabase workstream approves the identity migration, the injected adapter must implement:

`session.user.id → ootie_profiles.user_id → ootie_profiles.id`

The resolver never creates, substitutes, or falls back to `user-01`, `profile-01`, or a random ID.

## Current migration boundary

BATCH-01 applies truthful toast outcomes to the main existing local/remote mutation paths and prevents non-UUID fixture identities from reaching private remote writes. Legacy demo data may still contain fixture IDs in local state; those IDs are not an authentication or remote ownership fallback. Full repository replacement of legacy data sources remains a later, schema-dependent batch.

Shared `BaseModal` is used by Auth and the SOS confirm flow. Remaining legacy modals use the registered `v-accessible-modal` migration bridge, which supplies dialog semantics, initial focus, Escape close, focus trapping, and focus restoration until their templates are migrated to `BaseModal`.
