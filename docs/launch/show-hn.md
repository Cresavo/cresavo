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

Hi HN, I'm Niclas, the solo maintainer of Cresavo in Sweden. My partner runs
a foot-care salon, and I wanted to see what booking software would look like
if it were built around a small salon's day. I think booking software should
belong to the salons that use it.

You can open the studio, use “Someone is calling” to enter a fictional
appointment, or try the customer side at
https://demo.cresavo.com/boka/salong-eko. There's no sign-up. This is a
concept demo with fictional data and browser state.

The code is AGPL-3.0-only at https://github.com/Cresavo/cresavo. From a clone,
`npm run demo` starts the studio without a database or an AI key. The booking
engine uses Postgres and is still separate from the studio. There's an
optional MCP connection for clients such as ChatGPT and Claude in a
configured setup. The calendar and booking flow work without it.

I'd like to hear from anyone who's moved a small business off a booking
platform. Which records and details did you need to bring with you?

