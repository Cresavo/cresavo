# Booking Lab SE – guide för agenter

Gäller Claude Code, Codex och Grok. Kort med flit: läs denna, sedan bara
det dokument din uppgift pekar på. Äldre historik ligger i
`docs/history/AGENTS_2026-11-16.md` – den ger **inga** uppdrag eller regler.

## Roller

- **Niclas** – produktägare. Bestämmer vad som byggs.
- **Claude Code** – teknisk ägare: plan, struktur, granskning, prompts.
- **Codex** – bygger enligt en goal-prompt i `docs/concept/`.
- **Grok** – granskar och klickar igenom, rapporterar i `docs/concept/REVIEW.md`.

## Aktuellt mål: klickbar AI-native demo

Läs `docs/concept/CONCEPT.md`. Fart och känsla går före full riktighet.
Arbeta på gren `concept/ai-native-demo` (eller en gren från den).

- Bygg i `src/app/studio`, `src/app/boka`, `src/concept/` och
  `src/app/api/concept/`. Rör inte befintlig `/admin`, `/api/v1`, MCP,
  Prisma-schema eller migrationer utan uttryckligt uppdrag.
- Konceptet använder fixture-data + webbläsarstate, ingen databas.
- AI-nycklar (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) är valfria och används
  bara på servern. Allt ska fungera utan nyckel.

## Så ser Niclas vad som händer

Efter varje större steg:
1. Uppdatera `docs/concept/PROGRESS.md`: datum, vad som är klart, hur man
   provar det (URL-sökväg), vad som är kvar. Kort, på svenska.
2. Ta mobil- (390 px) och datorskärmbild (1280 px) av nya sidor och lägg dem
   i `docs/concept/screens/` (png, max ~400 kB styck). Länka dem i PROGRESS.
3. Commita ofta med tydliga meddelanden och pusha grenen.

## Bevarade grundregler (gäller hela repot)

- Bara påhittad data. Inga riktiga kunders uppgifter, inga riktiga utskick.
- Inga hemligheter i Git. `.env` är ignorerad; nycklar loggas aldrig.
- Ingen deploy, ingen merge till `main`, ingen force-push utan Niclas ja.
- Befintlig bokningsmotor (`src/lib/domain.ts`, Prisma, MCP, `/api/v1`)
  har dubbelbokningsskydd, idempotens och kvoter som inte får försvagas.
  Tester mot databas kräver separat `_test`/`_demo`-databas
  (`scripts/test-db-guard.mjs`).
- Nya beroenden bara vid tydligt behov; skriv varför i commit-meddelandet.

## Kommandon

```bash
npm run dev          # http://localhost:3000 (kräver .env med DATABASE_URL för befintliga delar)
npm run lint
npx tsc --noEmit
npm test             # unit
npm run build
```

Konceptsidorna (`/studio`, `/boka/salong-eko`) ska fungera även utan databas.

## Karta över befintlig kod (återanvänd gärna idéer)

- `src/lib/domain.ts`, `time.ts`, `schedule.ts` – bokningsregler och tider.
- `src/lib/capacity.ts` – proaktiva förslag på luckor/kampanjer.
- `src/app/admin/` – nuvarande admin (kalender, kunder, tjänster, personal,
  översikt, kampanjer). Fungerar men upplevs rörig – konceptet ersätter UX:en.
- `src/app/api/v1/`, `src/mcp/` – agent-API och MCP (Claude/ChatGPT).
- `docs/ARCHITECTURE.md`, `docs/PRIVACY_SECURITY.md` – när du rör motorn.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
