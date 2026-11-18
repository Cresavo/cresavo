# Roadmap

Cresavo starts with salons and clinics. The goal is to make booking and the
owner's day easier while giving businesses control of their data, their website
and the tools they connect. See [project status](STATUS.md) for what works today.

## Available in the demo

Try the owner studio and the customer booking page with a fictional salon.
The demo covers booking, schedules, client history, inbox, campaigns, stock and
finance. Owners can use the built-in assistant to draft changes and approve
them. The separate booking engine and its agent interfaces are available for
local testing. [Try the demo](https://demo.cresavo.com).

## Current priorities

- **Core workflows and accessibility.** Keep booking, rescheduling and daily
  planning reliable across mobile and desktop. Make common settings easier to
  find.
- **Business-level localization.** Give each business its own language,
  currency, time zone and date formats. Keep English as the source language.
- **Connections.** Build on the simulated messaging, payment and calendar
  adapters. Make provider setup, permissions and costs clear. Continue
  exploring business email, phone answering and campaign publishing.
- **Salon websites.** Develop the business-branded booking page and replace
  simulated domain setup with verified ownership and clear DNS status.

## Pilot readiness

Connect the studio to the booking engine, then prove tenant isolation,
owner and staff access, data export and deletion, backups and restore,
and operational monitoring. The quality, security and privacy checks must
pass before real customers use Cresavo. [Pilot gate](QUALITY_SECURITY.md#pilot-gate-before-the-first-real-customer).

## Open-source project

Maintain a clear route to self-hosting and contribution, document public
interfaces and release changes in small, testable steps. Share feedback and
questions in [GitHub Discussions](https://github.com/Cresavo/cresavo/discussions).
