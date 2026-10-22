# Live YouCam acceptance — 2026-10-22

Real jury account, OOTIE project only. Provider calls used gifted credits; no purchase or top-up was performed. User approved the team's fictional AI model as input.

| Check | Observed result |
|---|---|
| Source | Existing OOTIE `look-1.png` fictional adult model |
| Garment | Colorful Standard Classic Merino Wool Crew, Soft Lavender; original merchant product photo and source link |
| Try-on | YouCam cloth-v3 accepted, processed and returned a real image; stored privately and displayed in the jury album |
| First color analysis | Provider rejected the full-body input: `No face was detected in the source image.` No fabricated result was displayed |
| Corrected input | Built-in imagegen companion portrait `portrait-1.png`; original full-body image retained |
| Color flow | YouCam skin-tone-analysis succeeded, returned validated hex values, saved to the jury account |
| Repeat submission | Replaying the same batch returned the same completed job, without another allocation or generation |
| Privacy | Signed-in image download succeeded; anonymous gateway image access returned 401; anonymous job queries exposed no rows |
| Credit reconciliation | Verified gifted batch decreased from 1000 to 978 units (2 try-on + 20 successful color analysis); other 40-unit batch unchanged |

The internal 100-unit acceptance allocation is conservatively 58 remaining because it reserves all submitted jobs, including the failed 20-unit analysis. This is distinct from the provider's actual 978-unit remaining gifted batch. Failed reservations are not silently refunded without reconciliation.

Skin, eye, lip, eyebrow and hair color values prove the integration, not real-person color accuracy. In particular, the provider's hair color output for this synthetic portrait should not be treated as a validated personal recommendation.

Private execution evidence, exact job records, input paths and downloaded output remain in ignored `backups/`. No jury credentials or provider task credentials are committed. Local/browser success is not yet public deployment acceptance.
