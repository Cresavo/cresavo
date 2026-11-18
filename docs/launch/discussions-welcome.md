# GitHub Discussions welcome and seeds

> Post the welcome in Announcements and pin it across the repository's
> Discussions. Publish each seed as its own thread under your own name.

## Welcome to Cresavo

Hi, I’m Niclas. I’m building Cresavo for my partner’s salon at home and
sharing it with every salon. I got hooked on building software with AI coding
tools, but her booking platform gives her no way to get her data out or
connect an AI assistant. The website I built for her can only link to its
booking page.

I want salons to be able to export their data, access it through an API or
bring it into their own AI tools through MCP. They should be able to connect
their own website and choose their POS and payment providers through
connectors. Cresavo is open source and there’s a long way to go.

If you run a salon or work in development, design or payments, I’d love
your help. What would you want to connect to a booking system first?

You can [try the early concept demo](https://demo.cresavo.com) with fictional data.
Use Ideas for suggestions and Q&A if you're stuck. For a reproducible bug,
[open an issue](https://github.com/Cresavo/cresavo/issues/new/choose). Please
keep examples fictional and [report vulnerabilities privately](https://github.com/Cresavo/cresavo/security).

A few lines are plenty. I'll read along and bring recurring themes back in
the weekly updates.

## Seed 1 · Ideas · What should a salon be able to export?

My partner runs a salon at home and can’t export her data from her booking
platform. If you were switching booking systems on Friday, what would you
need to take with you to open on Monday? Which fields or file formats would
make an export useful to you?

## Seed 2 · Q&A · How do I run the demo without AI or a database?

Can I try the studio on my own machine without setting up Postgres or
getting an AI key? Which parts can I try there?

**Maintainer reply to post and mark as the answer:** With Node.js 22.12+
(or 24+), clone the repo and run `npm run demo` from the repo root. Open the
studio at http://localhost:3000/studio and the fictional booking page at
http://localhost:3000/boka/salong-eko. Both use browser state. The separate
booking engine needs PostgreSQL.

## Seed 3 · Ideas · Which booking task interrupts your day?

Think about a busy day at your salon. A client calls, someone needs to
reschedule, or a slot opens up. Which task interrupts you most often? Tell
us what you do today using a fictional example.

