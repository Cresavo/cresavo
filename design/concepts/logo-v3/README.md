# Cresavo · Lettering studies, round three

[Open the contact sheet](contact-sheet.png) · [View at native CSS sizes in a browser](contact-sheet.html)

Read across each row to compare the same lettering with and without a symbol. Both themes show the horizontal lockup, a 16/32/64 px mark, a 180 px app icon, a 48 px round avatar and a monochrome lockup. Salong Eko is the fictional business in each booking header. Its opt-in footer credit pairs 10 px “Booked with” text with a 14 px-high Cresavo lockup.

| Wordmark only | With a symbol | Where the difference shows |
| --- | --- | --- |
| [A1 · Pen note](a1-pen-note/README.md) | [B1 · Apron tie](b1-apron-tie/README.md) | The name has a signature of its own. The loop gives the app a more recognisable silhouette. |
| [A2 · Sunday](a2-sunday/README.md) | [B2 · Palm](b2-palm/README.md) | Sunday is the clearest small credit. The cupped hand adds warmth, especially at avatar size. |

**First choice — A1 · Pen note.** The rising exit of the **c** and the open **e** make it feel signed by a person. That quality carries into a small booking credit. The isolated initial is quieter than the apron tie, a trade I would take for this audience.

## What changed in proof

1. **After the first render** the opening **cr** in Pen note felt pinched and the **vo** loose. I moved the **r** and **e** right and the **o** left. A pinhole at the tie's crossing broke its line, so I changed the overlap to a continuous fill. Palm's upright fingers resembled a crown at 16 px. I redrew the hand in profile with an open wrist.
2. **After the second render** the tie looked like an extra cursive letter before the name. I turned its loop back to the left and lengthened the free end. Sunday's initial felt anonymous on the 180 px tile. I curled its upper lip inward and tightened the space ahead of the **e**. I also recentered the two symbols in their square and circular crops.

At 16 CSS px, a separate single-density Chromium proof kept both initials open, the tie's loop hollow and the wrist gap visible. Palm still depends most on context.

## Artwork and rendering

Each folder contains self-contained SVGs with hand-drawn, closed Bézier outlines. The monochrome mark and lockup use `currentColor` for a single ink. The sheet shows them in black on warm paper and white on dark. The colour versions use the Cresavo tokens for aubergine (`#50364B`), apricot (`#F2B184`) and warm neutrals.

With the repository's Playwright dependency and Chromium installed, run `node design/concepts/logo-v3/render.cjs` from the repository root. Set `CONCEPT_BROWSER_CHANNEL=chrome` to use an installed Chrome. The renderer captures a 1344 CSS px-wide sheet at deviceScaleFactor 2. All labels and booking text belong to the proof page. The lettering in every logo asset consists of paths.
