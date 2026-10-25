# Social content update — 2026-10-25

## Product changes

- Home, Explore and Following interleave authors while retaining each author's post order. Repeated copies of an author's image are excluded from these feeds.
- Posts retain their original language. Translate / Show original is available on Home, Explore, post details and comments. Supported reading languages: Traditional Chinese, English, Japanese and Spanish.
- Authors can select the original language when publishing or editing. Legacy text without a known language offers a source-language selector.
- Public profile lookup accepts handles with or without `@`. Missing metrics display an unknown state instead of a misleading zero. Profile posts also support translation.
- Ten existing third-look posts received distinct revised images, matching captions and updated garment tags. Removed outerwear tags no longer appear on those posts. Original post IDs, comments and likes were preserved.

## Scoped content import

The 16 controlled character accounts now have additional actual database records:

| Record | Added |
| --- | ---: |
| Likes | 271 |
| Comments | 98 |
| Follows | 89 |

Existing records were retained. The import used owner sessions and row-level security. Fixed record IDs and conflict handling make retries idempotent. It did not create interactions on unrelated users' posts.

Readback of all 48 scoped posts found zero differences between public counts and underlying like/comment records, zero duplicate like/follow pairs, zero self-follows and zero duplicate comment bodies within the same author/post pair. Private import manifests and original-image backups are stored outside the repository.

## Translation operations

Migration `20261025071955_content_translations.sql` adds source-language metadata and server-only translation cache/budget tables. Apply it before deploying the gateway.

The gateway reads publicly accessible content using the publishable key before serving translations. Cache keys include the complete source text and source language hash. Only the service role can read/write the cache and reserve translation quota.

MyMemory's public API is used on demand, with a conservative global limit of 4,500 source characters per UTC day, shared by posts and comments. Cached translations remain available after that limit. Ten updated posts have 33 prepared translations. Errors retain the original text. This does not use YouCam credits. Higher traffic will require a separately configured translation provider or quota.

Live verification observed HTTP 429 from MyMemory on Render even below the application limit. For uncached text, the UI offers a Google Translate link when inline translation is unavailable; it sends the original text to that site only when the reader opens the link. Prepared translations were verified inline. Reliable uncached inline translation remains dependent on provider availability or a separately provisioned API account.
