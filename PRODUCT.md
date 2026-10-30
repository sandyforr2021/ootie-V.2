# OOTIE product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Consumers considering an online clothing purchase and merchants interested in useful virtual try-on. The existing wardrobe makes a new product easier to evaluate in the context of clothes the shopper already owns. The team is preparing this project for the YouCam hackathon.

## Product Purpose

Save a product link or image, preview it on a consenting user's own photo using YouCam, find complementary wardrobe pieces, return to the merchant, and optionally share a chosen result.

## Operating Context

Vue 3 / Pinia web application with a Node gateway, Supabase authentication, private storage and a persistent generation queue. Local preview is currently the development target. English is the default, with Traditional Chinese, Japanese and Spanish available. Saved language preferences take precedence.

## Capabilities and Constraints

- No additional spending, paid asset services, credit purchases or automatic top-up.
- No payment integration in this phase. Merchant partnerships and try-on service fees are future business hypotheses, not current revenue.
- Keep OOTIE's Supabase project isolated from the unrelated drumstand project.
- Product wishlists are not owned wardrobe items. Moving a product to the wardrobe requires confirmation of ownership.
- Person photos and results stay private unless the user separately chooses to publish a result.
- Batch up to three clothing previews. Show queue state and finished results in the private album.
- Optional skin-tone color ideas must not be presented as diagnosis, objective beauty scores or a sizing guarantee.

## Brand Commitments

OOTIE is a fashion and wardrobe product. The user requested joyful, colorful high fashion: berry, butter yellow, mint and lilac accents with clear typography. Preserve and improve the original opening wardrobe-door animation. Adapt typography and line breaks independently to all four languages. The user confirmed that the 16 team-established accounts and their clothing, posts and interactions are valid content and must be preserved. Do not classify them as obsolete from their names, paths or creation dates. Preserve working product behavior while improving the experience.

## Evidence on Hand

Six team-prepared editorial posts are available, including four newly generated full-body fashion images with provenance in docs/EDITORIAL_IMAGE_SOURCES.md. The working jury account has eight private wardrobe items with actual merchant product photos and source links in src/data/juryWardrobeSources.json. These prepared contents are not evidence of customers, purchases, revenue or conversion improvements. No consented live YouCam generation has yet been completed in this development session. Known legacy fixture activity is excluded from the live feed.

## Product Principles

1. Make the next action obvious and keep complex choices progressive.
2. Distinguish owned pieces, wishlisted products and AI previews.
3. Keep actual service state, privacy and credit use understandable.
4. Improve consumer choice and merchant discovery without invented commercial claims.

## Open Decisions

Production hosting through judging, real demo input photos, merchant agreements, and live user testing remain separate deliverables. This record consolidates the user's existing brief and accepted decisions; it does not infer a new business commitment.

## Homepage scope — 2026-10-29

- Local implementation only. No GitHub push, public deployment or database cleanup. The user separately authorized original welcome-page image generation.
- The guest homepage retains the shared sidebar, with a brand header, four core experiences, a horizontal four-step journey, account CTAs and existing policy links. The header logo appears when the desktop sidebar is collapsed and remains visible on mobile.
- The welcome visual uses separate cloud-only cumulus and transparent model assets. Illustrative feature previews move without fabricating member activity or API results; reduced-motion preferences are respected.
- `/welcome` shows the same public brand introduction while a member remains signed in, so both homepage variants can be reviewed without changing account state.
- The member homepage retains real content: welcome/date/time with nearby weather and relocation control, outfit suggestions, followed posts (or the established discovery fallback), then recent clothing.
- The user chose to leave new quick actions and personalized reminders for later discussion. Do not add those sections.
- Contact information is planned but not displayed until the user provides a public contact channel.
- Existing opening animation, Google account creation, email account login, privacy boundaries and four-language support remain in use.

## Generation allowance — 2026-10-29

- Every account receives two daily free final images, shared by try-on and AI garment cleanup; reset at midnight America/Los_Angeles (pending database rollout).
- Use platform points first (2 per garment, 6 for a three-garment outfit), without a daily image count cap. If the complete batch cannot be funded, use an available free image without a partial debit.
- A sequential outfit is one final image. Pending/uncertain work reserves its free slot; confirmed unsuccessful work restores it. Replays do not consume another slot or debit.
- Provider gift-budget limits, expiry, concurrent-work limits and no automatic purchasing remain in effect.
- Implemented as a local migration and isolated SQL tests; not applied to the shared production database in this local-only phase.
