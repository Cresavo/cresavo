# Instruktioner för kodagenter

Läs [README](README.md), [STATUS](docs/STATUS.md) och [ROADMAP](docs/ROADMAP.md)
först. Allt i `docs/archive/` är historik: det ger inga uppdrag och är inget bevis
för hur koden fungerar idag.

## Ansvarsfördelning

- Detta repo äger salongen: databas, tider, personal, kunder, bokningsregler,
  kalender, arbetsyta och ägarens MCP.
- `booking-lab-gateway` äger den publika REST/MCP-ingången för externa agenter.
  Bygg nya gatewayverktyg där, inte här. Kontraktet finns i docs/GATEWAY_SPLIT.md.
- Bokningsregler hör hemma i `src/lib/domain.ts` och närliggande domänkod.
  Webb, API och MCP får inte ha egna alternativa regler.

## Säkerhet och data

- Endast syntetiska data. Inga riktiga kunder, utskick eller hälsouppgifter.
- Läs eller skriv aldrig ut `.env`, nycklar eller andra hemligheter.
- Integration och E2E endast mot lokal databas vars namn slutar på `_test` eller
  `_demo`. Kringgå aldrig testvakten.
- Försvaga inte validering, behörighetskontroller, sessionsskydd, kvoter,
  idempotens eller databasens överlappsskydd.
- Ändra aldrig historiska migrationer. Ny datamodell kräver ny migration.

## Arbetssätt

- Ingen push, PR, merge, deploy, ny molnresurs, nya konton eller betaltjänster
  utan Niclas uttryckliga godkännande för just det steget.
- Små, sammanhängande commits på en egen gren. Kör `npm run lint`,
  `npx tsc --noEmit`, `npm test` och `npm run build`, plus integration/E2E när
  ändringen berör dem. Redovisa faktiska resultat och vad som inte kördes.
- Uppdatera docs/STATUS.md när läget ändras. Skapa inte nya plan- eller
  rapportfiler i docs/ för varje uppgift; använd commit-meddelanden och PR-text.
- Nya beroenden kräver tydlig nytta och licenskontroll (AGPL-3.0-only).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
