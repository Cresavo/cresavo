<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Guide för Booking Lab SE

- Läs `README.md`, `docs/ARCHITECTURE.md` och `docs/ENGINEERING_PRINCIPLES.md` före ändringar.
- Gör små, tydliga ändringar; behåll webb och MCP på samma domänlogik. Ändra inte API-kontrakt eller migrationer utan uttryckligt uppdrag.
- Behåll servervalidering, admin- och origin-kontroller samt PostgreSQL:s överlappsskydd. Använd bara syntetiska kunduppgifter.
- Kör relevanta tester, lint och build enligt README; ange vad som faktiskt körts och eventuella begränsningar. Använd en separat testdatabas.
- Lägg inte till beroenden utan tydligt behov. Publicera inte, lägg inte till remote och exponera inte hemligheter utan uttryckligt uppdrag.
- Följ `docs/DATA_FLOWS.md` och `docs/PRIVACY_SECURITY.md`: använd syntetiska uppgifter och logga eller skicka inte kunddata/hemligheter till externa agenter eller tjänster utan dokumenterad behörighet och bedömning.
- Behandla `businessId` och lokal MCP-adminflagga som POC-begränsningar, inte verifierad tenant-isolering eller fjärrautentisering. Bedöm även indirekt hälsodata.

## Kodkarta

- `src/lib/domain.ts` och `time.ts`: gemensamma bokningsregler, datum och MCP-paginering; `db.ts` och `prisma/`: databas och historiska integritetsregler.
- `src/lib/auth.ts`, `errors.ts`, `http.ts`: lokal session och säkra felgränser. Skicka aldrig råa felobjekt till loggar eller klienter; `DomainError` får bara innehålla godkända statiska meddelanden.
- `src/app/`: webb/admin/HTTP; `src/mcp/`: endast lokal stdio. SDK-valideringsfel kan spegla klientens egen indata; det är inte en fullständig sekretessgräns.
- `tests/`: unit, riktig PostgreSQL-integration och desktop/mobil. Läs `docs/WORKPLAN.md` för aktuell verifiering och `docs/HANDOFF.md` för överlämning. CI ligger i `.github/workflows/verify.yml`, utan publicering.
