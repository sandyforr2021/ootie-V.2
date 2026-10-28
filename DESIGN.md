---
name: OOTIE Atelier
description: A cheerful fashion atelier for discovering clothes and styling a personal wardrobe.
colors:
  accent: "#af235e"
  accent-pink: "#f0a8c5"
  accent-pink-soft: "#fbe0eb"
  accent-yellow: "#f6d86b"
  accent-yellow-soft: "#fff1b9"
  accent-mint: "#ccead9"
  sage-dark: "#276449"
  accent-lavender: "#c6b4ef"
  accent-lavender-soft: "#eee6fc"
  accent-blue-soft: "#eaf3fc"
  paper: "#fff9f5"
  white: "#fffdfb"
  ink: "#302236"
  muted: "#716071"
  line: "#e9dce4"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, Noto Serif TC, Songti TC, Yu Mincho, serif"
    fontSize: "clamp(40px, 4.8vw, 69px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Playfair Display, Georgia, Noto Serif TC, Songti TC, Yu Mincho, serif"
    fontSize: "clamp(32px, 3.4vw, 46px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-.035em"
  section-title:
    fontFamily: "Playfair Display, Georgia, Noto Serif TC, Songti TC, Yu Mincho, serif"
    fontSize: "30px"
    fontWeight: 500
  studio-title:
    fontFamily: "DM Sans, Noto Sans TC, Yu Gothic, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: "-.03em"
  body:
    fontFamily: "DM Sans, Noto Sans TC, Yu Gothic, system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  control:
    fontFamily: "DM Sans, Noto Sans TC, Yu Gothic, system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.6
  display-cjk:
    fontFamily: "Noto Serif TC, Songti TC, Yu Mincho, serif"
    fontSize: "clamp(32px, 3.3vw, 48px)"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: ".015em"
rounded:
  chip: "6px"
  control-rendered: "7px"
  radius-control: "8px"
  panel: "10px"
  radius-card: "12px"
  modal: "14px"
  mobile-nav: "16px"
spacing:
  gap-small: "8px"
  gap-control: "12px"
  gap-field: "16px"
  gap-card: "20px"
  gutter-mobile: "20px"
  panel-mobile: "20px"
  gap-section: "24px"
  panel: "28px"
  gap-columns: "32px"
  section-mobile: "36px"
  section-desktop: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    typography: "{typography.control}"
    rounded: "{rounded.control-rendered}"
    padding: "12px 18px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control-rendered}"
    padding: "12px 18px"
  input-studio:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "12px"
  chip-category:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.control}"
    rounded: "{rounded.chip}"
    padding: "9px 16px"
  chip-category-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.chip}"
    padding: "9px 16px"
  panel-studio:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "28px"
  nav-active:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    typography: "{typography.control}"
    rounded: "{rounded.control-rendered}"
    padding: "12px 14px"
  step-active:
    backgroundColor: "{colors.accent-pink-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    padding: "12px 16px"
---

# Design System: OOTIE Atelier

## Overview

**Creative North Star: "The Cheerful Fashion Atelier"**

OOTIE combines an editorial fashion voice with an approachable personal wardrobe. Warm paper, berry actions, generous photography and pastel working areas make the product colorful without sacrificing the clarity of forms and navigation. The Latin serif headlines supply the fashion character; compact sans-serif controls keep the application usable.

The original wardrobe-door opening remains a signature welcome. English is the default, with Traditional Chinese, Japanese and Spanish treated as complete layouts: type size, line height, wrapping and emphasis change with the language. Product photography and editorial imagery retain distinct roles and source labels.

**Key Characteristics:**
- Berry actions on warm paper, with butter yellow, mint, pink and lilac surfaces.
- Editorial serif headlines paired with concise sans-serif controls.
- Quiet bordered panels, visible garment silhouettes and selective photographic depth.
- Locale-aware typography and a reduced-motion alternative to the wardrobe entrance.

Evidence: extracted from `src/assets/atelier.css`, `src/assets/shop-studio.css`, their base rules in `src/assets/main.css`, `src/components/ui/EditorialVisual.vue`, shared UI/layout components, and the local review screenshots `home-en-desktop.png`, `home-ja-mobile.png` and `shop-es-mobile.png`. `src/main.js` loads the Atelier layer after the base sheet; `ShopView.vue` loads its studio layer after its earlier scoped styles. This is an implementation record, not a claim that all runtime behavior is verified. Live YouCam output and deployment remain pending. The prepared editorial collection and private merchant-sourced wardrobe items are not customer or commercial-performance evidence.

## Colors

The palette uses a saturated berry action color against soft, clearly differentiated pastel surfaces. The frontmatter preserves the current CSS values; the sidecar's eight-step color ramps are generated display aids, not additional application tokens.

### Primary

- **Berry** (`accent`): primary actions, the active desktop destination, selected product borders and emphasized Latin display text.
- **Petal Pink** (`accent-pink`, `accent-pink-soft`): fitting-room headers, the second journey step and the arched editorial image surround.

### Secondary

- **Butter Yellow** (`accent-yellow`, `accent-yellow-soft`): the editorial note, discovery step, selected import method and supporting summaries.
- **Mint** (`accent-mint`): wardrobe-related destinations and wardrobe insight surfaces. **Leaf Ink** (`sage-dark`) supplies darker supporting icons.

### Tertiary

- **Lilac** (`accent-lavender`, `accent-lavender-soft`): sharing and Explore surfaces, empty collections and the right wardrobe door.
- **Powder Blue** (`accent-blue-soft`): account settings and supporting utility surfaces.

### Neutral

- **Warm Paper** (`paper`): page canvas.
- **Porcelain** (`white`): panels and fields; the CSS `surface-raised` alias currently shares this value.
- **Plum Ink** (`ink`): headings, body text and selected filter chips.
- **Muted Plum** (`muted`): descriptions and secondary labels.
- **Rose Line** (`line`): panel borders and quiet dividers.

**The Color Has a Job Rule.** Use the existing pastel families to distinguish working areas; keep the berry treatment for actions, selection and intentional emphasis.

## Typography

**Display Font:** Playfair Display with Georgia and CJK serif fallbacks. **Body Font:** DM Sans with Noto Sans TC, Yu Gothic and system sans-serif fallbacks. The OOTIE wordmark retains its Latin display family in every locale.

The hierarchy is editorial at the top and practical in working panels. The frontmatter records actual CSS roles rather than a mathematical scale: page headings, the home display and studio section titles differ deliberately. The home lead uses a more open line height (1.85) and a compact text column (400px maximum); explanatory Explore copy is limited to 65ch.

On phones, the Latin home display uses `clamp(39px, 9.4vw, 54px)` with a line height of 1.12. General page headings become 34px, and home section headings become 26px. Studio section titles become 22px below 430px. Small utility and source labels exist at 11–13px; these are secondary text, not the reading-text target.

Traditional Chinese and Japanese replace the display stack, use strict line breaking, remove italic hero emphasis and increase paragraph line height to 1.9. Their mobile home display is `clamp(30px, 8vw, 39px)` at line height 1.5. Spanish uses a narrower desktop display range, `clamp(40px, 4.1vw, 59px)`, at line height 1.16 and becomes 40px on phones. Studio titles have separate CJK adjustments.

**The Locale Shapes Type Rule.** Preserve each locale's wrapping, upright CJK emphasis and expanded line height; do not force translated headings into the English geometry.

Font delivery limit: `index.html` requests DM Sans weights 400/500/600/700 and Playfair Display weights 500/600. CSS also requests intermediate weights and display weight 400, so those appearances can involve browser substitution. Noto and platform CJK faces are named fallbacks, not bundled or requested webfonts. The screenshots show observed layouts, not proof of identical font availability on all devices.

## Layout

The desktop application pairs a sticky, full-height sidebar (218px; 196px below 1100px) with a centered main area (1510px maximum). Main horizontal padding is `clamp(24px, 4vw, 64px)`. Home and the shopping studio cap their content at 1260px. The sidebar can collapse using the incumbent compact width (78px).

The home hero uses a 1.12:1 two-column grid with a fluid gap. Its three-step journey becomes vertical below 1100px; the hero becomes one column below 600px. Recent wardrobe and journal content use four columns, then two on smaller screens. Final journal imagery uses a 2:3 frame with `object-fit: contain`, retaining complete outfits.

Below 900px, the sidebar gives way to a fixed bottom navigation and the main area reserves bottom space. The mobile canvas uses 20px side gutters below 600px and 105px bottom padding. The bottom navigation sits 10px above the bottom edge, inset 12px horizontally, with safe-area padding.

The studio uses a 1.7:1 working column and guide column, with a 210px guide minimum. It becomes one column below 700px and hides the guide image. Its product grid goes from three to two columns; narrow panels use 20px internal padding. Tabs wrap, step labels can stack, and studio inputs become 16px below 430px. Use the actual spacing roles in the frontmatter; the code does not define a universal spacing-token scale.

## Elevation & Depth

Most working surfaces are flat, bordered or separated by tone. The shared shadow custom properties remain available, but the current studio panels, common cards and primary buttons explicitly remove shadows. Photography, overlays and the mobile navigation receive the meaningful depth.

- **Photograph:** `0 16px 40px #30231a16` on the hero image frame.
- **Editorial note:** `0 12px 35px #30231a22`, with a slight rotation and a foreground translation.
- **Overlay:** `0 24px 80px #27251f25` on the common modal/popover layer. The scoped shop modal retains an older nearby shadow value; it is a local variation.
- **Mobile navigation:** `0 -5px 30px #29271e08`, with a translucent warm surface and 16px backdrop blur.

**The Quiet Working Surface Rule.** Keep forms and browsing panels flat; use depth for photographic composition and floating layers.

## Shapes

The dominant shape is a gently rounded rectangle. The root control radius is 8px, while common visible actions explicitly use 7px; both are recorded because they are distinct in the implementation. Filters use 6px, panels commonly use 10px, colored destination surfaces use 12px, common overlays use 14px and mobile navigation uses 16px. Cards on some legacy routes retain nearby 8–10px radii.

The arched image surround is a signature silhouette, with a high curved top and modest bottom corners. It belongs to the editorial composition, not every product card. Merchant garment photos use containment and neutral backdrops; complete fashion looks use containment in their 2:3 frame. The hero atmosphere image is intentionally cropped with `object-fit: cover` and is a separate image role.

## Components

### Buttons

Primary actions are berry with warm-white text; secondary actions are transparent with an outlined edge. Common actions have a minimum height of 44px. The home action uses more generous padding (14px 21px) and a 49px minimum. Shared primary hover deepens to `#8e184a`; studio primary hover intentionally keeps its berry fill. Studio buttons use 10px 16px padding and a 160ms state transition; disabled studio buttons use 0.48 opacity. The shared base button component still has an older ink-primary variant and is not the visual authority for the refreshed studio.

The global keyboard ring is berry, 2px wide and offset 4px. Some scoped controls retain different rings; these are documented drift, not a new family of focus tokens. Shared buttons inherit a small hover lift, while studio buttons use a 0.98 press scale. Respect reduced motion.

### Chips

Category chips use compact padding and modest corners. Selected categories use plum ink and warm-white text rather than a pastel selected fill. Feed tabs share this treatment with slightly different horizontal padding. Studio import methods are a separate segmented choice: a butter surface with a berry border marks the pressed option.

### Cards / Containers

Working panels use porcelain, a rose border, flat depth and 28px padding on desktop. The studio reduces that padding responsively. Product cards contain the full garment, identify its source and use a berry border plus a one-pixel selection ring when selected. Full-body editorial cards preserve the outfit and identify prepared editorial material. Do not treat prepared source material as evidence of a shopper's purchase or a completed try-on.

### Inputs / Fields

Fields use warm-white fill, a fine border and compact corners. Studio fields use 6px corners, 12px padding, a 46px minimum height and a local `#cfb8c9` border. Labels remain outside the input; placeholders supplement them. The shared input component supports associated descriptions, required state and error text. Upload targets use a lilac surface and dashed border, with a berry ring around the visible target on focus-within. Preserve real error and disabled states rather than rendering a success-like placeholder.

### Navigation

Desktop navigation uses a soft pink rail, compact SVG line icons and a solid berry active row. Row labels are 13px with a 46px minimum height. Mobile navigation uses a floating translucent warm bar; active destinations are berry without a filled tile, and active icon strokes strengthen. The language selector remains available in the top bar. Locale names and long navigation labels must remain readable when wrapping or using short mobile labels.

### Studio Stepper

Three numbered steps show the sequential workflow. The active step has a soft pink fill and berry bottom line. Completed steps may show a leaf-ink check; unavailable steps are disabled. On narrow phones labels stack under the number and step height increases to 80px. This is a workflow control, not a claim that any remote generation has finished.

### Wardrobe Opening and Editorial Frame

Keep the original paired wardrobe doors. The welcome runs for 2400ms on first home entry in a session, supports an explicit replay action and is skipped for reduced-motion users. Its panel highlights and metallic handle gradients describe a physical door; the flat-surface guidance does not ban those material details.

The editorial image can tilt only for a fine mouse pointer with hover and no reduced-motion preference. Its frame transition is 280ms; decorative movement must not affect keyboard access or change the underlying reading order. The opening is pointer-transparent and hidden from assistive technology.

## Do's and Don'ts

### Do:

- **Do** reuse berry actions and the existing pastel surface families to make state and destination legible.
- **Do** keep the original wardrobe opening, replay action and reduced-motion behavior.
- **Do** preserve locale-specific type rules for English, Traditional Chinese, Japanese and Spanish.
- **Do** contain garment and full-body editorial images, and preserve their source or editorial labels.
- **Do** keep visible labels, keyboard states, privacy language and actual service status alongside the visual refinement.

### Don't:

- **Don't** apply the hero photograph's crop to merchant product images or full-body editorial posts.
- **Don't** expand the arched hero silhouette or photographic shadows into every working panel.
- **Don't** present prepared editorial posts, private merchant photos or pending jobs as verified customer activity or live YouCam output.
- **Don't** use the generated sidecar tonal ramps as new production colors without a deliberate design change.

Not canonized or repaired: existing eyebrow/kicker treatments, residual glyph icons in the language/more/modal controls, local focus-ring differences, and base-component styling drift remain in the code. They are not rules for new surfaces. This documentation-only pass also does not resolve missing font weights or guarantee cross-device CJK font delivery.

## Approved pastel gradients — October 28

The requested digital finish uses lavender–blush–cream gradients on the page canvas, sidebar and section heroes. Berry–plum action gradients retain readable white labels. Garment images keep neutral white surfaces; intro doors and motion remain unchanged. Tokens live in `src/assets/atelier.css`: `--gradient-celebration`, `--gradient-navigation`, `--gradient-action`, `--gradient-canvas`.

Membership uses a wide pastel hero, dark personal-balance card, three aligned plan cards and a separate one-time top-up row. Cards stack on mobile. Until payment integration exists, paid plans show an explicit availability label without an inert purchase button. Prices remain denominated in TWD in all languages.

## Shared page headings — October 28 follow-up

All nine main member pages now use `.ootie-page-heading` from `src/assets/page-headings.css`, matching the fitting studio: 116px minimum height, 24px/28px padding, 12px radius and the same pastel gradient. Titles use the display family at 40px with 1.4 line height; mobile titles use 32px and controls wrap below. Heading entrance translations are disabled to keep the title stationary between routes; the wardrobe opening remains intact. Membership balance is now a compact right-hand control inside this shared heading, replacing the earlier standalone dark balance treatment.

Product actions in the studio use labelled SVG icon controls with 44px targets and tooltips. Profile captions initially show original text with a quiet translation trigger; source-language controls appear only after a translation request. Statistics use the same `itemPhoto` resolver and `WardrobeCutout` rendering as the wardrobe, contained on white.
