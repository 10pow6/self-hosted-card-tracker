---
version: alpha
name: Card Tracker — Archive Dark
description: Dark-first design system for the 10pow6 self-hosted card tracker. Calm, archival, precise — with explicit visual language for AI involvement.
colors:
  # Neutrals (dark-first; these ARE the shipped theme)
  background: "oklch(0.16 0.01 255)"
  surface: "oklch(0.195 0.012 255)"
  surface-raised: "oklch(0.22 0.014 255)"
  border: "oklch(1 0 0 / 10%)"
  foreground: "oklch(0.96 0.005 255)"
  muted-foreground: "oklch(0.71 0.012 255)"
  # Brand
  primary: "oklch(0.83 0.115 175)"        # Mint — interaction & brand
  primary-foreground: "oklch(0.20 0.04 175)"
  # Decision provenance (core to this product)
  ai: "oklch(0.74 0.13 300)"              # Violet — model output / automated decisions
  success: "oklch(0.78 0.14 150)"         # Green — human-confirmed decisions
  warning: "oklch(0.80 0.13 75)"          # Amber — awaiting human judgment
  info: "oklch(0.78 0.11 220)"            # Blue — informational / new-card events
  destructive: "oklch(0.70 0.19 22)"      # Red — destructive or irreversible
typography:
  display:
    fontFamily: Geist Variable
    fontSize: 28px
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: -0.02em
  h1:
    fontFamily: Geist Variable
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.015em
  h2:
    fontFamily: Geist Variable
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  h3:
    fontFamily: Geist Variable
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: Geist Variable
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Geist Variable
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: Geist Variable
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  microlabel:
    fontFamily: Geist Variable
    fontSize: 11px
    fontWeight: 550
    lineHeight: 1
    letterSpacing: 0.08em
rounded:
  sm: 6px
  md: 8px
  lg: 10px
  xl: 14px
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter-mobile: 16px
  gutter-desktop: 32px
  content-narrow: 44rem
  content-default: 72rem
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
  badge-ai:
    textColor: "{colors.ai}"
    backgroundColor: "color-mix(in oklch, oklch(0.74 0.13 300) 15%, transparent)"
    rounded: "{rounded.full}"
  badge-confirmed:
    textColor: "{colors.success}"
    backgroundColor: "color-mix(in oklch, oklch(0.78 0.14 150) 15%, transparent)"
    rounded: "{rounded.full}"
  badge-pending:
    textColor: "{colors.warning}"
    backgroundColor: "color-mix(in oklch, oklch(0.80 0.13 75) 15%, transparent)"
    rounded: "{rounded.full}"
omitted:
  - section: Elevation & Depth
    reason: "Covered in prose; tonal layers + 1px borders, no shadow scale."
---

# Card Tracker Design System

## Overview

Card Tracker is a **self-hosted archive for physical card collections** with an AI-assisted capture pipeline. The UI should feel like *a well-organized card shop at night*: dark, calm, precise, and trustworthy. It is a tool for a collector working through hundreds of physical cards — density and legibility beat decoration, and every screen should make the next step in the pipeline obvious.

Personality: **archival, technical, honest.** Numbers are tabular. Copy is plain. Nothing animates unless it communicates state.

**AI is a first-class design concern.** The product's pipeline (detection → embedding match → enrichment) makes automated proposals about the user's physical property. The design system therefore encodes *decision provenance* directly in color (see Colors) and requires every AI-derived value to carry its provenance and confidence. The model **proposes**; the user **disposes**.

Dark mode is the shipped theme. Tokens are single-sourced so a light theme can be added later without component changes.

## Colors

The palette is a cool near-neutral slate with **Mint** as the single brand/interaction hue, plus a fixed *provenance* vocabulary:

- **Background (oklch 0.16 0.01 255):** deep cool slate; the table felt everything sits on.
- **Surface (0.195) / Surface-raised (0.22):** tonal steps for cards and popovers; hierarchy comes from tone + 1px borders, not shadows.
- **Primary — Mint (0.83 0.115 175):** the only interaction color. Primary actions, active nav, focus rings, links. One primary action per view.
- **AI — Violet (0.74 0.13 300):** *reserved exclusively for model output and automated decisions.* Auto-matched placements, AI-enriched metadata, model confidence chips. Never used decoratively — if it's violet, a model produced it.
- **Success — Green (0.78 0.14 150):** *human-confirmed* decisions. A green badge means "you decided this."
- **Warning — Amber (0.80 0.13 75):** awaiting human judgment (pending review, needs metadata).
- **Info — Blue (0.78 0.11 220):** neutral system events (new card created, informational notes).
- **Destructive — Red (0.70 0.19 22):** destructive/irreversible actions only.

Placement review-status mapping (used everywhere a slot or placement appears):
`pending → warning · auto_matched → ai · user_confirmed → success · new_card → info · empty → muted`

## Typography

Single family: **Geist Variable** (already bundled). Hierarchy comes from size + weight, never from a second face.

- **Display/H1:** page titles; 600–650 weight, tight tracking.
- **Body (14px):** default UI text.
- **Caption (12px):** secondary metadata under thumbnails and in table cells.
- **Microlabel (11px, 550, +0.08em, uppercase):** the "engraved label" style for stat-card labels, section eyebrows, and provenance badges.
- **Numerals:** always `tabular-nums` for counts, percentages, and page/slot numbers.

Confidence is worded, not just numbered: percentages are always paired with a band label — **strong** (≥ 90%), **plausible** (75–89%), **weak** (< 75%) — so users don't over-read false precision.

## Layout

- Fixed sidebar (240px) on desktop; bottom tab bar on mobile.
- Page gutters: 16px mobile / 32px desktop, applied by a single `<Page>` container — never re-declared per screen.
- Content widths: `narrow` (44rem — settings, about, prose), `default` (72rem — everything else). Full-bleed only for canvas tools (polygon editor).
- 4px spacing scale. Card grids use 12–16px gaps; the trading-card aspect ratio is fixed at 63:88.

## Elevation & Depth

Tonal layers, not shadows: background → surface → surface-raised, each separated by a 1px `border`. Overlays use a heavy scrim (black/60 + blur) so modals read clearly on a dark UI. The only glow permitted is the brand `--brand-glow` band behind page heroes and a subtle mint shadow on hovered card thumbnails.

## Shapes

Soft-technical: 10px radius on cards and dialogs, 8px on buttons and inputs, full-round on chips/badges. Never mix sharp and rounded corners in one view. Card thumbnails use 12–14px to echo physical card sleeves.

## Components

- **Buttons:** one `primary` (mint) action per view; `outline` for secondary; `ghost` for tertiary/toolbar; `destructive` styling only on genuinely destructive actions. Irreversible actions always route through an AlertDialog that states the consequence in one sentence.
- **Status badges:** dot + label chips using the provenance palette; every badge has a tooltip stating *who decided* ("Auto-matched by the embedding model", "Confirmed by you").
- **Confidence chip:** `92% · strong` — violet when describing model output; includes tooltip explaining what similarity means and that it is advisory.
- **Inputs/Select/Switch/Checkbox:** themed primitives only — never OS-native controls or hand-rolled toggles.
- **Tables/lists:** row height ≥ 40px, caption-size metadata, actions right-aligned; on mobile, keep the safest action visible, overflow the rest.
- **Empty states:** dashed-border panels that state what the system can do, what it needs from the user, and one primary action.
- **Toasts:** every mutation confirms success or failure via toast; errors never go to `window.alert`.

## Do's and Don'ts

- **Do** reserve violet strictly for model output; **don't** let AI results masquerade as facts — provenance is always visible.
- **Do** pair every confidence number with its band word; **don't** show bare percentages.
- **Do** make every automated decision traceable and reversible from where it's displayed (unmatch, send back to review); **don't** auto-commit anything without a user-configured rule the UI can point to.
- **Do** use mint for exactly one primary action per view; **don't** use it for decoration.
- **Do** confirm irreversible actions (merge, delete, reassign that prunes a card) with an AlertDialog naming the consequence; **don't** use `window.confirm`.
- **Do** keep numerals tabular and card aspect 63:88 (portrait — including PDF exports); **don't** crop card art.
- **Do** maintain WCAG AA (4.5:1) for text on dark surfaces; **don't** use pure black or pure white.
