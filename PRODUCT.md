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

OOTIE is a fashion and wardrobe product. The user requested joyful, colorful high fashion: berry, butter yellow, mint and lilac accents with clear typography. Preserve and improve the original opening wardrobe-door animation. Adapt typography and line breaks independently to all four languages. Exclude known seeded people, posts and metrics from live UI; never relabel fixtures as genuine content. Preserve working product behavior while improving the experience.

## Evidence on Hand

Six team-prepared editorial posts are available, including four newly generated full-body fashion images with provenance in docs/EDITORIAL_IMAGE_SOURCES.md. The working jury account has eight private wardrobe items with actual merchant product photos and source links in src/data/juryWardrobeSources.json. These prepared contents are not evidence of customers, purchases, revenue or conversion improvements. No consented live YouCam generation has yet been completed in this development session. Known legacy fixture activity is excluded from the live feed.

## Product Principles

1. Make the next action obvious and keep complex choices progressive.
2. Distinguish owned pieces, wishlisted products and AI previews.
3. Keep actual service state, privacy and credit use understandable.
4. Improve consumer choice and merchant discovery without invented commercial claims.

## Open Decisions

Production hosting through judging, real demo input photos, merchant agreements, and live user testing remain separate deliverables. This record consolidates the user's existing brief and accepted decisions; it does not infer a new business commitment.
