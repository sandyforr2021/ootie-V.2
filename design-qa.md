# OOTIE HomeView — Option 1 Design QA

## Presentation data-quality refresh — 2026-10-01

- New visual reference: `C:\Users\w\Downloads\image-gen-1.png`.
- Current desktop capture: `C:\Users\w\.codex\visualizations\2026\09\30\01a0f2a3-7212-7152-adbb-66928975e0fa\ootie-presentation-home-1440.png`.
- Palette moved toward brighter cream white, soft pink, butter yellow, sky blue and lavender while keeping ink-black product UI.
- Guest hero now uses the direct 「今天穿什麼？」 message, real OOTD imagery, real login/Explore actions and non-interactive handwritten notes.
- Login modal root styling now correctly crosses the `BaseModal` scoped-component boundary. Runtime measurements at 1440, 1024, 768, 390 and 375 px found zero clipped text/control nodes and zero horizontal page overflow.
- Before evidence: `C:\Users\w\.codex\visualizations\2026\09\30\01a0f2a3-7212-7152-adbb-66928975e0fa\login-before-375.png`.
- After evidence was captured in the in-app browser at all five target widths; at 375 px the dialog measured 335 × 559 px inside a 375 × 662 CSS viewport, with no internal scrolling or clipped descendants.
- Explore runtime smoke rendered 36 cards, 36 unique post IDs, 36 loaded images and no broken images.

## Evidence

- Source visual truth: `C:\Users\w\.codex\generated_images\01a0f2a3-7212-7152-adbb-66928975e0fa\exec-749ced88-e3b7-4528-bb8d-74288f6172eb.png`
- Source pixels: 861 × 1827.
- Desktop implementation: `C:\Users\w\.codex\visualizations\2026\09\30\01a0f2a3-7212-7152-adbb-66928975e0fa\ootie-home-option1-desktop.png`
- Desktop pixels: 1425 × 2794; CSS viewport 1440 × 1000; device scale factor 1. The 15 px width difference is the browser scrollbar.
- Mobile implementation: `C:\Users\w\.codex\visualizations\2026\09\30\01a0f2a3-7212-7152-adbb-66928975e0fa\ootie-home-option1-mobile.png`
- Mobile pixels: 390 × 3511; CSS viewport 390 × 844; device scale factor 1.
- Normalized comparison: `C:\Users\w\.codex\visualizations\2026\09\30\01a0f2a3-7212-7152-adbb-66928975e0fa\ootie-home-option1-comparison.png`
- State: Development Guest Home, populated remote OOTD data, no modal open.

The comparison board scales both full-page captures to a common 1400 px maximum height and places them side by side. Focused regions were inspected separately in the browser for hero typography/CTA, the note asset, Trending cards, capability cards and mobile navigation.

## Required Fidelity Surfaces

- Fonts and typography: the implementation uses the existing DM Sans product font, with a heavier, tightly tracked Home display scale matching the selected direction. Traditional Chinese wrapping remains readable at 1440, 1024, 768, 390 and 375 px.
- Spacing and layout rhythm: the implementation preserves the reference's split hero, generous whitespace, horizontal Trending rail, two-column capability composition and large final CTA. The existing sidebar remains available rather than changing the product information architecture.
- Colors and tokens: cream white, ink black, soft pink, butter yellow, pale sky blue, lavender and restrained mint are defined as reusable global tokens. Contrast remains sufficient for body copy and controls.
- Image quality and asset fidelity: all fashion imagery comes from the real OOTIE feed. The handwritten note is a dedicated transparent raster asset, not CSS or placeholder art. No broken images were found.
- Copy and content: real OOTIE labels, routes, captions, authors, likes and capabilities are retained. No fake controls, metrics or feature promises were added.

## Comparison History

### Pass 1 — blocked

- [P2] The desktop full-page capture exposed the mobile more-menu contents below the page because the wrapper was not hidden outside the mobile breakpoint.
- [P2] The hero heading wrapped to four short lines in the expanded sidebar layout, producing heavier density than the source direction.

Fixes:

- Added a desktop-default `display: none` rule for `.bottom-nav-wrapper`, restored only below 760 px.
- Reduced the desktop Home hero display scale while preserving the mobile type override.

### Pass 2 — passed

- Desktop duplicate navigation is gone.
- Hero hierarchy is visually aligned with the selected direction.
- Automated checks at 1440, 1024, 768, 390 and 375 px reported no horizontal overflow, zero broken images and a visible primary CTA.
- Decorative note stays inside the viewport and does not cover a CTA at every checked width.
- Browser console produced no application errors.

## Findings

No actionable P0, P1 or P2 findings remain.

## Intentional Differences

- The existing desktop sidebar was retained and visually refined instead of replacing the information architecture with a new horizontal navigation.
- Capability imagery uses current live OOTD assets rather than invented garment cutouts.
- Extra flowers, additional handwritten phrases and decorative paper objects from the concept were omitted to keep decorative density low and avoid non-functional clutter.

## Follow-up Polish

- [P3] A later all-page phase may unify the new pastel tokens across Explore, AI, Try-on, Subscription and Profile after the user approves this Home direction.
- [P3] The existing main bundle remains above 500 kB; this is outside the presentation visual scope.

## Primary Interactions Tested

- Login CTA opens the existing authentication modal.
- Home navigation and capability links remain semantic links with their existing route targets.
- Mobile navigation remains fixed, legible and available at 390/375 px.
- Existing Home/navigation component tests remain green.

final result: passed
