# Cresavo symbol studies

**Recommend Open hour.** The curve cut into the doorway makes the empty part of the mark its subject. It gives “More time. On your terms.” a visual expression that fits a clinic as readily as a salon. The opening survives at 16 px, and the arch sits comfortably beside the rounded c and o of the master wordmark.

[View the full contact sheet](contact-sheet.png) · [Open the local HTML proof](contact-sheet.html)

| Concept | What survives at 16 px | Decision beside the wordmark |
| --- | --- | --- |
| [Cutaway c](cutaway-c/rationale.md) | The open bowl and blunt lower terminal read immediately. The diagonal is subtler here. | Closest relative of the lettering. In the lockup the initial appears twice in quick succession. |
| [Daybreak](daybreak/rationale.md) | The dot and the low arc stay separate. | Lightest of the five. The rising tip leads the eye toward the name, though the silhouette can also read as a bowl. |
| [Guest chair](guest-chair/rationale.md) | The raked back, seat and folded base give it a clear side profile. | Most specific to a service business. Its strong diagonal draws more attention than the quiet lettering. |
| [Open hour](open-hour/rationale.md) | One solid arch frames a broad, off-centre opening. | Best overall balance. The crown echoes the o, and the angled foot distinguishes the symbol from another letter. |
| [Coat check](coat-check/rationale.md) | The central punch and paired side notches survive in a compact silhouette. | Strongest as a small reception or booking badge. Its ticket shape also suggests admission or a voucher. |

## Using the artwork

Each folder contains a transparent 64-unit symbol and a self-contained horizontal lockup in light and dark variants. Aubergine ink sits on warm neutral and apricot ink on dark canvas. For the app and profile versions, inset the symbol by 14% on each side of an apricot tile in light mode or an aubergine tile in dark mode. The app corner radius is 23% of the side. The profile uses the same inset in a circle.

The lockups carry the seven original glyph outlines. Allow half the final o’s height as external clear space and keep the **wordmark portion** at least 96 CSS px wide. With these viewBoxes that gives a minimum total lockup width of 127 CSS px.

## Proof and refinement

Each row shows the 16 and 32 px favicons on bare canvas, both rounded-square app sizes, a 52 px profile crop and the lockup. The sheet is drawn at 1672 × 3555 CSS px and exported at 2×. Open the HTML at a viewport width of 1672 CSS px to compare the specimens at their labelled sizes.

In the first proof the chair’s base nearly met its seat at 16 px. Widening that wedge and lifting the symbol slightly in the lockup kept its bent frame visible. The ticket gained a taller body and a wider punch. Open hour gained a higher, angled right foot and a slightly smaller lockup symbol so its dark crown sits more evenly beside the lettering.

With Playwright and Chromium installed, run this from the repo root to render the sheet at device scale factor 2.

```sh
node design/concepts/symbol-v1/render.cjs
```

Chromium startup was blocked by the local sandbox during this review. The supplied PNG was rasterised at 2× from the same SVG composition in the HTML using librsvg.
