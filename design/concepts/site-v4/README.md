# Cresavo homepage directions

**Lead with A.** In one glance the visitor can see who asked for the appointment, who found the opening and who had authority to book it. The important qualification sits beside the sequence title. Customer-agent booking is coming soon. Owners can already connect their own assistant via MCP.

[Stacked overview](overview.png)

| Direction | Standalone page | First viewport | Full page | Phone |
| --- | --- | --- | --- | --- |
| A · Booked by AI. Approved by you. | [Open A](a/index.html) | [Desktop](a/desktop.png) | [Full](a/full.png) | [Mobile](a/mobile.png) |
| B · Your salon, answered. | [Open B](b/index.html) | [Desktop](b/desktop.png) | [Full](b/full.png) | [Mobile](b/mobile.png) |
| C · One inbox, every channel. | [Open C](c/index.html) | [Desktop](c/desktop.png) | [Full](c/full.png) | [Mobile](c/mobile.png) |

Each HTML file opens directly from disk and embeds its own assets. The current wordmark and v0.1 tokens come from the repo. The serif in B uses the reader’s installed Georgia or Times family. All three waitlists demonstrate the form locally. The GitHub and demo links lead to the real destinations.

## Art direction and five-second review

These observations come from the rendered pages and timing the prototype. Audience comprehension still needs testing with owners.

### A · Follow one appointment

The three panes depend on one another. The same Friday opening passes from a neutral chat, through a salon availability check, into the owner’s actual decision. The wide layout plays as a continuous strip. On a phone, the active pane takes the available width.

- **First pass.** The middle pane resembled a place card. Enlarged the time, gave the active pane an apricot rule and strengthened the dashed proposal edge. Extended the customer request beat so the opening question gets more reading time.
- **Second pass.** Held the time back until the availability check, named Alex in the request and added a keyboard-operable timeline. Reduced-motion readers get the completed sequence, with all three panes visible on mobile.
- **Five seconds.** Alex asks immediately. The opening appears at 1.45 s, the proposal at 2.55 s, the owner taps at 3.65 s and the booking lands at 4.35 s. The 6.6 s loop leaves a reading pause after approval. The risk is that a moving sequence can outrun a reader. Pause, scrubbing and mobile step controls let them revisit a beat. [Request](a/frame-1-request.png) · [Proposal](a/frame-2-proposal.png) · [Booked](a/frame-3-booked.png)

### B · Put the reader in the room

A large local photograph sets the pace. A narrow appointment clipping overlaps its margin. Further down, three short paragraphs follow Anna through the opening, the decision and the record of her change. Two small crops from the studio supply the evidence, including the actual Undo action.

- **First pass.** The opening spread could have belonged to a salon itself. Brought the 14:45 appointment onto the photograph and shortened the introduction to the owner’s question and approval.
- **Second pass.** Repeated 14:45 in the link into the story, adjusted the clipping’s angle and mobile placement, and tightened the lower comparison headline. The booking time carries the reader from the room to the calendar.
- **Five seconds.** The reader sees a salon, a question they might ask their own AI and one resulting visit. B communicates the owner’s role immediately. The details of interoperability and the activity log require scrolling. This is the strongest choice for an owner who first wants to recognise their day.

### C · Trace a request

Each channel is a working input. Choosing it changes the highlighted path, incoming question, drafted reply, appointment time and service. On mobile the five channels feed downward into the same inbox. The calendar changes only when the visitor approves the proposed booking.

- **First pass.** The calendar looked final before approval. Gave the proposal a dashed edge and a “Proposed time” label, then switched to a solid edge when booked. Enlarged channel labels and gave the ownership comparison the full width of a reference table.
- **Second pass.** Made the owner’s own AI explicit in the opening sentence, moved a signal along the outgoing connection on approval and added Undo to the booked appointment. The incoming signal settles after two passes, and reduced motion keeps the path still.
- **Five seconds.** The map exposes all five inputs, one draft and one proposed time before interaction. The approval rule becomes clearest on the first click. C explains how the product fits together particularly well for someone comparing inbox tools. The breadth of channels competes with the owner-assistant story as an apex headline.

## Template review

The pages start with their headlines. A’s three positions are sequential booking states. B keeps its prose asymmetrical and gives the photograph room. C uses connected, selectable inputs whose output the visitor can change. Each waitlist sits on the page canvas with a labelled field. Apricot marks an active control, a calendar header or the emphasis in A’s headline. Dark neutral ink carries text on the pale surfaces. The designs use flat colour, the existing wordmark and ordinary product controls.

## Reference study

- Linear places readable issue titles and activity directly into its marketing narrative. A adopts the principle of showing a consequential change through product text. [Linear](https://linear.app/)
- Granola explains where a person’s contribution ends and the assistant’s work begins. That distinction informed the separate request, draft and approval states. [Granola’s product introduction](https://www.granola.ai/blog/announcement)
- Aesop pairs a photograph of a particular location with a small caption and room for the adjoining text. B uses the supplied Salong Eko room as its setting. [Aesop impact report, pp. 17–18](https://www.aesop.com/on/demandware.static/-/Sites-aesop-us-Library/default/v5fee25a612add25852818bc09d5a92275f057f16/pdf/Aesop_ImpactReport2025_FINAL.pdf)
- Teenage Engineering introduces its field system as one connected set, then lets the reader inspect individual components. C takes that order of explanation into an interactive channel map. [Field system](https://teenage.engineering/products/field-system)

## Capture details

Chromium via Playwright. Desktop viewport 1440 × 900 CSS pixels. Full desktop captures use the same width. Mobile viewport 390 × 844 with full-page capture. All exports use device scale factor 2. The overview uses the three desktop first viewports at equal scale.
