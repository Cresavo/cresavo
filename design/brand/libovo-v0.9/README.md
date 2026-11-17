# LIBOVO / Brand Kit v0.9

**Status:** Approved as an *implementation direction*, **not** a trademark-cleared/registered brand. This folder can be handed to Claude Code as a self-contained starting point. Do NOT ship a final public rebrand without separate approval.

## Brand promise

**Mer tid. Dina villkor.**

Libovo gives a business more freedom to run its day: bookings, customers, repeat work, reports and connected tools, with openness, user choice and transparent automation.

The brand is deliberately **AI-neutral**: AI is presented as a useful capability, not the product's identity. Never claim all planned functionality is available now.

## Design principle

- Calm, precise, human and trustworthy, never futuristic for its own sake.
- Mobile first for every day-to-day flow. Desktop optimized for calendars and dense data.
- Less is more: progressively reveal complexity, not hide essential controls.
- User initiates the key action; AI may suggest, but never quietly execute high-impact operations.
- White-label: tenant salon/business has its own logo and colors on public booking pages, Libovo runs the platform shell.

## Visual direction / round 05 winner

Aubergine and warm apricot (distinctive alternative to generic teal AI branding). Two separately designed themes:

| Role | Light | Dark |
|---|---|---|
| Background | `#FAF7F3` | `#18141E` |
| Surface | `#FFFFFF` | `#25202A` |
| Primary text | `#2C242E` | `#FBF5F0` |
| Secondary text | `#6F666F` | `#BEB4BD` |
| Action | `#50364B` | `#F2B184` |
| On action | `#FFFFFF` | `#211820` |
| Border | `#E7DDD9` | `#4D414F` |

Full tokens are in `tokens/libovo.tokens.css` and `tokens/colors.json`. Do not reuse brand plum/apricot for success/error states; semantic colors are separate.

## Typography

- Product: **Inter** 400, 500, 600, 700. Base 16px; 14px only for secondary table labels.
- Wordmark: outlined SVG paths sourced from a Cabin Bold exploration. SVG is included; **no font binaries** are redistributed.
- Avoid setting entire UI in Cabin Bold. It makes numeric tables and density less usable.
- Headings: no all-caps huge hero type except short overlines; line length generally 40–65 characters.

## Logo rules

- **Primary identity is the wordmark only**, visible without a standalone symbol.
- Prefer `logo/libovo-wordmark-light.svg` over a light background; inverse on dark.
- Keep clear space of at least the height of the wordmark's lower-case `o` around it.
- Minimum screen width 92px for full wordmark, ideally >=120px. On mobile navbar use 110–140px.
- No stretching, shadows, gradients, embossing, unapproved custom font substitution or app-square border around the wordmark.
- App icon and favicon assets are **temporary `lv` monograms**, not a vetted or distinctive final symbol. Replace before major brand launch. They are used only to avoid blank PWA icons during development.
- Source SVGs are font-outlined vectors. Inspect/adjust kerning and rendering at 24px, 40px, 80px before approval.

## Missing from final-brand release

1. A finalized original symbol, or deliberate decision to remain wordmark-only.
2. Trademark and visual similarity clearance in relevant territories. Libovo vs Lenovo is one specific check.
3. Verified handle availability, including YouTube and app stores.
4. Brand approval for the selected palette and headline before live migration.
5. Accessibility audit on *actual components* across both themes and tenant palettes.

## Files

- `logo/`: 5 production-shaped SVG exports for wordmark, still provisional.
- `icons/`: monochrome/inverse icon drafts and favicon/PWA placeholder exports.
- `social/`: OG image and placeholder social avatar.
- `tokens/`: CSS, JSON, contrast report.
- `preview/`: responsive, local view of the identity in a dashboard and on mobile.
- `guidelines/`: mobile-first, accessibility, logo use, white-label and voice.
- `handoff/`: drop-in prompt for Claude Code and phased implementation checklist.

The `preview/` files are **mockups**, not product code. **Do not overwrite original brand kit versions.**
