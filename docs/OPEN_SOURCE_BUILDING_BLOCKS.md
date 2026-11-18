# Open source building blocks

Reuse before we build, but only when the result is as good as we would build
ourselves. Licences below were read from each project's LICENSE file on
2026-11-17; re-check before adding a dependency. Our code is AGPL-3.0, which is
compatible with MIT, Apache-2.0, BSD and MPL-2.0 dependencies. Prefer
permissive licences (MIT, Apache-2.0, BSD). Treat "open core" projects with
care: parts may need a commercial licence.

| Need | Candidate | Licence (verified) | Use it for | Notes |
|---|---|---|---|---|
| Phone answering (voice agent) | Pipecat | BSD-2-Clause | Real-time voice pipeline: telephony audio ↔ speech ↔ LLM ↔ tools | Pairs with 46elks (Swedish numbers, realtime voice over WebSocket) or Twilio. Our tool registry stays the brain. |
| Phone answering (alternative) | LiveKit Agents | Apache-2.0 | Same, with LiveKit's media server | Heavier; pick one of the two. |
| Transactional email templates | React Email | MIT | Booking confirmations, reminders, receipts, owner digests | Renders with the tenant's brand. Sending via a provider (SES, Postmark, Resend). |
| Notifications fan-out | Novu | MIT (verify `ee/` folders before use) | One API for email/SMS/push/in-app per tenant | Optional; our Inbox may be enough at first. |
| Background jobs and schedules | Trigger.dev | Apache-2.0 | Routines, reminders, briefs on a real schedule (today they only run while the studio is open) | Or a simple Postgres-backed queue first. |
| Authentication | Better Auth | MIT | Owner/staff login, MFA, sessions, roles (pilot gate) | Fits Next.js + Postgres; replaces demo role switch. |
| Calendar UI | Schedule-X | MIT (core) | Week/day/resource views if our own calendar hits limits | Premium plugins are separate; our calendar works today. |
| Calendar UI (alternative) | FullCalendar | MIT (standard) | Same | Resource/timeline views are premium-licensed. |
| Rich text | Tiptap | MIT (core) | Journal entries, campaign copy, help articles | Pro extensions are paid. |
| UI primitives | shadcn/ui (on Radix/Base UI) | MIT | Accessible dialogs, menus, comboboxes when ours get complex | Copy-in components, no lock-in. |
| Charts | Recharts | MIT | Finance and reports if our SVG charts are not enough | Keep our tested colours. |
| Images / posters | Satori | MPL-2.0 | Server-side PNG for campaign posters and OG images | File-level copyleft; fine as a dependency. |
| Speech to text (self-hosted) | whisper.cpp | MIT | Voice journal and call transcripts without sending audio to a third party | Option for self-hosters; cloud API otherwise. |
| Social publishing | Postiz | AGPL-3.0 | Publish campaigns to Instagram/Facebook/TikTok/LinkedIn | Same licence as ours; run as a separate service, talk via its API. |
| Scheduling reference | Cal.com | MIT (root licence; check enterprise folders) | Ideas and possibly code for availability/round-robin | Do not copy blindly; our engine already covers this. |
| Search | Meilisearch | Business Source (enterprise parts) | Avoid for now; Postgres full-text search is enough | Licence not permissive. |

Not verified here: self-hosted mail servers (e.g. Postal, Stalwart). We do not
plan to run our own mail server; deliverability is a specialist job. Use a
sending/receiving provider with per-tenant domains instead.
