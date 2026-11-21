# Roadmap

Cresavo is a booking system for salons, hairdressers and treatment businesses,
with AI help built in: an assistant for the owner's day and help with
marketing. Owners keep control of their data, their website and the tools they
connect. See [project status](STATUS.md) for what works today.

We build in three stages and work on one stage at a time. A stage is done when
a real business uses it, not when the code is merged.

## Stage 1: Foundation and marketing (now)

**Goal.** A real salon owner logs in and makes social media posts with Cresavo
that they are happy to publish.

Marketing is the first pilot's biggest daily problem, and it needs no payments,
no customer bookings and no customer data. It forces the foundation that
booking needs as well: owner login, one business per account and its data
stored on the server instead of in the browser.

- Owner login and a business stored on the server (`StudioStore` on Postgres).
- A photo library for the business's own pictures, uploaded from a phone.
- Brand settings: colours, fonts and logo.
- Post and story templates that put text on the owner's own photos.
- An editor to move, resize, crop and change text, photo and colour.
- AI-suggested captions in the business's tone, with templates when no AI key
  is set. No AI-generated images.
- Download or share to Instagram and Facebook from the phone. Scheduling stays
  in the owner's existing tools, such as Meta Business Suite.
- The owner's adjustments become the defaults for the next suggestion.

**Done when** the pilot salon has published four posts made in Cresavo without
another design tool.

## Stage 2: Live booking

**Goal.** Real customers book on their own phones and the booking appears in
the owner's studio.

- Public booking page reads and writes the server store.
- Confirmation, reminder and a cancellation link by e-mail; text messages optional.
- Import of an existing customer list.
- Service buffers and processing time (for example colour), so hairdressers
  can use it.
- Owner assistant and agent access (API, MCP and the
  [gateway](https://github.com/Cresavo/gateway)) read the same store.

**Done when** a salon has taken real bookings for two weeks without another
booking system. Payment stays in the salon's existing till.

## Stage 3: Till and payments through connections

**Goal.** Fewer double entries for salons that want one system.

Cresavo does not build its own cash register. It connects to the till and
payment provider the salon already uses, and may later take deposits online.
Legal requirements are checked against official sources before this starts.

## Not planned now

Group classes with capacity, memberships, gyms, door access, new industry
profiles and new demo features. The demo gets fixes, not new features, while
stages 1 and 2 are in progress.

## Pilot gate

Before real customer data is stored, the quality, security and privacy checks
must pass: tenant isolation, owner access, data export and deletion, backups
and restore, and monitoring. [Pilot gate](QUALITY_SECURITY.md#pilot-gate-before-the-first-real-customer).

## Open-source project

Maintain a clear route to self-hosting and contribution, document public
interfaces and release changes in small, testable steps. Share feedback and
questions in [GitHub Discussions](https://github.com/Cresavo/cresavo/discussions).
