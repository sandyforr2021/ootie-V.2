# OOTIE Clothing Media Upload Lifecycle

Scope: `OOTIE-personal-dev` and the Development Preview. Production is not configured by this document.

## Storage and database contract

- Bucket: `ootie-closet-media` (private).
- Path: `closet/{auth_user_id}/{clothing_item_id}/{operation_id}/original.ext` and `display.webp` (JPEG fallback only when WebP encoding is unavailable).
- Browser authentication uses the member JWT and Storage RLS. No service-role key is present in the browser.
- `ootie_clothing_items.photo_*` columns store private object paths and media metadata. The legacy `photo` URL remains for existing Development seed assets.
- Private display images are fetched through the authenticated Storage client and rendered as revocable browser Object URLs. Logout revokes the URLs instead of leaving a signed bearer URL alive.

## Create

1. Validate MIME from file bytes, size and decoded dimensions.
2. Decode with EXIF orientation handling and run low-cost quality heuristics.
3. Keep the selected `File` as the original and create one display derivative in memory.
4. Upload the original to a unique path. Files up to 6 MB use the standard Storage upload; larger originals use Supabase resumable TUS upload with 6 MB chunks, three finite attempts and real byte progress.
5. Upload the derivative with `upsert: false`.
6. Download the derivative through the authenticated private-bucket path to verify readability.
7. Insert the clothing row with its pre-generated item ID and media metadata.
8. If any Storage step or the DB insert fails, remove only the objects created by that operation. The form and selected derivative remain available for retry.

## Replace

1. Upload and verify a new unique media operation.
2. Update the owner-scoped clothing row.
3. Only after the DB update succeeds, remove the old display derivative.
4. Preserve the old original while the clothing item exists. This keeps an owner-recoverable source history and avoids destructive replacement.
5. If the DB update fails, delete the new operation and keep the old working image/reference.

## Delete

- A database trigger rejects deletion while the item is referenced by an OOTD, SOS post or SOS suggestion.
- For an unreferenced item, the owner-scoped DB delete happens first. This prevents media loss when the row cannot be deleted.
- After DB success, the client removes only expected `original.*` and `display.*` objects below that exact owner/item prefix.
- If best-effort Storage cleanup fails, the item remains deleted and the dry-run orphan audit reports the leftover objects.

## Cancellation and retry

- Re-selecting a file invalidates the prior preprocessing task and releases its Object URL.
- Submit is disabled while active to prevent duplicate DB/Storage operations.
- “取消上傳” sets an application cancellation flag. For a large TUS upload it also aborts the active transfer; the lifecycle checks cancellation between every remaining remote step and compensates completed objects before returning.
- A failed save preserves the form fields and selected in-memory derivative for a deliberate retry. Large uploads use only the finite retry delays `[0, 3000, 5000]`; there is no unlimited retry.

## Orphan audit

`npm run audit:orphan-media` is dry-run by default. It only traverses the private OOTIE bucket and the expected `closet/{user}/{item}/{operation}` path shape.

Deletion requires both:

```powershell
$env:OOTIE_MEDIA_CLEANUP_CONFIRM='DELETE_ORPHANS'
npm run audit:orphan-media -- --delete
```

The minimum age is seven days by default and can never be set below 24 hours. Historical original files remain protected while their item still exists. The script requires server-side `SUPABASE_SERVICE_ROLE_KEY`; that key must never be exposed as `VITE_*` or shipped to the browser.

