# Landing copy: references and choices

The demo landing (`/` on demo.cresavo.com, `src/pages/landing.tsx`, strings in
`src/concept/site/en.ts`) sells Cresavo as the business tool for salons and
clinics. This note says what it borrows from and why each choice was made.

## References

**I could not open these sites from the build environment** (outbound web
access is blocked there), so nothing was reviewed fresh for this pass. The
notes below are what I know of each site's structure and tone from before.
Treat them as direction, not as a current audit, and nothing on the page is
copied from any of them.

| Reference | What we borrow | What we leave |
|---|---|---|
| Fresha, Timely, Square Appointments | The owner's outcomes first: a full calendar, fewer no-shows, clients booking themselves. Real product screens next to each claim. | Long feature grids, pricing tables, marketplace talk, stock photos of smiling stylists. |
| Cal.com | One sentence that says what it is, and a way to try it without signing up. | Developer framing in the hero. |
| Linear | Restraint: lots of space, one typeface, screenshots as the only imagery, one filled button. | The dark, glossy product-launch look (gradients, glows). |
| Plausible | Plain claims in plain words, and saying "open source, self-hostable" as a simple fact near the end. | Comparison-with-competitor sections. |
| Basecamp, HEY | Short sentences that sound like a person. One idea per block. | Their length and opinionated essays. |

## Choices

| Choice | Why |
|---|---|
| Hero is the promise, "More time. On your terms." | It is the brand's one line and it is the owner's benefit. The sentence under it says what the product is in ordinary nouns (calendar, customers, booking page). |
| Primary "Open the demo", secondary "See a booking page" | One filled button per screen. The demo needs no sign-up, so the clearest path is straight in. The second link shows the other side: what a customer sees. |
| Five feature sections | Visitors see a confirmed visit, a filled slot, a saved price, draft campaign copy and a journal entry. Each link opens the screen where the visitor can try it. |
| "You wake up to a fuller calendar." | A picture of the benefit instead of a feature name ("online booking"). No numbers we cannot back up. |
| Two sides of the same salon | The laptop shows the real Today schedule. The phone lets visitors pick a treatment and a time in the salon’s own colours. |
| "Try it in one minute", three steps | Visitors do not know where to click in a demo. Three tasks (book a client, move a time, see the booking page) each link to the right screen. |
| "Start simple. Add what you need." | The owner found everything-switched-on too much. Two links set the studio to Essentials or Everything; the copy lists what each contains and says it can be changed. |
| The assistant in one sentence | "An assistant for quick questions: it proposes, you approve." A quiet helper, named plainly, inside the Everything list. No "AI-powered". |
| "Open source. Yours to run." near the end | An honest fact and a reason to trust, in two sentences. Open data is one line: export, and an open API. Protocol names (MCP and so on) stay on the "For developers" page, linked in the footer. |
| Waiting list last | "Hear when it opens." closes the page. The button is outlined so "Open the demo" stays the one filled action. The answer is honest while no provider is connected (`docs/WAITLIST.md`). |
| No logos, counters, testimonials or badges | There are no customers yet; inventing proof would be dishonest, and the owner asked for calm. |
| Layout: a heading on the left edge, text in a second column, one rule between blocks | The brand's rhythm (one left edge, a second column) instead of a card grid. No gradients, glass or tinted text. |

## Words we avoid

AI-powered, seamless, effortless, all-in-one, platform, solution, leverage,
supercharge, revolutionise, next-generation. Also "simply" and "just".

## Regenerating the product tour

The laptop shows the studio and the phone offers a local sample booking.
The five recordings use fresh browser contexts on Wednesday 18 November at
09:20 in Stockholm. The booking page keeps Salong Eko’s own palette. The
studio recordings follow the visitor’s light or dark preference.

With the repository dependencies installed, install Playwright Chromium and
have FFmpeg with libx264, libvpx-vp9 and libwebp available. Build and start
the local demo from the repository root.

```sh
npx playwright install chromium
export DATABASE_URL=postgresql://build@127.0.0.1:1/build_test
export NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO=1 NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN=cresavo.com
npx prisma generate && npm run build
PUBLIC_READONLY=1 BOOKING_RUNTIME=local npx next start -p 3200
```

Run the recorder in a second terminal. It writes both encodings and a poster
from the same take into `public/site/`. To update individual scenes, pass
any of `booking day treatments campaign journal` after the script name.
`CHROMIUM_PATH` can point to an existing Chromium executable.

```sh
node scripts/record-landing-clips.mjs
```
