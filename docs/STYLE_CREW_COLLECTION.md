# OOTIE Style Crew — 2026-10-23 expansion

Six fictional adult characters (Clara, Iris, Mei, Kai, Amara, Elise) have distinct identity-matched portraits, original full-body images and two more lifestyle scenes each. The real jury login is now presented as Maya, @jury_maya82, with a separate avatar and three everyday looks based on its existing twenty-piece wardrobe. Login credentials were unchanged.

The public feed contains 27 posts: 18 crew looks, three jury looks and six earlier editorial looks. Recommended results vary authors while preserving relative order within each author; following results preserve their order. Team-curated attribution remains visible. These are fictional styling stories, not customer testimonials or evidence of adoption.

## Independent wardrobes

Six crew capsules have 3, 4, 5, 6, 8 and 10 selected public pieces: 36 distinct item IDs and photos, each owned by its corresponding profile. None reference the jury wardrobe. Individual photos include hangers, chairs, beds, rugs and floors. Original catalogue-copy rows were hidden, original crew SOS briefs and the old jury acceptance SOS were closed; rows, replies and history were preserved. New SOS briefs use the new capsules, with two or three suggestions selecting only that requester's published pieces.

Original and new posts now tag matching pieces from their owner's capsule. Feed cards show all tagged thumbnails with names, opening the full post. Each identity's avatar is reused consistently across Explore, SOS and comments, but is a newly generated photograph rather than a crop of a post.

## Assets and provenance

Built-in ImageGen generated 58 assets: 36 garments, seven avatars and fifteen lifestyle scenes. Reference photographs are the previously generated fictional characters. Prompts: scripts/style-crew-image-prompts.json and scripts/jury-story-image-prompts.json. Sources remain in public/images/style-crew as local ignored PNGs and at their original Codex generated-image paths. WebP encoding preserves dimensions and composition, reducing approximately 157 MB to 16 MB. The 58 WebP files are committed for deployment. No additional YouCam job or paid API was submitted.

Generation preparation: scripts/prepare-style-crew-expansion.mjs; encode without crop/resize using scripts/optimize-style-crew-assets.py. Publication: scripts/publish-style-crew-expansion.mjs and scripts/publish-jury-life.mjs. Use the expansion publisher rather than the earlier catalogue-copy publisher. Exact pre-change backups/publication IDs remain ignored under backups/. Prepared fictional Auth identities remain banned from sign-in; the working jury account is separate.

## Verified relationships and privacy

The owner approved migration 030. It is now applied to OOTIE hoxkrmadzjnyjaqjbyxc. Visitor and member calls returned only post_id, like_count, comment_count, save_count. Counts for all 21 prepared posts matched actual relationship rows. Neither role could read other profiles' private saved-outfit lists. No RLS/table policy was broadened; no saver identities are returned.

Acceptance verified all 36 unique garment owners/photos, the six SOS item selections, seven distinct avatars, jury wardrobe preservation and actual public totals. Anonymous and authenticated checks passed. No fabricated numeric counters, purchase history, wear history or revenue were introduced. Existing merchant-photo source attribution is not a redistribution license; jury catalogue photos still require final competition asset-permission review.

The seven prepared names required an administrative correction of a business cooldown. An exclusive table lock and a single transaction kept concurrent client updates blocked until the display-name trigger was re-enabled; tgenabled=O was verified afterward. Normal member cooldown rules were preserved.

## Current release: distinct outfits and four more characters

The original six characters now have three distinct garment combinations each. Twelve replacement scenes and 22 additional garment photographs preserve their facial references but change their clothing. `src/data/styleCrewDistinctLooks.json` records each photographed outfit and its exact owned garment keys. `scripts/publish-distinct-crew-looks.mjs` updates the existing post IDs so later interactions are preserved. Only prepared content is checked for duplicate outfits; normal member publishing is unrestricted.

Seo-yun (Seoul), Camille (Lyon), Nicha (Bangkok) and Zuri (Chicago) add four fictional adult styling characters with different body types, settings and poses. Each has a newly photographed matching avatar, one lifestyle post and three individually photographed garments. Their declared fictional backgrounds are authored metadata, not ethnicity inferred from images. `src/data/additionalStyleProfiles.json`, `scripts/additional-style-image-prompts.json` and `scripts/publish-additional-style.mjs` record these assets. The built-in ImageGen tool generated the images; this release does not call a paid external image API. Preserve all original PNGs. WebP files keep the full frame.

Current prepared community acceptance: 25 visible character/jury posts; 70 distinct character garments; jury wardrobe unchanged at 20 pieces. Each SOS still selectively exposes only 3, 4, 5, 6, 8 or 10 of its own author's pieces. All 11 character/jury avatars are distinct. Visitor and member aggregate counts match stored like/comment/save rows, and neither can query others' private save identities. New fictional identities have sign-in disabled and do not receive emails. Prepared interactions are not evidence of organic adoption, sales or revenue.

**Do not rerun the older initial publishers on an existing release:** they contain historical captions and garment combinations. Use the distinct-outfit and additional-character publishers for the current update. The initial manifests remain for provenance. Visible reserved Crew badges/hashtags were removed at the owner's request; provenance remains documented here and in prepared profile biographies.

## Studio navigation and try-on scope

Bookmarks no longer occupy a separate sidebar destination. `/bookmarks?tab=outfits` redirects to `/shop?tab=saved`; other old bookmark URLs redirect to `/shop?tab=links`. Existing saved looks, SOS references and legacy product links remain accessible. New product capture goes through Wishlist and the browser companion.

The wardrobe pairing board shows up to six **owned** pieces side by side. Its saved selection is browser-local, namespaced by domain profile ID, with no stored image bytes and no generation request. It does not synchronize to another device. Category/search filters, removable choices and storage failures are handled explicitly. Public shopping try-on cards identify the publishing member via a public profile link; the publisher is not inferred from the person shown in the image. Private originals and other results stay private.

The currently integrated clothing API takes one garment reference per job. Three selected products create separate outputs. Combined top + trousers + bag on the same person is not implemented or claimed by the pairing board. UI consent names OOTIE and its image processing provider; competition submission documentation must still accurately explain the underlying API integration.
