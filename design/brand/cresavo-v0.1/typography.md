# Cresavo typography

**Use Inter throughout the product.** Its tall lowercase letters keep names legible at 14 px, and its tabular figures keep 11:00 and 14:45 the same width in a calendar. Inter is available on Google Fonts under the SIL Open Font License 1.1. Keep the existing self-hosted delivery, Latin and Latin Extended coverage, and the system fallback in `--font-ui`. Include the licence with any distributed font files. [Inter family and features](https://rsms.me/inter/) · [Google Fonts specimen](https://fonts.google.com/specimen/Inter)

Use 400 for reading, 500 for controls, 600 for headings and selected labels. Reserve 700 for brief emphasis. Apply `font-variant-numeric: tabular-nums` throughout the studio. Align amounts to the end of a column and times to its start. Keep the currency with its amount and the owner's locale in the formatter. Demo examples use en-GB dates, a 24-hour clock and SEK.

## App scale

Values are size / line height in CSS px at the default root size. Implement with rem and unitless line heights so text zoom scales both.

| Role | Phone | Wide | Weight and spacing |
| --- | --- | --- | --- |
| Page title | 26 / 32 | 28 / 36 | 600, −0.025 em |
| Section title | 17 / 24 | 17 / 24 | 600, −0.01 em |
| Body, form field | 16 / 24 | 16 / 24 | 400, normal |
| Button, row title | 16 / 22 | 16 / 22 | 500, normal |
| Schedule detail, table label | 14 / 20 | 14 / 20 | 400 or 500, normal |
| Badge | 12 / 16 | 12 / 16 | 600, normal |

Small type belongs to an adjacent label. Set interactive hit areas to at least 44 × 44 CSS px and inputs to at least 16 px. Keep full names accessible when rows truncate. At 200% zoom allow labels and buttons to grow vertically. Check Swedish diacritics and longer translated service names.

## Site scale

| Role | Phone | Wide | Weight and spacing |
| --- | --- | --- | --- |
| Promise / H1 | 40 / 44 | 72 / 76 | 500, −0.04 em |
| Section / H2 | 28 / 34 | 40 / 46 | 500, −0.03 em |
| Intro | 18 / 26 | 20 / 30 | 400, normal |
| Body and links | 16 / 24 | 16 / 24 | 400, links 500 |
| Caption and footer | 14 / 20 | 14 / 20 | 400, normal |

Scale the H1 fluidly between those endpoints. Give prose a maximum of 58ch and let headings wrap. Keep both sentences of the promise at the same weight. Use the existing Inter file for both sites. If a display cut is already available, Inter Display 500 may replace Inter on marketing headings at 40 px and above. The outlined mark uses Inter Display 600 with its single-storey a. Use the supplied SVG there. Keep the UI's familiar double-storey a in running text and controls. [Wordmark specification](wordmark/README.md)
