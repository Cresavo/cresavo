# Product site design rules

Applies to the product homepage (`src/concept/site/home/`), the about and
privacy pages and any new marketing page. Claude Code, Codex and Grok read this
before they change a page. The studio follows [DESIGN_SYSTEM](DESIGN_SYSTEM.md).

The site should look like a salon owner's tool made by people, not a template.
Calm, mobile first, less is more: only show what the visitor needs right now.

## Banned: the usual signs of a generated page

- Purple, violet or indigo accents. The accent is a deep, neutral plum in light
  mode and apricot in dark mode (`--plum` in `home.module.css`).
- Gradient text, glow blobs, glassmorphism, noise or blur used as decoration.
- Emoji as icons. Use the line icons in `home/icons.tsx` or none.
- Centring everything. Only the short hero lines may be centred, from 600 px.
  Body sections, closing asks and lists are left-aligned.
- One word in a headline picked out with colour, italics or a gradient.
- All-caps "eyebrow" labels above headings (`PRODUCT`, `PRICING`). The heading
  says it; a short sentence-case note in muted text is the most it gets.
- `01 / 02 / 03` numbering on things that are not real, ordered steps.
- Rows of identical cards with the same border, radius and shadow as the
  default layout. Vary the layout or flatten it into rules and plain text.
- Fade-and-slide-up on every section. The page has two intentional motion
  moments in the hero, the dot wordmark and the booking flow under it (hard cuts, no fades or slides, a pause
  button, a finished frame for reduced motion); everything else is there at first paint.
- Framed utility buttons. Menu, theme toggle and similar controls are plain
  text or icon buttons; a second action beside the primary one is a text link.
- Generic hero copy ("Supercharge your workflow", "All-in-one platform"). Say
  what Cresavo does for a salon, in the words of `en.ts` and `sv.ts`.
- Disclaimers and fine print added to soften a claim. Don't add the claim.

## No nested boxes

This applies to the studio as well as the site.

- Group with spacing, type weight and a few thin dividers, not with frames.
- At most one level of surface: a page may lift one thing onto a surface (the
  next customer on Today, a dialog), and nothing inside it gets another one.
  No card in a card, and no card around every row.
- One filled button per screen. Other actions are text links or icon buttons
  without frames (the `link` and `tertiary` variants), still 44 px targets
  with a visible focus ring.
- A warning inside content is a short warm highlight on its words, not a
  filled box.

## Type and spacing

- Two type families, each with one job:
  - **Instrument Serif 400** (no other weight, no italic) for the display layer:
    the hero `h1`, section `h2`s, the product moment `h3`s, the manifesto lines,
    the founder's quote and the closing heading. Loaded in `src/pages/_app.tsx`
    as `--font-display`; `font-synthesis: none`, never a faux bold.
  - **Inter** for body text, buttons, navigation, small labels (the founder
    heading, status and plan names, prices, FAQ questions) and every product
    panel. The panels replicate the studio, so they stay in the studio's face.
  - A monospace only for the code line.
- Serif sizes (390 px → from 600 px, clamped to 1280 px): `h1` 56 → 64–92 px,
  line-height 1.0; section `h2` 42 → 48–64 px, 1.04; moment `h3` 34 → 40 px and
  up to 56 px on wide screens, 1.06; the booking headline 40 → 52 → 56–80 px;
  closing 46 → 56–80 px; manifesto 36 → 44–64 px; quote 28 → 32–42 px, 1.2.
  Tracking −0.01em (−0.015em on the largest), never the old −0.035em.
- Never one word in a heading set in italics or a colour. No all-caps or
  tracked-caps labels on the site (the product panels show the studio's own).
- Spacing on a 4 px scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64 …).
- Body text 16 px or larger (17 px on the homepage) at line-height 1.5–1.6;
  nothing a visitor must read below 13 px.

## The product section

Each moment in "From booking to chair" has its own layout (headline across the
page, full-width screen, screen first with words under it, a closing band).
Don't return to alternating text-and-screen rows or any zigzag; a new moment
gets a form the others don't use.

## Quality floor

- Every interactive element has a visible `:focus-visible` state and a target of
  at least 44 × 44 px on touch.
- Text contrast meets WCAG AA (4.5:1, 3:1 for large text) in light and dark.
- Works at 375 and 390 px without sideways scrolling.
- `prefers-reduced-motion: reduce` shows the finished page with nothing moving.
- English and Swedish stay in parity; no new claims without the maintainer.

## Before you say done

Screenshot the page at 390 and 1280 px, in light and dark, for `/` and `/sv`,
and check each screenshot against this list. Report what you saw, not what you
meant to build. Run `npm run lint`, `npx tsc --noEmit`, `npm test` and
`npm run test:concept` (it includes the axe checks).
