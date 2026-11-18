# r/selfhosted megathread comment

> For Niclas. Use a top-level comment in the current New Project Megathread
> only if the project qualifies by first public presence (including prior
> names), the downloadable demo and install docs meet the thread's rules,
> and the link works. Confirm the AI disclosure before posting.
> [Subreddit rules](https://www.reddit.com/r/selfhosted/about/)

**Project Name:** Cresavo

**Repo/Website Link:** https://github.com/Cresavo/cresavo

**Description:** I’m building Cresavo for my partner’s salon at home and
sharing it with every salon. Her booking platform gives her a hosted
booking page, but she can’t get her data out or connect an AI assistant.
The website I built for her can only link to that page.

Cresavo is open source under AGPL-3.0-only. I want salons to be able to
export their data, access it through an API or use it in their own AI tools
through MCP. The goal is to let salons run the software themselves, connect
their own website and choose their own POS and payment providers through
connectors. There’s an early concept demo at https://demo.cresavo.com/studio with
a fictional salon and no account needed. There’s a long way to go.

**Deployment:** Clone the repo and run `npm run demo` with Node.js 22.12+
(or 24+). The concept demo uses browser state and needs no database. The
README covers building the demo and the separate Postgres engine. Both are
work in progress. Please use fictional data.

**AI Involvement:** I recently got hooked on building software with AI
coding tools. I used them to build parts of Cresavo and draft this comment.
The in-app assistant is optional, and the booking demo runs without an AI
key.

If you try the local setup, I'd be glad to hear where the instructions leave
you guessing. What would you need documented before running booking software
for a small business?

