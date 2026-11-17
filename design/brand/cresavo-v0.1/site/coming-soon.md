# cresavo.com · Coming soon

A visitor should understand who Cresavo serves and be able to try it in one tap. Build a single, left-aligned composition with three regions in reading order. No image is needed here. The product itself supplies the imagery on the demo site.

## Final English copy

| Element | Content |
| --- | --- |
| Document title | Cresavo — More time. On your terms. |
| Description | A workspace for small service businesses. Explore a day at a fictional Stockholm salon. |
| Header | Cresavo wordmark |
| H1 | More time. On your terms. |
| Body | Cresavo brings bookings, customers and the work behind a small service business into one place. We're building it on an open-source foundation so you can choose the tools you work with. |
| Primary link | Explore the demo |
| Footer | Cresavo · Coming soon |

The link opens the demo in the same tab at [demo.cresavo.com](https://demo.cresavo.com/). Omit email sign-up in v0.1. The demo link is the only call to action. Leave the wordmark unlinked on this home page and give the image the accessible name “Cresavo”.

## Composition

| | Phone first | From 768 px |
| --- | --- | --- |
| Canvas | One column, 24 px inset (16 px at 320), 24 px top and bottom plus device safe areas | Centre a max-1160 px container with at least 48 px side gutters |
| Header | 144 px wordmark at the top left | 176 px wordmark, 48 px from the top |
| Main | Start on the same left edge. Centre the whole text/action group vertically in the space between header and footer | Keep the group towards the left, with open space on the right. Limit prose to 52ch |
| Hierarchy | H1 40/44, then 20 px to body 18/26, then 24 px to the link | H1 up to 72/76, body 20/30. Allow 24 px below the heading and 32 px before the link |
| Footer | 14/20 supporting text at the bottom of the composition | Same left edge as the wordmark |

The line break after “More time.” is intentional. Use two block spans within one H1 and allow each to wrap. Render the link as a filled button, 48 px minimum height, 20 px horizontal padding, 10 px corners. Align by the left edge of the button. Keep at least 32 px between header, main and footer. Use `min-height: 100svh` with an auto-growing middle row. Aim for one screen at 390 × 844 and 1280 × 720. Short landscape windows, large type and 200% zoom get ordinary vertical scrolling.

## Theme and behaviour

Use `--ui-bg` for the entire canvas, `--ui-text` for headline and body, and `--ui-text-secondary` for the footer. Light uses the light wordmark and aubergine action. Dark uses the dark wordmark and apricot action. The link uses `--ui-action-text` in both states and `--ui-action-hover` on hover and press. Draw the offset focus ring in `--ui-focus`. Follow the visitor's system preference on first paint. Preserve legible content with CSS fonts still loading, reduced motion, and JavaScript disabled. Use a normal anchor; this page needs no client-side interaction.

Use English document language and a site-area string dictionary. Keep the body factual as the product moves beyond the fictional demo.
