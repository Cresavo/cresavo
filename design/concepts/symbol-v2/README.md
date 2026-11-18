# Cresavo · Round two symbol studies

[Open the contact sheet](contact-sheet.png) · [Inspect at native CSS sizes](contact-sheet.html) · [Open the recommended logo kit](../../logo/README.md)

| Direction | At 16 px | Beside the wordmark |
| --- | --- | --- |
| **[Open hour](open-hour/symbol.svg)** · [dark](open-hour/symbol-dark.svg) | The sill gives the eye a floor. Daylight separates the arch from the door swung towards the viewer. | **Recommended.** The arch picks up the curve of the o. The projecting door gives the signature a recognisable silhouette before the reader reaches the name. |
| **[Cutaway c](cutaway-c/symbol.svg)** · [dark](cutaway-c/symbol-dark.svg) | A slanted upper face cuts back into the counter. Its line still changes direction at the mouth of the c. | Closest match to the lettering. The horizontal signature puts two initials side by side. |
| **[Folded slip](folded-slip/symbol.svg)** · [dark](folded-slip/symbol-dark.svg) | The short return and long face of the paper slip stay separate. The curl at the foot becomes subtle. | The leaning paper gives the name movement. Its association with an appointment reminder is clearest on a larger tile. |
| **[Between visits](between-visits/symbol.svg)** · [dark](between-visits/symbol-dark.svg) | Two offset shapes, each drawn from the curve of the o, leave a diagonal pause in the middle. | The balanced pair works well above the name. The connection to the space between appointments takes more explanation. |

## Optical review

In the first proof, Open hour’s two upright pieces still suggested a letter in the small lockup. In the next drawing a sill turned the left piece into a frame. The pointed upper cut of Cutaway c also became a folded corner, and the angular appointment slip gained a curved return so the paper could be read edge-on.

A second refinement widened the daylight above Open hour’s door and deepened the sill. This preserved both the floor and the diagonal edge at 16 px. The final horizontal lockup makes the doorway about 1.3 times the visible height of the letters, with a gap of roughly half an o-height before the c. The folded slip gained a wider crease, and the two halves of Between visits pulled apart slightly at the waist.

## Rendering

The HTML proof shows 16, 32 and 64 CSS px symbols, 180 and 512 CSS px rounded app tiles, a 64 CSS px circular crop and both lockups on each ground. Open it at a viewport width of 1800 CSS px for side-by-side inspection. The PNG is a full-page Chromium capture at device scale factor 2.

Run `node design/concepts/symbol-v2/render.cjs` from the repository root with Playwright and Chromium installed. To select the provided browser, prefix the command with `CHROMIUM_PATH=/opt/pw-browsers/chromium`.
