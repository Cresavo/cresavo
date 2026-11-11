# Lokal verifiering 2026-11-11

Verifierat på Windows x64 med Node 24.16.0 och npm 11.13.0. Docker, Podman och vanlig PostgreSQL-installation fanns inte tillgängliga. Testerna kördes i stället mot en **ny separat PostgreSQL 18.6-instans**, skapad med `embedded-postgres@18.6.0-beta.19` utanför projektet. Instansen använde UTF-8 och lyssnade endast på `127.0.0.1:55439`. En tillfällig ignorerad `.env` pekade på en ny tom testdatabas. Databasen stoppades och `.env` togs bort efter verifieringen. Detta verifierar PostgreSQL-alternativet, inte Docker Compose-konfigurationen.

| Kontroll | Resultat |
|---|---|
| `npm ci` | PASS; ren ominstallation från låsfilen. |
| `npx prisma generate` | PASS. |
| `npm run db:migrate` | PASS på den nya databasen. |
| `npm run db:seed` | PASS. |
| `npm run lint` | PASS. |
| `npm test` | PASS, 3 enhetstester. |
| `npm run test:integration` | PASS, 3 integrationstester, inklusive samtidiga bokningsförsök och direkt kontroll av databasens överlappsspärr. |
| `npm run mcp:client -- --admin` | PASS; listade behandlingar, hämtade tillgänglighet och skapade utkast. |
| `npm run test:e2e` | Första körningen: FAIL för desktop, 30 sekunders timeout vid `page.goto`; mobil PASS. Efter att testets timeout ökats till 60 sekunder: PASS för både desktop och mobil. Orsaken till den första fördröjningen är inte fastställd. |
| `npm run build` | PASS, inklusive TypeScript-kontroll. |
| `npm audit` | FAIL (exit 1): 3 höga och 7 måttliga beroendeposter; se nedan. |
| `npm audit --omit=dev` | FAIL (exit 1): 3 höga poster i Prisma-kedjan. |
| Docker Compose / PostgreSQL 16 | EJ VERIFIERAT: Docker saknas på värden. |

`npm ci` och Vitest gav varningar om stödet för ESLint 9 respektive framtida Vite-konfigurationsladdning. De påverkade inte testresultaten men bör följas upp.

## Alternativ utan Docker

En vanlig lokal PostgreSQL-server kan användas. Skapa en **ny tom databas**, exempelvis `createdb -h 127.0.0.1 -U postgres booking_lab_verify`, och konfigurera `DATABASE_URL` i en lokal `.env` med en användare som har rätt att köra migrationen och skapa `btree_gist`. Kör sedan `npm ci`, `npx prisma generate`, `npm run db:migrate`, `npm run db:seed` och `npm run dev` enligt README. Använd aldrig produktionsdatabasen för testerna. Detta alternativ med vanlig PostgreSQL-installation har inte testats på just denna värd.

Den faktiskt använda alternativa testmiljön byggde på `embedded-postgres@18.6.0-beta.19` installerat i en separat katalog utanför projektet. En ny katalog för dataklustret initierades med UTF-8, PostgreSQL startades bundet till `127.0.0.1` på port 55439 och en ny databas skapades med paketets `createDatabase`-API. Paketet är ett separat testverktyg, inte ett projektberoende eller del av ZIP-leveransen. Använd en ny katalog och ledig port om metoden upprepas; återanvänd eller radera inte befintliga datakluster av misstag.

## Beroendegranskning

Audit-resultatet räknar påverkade paket i beroendekedjor, inte tio oberoende sårbarheter:

- **Hög:** `prisma@6.19.3` → `@prisma/config@6.19.3` → `deepmerge-ts@7.1.5`. [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) gäller stackutmattning när särskilda rekursiva objektgrafer slås ihop; vanlig JSON skapar inte sådana cykler. Den installerade Prisma-konfigurationskoden laddar paketet vid hantering av konfiguration. Det har inte visats att webbens användarindata når den vägen. Auditens föreslagna fix är Prisma 7.10.1, en major-uppgradering som kräver en separat migrering och tester. `--omit=dev` rapporterar också kedjan eftersom `@prisma/client` kan dra in Prisma; anta inte att produktionsinstallation automatiskt saknar den.
- **Måttlig:** `eslint-config-next` → `typescript-eslint@8.72.2` → `@typescript-eslint/typescript-estree` → `minimatch@10.2.6`. [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) beskriver resursutmattning med ett angriparstyrt glob-mönster och vissa inställningar. Kedjan används i utvecklings-/lintverktyg; ingen extern angreppsväg till applikationen har verifierats. Vid kontrollen deklarerade aktuell `typescript-estree` fortfarande `minimatch ^10.2.2`, medan rådgivningen anger 11.0.1 som korrigerad version. Även om npm anger att en automatisk fix finns har en fungerande semver-kompatibel lösning inte verifierats här.

Inga automatiska major-uppgraderingar eller overrides gjordes. Kör inte utvecklingsverktyg på opålitlig kod eller konfiguration, och gör en separat uppgradering med riskbedömning och ny fullständig testning. POC:n är inte produktionssäker.

## Git och sekretess

Den första lokala commiten skapades efter att `.gitignore` utökats och en riktad sökning efter vanliga tokenformat, privata nycklar och anslutningssträngar bland 48 källfiler inte gav några träffar. Sökningen är inte en garanti för att alla slags hemligheter eller personuppgifter upptäcks. Endast syntetiska testdata har avsiktligt använts. Ingen remote eller extern publicering skapades.

## Underhållsgranskning 2026-11-11

Efter kod- och beroendestädningen verifierades projektet på Windows med Node 24.16.0 mot en ny, isolerad lokal PostgreSQL 18.6-databas. Den historiska migrationen applicerades och demodata seedades; Docker Compose verifierades inte.

| Kommando/kontroll | Resultat |
|---|---|
| `npm ci` | PASS; låsfilen accepterades. npm rapporterade fortfarande 3 höga och 7 måttliga auditposter samt en ESLint-varning. |
| `npx prisma validate` | PASS. |
| `npm run db:migrate`, `npm run db:seed` | PASS på den nya testdatabasen. |
| `npm run lint` | PASS. |
| `npm test` | PASS, 3 tester; Vite gav en konfigurationsvarning. |
| `npm run test:integration` | Första körningen FAIL eftersom `npm ci` hade ersatt Prisma-klienten och `prisma generate` ännu inte körts. Efter `npx prisma generate`: PASS, 3 tester. |
| `npm run test:e2e` | PASS, 2 körningar: desktop och mobil. |
| `npm run build` | PASS, inklusive TypeScript-kontroll. |
| TypeScript AST-jämförelse | PASS: `src/lib/domain.ts` och `src/lib/auth.ts` har samma syntaxträd som före läsbarhetsändringarna. |
| Manuell Chromium-kontroll | PASS för HTTP 200, rubrik, två tjänster och inga observerade konsol- eller nätverksfel. En skärmbild sparades utanför repot; datumfältets lokaliseringsfynd beskrivs i underhållsgranskningen. |

E2E-testet följde bokningssida → tillgänglighet och boknings-API → PostgreSQL → administrationsagenda samt MCP-utkast → publicering → bokningssida. Testerna använde syntetiska uppgifter. Den tillfälliga `.env`-filen togs bort och testdatabasen stoppades efteråt. Resultaten innebär inte att POC:n är produktionssäker.

## MCP-dataminimering 2026-11-11

På Windows med Node 24 och en ny separat lokal PostgreSQL 18.6-databas kördes migration och seedning med enbart syntetiska uppgifter. `npm run lint`, `npm test` (3 tester), `npm run test:integration` (6 tester), `npx tsc --noEmit`, `npm run test:e2e` (desktop och mobil) och `npm run build` passerade. Next.js-telemetri var avstängd för E2E och build genom processvariabel; Prisma checkpoint var avstängd vid migration. Vitest gav sin befintliga varning om framtida Vite-konfigurationsladdning. Docker Compose har inte verifierats.

Integrationstesterna använder den lokala MCP-protokollklienten och 105 syntetiska bokningar. De täcker avsaknad av adminverktyg utan `--admin`, krav på giltiga datum, 31-dagarsgräns, avvisande av för stor sida och extra fält, sidstorlekar och fortsättningsmarkörer, sortering vid lika starttider, datumgränser kring sommartid och frånvaro av kundnamn/e-post i svaret. Testerna kontrollerar nuvarande `demo`-filter men bevisar inte fullständig tenant-isolering. Boknings- och webbflödet kontrollerades också med befintliga integrationstester och Playwright.
