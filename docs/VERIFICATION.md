# Verifiering – Epic 01 QA fix batch

## Aktuellt resultat, 2026-11-11

Kodrevision: `26ea6171de05fe17ce4d8bd1e4a4d931d9d5bc82`, branch `epic-01-foundation-hardening`, bas `ed1658a`. Efterföljande kodrevision `3b3309df290cb9b3d6e9ec64c16adf51c32516ac` formaterar bara ESLint-config och CSS. Lint, tsc, build och Prettier kördes igen efter den formateringen; fullsvit/demobeteende gäller 26ea617. Dokumentationscommiten följer dessa commits. Endast syntetiska uppgifter. Windows x64, Node 24.16.0, npm 11.13.0, Prisma 6.19.3, Next 16.4.6. **Testad POC, inte produktionsgodkännande.**

| Kommando/kontroll | Faktiskt resultat |
|---|---|
| `npm ci` | PASS, exit 0; `added 461 packages in 1m`. Ren ominstallation från oförändrad låsfil. |
| `npx prisma generate` | PASS, Prisma Client 6.19.3. Första sandboxförsöket stoppades av nedladdningsåtkomst; godkänd omkörning passerade. |
| `npm run db:migrate` | PASS på två nya databaser; båda migrationerna applicerade. Historisk migration oförändrad. |
| `npm run db:seed` | PASS på båda databaserna, två syntetiska tjänster. |
| `npm run lint` | PASS, exit 0, inga lintfel. |
| `npx tsc --noEmit` | PASS, exit 0, ingen diagnostik. |
| `npm test` | PASS: `Test Files 3 passed (3)` / `Tests 14 passed (14)`; slutlig körning 1.18 s. |
| `npm run test:integration` | PASS: `Test Files 3 passed (3)` / `Tests 14 passed (14)`; slutlig körning 8.20 s. |
| `npm run test:e2e` | PASS: `6 passed (15.2s)`, Chromium desktop och Pixel 7-emulering, utvecklingsserver. |
| `npm run build` | PASS: `Compiled successfully in 3.6s`, `Generating static pages (8/8) in 146ms`, exit 0. |
| `npm run demo:record` | PASS: produktionsbygge + `2 passed (25.7s)`, tolv PNG och två WebM. |
| `npm audit --json` | FAIL, exit 1: 3 high, 7 moderate, 10 total. |
| `npm audit --omit=dev --json` | FAIL, exit 1: 3 high, 0 moderate. |
| Extern Prettier 3.6.2 `--check` | PASS: `All matched files use Prettier code style!` på src (inklusive CSS), tests, scripts, TS/MJS-config och seed. ESLint-configens AST är oförändrat; CSS-diff granskad (radbrytningar och inledande nollor). |
| `git diff --check`; jämförelse av gammal migration, package.json och package-lock mot basen | PASS; inget innehåll ändrat i de skyddade filerna. |
| Docker Compose/PostgreSQL 16, GitHub Actions, verklig TLS/proxy/flerprocessdrift | EJ KÖRT. Docker saknas; ingen remote/publicering tillåten. |

## Isolerad miljö och kommandon

En ny PostgreSQL 18.6-instans initierades med UTF-8 i `C:\Users\<user>\booking-lab-pg-test\qa-batch-20261111`, endast `127.0.0.1:55444`. `embedded-postgres@18.6.0-beta.19` är ett befintligt separat lokalt testverktyg, inget npm-beroende i projektet. Databaserna `booking_qa_test` och därefter `booking_qa_demo` skapades tomma, migrerades och seedades. Hela ordinarie sviten kördes mot testdatabasen. Produktionsinspelning och slutlig omkörning av unit/integration/build använde demodatabasen i samma isolerade kluster. Ingen befintlig användardatabas återanvändes. Efter verifieringen stoppades det egna klustret (`pg_ctl status`: `no server running`) och den tillfälliga egna .env-filen togs bort. Klusterfilerna behölls lokalt; ingen användardata raderades.

`NEXT_TELEMETRY_DISABLED=1` och `CHECKPOINT_DISABLE=1` sattes för bygg-/test-/Prisma-processerna. Tillfällig ignorerad `.env` innehöll endast syntetisk lokal konfiguration. Ingen nätverksfångst eller fullständig tredjepartsgranskning gjordes.

Körordning från projektroten (skapa först en ny lokal `*_test` enligt README):

```powershell
$env:NEXT_TELEMETRY_DISABLED='1'
$env:CHECKPOINT_DISABLE='1'
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run lint
npx tsc --noEmit
npm test
npm run test:integration
npm run test:e2e
npm run build
npm audit --json
npm audit --omit=dev --json
# Byt till en separat, ny, migrerad och seedad *_demo:
npm run demo:record
```

Audit-JSON sparades utanför repot i `C:\Users\<user>\booking-lab-pg-test\qa-audit.json` och `qa-audit-runtime.json`. Faktisk metadata för full audit:

```json
{"info":0,"low":0,"moderate":7,"high":3,"critical":0,"total":10}
```

Prisma/config/deepmerge-ts står för de tre höga posterna, ESLint/typescript-eslint/minimatch för de sju måttliga. Det är beroendeposter, inte tio oberoende sårbarheter. Inga major-uppgraderingar, overrides eller `audit fix --force`. Se historisk advisoryanalys nedan och [separat Prisma 7-plan](PRISMA_7_PLAN.md). Audit ligger nu i eget märkt CI-jobb och kommer fortfarande att ge rött; detta döljs inte med `continue-on-error`.

## Vad acceptanstesterna faktiskt bevisar

- Fem felaktiga lösenordsförsök följs av 429 på sjätte/sjunde, statiskt svenskt fel och Retry-After. Tre bokningar per normaliserad e-post och skapandedag i Stockholm; fjärde nekas även med parallella anrop. Bokningsrutten spärrar efter 30 försök per 15 minuter.
- Utloggning visar loginform och efterföljande publicering ger 403. Sessionsversionstest ogiltigförklarar gammal signerad cookie utan byte av SESSION_SECRET.
- 150 syntetiska bokningar ger 100 + 50, korrekt sortering/datumavgränsning över Stockholms 25-timmarsdygn och maskerad e-post. MCP:s negativa datum-/behörighets-/sidtester finns kvar.
- Sekventiellt retry och 20 samtidiga anrop med samma nyckel ger en rad och samma ID; annan payload ger 409. Även 20 parallella HTTP-anrop testas.
- 20 samtidiga bokningar och en separat blandad 30/60-minutersgrupp ger exakt en framgång per konfliktfönster. SQL self-join med `tstzrange &&` hittar noll överlapp. Forcerad exclusion-överträdelse blir DomainError 400 med `Tiden är inte tillgänglig`.
- Verkliga Vitest-/Playwright-konfigurationsstarter med otillåten databas-URL avslutas med non-zero och `TEST_DATABASE_REFUSED` innan testinsamling/serverstart/dataåtkomst. Localhost samt *_test/*_demo krävs, men detta är ingen garanti för att data i en tillåten databas är syntetiska.
- Kampanj med framtida validFrom visas inte före giltighetsdagen. Okänt MCP-fält, för långt (>90 kalenderdagar) eller omvänt intervall avvisas; DB CHECK stoppar omvända datum även vid direkt INSERT.
- Headers kontrolleras på `/`, `/admin`, `/api/services`. Produktionsdemon kontrollerar även HSTS. Browserfel/CSP-blockeringar observeras av flödestestet. Bekräftelsen innehåller tjänst + lokal tid + Europe/Stockholm, och utloggning ingår.

## Faktiska fel under arbetet och rättningar

1. Första unit-körningens gamla sessionsfixture signerade utan version: testet uppdaterades för nya avtalet.
2. Första integrationens 150-radersfixture använde samma personal för en gränsrad och träffade korrekt exclusion constraint: fixture separerades; produktskyddet ändrades inte.
3. Kall desktop-E2E skickade formuläret innan hydration: bokningsval är nu inaktiverade tills React kan hantera formuläret. Därefter 6/6 PASS utan retry eller ökad timeout.
4. Första produktionsdemon startade både dev och prod därför att Playwrights `defineConfig(base, override)` konkatenerar webServer. Ändrat till ett sammansatt config-objekt med en enda prodserver. Därefter 2/2 PASS.
5. `createdb.exe` saknades i den portabla distributionen. Den nya demodatabasen skapades i stället med ett konstant administrativt CREATE DATABASE mot det egna isolerade klustret. Ingen produktkod för detta tillkom.

Vite varnar för framtida native configLoader/ESM, ESLint 9 gav versionsvarning vid installation och Playwright varnar för NO_COLOR/FORCE_COLOR. Dessa varningar kvarstår. Prettier installerades utanför repot: MIT, separat audit 0 sårbarheter. Inga nya projektberoenden.

## Demo, kvarvarande risker och ej körda kontroller

[Produktionsgalleri](../demo-artifacts/2026-11-11T19-51-02-683Z/index.html) och [manifest](../demo-artifacts/2026-11-11T19-51-02-683Z/manifest.json). Manifestet anger basrevision ed1658a + dirty=true: den verifierade arbetskopians kod är nu committad som 26ea617. Artefakterna ändras inte för att låtsas vara inspelade efter commit. Båda videorna kunde läsas i Chromium: 10,88 s (800×450) och 10,60 s (392×800). Två representativa bilder granskades: mobil bekräftelse och desktop admin, utan N-badge; samma SEK-format. Native datumfält syns i testmiljön som MM/DD/YYYY, trots sv-SE-inställningen.

Full svit i produktionsläge har inte körts; produktionsdemon återanvänder de två fullflödestesterna, medan samtliga sex E2E kördes mot dev. Ingen Docker/PostgreSQL 16, extern CI, andra webbläsare än Chromium, verklig reverse proxy/TLS, distribuerat rate limiting, penetrations-/lasttest eller backup/restore har verifierats. Manuell `mcp:client` har inte körts igen i denna batch; riktig stdio-klient används automatiskt i integration och E2E. Simulerat saknat Git är unit-testat, men alla demofelkoder har inte var för sig framkallats. Inget externt repo, deploy eller publicering.

Rate limiter är processlokal och använder gemensam konservativ bucket utan betrodd proxy-IP. CSP tillåter unsafe-inline för Next; ingen nonce-policy. Utloggning raderar browsercookien, inte en redan stulen kopia; höj ADMIN_SESSION_VERSION och starta om alla processer för global återkallelse. Individuella konton, gallring, flerföretagsisolering och drift-/GDPR-beslut återstår. Se [PRIVACY_SECURITY](PRIVACY_SECURITY.md).

## Bilaga – tidigare verifieringar (historik, inte aktuell status)

Följande tidigare resultat bevaras för spårbarhet. Deras äldre kommandon, databasnamn och begränsningar gäller respektive dåvarande revision.

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

## Epic 01 – 2026-11-11

Aktuell kommandotabell, fel och omkörningar finns i [WORKPLAN.md](WORKPLAN.md). Ren npm ci, Prisma generate/migrate/seed, 8 unit + 8 integration + 4 Playwright, lint, TypeScript och build passerade på ny isolerad PostgreSQL 18.6. Docker Compose och GitHub-workflowen har inte körts här. Den historiska 30-sekundersgränsen gav timeout igen; trace visade även långsam browser-fixture. Ordinarie 60 sekunder passerade med varm och tom Next-cache. Ett fel i det nya testets råa JSON-payload rättades innan slutlig PASS.

### Uppdaterad beroendebedömning

`npm audit --json` och `npm audit --omit=dev --json` gav exit 1 med 3 höga + 7 måttliga respektive 3 höga. Registrykontroll: `npm view prisma@6 version --json` slutar på 6.19.3; @prisma/config@6.19.3 kräver exakt deepmerge-ts 7.1.5. typescript-eslint latest är 8.72.2; typescript-estree kräver minimatch ^10.2.2 och senaste 10.x är 10.2.6. Ingen patch/minor-lösning identifierades.

- [Deepmerge-advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): rättad från 8.0.0, kräver cykliska objektgrafer; vanlig JSON skapar inte sådana. Prisma-konfigurationskedjan är berörd, inte någon verifierad väg från bokningsformuläret. CLI finns även i omit=dev-trädet via klienten; runtime-installationen är alltså inte audit-ren. npm föreslår Prisma 7.10.1, en separat ORM-/driver-/konfigurationsmigrering, inte en säker POC-patch.
- [Minimatch-advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249): rättad i 11.0.1; angriparstyrda glob-mönster kan förbruka resurser vid optimizationLevel >=2. Kedjan används av ESLint/TypeScript ESLint, inte som applikationsfunktion. Ingen fjärrväg har verifierats. En major-override skulle åsidosätta upstream-kontraktet och behöver separat verifiering.

Registry anger BSD-3-Clause för deepmerge-ts 8 och BlueOak-1.0.0 för minimatch 11.0.1. Metadata är inte klarering av faktiska artefakter. Ingen av versionerna infördes och projektlicensen ändrades inte. Kör endast verktygen på betrodd kod/konfiguration; använd inte POC:n publikt eller med riktiga uppgifter. Följ upp upstream-backport eller planera testad Prisma-/lintmigrering före pilot. Risken är dokumenterad, inte eliminerad eller accepterad för produktion.

CI använder officiella [checkout](https://github.com/actions/checkout) och [setup-node](https://github.com/actions/setup-node), båda MIT enligt projekten, låsta till kontrollerade v6-revisioner. Syftet är reproducerbar installation/Compose/testning utan nya npm-paket. GitHub-körning, runnerkompatibilitet och Compose måste verifieras när publicering senare tillåts. Audit är ett felande slutsteg, inte dolt med continue-on-error.

## Visual Progress & Demo Delivery – 2026-11-11

Basrevision `6535b596c4a7be56f091d0d20e88390238dc8caf`, med ocommittad demo-/dokumentationsinstrumentering under körningen (redovisas i manifest). Ingen produktkod eller beroendeversion ändrades. Startläget var rent. Ny lokal PostgreSQL 18.6, databas booking_visual_demo på 127.0.0.1:55443, skapades med tidigare befintligt separat testverktyg. Migration/seed PASS. Docker/Compose är fortfarande ej testat.

| Kommando/kontroll | Resultat |
|---|---|
| npm run demo:record | Slutlig PASS 2/2, desktop/mobil, 26,6 s |
| npm test | PASS 8/8 |
| npm run test:integration | PASS 8/8 |
| npm run test:e2e | PASS 4/4, 10,6 s |
| npm run lint | PASS |
| npm run build | PASS |
| npx tsc --noEmit | PASS |
| git diff --check | PASS |
| Demons preflight | PASS: fjärrvärd, fel databasnamn och befintligt syntetiskt utkast avvisades |
| Bild/video | 12 PNG och 2 WebM; Chromium läste videometadata: 10,00 s/800×450 och 10,16 s/392×800. Admin desktop och publicerat erbjudande mobil granskades visuellt |
| npm ci / npm audit | Ej omkörda: paketversioner/låsfil oförändrade; tidigare Epic-resultat gäller som historik |

Försök 1: FAIL, grep var felaktigt förankrat och hittade inga tester. Rättat. Försök 2: desktop PASS, mobil FAIL; Playwrights tillfälliga caret-stil för screenshot observerades i React hydration-varning, och en icke-exakt textsökning matchade även dev-overlay. Åtgärd: screenshot med caret initial och exakt bekräftelsetext. Försök 3: PASS på båda enheterna utan observerad hydration-varning. Produktkoden ändrades inte. Misslyckade artefakter är märkta FAIL och ska inte förväxlas med slutleveransen.

Slutlig [lokal demo](../demo-artifacts/2026-11-11T17-17-11-326Z/index.html) och [manifest](../demo-artifacts/2026-11-11T17-17-11-326Z/manifest.json). Endast syntetiska uppgifter; inspelningarna saknar ljud. Trace är avstängt i demo för att undvika request-/sessionsdata i artefakter. Bilder/video är Git-ignorerade och har inte publicerats. Manuell reproduktion finns i DEMO.md. Observerad UX-begränsning: datumfältets placeholder är mm/dd/yyyy även med sv-SE; admin är en enkel agenda. Verifierad demo innebär inte produktionsberedskap.

Efter körningen stoppades testdatabasen (pg_ctl: no server running) och hjälpprocessen. Den egen skapade tillfälliga .env togs bort. Kluster och demoartefakter finns kvar lokalt; ingen automatisk gallring görs.
