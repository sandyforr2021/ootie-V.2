# OOTIE Demo Seed Data

`scripts/seed-demo-data.mjs` is the canonical, repeatable Development seed. Stable UUIDs come from `scripts/demoSeedContract.mjs`; rerunning the command upserts the same rows instead of multiplying content.

## Current dataset

- 12 Demo profiles with avatars
- 42 catalogued presenter items and 44 supporting community ownership rows
- 36 OOTD posts covering 20 named real-life scenarios with unique combinations
- 170 varied post likes
- 8 legacy saved-post rows and 8 canonical saved-outfit rows
- 12 SOS posts and 18 suggestions
- 6 notifications
- PLUS Demo subscription and 4 point transactions, including one birthday reward
- one private full-body person image and one private AI history result

The 42 garment images and 36 OOTD images are distinct, project-local, AI-generated Development assets under `public/demo/`. The seed uploads them to the existing Development bucket and stores exact public object URLs. They do not scrape or claim official brand product photography. Person and AI result images remain in `ootie-ai-private`.

The seed never stores generated Base64 in PostgreSQL. It does not call Google AI, does not create a paid subscription, and does not touch Production.

## Validation

`tests/demo-seed.test.mjs` validates stable UUIDs, presentation-density targets and duplicate detection. `npm run audit:demo` reads the remote Development rows and reports clothing/image/post/combinations/scenario/brand quality. The live seed has been rerun with `OOTIE_DEMO_RESET=true` without duplicate IDs or exact outfit combinations; the ignored local handoff file is regenerated each time.

The seed uses brand names with generic descriptions only (for example `UNIQLO / 白色棉質襯衫`). It does not claim official SKU, price or catalog provenance.
