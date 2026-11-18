# Show HN draft

> For Niclas. Use this as a brief and write the title, first comment and
> replies yourself, from scratch. HN bars generated submissions and
> generated or AI-edited comments.
> [Hacker News guidelines](https://news.ycombinator.com/newsguidelines.html)

## Title

Show HN: Cresavo, an open-source booking demo for salons

## Submission URL

https://demo.cresavo.com/studio

## First comment

I’m building Cresavo for my partner’s salon at home and sharing it with
other salons. I recently learned to build software with AI coding tools and
got hooked. Her booking platform gives her a hosted page, but the site I
built for her can only link to it. She can’t export her data or connect an
AI assistant to help with the salon.

In the early concept demo, you can use “Someone is calling” to enter a
fictional appointment, or try the customer side at
https://demo.cresavo.com/boka/salong-eko. There’s no sign-up. It runs on
fictional data and browser state.

The source is AGPL-3.0-only. From a clone, `npm run demo` starts the studio
without a database or an AI key. The Postgres booking engine is still
separate from the studio. https://github.com/Cresavo/cresavo

I want salons to be able to export their data, access it through an API or
use it with their own AI tools through MCP. I also want them to be able to
connect their own website and choose their POS and payment providers through
connectors. There’s a long way to go. If you’ve moved a small business off
a booking platform, I’d appreciate hearing what you needed to take with you.

