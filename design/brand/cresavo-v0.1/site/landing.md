# demo.cresavo.com · Demo landing

Start with Salong Eko. A visitor chooses which side of its working day to try before scrolling. The first action opens the studio directly. The second goes straight to the salon's public booking page. Both are ordinary same-tab links and work without signing in.

## First screen

| Element | Final English copy / destination |
| --- | --- |
| Document title | Explore the Cresavo demo |
| Masthead | Cresavo wordmark linking to https://cresavo.com/ |
| H1 | A day at Salong Eko. |
| Intro | Step behind the desk at a Stockholm salon, or see what a customer sees when they book a visit. |
| Filled primary link | Open the owner studio → `/studio` |
| Underlined secondary link | Try customer booking → `/boka/salong-eko` |
| Supporting note | Fictional demo. Changes stay in this browser. Use invented details when booking. |

The arrows in the route table indicate destinations and are outside the copy. Neither link needs an icon. At 390 px use a 24 px page inset, 144 px wordmark, 32 px to the heading and 24 px from the intro to the routes. Stack links on the same left edge with 8 px between targets and give both at least 44 px of touch height. Put the note directly under the choices. Images follow both links and the note in mobile reading order.

At 1024 px and up use two columns within 1160 px. Put the heading, intro, links and note in five columns of a twelve-column grid, an empty gutter column, and the studio figure in the remaining six. The links can still stack. Align the first schedule row with the intro. Use the marketing H1 scale and a 176 px masthead. At 320 px or text zoom allow labels to wrap and keep the page in normal flow.

## Below the routes

Use two short sections in this order. The owner figure sits by the hero on desktop and immediately above the owner section on mobile. Use one copy of the figure, repositioned in the grid. Keep the customer section and its figure together. Do not add a second set of route buttons.

| Section | Heading | Body |
| --- | --- | --- |
| Owner | Find room in the day. | In Today, look for an opening between visits. Select “Someone is calling” to see available times while you have a customer on the line. |
| Customer | Book with the salon. | Choose a treatment at Salong Eko, pick a time and review the visit. The page wears the salon's name and colours, right through to confirmation. |

End with a quiet text link **About Cresavo** to [cresavo.com](https://cresavo.com/). Place a note alongside it, “Messages and payments are simulated.” Keep this a walkthrough of what visitors can click. Infrastructure and upcoming integrations belong in product documentation.

## Screenshot art direction

Use these repository images as the composition sources. All are fictional. Export cropped image files at implementation time so no off-screen text or hidden legacy brand is shipped in the thumbnail. Supply intrinsic image dimensions to reserve space. Use a single responsive picture per subject.

| Subject | Source and crop | Alt text |
| --- | --- | --- |
| Owner, narrow | [Today at 390](../../../../docs/design/after/today-390-light.png) and [dark](../../../../docs/design/after/today-390-dark.png). Crop to “Today's schedule” and the first three rows, retaining time, staff name and free-slot label. Exclude both the masthead and floating launcher. | Today's schedule with a free slot between two appointments. |
| Owner, wide | [Today at 1440](../../../../docs/design/after/today-1440-light.png) and [dark](../../../../docs/design/after/today-1440-dark.png). Crop the main schedule column to the heading and first few visits, excluding sidebar, top bar and right-hand panels. Keep the day readable at the final image width. | Today's schedule with a free slot between two appointments. |
| Customer | [Booking at 390](../../../../docs/design/after/boka-time-390-light.png). Crop to the green selected date and available time buttons under “When would you like Medical foot care?” Use this narrow detail at all widths. | Salong Eko's booking page showing available times for medical foot care. |

Keep the owner figure beside the real copy, with at most one 1 px border and no device bezel, shadow or overlay text. Refresh full-shell photography after Cresavo and the assistant label are in place if a wider screenshot is later needed. The studio image follows the landing theme. Salong Eko's image keeps its actual fixed light palette in both themes. Show its own surface against the dark surround without recolouring the capture.

## Interaction and acceptance

- Platform canvas, type, links, focus and control states use the same token roles as [the coming-soon page](coming-soon.md). Follow the visitor's system scheme. The studio then honours its saved appearance, and the customer route enters the tenant boundary.
- Put site copy and alt text in the page's English dictionary. Use `lang="en"`, a single H1, H2s for the two sections and meaningful figure alternatives. Keep all the information needed to choose a route in live text.
- Verify both routes by keyboard at phone and desktop widths, then use browser Back to choose the other view. At 200% text zoom both routes must remain visible by scrolling, with no clipped focus ring or horizontal page scroll. Keep all copy opaque in every interaction state.
