# booking-lab-se

En liten lokal, svensk boknings-POC för en fiktiv salong. Next.js, TypeScript, PostgreSQL/Prisma och lokal MCP över stdio. Endast syntetiska uppgifter. **Inte för produktion eller riktiga kunder.**

För produktägaren: [projektstatus och acceptanskriterier](docs/PROJECT_STATUS.md), [prova/spela in demo](docs/DEMO.md) och [senaste produktägarrapport](docs/PRODUCT_OWNER_REPORT.md). `npm run demo:record` skapar lokala bilder och video med befintliga Playwright-verktyg; ingen extern publicering.

## Starta lokalt

Förutsättningar: Node.js 22.12 eller senare (alternativt 24 eller senare), npm och Docker med Compose. Port 5432 och 3000 måste vara lediga. I projektkatalogen:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Redigera .env: välj ADMIN_PASSWORD (minst 12 tecken) och SESSION_SECRET (minst 32 slumpmässiga tecken).
docker compose up -d --wait
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run dev
```

Öppna http://localhost:3000 och välj en vardag inom 60 dagar. Salongen har öppet måndag–fredag 09–17 i Europe/Stockholm, en anställd och tider på halvtimmar. Logga in via `/admin` med lösenordet i `.env`. Seeds kan köras igen utan att radera bokningar. För en egen Postgres-instans, ändra `DATABASE_URL` i `.env`; databasanvändaren måste kunna skapa extensionen `btree_gist`. Ett verifierat alternativ utan Docker beskrivs i [verifieringsrapporten](docs/VERIFICATION.md). Compose-lösenordet är endast avsett för lokal demo. Stoppa databasen med `docker compose stop`; volymen sparas.

## MCP

En betrodd lokal MCP-klient kan starta `node --env-file=.env --import tsx src/mcp/server.ts` i projektkatalogen. Standardläget erbjuder `list_services` och `get_availability`. Administratören kan uttryckligen lägga till argumentet `--admin`; då tillkommer `list_bookings` och `create_campaign_draft`. Ge endast betrodda lokala klienter adminläget: flaggan är en lokal behörighetsgräns, inte säker fjärrautentisering. Servern lyssnar inte på något nätverksuttag. Utkastet publiceras manuellt i administrationen.

Prova med den medföljande klienten:

```powershell
npm run mcp:client
npm run mcp:client -- --admin
```

`list_bookings` i adminläge kräver nu `from` och `to` som inkluderande datum `YYYY-MM-DD` i Europe/Stockholm, högst 31 kalenderdagar. `limit` är valfri (standard 20, max 100) och `cursor` är valfri. Exempel på argument:

```json
{ "from": "2026-11-16", "to": "2026-11-22", "limit": 20 }
```

Svaret har `bookings` och `nextCursor`. Varje bokning innehåller bara `id`, `startsAt`, `endsAt` och tjänstens `id`/`name`, aldrig kundnamn eller e-post. Använd `nextCursor` som `cursor` med samma datumintervall för nästa sida; `null` betyder sista sidan. Endast bokningar vars **start** ligger inom datumintervallet räknas. Tiderna i svaret är UTC. Sidmarkören måste fortfarande finnas i den aktuella verksamheten och intervallet; om den tagits bort får klienten börja om. Pagineringen ger ingen fryst ögonblicksbild vid samtidiga ändringar. ID, tid och tjänst kan fortfarande vara personuppgifter.

Detta är en avsiktlig brytande ändring: tidigare `list_bookings` utan argument och fullständiga kundposter fungerar inte längre. Ingen funktion för utlämning av kunduppgifter finns i MCP. `--admin` är fortsatt bara ett lokalt förtroendeläge, inte fjärrautentisering.

Det andra kommandot skapar ett riktigt utkast i demodatabasen. MCP använder strukturerade argument, exempelvis `serviceId: "fotvard"`, `discountPercent: 20`, `validFrom: "2026-11-16"` och `validUntil: "2026-11-22"`. Agenten ansvarar för att tolka exempelvis ”nästa vecka” till datum; servern validerar fälten och publicerar aldrig automatiskt.

## Kontrollera

```powershell
npm run lint
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
```

Integration och Playwright kräver en migrerad, seedad separat databas och `.env`. Testgrinden tillåter bara localhost/127.0.0.1/::1 och databasnamn som slutar med `_test` eller `_demo`; testerna skapar och tar bort sina egna syntetiska poster. Kör aldrig testerna mot produktionsdata. E2E startar en lokal Next-server på port 3000. Integrationstestet provar konkurrerande förfrågningar och en direkt insättning mot databasspärren. Enhetstester täcker sommartid/vintertid och datumvalidering.

## Avgränsningar

Admininloggningen är en minimal lokal lösning med socketbaserad processlokal spärr, serveråterkallad logout och global sessionsversion, men utan individuella konton, återställning eller revisionslogg. Endast stdio-processens ägare bestämmer MCP-adminläget. Delade cookies, tenant-isolering, HTTPS, säker konfiguration, missbruksskydd, tillgänglighet, integritet och säkerhetsgranskning krävs inför verklig drift. Den signerade cookien kräver HTTPS i `NODE_ENV=production`; kör `npm run dev` för lokalt HTTP. Pris och erbjudande är information, ingen debitering. Översättningsförberedelsen är begränsad: några texter ligger i `src/lib/i18n.ts`, men flertalet är ännu svenska i komponenterna. Kalendern är en kronologisk agenda, inte en fullständig veckovy.

[Omfattning](docs/POC_SCOPE.md) · [Arkitektur](docs/ARCHITECTURE.md) · [Tekniska principer](docs/ENGINEERING_PRINCIPLES.md) · [Underhållsgranskning](docs/MAINTENANCE_REVIEW.md) · [Licens- och projektgranskning](docs/OPEN_SOURCE_REVIEW.md) · [Verifiering](docs/VERIFICATION.md) · [Bidra](CONTRIBUTING.md)

Projektets egen kod är AGPL-3.0-only, se [LICENSE](LICENSE). Paket och tillgångar har egna licenser. Före distribution eller nätverksdrift måste licensuppfyllelse och ett fungerande erbjudande om motsvarande källkod för den körda versionen ordnas; se granskningen.

## Aktuell verifiering – Epic 01 QA batch 2, 2026-11-11

Kod `a84e48a`, bas `b000481`, branch `epic-01-foundation-hardening`. Punkterna 1–5 och 7–11 genomförda; punkt 6 (Visa e-post) uttryckligen undantagen. Ingen Epic 02 eller push. Ren installation, Prisma på nya databaser, lint/tsc/build, 20 unit och 16 integration PASS. Åtta E2E passerar i fyra kombinationer: dev/prod × direkt/betrodd proxy. Produktionsdemo 2/2 PASS från ren commit. [Kommandon och felhistorik](docs/VERIFICATION.md).

Audit kvar FAIL: tre höga i Prisma/config/deepmerge-ts, sju måttliga i ESLint-kedjan. Inga nya paket eller major-uppgraderingar; låsfilen är oförändrad. [Separat Prisma 7-plan](docs/PRISMA_7_PLAN.md). Docker, extern CI och verklig TLS/proxydrift har inte körts/verifierats i denna batch.

## HTTP-start och betrodda proxyadresser

`npm run dev` och `npm run start` använder `scripts/server.mjs`, en liten Node-startpunkt runt samma Next-app. Den läser socketens remoteAddress och skriver över interna, signerade adressheaders. Nexts route-objekt exponerar inte socketadressen. **Använd dessa npm-kommandon, inte direkt next dev/next start.** Utan verifierad intern adress nekas bokning/login; ingen global reservbucket finns. Produktionsläget använder kompilerad Next med dev:false. Ingen extra tjänst eller npm-dependency.

TRUST_PROXY_IP=0 är standard: verklig socketadress används och X-Real-IP ignoreras. TRUST_PROXY_IP=1 kräver TRUSTED_PROXY_IPS, en kommaseparerad IP/CIDR-lista. Saknad/ogiltig lista stoppar starten. X-Real-IP används bara när anslutande socket matchar listan. Proxyn måste själv skriva över headern med faktisk klientadress. Lista aldrig hela internet eller vanliga klientnät som betrodda. Testerna simulerar proxy med en separat verklig loopback-källadress, 127.0.0.10/32; detta är ingen driftskonfiguration. BOOKING_ADDRESS_SECRET genereras internt vid start och ska inte konfigureras eller delas.

Fem felaktiga login per adress/15 minuter, med 100–500 ms progressiv asynkron fördröjning; sjätte misslyckandet ger 429. Korrekt lösenord får logga in även efter andras fel från samma NAT-adress. Bokningsförsök begränsas till 30 per adress/15 minuter. Vid 10 000 buckets evikteras äldsta posten i stället för att spärra nya klienter. Räknarna är processlokala; omstart och flera processer kräver andra driftkontroller.

## Bokning, sessioner och kampanjer

- Tre nya bokningar per e-postnyckel och skapandedag i Stockholm. Nyckeln använder gemener utan +tagg; kontaktadressen behåller taggen. Detta är en POC-regel, inte universell e-postidentitet. Inga leverantörsspecifika punktregler eller e-postverifiering.
- Fem nya bokningar per verifierad klientadress och skapandedag, även med olika e-postadresser. HMAC lagras som clientKey, inte rå IP. Transaktionslås säkrar båda taken. Användare bakom samma NAT delar taket; olika IP kan kringgå det. Det är inte pilotsäkert identitetsskydd.
- Valfri Idempotency-Key, 1–64 tecken [A-Za-z0-9_-]. Samma nyckel/payload ger ursprunglig 201/ID utan att förbruka försöksbudget eller dagstak. Annan payload ger 409 och räknas som försök. UI återanvänder UUID vid retry/dubbelsubmit för samma payload, men nyckeln överlever inte sidomladdning. Servernycklar lever med bokningen.
- Logout sätter revokedAt i AdminSession innan cookien raderas. Kopierad cookie nekas efter logout. DB lagrar tokenhash och skapande/utgång/återkallelsetid. Gamla cookies slutar fungera. ADMIN_SESSION_VERSION är global kill switch: höj och starta om alla instanser; återanvänd inte gamla värden. Konton och sessionsgallring saknas.
- Admin visar idag till idag+14 inklusive, max 31 dagar/100 rader per sida. Felaktiga datumfilter ger svensk text och standardintervall, inte 500. E-post förblir maskerad. Datum anges YYYY-MM-DD i textfält med validering; kalenderpopupen är ersatt.
- Kampanjer visas endast inom giltiga Stockholmsdatum, högst 90 inkluderande kalenderdagar. Omvända datum och för lång period har olika meddelanden. **100 % rabatt tillåts** i informations-POC:n; ingen betalning/debitering görs. Kommersiella regler måste beslutas före pilot.

## Reproducera testerna

Skapa en ny lokal *_test-databas, exempelvis med `docker compose exec db createdb -U booking booking_lab_test`, och peka lokal .env på den. Bevara befintliga databaser. Alternativet är separat lokal PostgreSQL; denna körning använde PostgreSQL 18.6. Kör npm ci, prisma generate, migration och seed enligt startanvisningen.

```powershell
$env:NEXT_TELEMETRY_DISABLED='1'
$env:CHECKPOINT_DISABLE='1'
npm run lint
npx tsc --noEmit
npm test
npm run test:integration
$env:TRUST_PROXY_IP='0'
npm run test:e2e
$env:TRUST_PROXY_IP='1'
npm run test:e2e
npm run build
$env:E2E_PRODUCTION='1'
$env:TRUST_PROXY_IP='0'
npm run test:e2e
$env:TRUST_PROXY_IP='1'
npm run test:e2e
Remove-Item Env:E2E_PRODUCTION
Remove-Item Env:TRUST_PROXY_IP
node --env-file=.env scripts/test-cleanup.mjs
npm audit
```

Alternativt `npm run test:e2e:production` bygger och kör hela produktionssviten. Cleanup-proben framkallar avsiktlig timeout i separat Playwright och godkänner endast förväntad exit 1 plus noll kvarvarande syntetiska bokningar/kampanjer. Kör bara en QA-omgång i taget mot samma miljö/port. Fixture-städning klarar timeout när DB är tillgänglig, inte processkill, strömavbrott eller DB-avbrott.

MCP-klienter skickar explicit förälderns DATABASE_URL; exporterad miljö vinner över env-filen. Ett integrationstest pekar env-filen på en annan oanvändbar databas och bevisar att utkastet hamnar i exporterad testdatabas.

[Tredjepartsnotiser](THIRD_PARTY_NOTICES.md) · [Datakarta](docs/DATA_FLOWS.md) · [Handoff](docs/HANDOFF.md)
