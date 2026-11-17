# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/) (`0.x` while in concept stage).

## [Unreleased]

### Fixed
- Voice journal: sentences about treating skin or nails are no longer filed
  under observations.

### Added
- Customer card: a one-line summary at the top ("Regular since 2024, foot care
  every 6 weeks, sensitive skin, prefers Anna, afternoons") and the next
  suggested visit with a one-tap time suggestion.
- Return visits (Customers > Due back): set the return interval per treatment,
  see who is overdue and send a simulated SMS with a ready booking link that
  lands in the Inbox.
- Customer segments as filters: regulars, not seen in 3 months, new this year,
  birthday this month.
- Journal templates (foot care, ingrown nail, massage, deep tissue),
  before/after photos and version history that keeps earlier wording after edits.
- Customer import from CSV with column matching and preview, plus an example
  file (`/demo/customers-example.csv`).
- Command box at the top of every studio page: type or speak what you want,
  review a proposal with before/after, then approve, edit or cancel. Questions
  about earnings and lapsed customers are answered in the card.
- Voice journal: dictate a visit, get treatment, observations, advice and next
  visit as editable fields, and book the next visit in one tap.
- Your data & AI shows which AI task runs on which model (or built-in rules),
  a cost log, and a demo form for your own AI key (not stored).
- Customer booking page (`/boka/salong-eko`): describe what you want in your own
  words or pick a treatment, choose a time, confirm with name and phone. Includes
  add to calendar, reschedule, cancel (free until 24 hours before), "My bookings"
  with rebooking, and a waiting list for full days that reaches the owner's Inbox.
- Links from the start page to the customer page and owner studio demos.
- Salon command proposals and seven optional AI tasks work without API keys.
- AI evaluation command checks salon scenarios and reports accuracy, time and
  estimated cost, with no network calls by default.
- Concept for an AI-native salon system: owners and customers say or type
  what they want and approve a proposal; everything also works with buttons.
- Owner studio (`/studio`) demo: Today, Calendar, Customers, Inbox and More,
  with realistic fictional data (in progress).
- Goal queue, agent guide, quality and security baseline, and release process.

## [0.1.0] - 2026-11-16

### Added
- Booking engine proof of concept: online booking, admin calendar, customer
  register, services and staff, proactive capacity suggestions, agent API and
  MCP with customer approval before booking.
