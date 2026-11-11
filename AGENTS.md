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

## Produktägarleverans efter varje Epic

- Uppdatera `docs/PROJECT_STATUS.md` med observerbara acceptanskriterier, datum/revision, faktisk testning, delvis/planerat och pilotblockerare. Använd inga uppskattade procenttal.
- Spela in full demo enligt `docs/DEMO.md` när en Epic är klar, inför en överenskommen viktig avstämning eller på uttrycklig begäran. Vanliga QA-/fixomgångar kräver tester och en kort resultatrapport, inte ny inspelning. Ta riktade skärmbilder när en synlig ändring behöver granskas. Detta ändrar inte kraven på automatiska tester.
- Återanvänd senaste relevanta demo med tydlig revision och ange om bilderna är äldre än koden. Nya inspelningar använder separat syntetisk databas; länka lokala artefakter/manifest och håll dem utanför Git.
- Lägg kort svensk rapport i `docs/PRODUCT_OWNER_REPORT.md`: byggt, prova nu, förbättrat, kvarstår och tre nästa mål. Skilj alltid POC/PASS från produktionsklarhet; bevara tidigare Epic-bevis i HANDOFF/VERIFICATION.

## QA-skydd

- Tester får bara använda separat loopback-databas med suffix `_test`/`_demo`; kringgå aldrig `scripts/test-db-guard.mjs`.
- Bevara rate limit, dagstak, idempotenslås och databasens exclusion constraint. Gå via `createBooking`, inte lagringshjälparen.
- Starta HTTP via `npm run dev/start` och socket-wrappern. `TRUST_PROXY_IP=1` kräver matchande socket i TRUSTED_PROXY_IPS och överskrivande proxy; lokal `--admin` är ingen fjärrbehörighet.
- Aktuell resultatlista finns överst i VERIFICATION; historik i bilagan. Licensbegränsningar: `THIRD_PARTY_NOTICES.md`. Prisma 7 är separat framtida arbete enligt `docs/PRISMA_7_PLAN.md`.
- Epic 01 är avslutad. Epic 02 är godkänd enligt `docs/EPIC_02_PLAN.md`: endast lokal syntetisk MCP-bokning. Visa e-post är fortsatt utanför scope. Logout måste återkalla serverraden; idempotenta replays förbrukar ingen budget. Bevara samtliga tre migrationer.
- MCP-subprocesser får samma exporterade DATABASE_URL via mcpEnvironment, inte alla förälderns hemligheter. Kör bara en QA-omgång per miljö; bevara fixture-städningens egen teardown-tid och spårning av egna sessionshashar.
- Repot ska förbli privat. Denna batch får lokala commits, ingen push utan nytt uppdrag.

- Loginspärren måste kontrolleras före lösenordet, även rätt lösenord nekas från spärrad klient. Behåll testet att ingen lösenordskontroll anropas efter spärr. ADMIN_SESSION_VERSION får endast höjas.

- Uppföljning efter 8b83a40: M2/L8 och fyrfältsmatris i CI. Bevara låsordningen idempotens → klient/dag → e-post/dag → anställd/bokningsdag; ta anställdslåset före tillgänglighetskontroll. Nya CI-jobb är inte verifierade på GitHub förrän en godkänd push har körts.
