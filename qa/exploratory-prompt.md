You are doing an exploratory QA pass of "Cresavo", a concept demo of booking + customer software for small salons and clinics (fictional data, English UI). A production build is ALREADY RUNNING at http://127.0.0.1:3100 (do not start, stop, rebuild or modify the server, and do not edit anything under src/, tests/, package.json or other repo files). All demo state lives in the browser's localStorage, so you can change things freely in your own browser contexts.

Play two roles at once:
1. A picky first-time salon owner (foot care / massage salon, not technical) who opens the demo for the first time and tries to run a normal day: understand the landing page, open the studio, look at Today, the calendar, customers, inbox, "More" pages, book a phone caller ("Someone is calling"), move and cancel bookings, use the Assistant, change features (Essentials/Everything), switch Owner/Staff view, try the public booking page as a customer.
2. A QA engineer looking for anything broken, confusing, inconsistent or ugly: dead ends, buttons that do nothing, wrong or inconsistent copy, wrong numbers or dates, broken back navigation, layout overflow or clipped text at 390px wide (phone) and 1280px (desktop), dark mode problems, low-contrast or same-hue text on tinted backgrounds, focus/keyboard traps, missing empty states, confusing error messages.

How to drive the app: write Node ESM Playwright scripts in the folder qa-codex/ (this folder only) and run them with `node qa-codex/<name>.mjs`. Use `import { chromium } from "playwright"` and ALWAYS launch like this (the bundled browser version is missing, use this binary, and map the hosts):
  chromium.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell", args: ["--host-resolver-rules=MAP cresavo.com 127.0.0.1:3100, MAP *.cresavo.com 127.0.0.1:3100"] })
Then use these addresses (plain http):
  - http://demo.cresavo.com/            the demo landing (start here as the owner would)
  - http://demo.cresavo.com/studio      the owner's studio (also /studio/calendar, /studio/customers, /studio/inbox, /studio/more, ...)
  - http://demo.cresavo.com/boka/salong-eko   the salon's public booking page (customer view)
  - http://salong-eko.cresavo.com/      the same booking page on the salon's own subdomain
  - http://cresavo.com/                 the product's coming-soon page
Use browser contexts with deviceScaleFactor: 1, locale "en-GB", timezoneId "Europe/Stockholm"; viewports 390x844 and 1280x900; also try colorScheme "dark". Save screenshots to qa-codex/shots/ with descriptive file names (e.g. F03-calendar-overflow-390.png). Look at your screenshots (they are PNG files; inspect them) — visual problems count.

Do not contact any host except these local ones. Do not install packages. Spend roughly 45-60 minutes of effort, then stop.

Deliverable: write qa-codex/FINDINGS.md with a numbered list of findings. For each: a short title, severity (High = broken/blocks a task or shows wrong data; Medium = confusing, inconsistent, or clearly ugly; Low = polish), the role that noticed it (owner or QA), exact steps to reproduce (URL, viewport, what to click), expected vs actual, and the screenshot file name(s). Only report things you actually observed in this running app. Also list at the end what you checked that looked fine. Finish by printing the contents of FINDINGS.md.
