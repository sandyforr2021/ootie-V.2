# Real User Media Safety

## Supported input

| Format | Behavior |
| --- | --- |
| JPEG | Supported; byte signature, size and decoded pixels are validated |
| PNG | Supported; byte signature, size and decoded pixels are validated |
| WebP | Supported; RIFF/WEBP signature, size and decoded pixels are validated |
| HEIC / HEIF | Detected and rejected with a truthful conversion message; no unreliable or heavy browser converter is bundled |
| SVG / malformed files | Rejected |

Source limit: 20 MB. A decoded image below 128 × 128 is blocking. A short edge below 720 px or long edge below 1000 px is a warning.

## Quality checks

The browser performs low-cost heuristics on a maximum 320 px analysis canvas:

- average luminance for dark images;
- bright-pixel ratio for heavily overexposed images;
- luminance Laplacian variance for obvious blur risk;
- a conservative edge/background difference for possible clipped-garment risk;
- decoded dimensions for resolution.

These are suggestions, not AI classification. Except for malformed, unsupported, oversized or technically unusable files, the user can keep the original framing and continue. The interface separately asks the user to confirm that one main garment is present; it does not claim to detect item count.

## Preprocessing

- `createImageBitmap(..., { imageOrientation: 'from-image' })` normalizes EXIF orientation where supported.
- The longest display edge is at most 2048 px.
- The preferred derivative is WebP at quality 0.88; JPEG quality 0.90 is the browser fallback.
- Originals larger than 6 MB use a lazy-loaded resumable uploader. This keeps the normal initial bundle free of the upload client and provides measured byte progress, finite retry and cancellation for less reliable mobile networks.
- No crop, auto white balance, contrast filter or style preset is applied.
- The original `File` is uploaded unchanged and remains private. The derivative is for normal UI display and future explicitly requested features.
- The browser uses `Blob`, `File` and short-lived Object URLs. It does not keep multiple full-resolution Base64 copies in application state. Object URLs are revoked on replacement, close and component teardown.

## Privacy and trust

- Uploading a closet photo never publishes it.
- Original and derivative closet images remain in a private bucket with owner-path RLS.
- A processed derivative does not make a private original, person photo or AI result public.
- Public OOTD continues to use its separate public snapshot model. Public tagged-item queries do not mint private closet-media signed URLs.
- “整理背景” is shown as unavailable. No paid service is called and the product does not pretend that removal completed.

## Failure behavior

- Offline or Storage errors show a recoverable message; no silent success is shown.
- A DB failure after upload triggers operation-scoped Storage compensation.
- A replacement failure leaves the previous image and DB reference intact.
- Duplicate submit is blocked.
- No automatic background regeneration, image AI request or paid provider call occurs.

