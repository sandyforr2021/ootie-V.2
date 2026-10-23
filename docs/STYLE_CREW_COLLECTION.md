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
